/* global game */

var RemotePlayer = function (playerID, group, startX, startY, playerInfo) {
  var x = startX
  var y = startY

  this.playerID = playerID

  this.gameObj = group.create(x, y, 'playerbot')
  this.gameObj.animations.add("stand", [0], 5, true)
  this.gameObj.animations.add("move", [0, 1], 5, true)
  this.gameObj.animations.play("stand")
  this.gameObj.anchor.setTo(0.5, 0.5)

  this.gameObj.body.immovable = true
  this.gameObj.body.collideWorldBounds = true

  this.targetPos = new Phaser.Point(x, y)
  this.lerpSpeed = 6
}

RemotePlayer.prototype.exists = function () {
  return this.gameObj.exists
}

RemotePlayer.prototype.update = function () {
  var delta = Phaser.Point.subtract(this.targetPos, this.gameObj.position)
  if (delta.getMagnitude() > this.lerpSpeed) {
    delta.normalize()
    delta.multiply(this.lerpSpeed, this.lerpSpeed)
    if (this.gameObj.animations.currentAnim.name !== "move") {
      this.gameObj.animations.play("move")
    }
  } else {
    if (this.gameObj.animations.currentAnim.name !== "stand") {
      this.gameObj.animations.play("stand")
    }
  }
  this.gameObj.x += delta.x
  this.gameObj.y += delta.y
}

RemotePlayer.prototype.setTargetPos = function(x, y) {
  this.targetPos.x = x
  this.targetPos.y = y

  //this.lerpSpeed = Phaser.Point.subtract(this.gameObj.position, this.targetPos).getMagnitude() / 30
}

window.RemotePlayer = RemotePlayer
