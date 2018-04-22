var LocalCollectible = function (itemID, group, startX, startY, type) {
  this.itemID = itemID
  this.type = type
  this.isCritter = Collectible.COLLECTIBLES[type].isCritter
  this.targetPos = new Phaser.Point(startX, startY)
  this.lerpSpeed = Collectible.COLLECTIBLES[type].moveSpeed
  this.playerCarryingID = ""

  this.gameObj = group.create(startX, startY, type)
  this.gameObj.animations.add("stand", [0], 5, true)
  this.gameObj.animations.add("move", [0, 1], 5 + Math.random() * 2, true) // critter only
  this.gameObj.animations.add("harvested", [1], 5, true) // plant only
  this.gameObj.animations.play(this.isCritter ? "move" : "stand")
  this.gameObj.anchor.setTo(0.5, 0.5)

  this.gameObj.inputEnabled = true;
  this.gameObj.events.onInputDown.add(this.pressed, this);
}

LocalCollectible.prototype.setData = function (data) {
  this.targetPos = new Phaser.Point(data.gotoX, data.gotoY)
  if (this.playerCarryingID !== "") {
    var prevCarrying = playerByID(this.playerCarryingID)
    if (prevCarrying) {
      prevCarrying.carryingItemID = ""
    }
  }
  this.playerCarryingID = data.playerCarryingID
  if (this.playerCarryingID !== "") {
    var nowCarrying = playerByID(this.playerCarryingID)
    if (nowCarrying) {
      nowCarrying.carryingItemID = this.itemID
    }
  }
}

LocalCollectible.prototype.update = function () {
  if ("" !== this.playerCarryingID) {
    var p = playerByID(this.playerCarryingID)
    if (p) {
      this.gameObj.x = p.gameObj.x
      this.gameObj.y = p.gameObj.y
      if (this.isCritter && this.gameObj.animations.currentAnim.name !== "move") {
        this.gameObj.animations.play("move")
      } else if (!this.isCritter && this.gameObj.animations.currentAnim.name !== "move") {
        this.gameObj.animations.play("harvested")
      }
    }
  } else if (this.isCritter) {

    var delta = Phaser.Point.subtract(this.targetPos, this.gameObj.position)
    if (delta.getMagnitude() > this.lerpSpeed) {
      delta.normalize()
      delta.multiply(this.lerpSpeed, this.lerpSpeed)
      this.gameObj.scale.setTo(delta.x > 0 ? 1 : -1, 1)
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
  } else {
    this.gameObj.x = this.targetPos.x
    this.gameObj.y = this.targetPos.y
  }
}

LocalCollectible.prototype.pressed = function() {
  if (!clickUsedByUI) {
    clickUsedByUI = true // ALWAYS DO THIS FIRST
    player.targetPos = new Phaser.Point(this.gameObj.x, this.gameObj.y)
  }
}

window.LocalCollectible = LocalCollectible
