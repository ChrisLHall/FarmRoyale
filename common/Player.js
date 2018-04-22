;(function() {
  var Player = function (startX, startY, startPlayerID, startSocket) {
    this.x = startX
    this.y = startY
    this.angle = 0
    this.playerID = startPlayerID
    this.carryingItemID = ""
    this.kiiObj = null
    this.socket = startSocket
    this.info = {

    }
  }

  Player.generateNewInfo = function (playerID) {
    return {
      powerup: {
        type: "none",
        expiresAt: 0
      },
      color: Math.floor(Math.random() * 3),
      inventory: [
        {
          type: "empty"
        },
        {
          type: "empty"
        },
        {
          type: "empty"
        }
      ],
      playerid: playerID
    }
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Player
  } else {
    window.Player = Player
  }
})();
