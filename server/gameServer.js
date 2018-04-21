var util = require('util')
var path = require('path')
express = require('express')
var app = express()
var http = require('http').Server(app)
var io = require('socket.io')(http, {origins:'localhost:* 192.168.*.*:* http://chrislhall.net:* http://www.chrislhall.net:* http://chrislhall.net/bees http://www.chrislhall.net/bees'})
var uuidv4 = require('uuid/v4')

var Player = require('../common/Player')
var Planet = require('../common/Planet')
var Cactus = require('../common/Cactus')
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
var planets // Array of planets
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
  generateNewMap()
  // Start listening for events
  setEventHandlers()
  setInterval(tick, 500)
}

function tick() {
  //io.emit('server tick', {serverTicks: metadata["serverticks"]})

  growPlants()
}

// Process the map
function growPlants () {
  /*
  for (var planetIdx = 0; planetIdx < planets.length; planetIdx++){
    var planet = planets[planetIdx]
    var planetSlots = planet.info.slots
    var changed = false
    for (var slotIdx = 0; slotIdx < 6; slotIdx++) {
      var slot = planetSlots[slotIdx]
      var age = metadata["serverticks"] - slot.birthTick
      if (slot.type === "empty" && age > 20 && Math.random() < .05) {
        slot.type = "cactus1"
        slot.birthTick = metadata["serverticks"]
        changed = true
      } else if (slot.type.startsWith("cactus") && age > 50 && Math.random() < .05) {
        slot.type = "empty"
        slot.birthTick = metadata["serverticks"]
        changed = true
      }
    }
    if (changed) {
      setPlanetInfo(planet.kiiObj, planet, planet.planetID, planet.info)
    }
  }
  */
}

function DEBUGReplant () {
  for (var planetIdx = 0; planetIdx < planets.length; planetIdx++){
    var planet = planets[planetIdx]
    var planetSlots = planet.info.slots
    for (var slotIdx = 0; slotIdx < 6; slotIdx++) {
      planetSlots[slotIdx].type = "cactus1"
      planetSlots[slotIdx].birthTick = metadata["serverticks"]
    }
    setPlanetInfo(planet.kiiObj, planet, planet.planetID, planet.info)
  }
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
  this.broadcast.emit('new player', {playerID: newPlayer.playerID, x: newPlayer.getX(), y: newPlayer.getY()})

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
      this.emit('new player', {playerID: existingPlayer.playerID, x: existingPlayer.getX(), y: existingPlayer.getY()})
    }
  }

  // Add new player to the players array after duplicates have been removed
  players.push(newPlayer)
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
  movePlayer.setX(data.x)
  movePlayer.setY(data.y)
  movePlayer.setAngle(data.angle)

  // Broadcast updated position to connected socket clients
  this.broadcast.emit('move player', {playerID: movePlayer.playerID, x: movePlayer.getX(), y: movePlayer.getY(), angle: movePlayer.getAngle()})
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
