/* global game */

var UIButton = function (group, animName, frame, screenX, screenY, touchAction) {
  this.touchAction = touchAction

  this.gameObj = group.create(screenX, screenY, animName)
  this.gameObj.animations.add("button", [frame], 1, true)
  this.gameObj.animations.play("button")
  this.gameObj.anchor.setTo(0.5, 0.5)

  this.gameObj.inputEnabled = true;
  this.gameObj.events.onInputDown.add(this.pressed, this);
}

UIButton.prototype.pressed = function() {
  clickUsedByUI = true // ALWAYS DO THIS FIRST
  this.touchAction.call(this)
}

window.UIButton = UIButton
