var SCREEN_WIDTH = 513
var SCREEN_HEIGHT = 912
var game = new Phaser.Game(SCREEN_WIDTH, SCREEN_HEIGHT, Phaser.AUTO, 'gameContainer',
    { preload: preload, create: create, update: update, render: render })

WebFontConfig = {
  //  'active' means all requested fonts have finished loading
  //  We set a 1 second delay before calling 'createText'.
  //  For some reason if we don't the browser cannot render the text the first time it's created.
  active: function() {
    game.time.events.add(Phaser.Timer.SECOND, createCenterText, this);
  },

  //  The Google Fonts we want to load (specify as many as you like in the array)
  google: {
    families: ['Open Sans']
  }
};

function preload () {
  //  Load the Google WebFont Loader script
  game.load.script('webfont', '//ajax.googleapis.com/ajax/libs/webfont/1.4.7/webfont.js');
  game.load.image('voidBG', 'assets/images/void.png')
  game.load.image('grassTile', 'assets/images/grassbg.png')
  game.load.image('sandTile', 'assets/images/sandbg.png')
  game.load.image('swampTile', 'assets/images/swampbg.png')
  game.load.image('farmTile', 'assets/images/farmbg.png')
  game.load.image('emptyTile', 'assets/images/emptybg.png')

  game.load.spritesheet('emojis', 'assets/images/emojis.png', 64, 64)
  game.load.spritesheet('playerbot', 'assets/images/roboto.png', 64, 64)
  game.load.spritesheet('ui_dropbutton', 'assets/images/ui_dropbutton.png', 96, 96)

  game.load.spritesheet('plant_radish', 'assets/images/plant_radish.png', 64, 64)
  game.load.spritesheet('plant_acorn', 'assets/images/plant_acorn.png', 64, 64)
  game.load.spritesheet('plant_cactus', 'assets/images/plant_cactus.png', 64, 64)
  game.load.spritesheet('plant_mushroom', 'assets/images/plant_mushroom.png', 64, 64)
  game.load.spritesheet('plant_mushroom2', 'assets/images/plant_mushroom2.png', 64, 64)

  game.load.spritesheet('critter_butterfly', 'assets/images/critter_butterfly.png', 64, 64)
  game.load.spritesheet('critter_bug', 'assets/images/critter_bug.png', 64, 64)
  game.load.spritesheet('critter_slime', 'assets/images/critter_slime.png', 64, 64)
  game.load.spritesheet('critter_snake', 'assets/images/critter_snake.png', 64, 64)
  game.load.spritesheet('critter_squirrel', 'assets/images/critter_squirrel.png', 64, 64)
}

var socket // Socket connection

var voidBG

var player
var centerText = null
var dropButton

var PLAYER_START_X = Collectible.TILE_SIZE / 2
var PLAYER_START_Y = Collectible.TILE_SIZE / 2

var glob = {
  intermittents: [],
  otherPlayers: [],
  tiles: [],
  gameInfo: null,
  map: null,
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
  // socket IO is setup after font load
  game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
  // TODO remove for release????
  game.stage.disableVisibilityChange = true;

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
  dropButton = new UIButton(uiGroup, "ui_dropbutton", 1, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 50, clickDrop)
  glob.ui.push(dropButton)
  dropButton.gameObj.animations.add("invisible", [0], 1, true)
  dropButton.gameObj.animations.add("highlighted", [2], 1, true)
}

function createCenterText () {
  var style = { font: "30px Open Sans", fontWeight: "bold", fill: "#222222", align: "center" };
  centerText = game.add.text(SCREEN_WIDTH / 2, 120, "", style);
  uiGroup.add(centerText)
  centerText.anchor.setTo(0.5, 0);

  socket = io.connect()
  //Kii.initializeWithSite("l1rxzy4xclvo", "f662ebb1125548bc84626f5264eb11b4", KiiSite.US)
  // Start listening for events
  setEventHandlers()
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

function clickDrop () {
  player.tryDrop()
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
  socket.on('update game info', onUpdateGameInfo)
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
  player.gameObj.kill()
  player.nameTag.kill()
  socket.close()
}

function onConfirmID (data) {
  console.log("confirmed my ID: " + data.playerID)
  window.localStorage.setItem("preferredID", data.playerID)

  player = new LocalPlayer(data.playerID, playerGroup, PLAYER_START_X, PLAYER_START_Y, data.name, data.color)

  game.camera.follow(player.gameObj, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1)
  game.camera.focusOnXY(PLAYER_START_X, PLAYER_START_Y)
}


// New player
function onNewPlayer (data) {
  console.log('New player connected:', data.playerID)

  // Add new player to the remote players array
  var remote = new RemotePlayer(data.playerID, playerGroup, data.x, data.y, data.name, data.color)
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
  removePlayer.nameTag.kill()

  // Remove player from array
  glob.otherPlayers.splice(glob.otherPlayers.indexOf(removePlayer), 1)
}

function onUpdateMap (data) {
  glob.map = data.map
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
  if (coll) {
    coll.setData(data)
  }
}

function onDestroyCollectibles (data) {
  var numDestroyed = 0
  var listToCheck = data.specificCollectibles // can be null
  for (var i = 0; i < glob.collectibles.length; i++) {
    var c = glob.collectibles[i]
    if (!listToCheck || listToCheck.indexOf(c.itemID) >= 0) {
      c.gameObj.kill()
      glob.collectibles.splice(i, 1)
      i--
      numDestroyed++
    }
  }
  console.log("Destroyed " + numDestroyed + " collectibles")
}

function onUpdateGameInfo (data) {
  glob.gameInfo = data
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
  updateUIText()
  resetUIClick()
}

function updateUIText() {
  if (centerText && glob.gameInfo) {
    var centerTextStr = glob.gameInfo.onBreak ? "ROUND OVER. Next round in: " : "Time left: "
    centerTextStr += glob.gameInfo.ticksLeft.toString() + "\n"
    centerTextStr += "Collected: " + glob.gameInfo.specimensFound + "  Species: " + glob.gameInfo.typesFound + "/" + glob.gameInfo.typesAvailable
    if (glob.gameInfo.onBreak) {
      centerTextStr += "\n\nMost species: " + glob.gameInfo.mostPlayerTypes + " by:\n"
      for (var i = 0; i < glob.gameInfo.playerIDsMostTypes.length; i++) {
        var p = playerByID(glob.gameInfo.playerIDsMostTypes[i])
        if (p) {
          centerTextStr += p.name + "\n"
        }
      }
      centerTextStr += "\n\nMost collected: " + glob.gameInfo.mostPlayerSpecimens + " by:\n"
      for (var i = 0; i < glob.gameInfo.playerIDsMostSpecimens.length; i++) {
        var p = playerByID(glob.gameInfo.playerIDsMostSpecimens[i])
        if (p) {
          centerTextStr += p.name + "\n"
        }
      }
    }
    centerText.setText(centerTextStr)
  }
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
