var game = new Phaser.Game(513, 912, Phaser.AUTO, 'gameContainer',
    { preload: preload, create: create, update: update, render: render })

function preload () {
  game.load.image('voidBG', 'assets/images/void.png')
  game.load.image('grassTile', 'assets/images/grassbg.png')
  game.load.image('sandTile', 'assets/images/sandbg.png')
  game.load.image('swampTile', 'assets/images/swampbg.png')
  game.load.image('farmTile', 'assets/images/farmbg.png')

  game.load.image('shout', 'assets/images/shout.png')
  game.load.image('pressshout', 'assets/images/pressShout.png')

  game.load.spritesheet('empty', 'assets/images/empty_sheet.png', 180, 180)
  game.load.spritesheet('cactus1', 'assets/images/cactus1_sheet.png', 180, 180)

  game.load.spritesheet('playerbee', 'assets/images/bigbee.png', 64, 64)
}

var socket // Socket connection

var voidBG

var player
// The base of our player
var startX = 500
var startY = 500

var glob = {
  currentServerTick: 0,
  intermittents: [],
  otherPlayers: [],
  planets: [],
  shouts: [],
}
window.glob = glob

var uiText
var clickUsedByUI = false

var tileGroup
var planetGroup
var playerGroup
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
  game.world.setBounds(-2048, -2048, 5120, 5120)

  // Our tiled scrolling background
  voidBG = game.add.tileSprite(0, 0, 513, 912, 'voidBG')
  voidBG.fixedToCamera = true

  tileGroup = game.add.group();
  var tile = game.add.tileSprite(0, 0, 512, 512, "farmTile") // expand to 1000x1000
  tile.scale.setTo(2, 2)
  tileGroup.add(tile)

  planetGroup = game.add.group();

  playerGroup = game.add.group();
  playerGroup.enableBody = true;
  uiGroup = game.add.group();
  uiGroup.fixedToCamera = true

  uiText = uiGroup.create(250, 150, "pressshout")
  uiText.anchor.setTo(0.5, 0.5)
  uiText.inputEnabled = true;
  uiText.events.onInputDown.add(clickShout, uiText);
}

function clickShout () {
  clickUsedByUI = true // ALWAYS DO THIS FIRST
  if (null != player) {
    socket.emit('shout', {playerID: player.playerID})
  }
}

function onShout (data) {
  var shout = new Shout(data.playerID)
  glob.shouts.push(shout)
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

  socket.on('shout', onShout)
  socket.on('chat message', onReceiveChat)
  // server side only
  //socket.on('change tile', onChangeTile)
}

// Socket connected
function onSocketConnected () {
  console.log('Connected to socket server')

  var preferredID = window.localStorage.getItem("preferredID")
  // Send local player data to the game server
  socket.emit('new player', { preferredID: preferredID, x: startX, y: startY })
}

// Socket disconnected
function onSocketDisconnect () {
  console.log('Disconnected from socket server')
}

function onConfirmID (data) {
  console.log("confirmed my ID: " + data.playerID)
  window.localStorage.setItem("preferredID", data.playerID)

  player = new LocalPlayer(data.playerID, playerGroup, startX, startY, Player.generateNewInfo(data.playerID))

  game.camera.follow(player.gameObj, Phaser.Camera.FOLLOW_TOPDOWN_TIGHT, 0.3, 0.3)
  game.camera.focusOnXY(startX, startY)

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
  for (var i = 0; i < glob.planets.length; i++) {
    glob.planets[i].update()
  }
  for (var i = 0; i < glob.shouts.length; i++) {
    glob.shouts[i].update()
  }
  voidBG.tilePosition.x = -game.camera.x / 3
  voidBG.tilePosition.y = -game.camera.y / 3

  updateUI()
}

function updateUI () {
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
  return null
}


// TEMP CHAT SYSTEM
function onReceiveChat(msg) {
    $('#messages').prepend($('<li>').text(msg));
}
