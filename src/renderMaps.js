import createElement from "./createElement.js";
import { state } from "./state.js"; //

const TILE_SIZE = 50;

const mapBuilder = () => {
  const rows = [];

  const map = state.map;
  const players = state.players;

  for (let row = 0; row < map.length; row++) {
    // go through the row
    const tiles = [];
    for (let col = 0; col < map[row].length; col++) {
      // go through the column
      let tileType = map[row][col];

      // Check if a player is here
      const playerHere = players.find(
        (p) => p.position && p.position.x === col && p.position.y === row
      );

      if (playerHere) {
        tileType = `player-${playerHere.character}`;
      }

      const bombHere = state.bombs.find((b) => b.x === col && b.y === row);

      if (bombHere) {
        tileType = "bomb";
      }
      const explosionHere = state.explosions.find(
        (e) => e.x === col && e.y === row
      );
      console.log("explosionHere", explosionHere);

      if (explosionHere) {
        tileType = `explosion-${explosionHere.direction}`;
      }
      const powerUpHere = state.powerUps.find(
        (p) => p.x === col && p.y === row
      );
      if (powerUpHere) {
        tileType = `powerup-${powerUpHere.type}`;
      }

      tiles.push(
        createElement("div", {
          attrs: {
            class: `tile${tileType}`,
            style: `width: ${TILE_SIZE}px; height: ${TILE_SIZE}px;`,
          },
          children: [],
        })
      );
    }

    rows.push(
      createElement("div", {
        attrs: { class: "row" },
        children: tiles,
      })
    );
  }

  return createElement("div", {
    attrs: { id: "game" },
    children: rows,
  });
};

const renderMap = () => {
  return mapBuilder();
};

export default renderMap;
