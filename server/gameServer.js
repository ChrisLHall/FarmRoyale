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
var gameInfo
var persistentPlayerNamesColors
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
  }
});

function init () {
  players = []
  collectibles = []
  persistentPlayerNamesColors = {}
  gameInfo = newGameInfo()
  generateNewMap()
  spawnCollectibles()
  // Start listening for events
  setEventHandlers()
  setInterval(tick, 1000)
}

const GAME_TICKS = 240
const BREAK_TICKS = 60
var TICKS_PER_REMOVE_TILE = Math.floor(GAME_TICKS / 30) // slightly fewer than all the tiles
function newGameInfo () {
  return {
    onBreak: false,
    ticksLeft: GAME_TICKS,
    typesFound: 0,
    typesAvailable: 0,
    specimensFound: 0,
    playerIDsMostTypes: [],
    mostPlayerTypes: 0,
    playerIDsMostSpecimens: [],
    mostPlayerSpecimens: 0,
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

var CRITTERS_PER_TILE = 3
var PLANTS_PER_TILE = 8
function spawnCollectibles() {
  for (var row = 0; row < 7; row++) {
    for (var col = 0; col < 5; col++) {
      var onThisTile = 0
      if (row === 3 && col === 2) {
        // nothin
      } else {
        var availableCritters = getAvailableCollectibles(map[row][col], true)
        var availablePlants = getAvailableCollectibles(map[row][col], false)
        for (var i = 0; i < CRITTERS_PER_TILE; i++) {
          var x = Collectible.TILES_START_X + (col + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          var y = Collectible.TILES_START_Y + (row + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          var type = availableCritters[Math.floor(Math.random() * availableCritters.length)]
          collectibles.push(new Collectible(uuidv4(), type, x, y))
        }
        for (var i = 0; i < PLANTS_PER_TILE; i++) {
          var x = Collectible.TILES_START_X + (col + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          var y = Collectible.TILES_START_Y + (row + .1 + Math.random() * .8) * Collectible.TILE_SIZE
          var type = availablePlants[Math.floor(Math.random() * availablePlants.length)]
          collectibles.push(new Collectible(uuidv4(), type, x, y))
        }
      }
    }
  }
  io.emit('spawn collectibles', getCollectiblesData())
  tallyTypesAvailable()
}

function getAvailableCollectibles(habitat, isCritter) {
  var available = []
  // multiply each entry by its spawn rate
  for (var type in Collectible.COLLECTIBLES) {
    if (Collectible.COLLECTIBLES.hasOwnProperty(type)) {
      var data = Collectible.COLLECTIBLES[type]
      if (data.isCritter === isCritter && data.habitat === habitat) {
        for (var i = 0; i < data.spawnRate; i++) {
          available.push(type)
        }
      }
    }
  }
  return available
}

function getCollectiblesData() {
  var data = { collectibles: [] }
  for (var i = 0; i < collectibles.length; i++) {
    data.collectibles.push(collectibles[i].getData())
  }
  return data
}

function despawnCollectibles(specificTile) {
  var specificCollectibles = null
  if (specificTile) {
    specificCollectibles = []
    for (var i = 0; i < collectibles.length; i++) {
      var c = collectibles[i]
      var tile = Collectible.getTileAt(c.patrolX, c.patrolY)
      if (tile.row === specificTile.row && tile.col === specificTile.col) {
        collectibles.splice(i, 1)
        i--
        specificCollectibles.push(c.itemID)
      }
    }
  } else {
    collectibles = []
  }
  io.emit("destroy collectibles", {specificCollectibles: specificCollectibles})
}

const PATROL_DIST = 80
function tick() {
  // move critters, countdown
  for (var i = 0; i < collectibles.length; i++) {
    var c = collectibles[i]
    if (!c || !c.type || !Collectible.COLLECTIBLES[c.type]) {
      console.log("Something went wrong with collectibles, not sure what! " + c.type)
      continue
    }
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
      } else if (p.carryingItemID !== c.itemID) {
        console.log("Player doesnt know they are carrying " + c)
        p.carryingItemID = c.itemID
        updated = true
      }
    }
    if (updated) {
      io.emit("update collectible", c.getData())
    }
  }
  // check for players with orphaned carrying items
  for (var i = 0; i < players.length; i++) {
    var p = players[i]
    if (p.carryingItemID !== "") {
      var c = collectibleByID(p.carryingItemID)
      if (c && c.playerCarryingID !== p.playerID) {
        // someone else, or nobody, is carrying that item
        p.carryingItemID = ""
      }
    }
  }

  if (!gameInfo.onBreak && gameInfo.ticksLeft % TICKS_PER_REMOVE_TILE === 0) {
    var row = Math.floor(Math.random() * 7)
    var col = Math.floor(Math.random() * 5)
    if (row !== 3 || col !== 2) {
      console.log("Destroying tile at " + row + "," + col + ":" + map[row][col])
      map[row][col] = 0
      io.emit("update map", {map: map})
      despawnCollectibles({row: row, col: col})
    }
  }

  // update game info
  if (!gameInfo.onBreak) {
    tallyScores()
  }

  gameInfo.ticksLeft--
  if (gameInfo.onBreak && gameInfo.ticksLeft == 5) {
    // despawn everything now
    despawnCollectibles()
  } else if (gameInfo.ticksLeft < 0) {
    gameInfo.onBreak = !gameInfo.onBreak
    gameInfo.ticksLeft = gameInfo.onBreak ? BREAK_TICKS : GAME_TICKS
    if (gameInfo.onBreak) {
      // everything has to be dropped
      for (var i = 0; i < collectibles.length; i++) {
        var c = collectibles[i]
        if ("" !== c.playerCarryingID) {
          var p = playerByID(c.playerCarryingID)
          c.playerCarryingID = ""
          if (p) {
            p.carryingItemID = ""
          }
          io.emit("update collectible", c.getData())
        }
      }
    } else {
      // rebuild everything and start over
      generateNewMap()
      spawnCollectibles()
    }
  }
  io.emit("update game info", gameInfo)
}

function tallyTypesAvailable () {
  var available = {}
  var numAvailable = 0
  for (var i = 0; i < collectibles.length; i++) {
    var c = collectibles[i]
    if (!available.hasOwnProperty(c.type)) {
      available[c.type] = true
      numAvailable++
    }
  }
  gameInfo.typesAvailable = numAvailable
}

function tallyScores () {
  var numSpecimens = 0
  var types = {}
  var numTypes = 0
  var specimensPerPlayer = {}
  var typesPerPlayer = {}
  var numTypesPerPlayer = {}
  for (var i = 0; i < collectibles.length; i++) {
    var c = collectibles[i]
    var tile = Collectible.getTileAt(c.patrolX, c.patrolY)
    if (tile.row === 3 && tile.col === 2) {
      var p = c.lastPickedUpBy
      if (p === "") {
        console.log(c.toString() + " in the middle but never picked up")
        continue
      }
      numSpecimens++
      if (specimensPerPlayer.hasOwnProperty(p)) {
        specimensPerPlayer[p]++
      } else {
        specimensPerPlayer[p] = 1
      }

      if (!typesPerPlayer.hasOwnProperty(p)) {
        typesPerPlayer[p] = {}
      }
      if (!typesPerPlayer[p].hasOwnProperty(c.type)) {
        typesPerPlayer[p][c.type] = true
        if (numTypesPerPlayer.hasOwnProperty[p]) {
          numTypesPerPlayer[p]++
        } else {
          numTypesPerPlayer[p] = 1
        }
      }

      if (!types.hasOwnProperty(c.type)) {
        types[c.type] = true
        numTypes++
      }
    }
  }

  var highestPlayerSpecimens = 0
  for (var player in specimensPerPlayer) {
    if (specimensPerPlayer.hasOwnProperty(player)) {
      var specs = specimensPerPlayer[player]
      if (specs > highestPlayerSpecimens) {
        highestPlayerSpecimens = specs
      }
    }
  }
  var playersMatchingHighestSpecimens = []
  for (var player in specimensPerPlayer) {
    if (specimensPerPlayer.hasOwnProperty(player)) {
      if (specimensPerPlayer[player] >= highestPlayerSpecimens) {
        playersMatchingHighestSpecimens.push(player)
      }
    }
  }

  var highestPlayerTypes = 0
  for (var player in numTypesPerPlayer) {
    if (numTypesPerPlayer.hasOwnProperty(player)) {
      var num = numTypesPerPlayer[player]
      if (num > highestPlayerTypes) {
        highestPlayerTypes = num
      }
    }
  }
  var playersMatchingHighestTypes = []
  for (var player in numTypesPerPlayer) {
    if (numTypesPerPlayer.hasOwnProperty(player)) {
      if (numTypesPerPlayer[player] >= highestPlayerTypes) {
        playersMatchingHighestTypes.push(player)
      }
    }
  }

  gameInfo.specimensFound = numSpecimens
  gameInfo.typesFound = numTypes
  gameInfo.mostPlayerSpecimens = highestPlayerSpecimens
  gameInfo.playerIDsMostSpecimens = playersMatchingHighestSpecimens
  gameInfo.mostPlayerTypes = highestPlayerTypes
  gameInfo.playerIDsMostTypes = playersMatchingHighestTypes
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
  client.on("try drop", onTryDrop)
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
  var nameCol = getPlayerNameColor(newPlayerID)

  this.emit('confirm id', {playerID: newPlayer.playerID, name: nameCol.name, color: nameCol.color})
  this.emit('update map', {map: map})
  this.emit("update game info", gameInfo)
  // Broadcast new player to other connected socket clients
  this.broadcast.emit('new player', {playerID: newPlayer.playerID, x: newPlayer.x, y: newPlayer.y, name: nameCol.name, color: nameCol.color})

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
      this.emit('new player', {playerID: existingPlayer.playerID, x: existingPlayer.x, y: existingPlayer.y, name: nameCol.name, color: nameCol.color})
    }
  }

  // Add new player to the players array after duplicates have been removed
  players.push(newPlayer)

  this.emit('spawn collectibles', getCollectiblesData())
}

function getPlayerNameColor (playerID) {
  var result;
  if (persistentPlayerNamesColors.hasOwnProperty(playerID)) {
    result = persistentPlayerNamesColors[playerID]
  } else {
    result = {name: Player.generateRandomName(), color: Player.generateRandomColor()}
    persistentPlayerNamesColors[playerID] = result
  }
  return result
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

function onTryPickup (data) {
  if (gameInfo.onBreak) {
    return
  }
  var movePlayer = playerBySocket(this)

  // Player not found
  if (null == movePlayer) {
    console.log('Player not found for connection: ' + this.id)
    return
  }

  var c = collectibleByID(data.itemID)
  if (c && c.playerCarryingID === "" && movePlayer.carryingItemID === "") {
    var tile = Collectible.getTileAt(c.patrolX, c.patrolY)
    if (map[tile.row][tile.col] >= 2) {
      c.playerCarryingID = movePlayer.playerID
      c.lastPickedUpBy = movePlayer.playerID
      movePlayer.carryingItemID = c.itemID
      io.emit("update collectible", c.getData())
      console.log("Player " + movePlayer.playerID + " picking up " + c.toString())
    }
  }
}

function onTryDrop (data) {
  if (gameInfo.onBreak) {
    return
  }
  var movePlayer = playerBySocket(this)

  // Player not found
  if (null == movePlayer) {
    console.log('Player not found for connection: ' + this.id)
    return
  }

  if ("" !== movePlayer.carryingItemID) {
    var c = collectibleByID(movePlayer.carryingItemID)
    if (c) {
      var tile = Collectible.getTileAt(data.x, data.y)
      if (map[tile.row][tile.col] !== 0) {
        // todo check the tile
        c.playerCarryingID = ""
        movePlayer.carryingItemID = ""
        c.patrolX = data.x
        c.patrolY = data.y
        c.gotoX = data.x
        c.gotoY = data.y
        io.emit("update collectible", c.getData())
        console.log("Player " + movePlayer.playerID + " dropped " + c.toString() + " at tile " + tile.row + "," + tile.col)
      }
    }
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
