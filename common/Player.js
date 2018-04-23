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

  Player.generateRandomName = function () {
    var adjectives = ["Gross", "Snotty", "Funny", "Gnarly", "Crazy", "Buck Wild", "Blue", "Very Big", "Sad", "Juicy", "Funky"]
    var nouns = ["Cat", "Dog", "Watermelon", "Pineapple", "Pickle", "Robot", "Shoe", "Water Bottle", "Toe", "Camera", "Telephone", "Helicopter", "Spoon", "HYPE BEAST", "Critter", "Potato"]
    return adjectives[Math.floor(Math.random() * adjectives.length)] + " " + nouns[Math.floor(Math.random() * nouns.length)]
  }

  Player.generateRandomColor = function () {
    var strs = ["00", "22", "33"]
    return strs[Math.floor(Math.random() * 3)] + strs[Math.floor(Math.random() * 3)] + strs[Math.floor(Math.random() * 3)]
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Player
  } else {
    window.Player = Player
  }
})();
