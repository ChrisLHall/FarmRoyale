;(function() {
  var Collectible = function (itemID, type, patrolX, patrolY) {
    this.itemID = itemID
    this.type = type
    this.patrolX = patrolX
    this.patrolY = patrolY
    this.gotoX = patrolX
    this.gotoY = patrolY
    this.playerCarryingID = ""
  }

  // these are defined in two places, rip
  var TILES_START_X = -2048
  var TILES_START_Y = -3072
  var TILE_SIZE = 1024

  Collectible.prototype.getCurrentTile = function () {
    var tileX = 0
    for (var i = 0; i < 5; i++) {
      if (this.patrolX >= TILES_START_X + i * TILE_SIZE) {
        tileX = i
      }
    }
    var tileY = 0
    for (var i = 0; i < 7; i++) {
      if (this.patrolY >= TILES_START_Y + i * TILE_SIZE) {
        tileY = i
      }
    }
    return { x: tileX, y: tileY }
  }

  Collectible.prototype.getData = function () {
    return {
      itemID: this.itemID,
      type: this.type,
      gotoX: this.gotoX,
      gotoY: this.gotoY,
    }
  }


  // 2 is grass, 3 is sand, 4 is swamp
  Collectible.COLLECTIBLES = {
      "critter_butterfly": { isCritter: true, habitat: 2, moveSpeed: 2, },
      "plant_radish": { isCritter: false, habitat: 2, moveSpeed: 0, }
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Collectible
  } else {
    window.Collectible = Collectible
  }
})();
