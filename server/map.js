function generateMap() {
  const map = [];

  for (let row = 0; row < 15; row++) {
    const r = [];
    for (let col = 0; col < 15; col++) {
      if (row === 0 || row === 14 || col === 0 || col === 14) {
        r.push("wall");
      } else if (col % 2 === 0 && row % 2 === 0) {
        r.push("wall");
      } else {
        r.push(Math.random() < 0.3 ? "block" : "empty");
      }
    }
    map.push(r);
  }

  const r = [1, 13];
  const c = [1, 13];
  for (let i of r) {
    for (let j of c) {
      map[i][j] = "empty";
    }
  }

  const spawnSafeZones = [
    [1, 1],
    [1, 13],
    [13, 1],
    [13, 13],
  ];

  for (const [sy, sx] of spawnSafeZones) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ny = sy + dy;
        const nx = sx + dx;
        if (
          ny >= 0 &&
          ny < 15 &&
          nx >= 0 &&
          nx < 15 &&
          map[ny][nx] !== "wall"
        ) {
          map[ny][nx] = "empty";
        }
      }
    }
  }

  return map;
}

module.exports = generateMap;
