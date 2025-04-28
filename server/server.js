const generateMap = require("./map");
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });
const clients = [];
let bombs = [];
let powerUps = [];

let gameStartTimer = null;
let currentMap = null;

const spawnPositions = [
  { x: 1, y: 1 }, // top-left
  { x: 13, y: 1 }, // top-right
  { x: 1, y: 13 }, // bottom-left
  { x: 13, y: 13 }, // bottom-right
];

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const msg = JSON.parse(data);

    if (msg.type === "join") {
      if (isNicknameTaken(msg.name)) {
        ws.send(
          JSON.stringify({
            type: "nickname_taken",
            message:
              "This nickname is already taken. Please choose another one.",
          })
        );
        return;
      }

      ws.name = msg.name;
      clients.push(ws);
      broadcastPlayers();

      // time start when we reach 2 player minmum
      if (clients.length > 1 && !gameStartTimer) {
        gameStartTimer = setTimeout(startGame, 30000);
        broadcast({
          type: "game_start_message",
          message: "Game will start in 30 seconds",
        });
      }

      if (clients.length === 4) {
        if (gameStartTimer) clearTimeout(gameStartTimer);
        startGame();
      }
    }

    if (msg.type === "message") {
      broadcast({ type: "message", message: `${ws.name}: ${msg.message}` });
    }
    if (msg.type === "move") {
      const player = clients.find((c) => c.name === msg.name);
      if (!player || !player.position) return;

      const { x, y } = player.position;
      let newX = x;
      let newY = y;

      switch (msg.direction) {
        case "up":
          newY--;
          break;
        case "down":
          newY++;
          break;
        case "left":
          newX--;
          break;
        case "right":
          newX++;
          break;
      }
      // console.log(`${msg.name} moved ${msg.direction}`);

      const mapTile = currentMap?.[newY]?.[newX]; // ?. give us undefined if there error

      if (
        newY >= 0 &&
        newY < 15 &&
        newX >= 0 &&
        newX < 15 &&
        mapTile === "empty"
      ) {
        player.position = { x: newX, y: newY };

        //check if the player exist on the powerup
        const powerUpIndex = powerUps.findIndex(
          (p) => p.x === newX && p.y === newY
        );

        if (powerUpIndex !== -1) {
          const powerUp = powerUps[powerUpIndex];
          if (!player.powerUps) player.powerUps = {};
          player.powerUps[powerUp.type] =
            (player.powerUps[powerUp.type] || 0) + 1;
          powerUps.splice(powerUpIndex, 1);
        }

        broadcast({
          type: "update_positions",
          players: clients.map((c) => ({
            name: c.name,
            position: c.position,
            character: c.character,
            lives: c.lives,
            powerUps: c.powerUps || {},
          })),
          powerUps,
        });
      }
    }
    if (msg.type === "drop_bomb") {
      const player = clients.find((c) => c.name === msg.name);
      if (!player || !player.position) return;

      const now = Date.now();
      const cooldown = 3000;

      if (now - player.lastBombTime < cooldown) {
        return;
      }

      player.lastBombTime = now;
      const { x, y } = msg.position;

      bombs.push({ x, y });

      broadcast({
        type: "bomb_dropped",
        position: { x, y },
        players: clients.map((c) => ({
          name: c.name,
          position: c.position,
          character: c.character,
          lives: c.lives,
        })),
      });
      setTimeout(() => {
        explodeBomb(x, y);
      }, 2000);
    }
  });

  ws.on("close", () => {
    const index = clients.indexOf(ws);
    if (index !== -1) clients.splice(index, 1);

    // // timer cancel when < 2 player
    if (clients.length < 2 && gameStartTimer) {
      clearTimeout(gameStartTimer);
      gameStartTimer = null;
      broadcast({ type: "game_start_message", message: "" });
    }

    broadcastPlayers();
  });
});

function broadcast(msg) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(msg));
    }
  });
}

function broadcastPlayers() {
  broadcast({ type: "players", players: clients.map((c) => c.name) });
}

function startGame() {
  if (gameStartTimer) clearTimeout(gameStartTimer);
  gameStartTimer = null;

  currentMap = generateMap();
  const characterSprites = ["white", "red", "black", "blue"]; // order

  clients.forEach((client, index) => {
    client.position = spawnPositions[index]; // player position on map
    client.lives = 3;
    client.character = characterSprites[index]; // assign by order 0 white, 1 red, 2 green, 3 yellow
  });
  const playersWithPositions = clients.map((client) => ({
    name: client.name,
    position: client.position,
    character: client.character,
  }));

  broadcast({
    type: "start",
    map: currentMap,
    players: playersWithPositions,
  });
}

function explodeBomb(x, y) {
  bombs = bombs.filter((b) => b.x !== x || b.y !== y);

  const directions = [
    { dx: 0, dy: 0 }, // center
    { dx: 0, dy: -1 }, // up
    { dx: 0, dy: 1 }, // down
    { dx: -1, dy: 0 }, // left
    { dx: 1, dy: 0 }, // right
  ];

  // array that contains all tiles that will be affected by the explosion to inform other players
  const affectedTiles = [];

  const directionNames = ["center", "up", "down", "left", "right"];

  directions.forEach(({ dx, dy }, index) => {
    const ex = x + dx;
    const ey = y + dy;

    // check if ouside of map
    if (ey < 0 || ey >= 15 || ex < 0 || ex >= 15) return;

    const tile = currentMap[ey][ex];

    // return nothing if wall
    if (tile === "wall") return;

    if (tile === "block") {
      currentMap[ey][ex] = "empty";
    }
    if (tile === "block") {
      currentMap[ey][ex] = "empty";

      if (Math.random() < 0.3) {
        const types = ["flame", "bomb", "speed"];
        const randomType = types[Math.floor(Math.random() * types.length)];
        powerUps.push({ x: ex, y: ey, type: randomType });
      }
    }

    affectedTiles.push({
      x: ex,
      y: ey,
      direction: directionNames[index],
    });
  });

  clients.forEach((client) => {
    if (!client.position) return;
    const { x, y } = client.position;
    const hit = affectedTiles.some((tile) => tile.x === x && tile.y === y);

    if (hit && client.lives > 0) {
      client.lives--;

      if (client.lives === 0) {
        client.position = null; // delete player from the map
        client.send(JSON.stringify({ type: "you_died" }));
      }
    }
  });
  setTimeout(() => {
    const alivePlayers = clients.filter((c) => c.lives > 0 && c.position);
    if (alivePlayers.length === 1) {
      const winner = alivePlayers[0];

      winner.send(
        JSON.stringify({
          type: "you_won",
          message: "🎉 You won the game!",
        })
      );

      broadcast({
        type: "game_over",
        winner: winner.name,
      });
    }
  }, 100);

  broadcast({
    type: "bomb_exploded",
    tiles: affectedTiles,
    players: clients.map((c) => ({
      name: c.name,
      position: c.position,
      character: c.character,
      lives: c.lives,
    })),
    powerUps,
  });
}

function isNicknameTaken(name) {
  return clients.some((client) => client.name === name);
}

console.log("WebSocket server is running on ws://localhost:3000");
