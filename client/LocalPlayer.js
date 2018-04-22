var LocalPlayer = function (playerID, group, startX, startY, playerInfo) {
  this.playerID = playerID
  this.carryingItemID = ""

  this.gameObj = group.create(startX, startY, 'playerbot')
  this.gameObj.animations.add("stand", [0], 5, true)
  this.gameObj.animations.add("move", [0, 1], 5, true)
  this.gameObj.animations.play("stand")
  this.gameObj.anchor.setTo(0.5, 0.5)
  this.gameObj.bringToTop()
  glob.intermittents.push(new IntermittentUpdater(this, function () {
    socket.emit('move player', { x: this.targetPos.x, y: this.targetPos.y, angle: this.gameObj.angle })
  }, 30))

  this.gameObj.body.collideWorldBounds = true
  this.gameObj.body.immovable = true

  this.targetPos = new Phaser.Point(startX, startY)
  this.lerpSpeed = 5
  this.finishedMoving = true

  this.setInfo(playerInfo)
}

LocalPlayer.colors = [0xffffff, 0xaaffaa, 0xffccff]
LocalPlayer.prototype.setInfo = function (info) {
  CommonUtil.validate(info, Player.generateNewInfo(this.playerID))
  this.info = info
  if (null != this.info) {
    this.gameObj.tint = LocalPlayer.colors[this.info.color];
  }
}

LocalPlayer.prototype.exists = function () {
  return this.gameObj.exists
}

var PICKUP_DIST = 40
LocalPlayer.prototype.update = function () {
  //  only move when you click
  var clickPoint = new Phaser.Point(game.input.activePointer.worldX, game.input.activePointer.worldY)
  if (!clickUsedByUI && game.input.activePointer.isDown
      && game.input.activePointer.duration > 50
      && Phaser.Point.subtract(clickPoint, this.gameObj.position)
      .getMagnitude() > 70) {
    //game.physics.arcade.moveToPointer(this.gameObj, 300);
    this.targetPos = clickPoint
  }

  var delta = Phaser.Point.subtract(this.targetPos, this.gameObj.position)
  if (delta.getMagnitude() > this.lerpSpeed) {
    this.finishedMoving = false
    delta.normalize()
    delta.multiply(this.lerpSpeed, this.lerpSpeed)
    this.gameObj.angle = Math.atan2(delta.y, delta.x) * Phaser.Math.RAD_TO_DEG
    if (this.gameObj.animations.currentAnim.name !== "move") {
      this.gameObj.animations.play("move")
    }
  } else {
    if (this.gameObj.animations.currentAnim.name !== "stand") {
      this.gameObj.animations.play("stand")
    }
    if (!this.finishedMoving) {
      this.finishedMoving = true
      this.checkForPickup()
    }
    // arrived
  }
  this.gameObj.x += delta.x
  this.gameObj.y += delta.y

  // update the drop button state based on my position
  var buttonAnim = "invisible"
  if ("" !== this.carryingItemID) {
    buttonAnim = "button"
    var tile = Collectible.getTileAt(this.gameObj.x, this.gameObj.y)
    if (tile.row === 3 && tile.col === 2) {
      buttonAnim = "highlighted"
    }
  }
  if (dropButton.gameObj.animations.currentAnim.name !== buttonAnim) {
    dropButton.gameObj.animations.play(buttonAnim)
  }
}

LocalPlayer.prototype.checkForPickup = function () {
  for (var i = 0; i < glob.collectibles.length; i++) {
    var c = glob.collectibles[i]
    if (c.playerCarryingID === "" && Math.abs(this.gameObj.x - c.gameObj.x) < PICKUP_DIST && Math.abs(this.gameObj.y - c.gameObj.y) < PICKUP_DIST) {
      socket.emit("try pickup", {x: this.gameObj.x, y: this.gameObj.y, itemID: c.itemID})
      break
    }
  }
}

LocalPlayer.prototype.tryDrop = function () {
  socket.emit("try drop", {x: this.gameObj.x, y: this.gameObj.y})
}

window.LocalPlayer = LocalPlayer
