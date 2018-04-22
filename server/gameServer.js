var util = require('util')
var path = require('path')
express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http, {origins:'localhost:* 192.168.*.*:* http://chrislhall.net:* http://www.chrislhall.net:* '})
var uuidv4 = require('uuid/v4')

var Player = require('../common/Player')
var Collectible = require('../common/Collectible')
var CommonUtil = require('../common/CommonUtil')
var kii = require('kii-cloud-sdk').create()
var KiiServerCreds = require('./KiiServerCreds')()
const readline = require('readline')
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var port = process.env.PORT || 5050

var players	// Array of connected players
var collectibles
var currentPlanetIdx = 0 // checking for modified planets
var map

/* ************************************************
** GAME INITIALISATION
************************************************ */

app.use(express.static(path.resolve(__dirname, '../build')))
http.listen(port, function (err) {
  if (err) {
    throw err
  }
  console.log("Started on port " + port)
  init()
})

rl.on('line', (input) => {
  console.log("Command input: " + input);
  if (input === "quit") {
    process.exit(0)
  } else if (input === "replant") {
    DEBUGReplant()
  }
});

function init () {
  players = []
  collectibles = []
  generateNewMap()
  spawnCollectibles()
  // Start listening for events
  setEventHandlers()
  setInterval(tick, 1000)
}

const PATROL_DIST = 80
function tick() {
  // move critters, countdown

  for (var i = 0; i < collectibles.length; i++) {
    var c = collectibles[i]
    var updated = false
    if (Collectible.COLLECTIBLES[c.type].isCritter && Math.random() < .5) {
      c.gotoX = c.patrolX + (-.5 + Math.random()) * PATROL_DIST
      c.gotoY = c.patrolY + (-.5 + Math.random()) * PATROL_DIST
      updated = true
    }
    // check for pickups whose player has left
    if (c.playerCarryingID !== "") {
      var p = playerByID(c.playerCarryingID)
      if (!p) {
        console.log("The player carrying " + c.toString() + " is gone.")
        c.playerCarryingID = ""
        updated = true
      }
    }
    if (updated) {
      io.emit("update collectible", c.getData())
    }
  }
}

function DEBUGReplant () {
}

function generateNewMap() {
  // map is 5x7
  // 2 is grass, 3 is sand, 4 is swamp
  // 1 is farm (always in the middle)
  // 0 is void
  map = []
  for (var row = 0; row < 7; row++) {
    var rowList = []
    for (var col = 0; col < 5; col++) {
      var tile = Math.floor(2 + Math.random() * 3)
      if (row === 3 && col === 2) {
        tile = 1
      }
      rowList.push(tile)
    }
    console.log(rowList.toString())
    map.push(rowList)
  }
}

var CRITTERS_PER_TILE = 0 // 3
var PLANTS_PER_TILE = 1 // 8
function spawnCollectibles() {
  for (var row = 0; row < 7; row++) {
    for (var col = 0; col < 5; col++) {
      var onThisTile = 0
      if (row === 3 && col === 2) {
        // nothin
      } else {
        for (var i = 0; i < CRITTERS_PER_TILE; i++) {
          // TODO list of colls that are critters and in the right habitat
          var x = Collectible.TILES_START_X + (col + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          var y = Collectible.TILES_START_Y + (row + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          collectibles.push(new Collectible(uuidv4(), "critter_butterfly", x, y))
        }
        for (var i = 0; i < PLANTS_PER_TILE; i++) {
          // TODO list of colls that are plants and in the right habitat
          var x = Collectible.TILES_START_X + (col + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          var y = Collectible.TILES_START_Y + (row + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          collectibles.push(new Collectible(uuidv4(), "plant_radish", x, y))
        }
      }
    }
  }
  io.emit('spawn collectibles', getCollectiblesData())
}

function getCollectiblesData() {
  var data = { collectibles: [] }
  for (var i = 0; i < collectibles.length; i++) {
    data.collectibles.push(collectibles[i].getData())
  }
  return data
}

function despawnCollectibles(doSend, includeFarmTile, specificTile) {
  if (specificTile) {

  } else {
    for (var row = 0; row < 7; row++) {
      for (var col = 0; col < 5; col++) {
        if (!(row === 3 && col === 2) || includeFarmTile) {
          // TODO actually do it
        }
      }
    }
  }
}

/* ************************************************
** GAME EVENT HANDLERS
************************************************ */
function setEventHandlers () {
  // Socket.IO
  io.on('connection', onSocketConnection)
}

// New socket connection
function onSocketConnection (client) {
  console.log('New player has connected: ' + client.id)

  // Listen for client disconnected
  client.on('disconnect', onClientDisconnect)

  // Listen for new player message
  client.on('new player', onNewPlayer)

  // Listen for move player message
  client.on('move player', onMovePlayer)

  client.on("try pickup", onTryPickup)
  client.on('shout', onShout)
  // TEMP chat
  client.on('chat message', onReceiveChat)
}

// Socket client has disconnected
function onClientDisconnect () {
  var removePlayer = playerBySocket(this)

  // Player not found
  if (null == removePlayer) {
    console.log('Player not found for connection: ' + this.id)
    return
  }

  // Remove player from players array
  players.splice(players.indexOf(removePlayer), 1)

  // Broadcast removed player to connected socket clients
  this.broadcast.emit('remove player', {playerID: removePlayer.playerID})
}

// New player has joined
function onNewPlayer (data) {
  var newPlayerID
  if (data.preferredID == null) {
    newPlayerID = this.id // get player ID from original connection ID
  } else {
    newPlayerID = data.preferredID
  }
  console.log("playerID of new player: " + newPlayerID)
  // Create a new player
  var newPlayer = new Player(data.x, data.y, newPlayerID, this)

  this.emit('confirm id', {playerID: newPlayer.playerID})
  this.emit('update map', {map: map})
  // Broadcast new player to other connected socket clients
  this.broadcast.emit('new player', {playerID: newPlayer.playerID, x: newPlayer.x, y: newPlayer.y})

  // Send existing players to the new player
  var i, existingPlayer
  for (i = 0; i < players.length; i++) {
    existingPlayer = players[i]
    if (existingPlayer.playerID == newPlayer.playerID) {
      // boot duplicate player
      existingPlayer.socket.disconnect()
      players.splice(i, 1)
      i--
    } else {
      this.emit('new player', {playerID: existingPlayer.playerID, x: existingPlayer.x, y: existingPlayer.y})
    }
  }

  // Add new player to the players array after duplicates have been removed
  players.push(newPlayer)

  this.emit('spawn collectibles', getCollectiblesData())
}

// Player has moved
function onMovePlayer (data) {
  var movePlayer = playerBySocket(this)

  // Player not found
  if (null == movePlayer) {
    console.log('Player not found for connection: ' + this.id)
    return
  }

  // Update player position
  movePlayer.x = data.x
  movePlayer.y = data.y
  movePlayer.angle = data.angle

  // Broadcast updated position to connected socket clients
  this.broadcast.emit('move player', {playerID: movePlayer.playerID, x: movePlayer.x, y: movePlayer.y, angle: movePlayer.angle})
}

function onTryPickup(data) {
  var movePlayer = playerBySocket(this)

  // Player not found
  if (null == movePlayer) {
    console.log('Player not found for connection: ' + this.id)
    return
  }

  var c = collectibleByID(data.itemID)
  if (c && c.playerCarryingID === "" && movePlayer.carryingItemID === "") {
    c.playerCarryingID = movePlayer.playerID
    movePlayer.carryingItemID = c.itemID
    io.emit("update collectible", c.getData())
    console.log("Player " + movePlayer.playerID + " picking up " + c.toString())
  }
}

function onShout (data) {
  io.emit("shout", data)
}

function onReceiveChat (msg) {
  var text = "" + this.id + ": " + msg
  console.log(text)
  io.emit("chat message", text)
}

/* ************************************************
** GAME HELPER FUNCTIONS
************************************************ */
// Find player by ID....maybe no need?
function playerByID (playerID) {
  var i
  for (i = 0; i < players.length; i++) {
    if (players[i].playerID === playerID) {
      return players[i]
    }
  }
  return null
}

function playerBySocket (socket) {
  var i
  for (i = 0; i < players.length; i++) {
    if (players[i].socket === socket) {
      return players[i]
    }
  }
  return null
}

function collectibleByID (itemID) {
  for (var i = 0; i < collectibles.length; i++) {
    if (collectibles[i].itemID === itemID) {
      return collectibles[i]
    }
  }
  return null
}
