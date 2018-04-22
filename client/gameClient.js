var SCREEN_WIDTH = 513
var SCREEN_HEIGHT = 912
var game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.AUTO, 'gameContainer',
    { preload: preload, create: create, update: update, render: render })

function preload () {
  game.load.image('voidBG', 'assets/images/void.png')
  game.load.image('grassTile', 'assets/images/grassbg.png')
  game.load.image('sandTile', 'assets/images/sandbg.png')
  game.load.image('swampTile', 'assets/images/swampbg.png')
  game.load.image('farmTile', 'assets/images/farmbg.png')
  game.load.image('emptyTile', 'assets/images/emptybg.png')

  game.load.spritesheet('emojis', 'assets/images/emojis.png', 64, 64)
  game.load.spritesheet('playerbot', 'assets/images/roboto.png', 64, 64)

  game.load.spritesheet('plant_radish', 'assets/images/plant_radish.png', 64, 64)

  game.load.spritesheet('critter_butterfly', 'assets/images/critter_butterfly.png', 64, 64)
}

var socket // Socket connection

var voidBG

var player

var PLAYER_START_X = Collectible.TILE_SIZE / 2
var PLAYER_START_Y = Collectible.TILE_SIZE / 2

var glob = {
  intermittents: [],
  otherPlayers: [],
  tiles: [],
  collectibles: [],
  ui: [],
  shouts: [],
}
window.glob = glob

var clickUsedByUI = false

var tileGroup
var playerGroup
var collPlantGroup
var collCritterGroup
var uiGroup

function create () {
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
  // TODO remove for release????
  game.stage.disableVisibilityChange = true;
  socket = io.connect()
  //Kii.initializeWithSite("l1rxzy4xclvo", "f662ebb1125548bc84626f5264eb11b4", KiiSite.US)
  // Start listening for events
  setEventHandlers()

  game.physics.startSystem(Phaser.Physics.ARCADE)
  game.world.setBounds(Collectible.TILES_START_X, Collectible.TILES_START_Y, 5 * Collectible.TILE_SIZE, 7 * Collectible.TILE_SIZE)

  // Our tiled scrolling background
  voidBG = game.add.tileSprite(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 'voidBG')
  voidBG.fixedToCamera = true

  tileGroup = game.add.group();
  var tile = null
  for (var row = 0; row < 7; row++) {
    var rowOfTiles = []
    for (var col = 0; col < 5; col++) {
      var texture = "emptyTile"
      if (row === 3 && col === 2) {
        texture = "farmTile"
      }
      tile = game.add.tileSprite(Collectible.TILES_START_X + col * Collectible.TILE_SIZE, Collectible.TILES_START_Y + row * Collectible.TILE_SIZE, Collectible.TILE_SIZE / 2, Collectible.TILE_SIZE / 2, "farmTile")
      tile.scale.setTo(2, 2) // expand to 1024x1024
      tileGroup.add(tile)
      rowOfTiles.push(tile)
    }
    glob.tiles.push(rowOfTiles)
  }

  playerGroup = game.add.group();
  playerGroup.enableBody = true;

  collPlantGroup = game.add.group()
  collCritterGroup = game.add.group()

  uiGroup = game.add.group();
  uiGroup.fixedToCamera = true
  for (var i = 0; i < 4; i++) {
    var x = (SCREEN_WIDTH / 4) * (i + .5)
    var emojiButton = new UIButton(uiGroup, "emojis", i * 2 + 1, x, 40, clickShoutFunc(i))
    glob.ui.push(emojiButton)
  }
}

function clickShoutFunc (emojiIdx) {
  return function () {
    if (null != player) {
      socket.emit('shout', {playerID: player.playerID, emojiIdx: emojiIdx})
    }
  }
}

function onShout (data) {
  var shout = new Shout(data.playerID, data.emojiIdx)
}

function setEventHandlers () {
  // Socket connection successful
  socket.on('connect', onSocketConnected)

  // Socket disconnection
  socket.on('disconnect', onSocketDisconnect)

  // log in with cached ID
  socket.on('confirm id', onConfirmID)
  // New player message received
  socket.on('new player', onNewPlayer)
  // Player move message received
  socket.on('move player', onMovePlayer)
  // Player removed message received
  socket.on('remove player', onRemovePlayer)

  socket.on('update map', onUpdateMap)
  socket.on('spawn collectibles', onSpawnCollectibles)
  socket.on('update collectible', onUpdateCollectible)
  socket.on('destroy collectibles', onDestroyCollectibles)

  socket.on('shout', onShout)
  socket.on('chat message', onReceiveChat)
}

// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')

  var preferredID = window.localStorage.getItem("preferredID")
  // Send local player data to the game server
  socket.emit('new player', { preferredID: preferredID, x: PLAYER_START_X, y: PLAYER_START_Y })
}

// Socket disconnected
function onSocketDisconnect () {
  console.log('Disconnected from socket server')
}

function onConfirmID (data) {
  console.log("confirmed my ID: " + data.playerID)
  window.localStorage.setItem("preferredID", data.playerID)

  player = new LocalPlayer(data.playerID, playerGroup, PLAYER_START_X, PLAYER_START_Y, Player.generateNewInfo(data.playerID))

  game.camera.follow(player.gameObj, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1)
  game.camera.focusOnXY(PLAYER_START_X, PLAYER_START_Y)
}


// New player
function onNewPlayer (data) {
  console.log('New player connected:', data.playerID)

  // Add new player to the remote players array
  var remote = new RemotePlayer(data.playerID, playerGroup, data.x, data.y)
  glob.otherPlayers.push(remote)
}

// Move player
function onMovePlayer (data) {
  var movePlayer = playerByID(data.playerID)

  // Player not found
  if (null == movePlayer) {
    console.log('Player not found: ', data.playerID)
    return
  }

  movePlayer.setTargetPos(data.x, data.y)
  movePlayer.gameObj.angle = data.angle
}

// Remove player
function onRemovePlayer (data) {
  var removePlayer = playerByID(data.playerID)

  // Player not found
  if (!removePlayer) {
    console.log('Player not found: ', data.playerID)
    return
  }

  playerGroup.remove(removePlayer.gameObj)
  removePlayer.gameObj.kill()

  // Remove player from array
  glob.otherPlayers.splice(glob.otherPlayers.indexOf(removePlayer), 1)
}

function onUpdateMap (data) {
  for (var row = 0; row < 7; row++) {
    var mapRow = data.map[row]
    var tileRow = glob.tiles[row]
    for (var col = 0; col < 5; col++) {
      var mapTileType = mapRow[col]
      var tileObj = tileRow[col]
      var texture = "emptyTile" // 0 means empty
      if (mapTileType === 1) {
        texture = "farmTile"
      } else if (mapTileType === 2) {
        texture = "grassTile"
      } else if (mapTileType === 3) {
        texture = "sandTile"
      } else if (mapTileType === 4) {
        texture = "swampTile"
      }
      tileObj.loadTexture(texture)
    }
  }
}

function onSpawnCollectibles (data) {
  for (var i = 0; i < data.collectibles.length; i++) {
    var cData = data.collectibles[i]
    var group = Collectible.COLLECTIBLES[cData.type].isCritter ? collCritterGroup : collPlantGroup
    var c = new LocalCollectible(cData.itemID, group, cData.gotoX, cData.gotoY, cData.type)
    c.setData(cData)
    glob.collectibles.push(c)
  }
}

function onUpdateCollectible (data) {
  var coll = collectibleByID(data.itemID)
  if (data.playerCarryingID) {
    console.log("oo somethin")
  }
  if (coll) {
    coll.setData(data)
  }
}

function onDestroyCollectibles (data) {

}

function update () {
  if (null != player) {
    player.update()
  }
  for (var i = 0; i < glob.intermittents.length; i++) {
    glob.intermittents[i].update()
    if (glob.intermittents[i].finished) {
        glob.intermittents.splice(i, 1)
        i--
    }
  }
  for (var i = 0; i < glob.otherPlayers.length; i++) {
    glob.otherPlayers[i].update()
  }
  for (var i = 0; i < glob.collectibles.length; i++) {
    glob.collectibles[i].update()
  }
  for (var i = 0; i < glob.shouts.length; i++) {
    glob.shouts[i].update()
  }
  voidBG.tilePosition.x = -game.camera.x / 3
  voidBG.tilePosition.y = -game.camera.y / 3

  resetUIClick()
}

function resetUIClick () {
  if (!game.input.activePointer.isDown) {
    clickUsedByUI = false
  }
}

function render () {

}

function playerByID (playerID) {
  for (var i = 0; i < glob.otherPlayers.length; i++) {
    if (glob.otherPlayers[i].playerID === playerID) {
      return glob.otherPlayers[i]
    }
  }
  if (player.playerID === playerID) {
    return player
  }
  return null
}

function collectibleByID (itemID) {
  for (var i = 0; i < glob.collectibles.length; i++) {
    if (glob.collectibles[i].itemID === itemID) {
      return glob.collectibles[i]
    }
  }
  return null
}

// TEMP CHAT SYSTEM
function onReceiveChat(msg) {
  // maybe remove
}
