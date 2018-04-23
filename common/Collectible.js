;(function() {
  var Collectible = function (itemID, type, patrolX, patrolY) {
    this.itemID = itemID
    this.type = type
    this.patrolX = patrolX
    this.patrolY = patrolY
    this.gotoX = patrolX
    this.gotoY = patrolY
    this.playerCarryingID = ""
    this.lastPickedUpBy = ""
  }

  // these are defined in two places, rip
  Collectible.TILES_START_X = -2048
  Collectible.TILES_START_Y = -3072
  Collectible.TILE_SIZE = 1024

  Collectible.getTileAt = function (x, y) {
    var tileX = 0
    for (var i = 0; i < 5; i++) {
      if (x >= Collectible.TILES_START_X + i * Collectible.TILE_SIZE) {
        tileX = i
      }
    }
    var tileY = 0
    for (var i = 0; i < 7; i++) {
      if (y >= Collectible.TILES_START_Y + i * Collectible.TILE_SIZE) {
        tileY = i
      }
    }
    return { col: tileX, row: tileY }
  }

  Collectible.prototype.getData = function () {
    return {
      itemID: this.itemID,
      type: this.type,
      gotoX: this.gotoX,
      gotoY: this.gotoY,
      playerCarryingID: this.playerCarryingID,
      lastPickedUpBy: this.lastPickedUpBy,
    }
  }

  Collectible.prototype.toString = function () {
    return this.type + ":" + this.itemID
  }

  // 2 is grass, 3 is sand, 4 is swamp
  Collectible.COLLECTIBLES = {
      "critter_butterfly": { isCritter: true, habitat: 2, spawnRate: 5, moveSpeed: 1, },
      "critter_bug": { isCritter: true, habitat: 4, spawnRate: 5, moveSpeed: 1, },
      "critter_slime": { isCritter: true, habitat: 4, spawnRate: 2, moveSpeed: 1, },
      "critter_snake": { isCritter: true, habitat: 3, spawnRate: 5, moveSpeed: 2, },
      "critter_squirrel": { isCritter: true, habitat: 2, spawnRate: 1, moveSpeed: 3, },

      "plant_radish": { isCritter: false, habitat: 2, spawnRate: 5, moveSpeed: 0, },
      "plant_acorn": { isCritter: false, habitat: 2, spawnRate: 5, moveSpeed: 0, },
      "plant_cactus": { isCritter: false, habitat: 3, spawnRate: 5, moveSpeed: 0, },
      "plant_mushroom": { isCritter: false, habitat: 4, spawnRate: 5, moveSpeed: 0, },
      "plant_mushroom2": { isCritter: false, habitat: 4, spawnRate: 2, moveSpeed: 0, },
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Collectible
  } else {
    window.Collectible = Collectible
  }
})();
