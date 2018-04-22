var LocalCollectible = function (itemID, group, startX, startY, type) {
  this.itemID = itemID

  this.gameObj = group.create(startX, startY, type)
  this.gameObj.animations.add("stand", [0], 5, true)
  this.gameObj.animations.add("move", [0, 1], 5, true) // critter only
  this.gameObj.animations.add("harvested", [1], 5, true) // plant only
  this.gameObj.animations.play("stand")
  this.gameObj.anchor.setTo(0.5, 0.5)
  this.gameObj.bringToTop()

  this.gameObj.body.collideWorldBounds = true
  this.gameObj.body.immovable = true

  this.isCritter = Collectible.COLLECTIBLES[type].isCritter
  this.targetPos = new Phaser.Point(startX, startY)
  this.lerpSpeed = Collectible.COLLECTIBLES[type].moveSpeed
}

LocalCollectible.prototype.update = function () {
  if (this.isCritter) {
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
      // arrived
    }
    this.gameObj.x += delta.x
    this.gameObj.y += delta.y
  }
}

window.LocalCollectible = LocalCollectible
