import createElement from "./createElement.js";
import mount from "./mount.js";
import { initState, setState } from "./state.js";
import renderMap from "./renderMaps.js";

let socket;

const state = {
  playerName: "",
  map: [],
  players: [],
  messages: [],
  bombs: [],
  explosions: [],
  powerUps: [],
  started: false,
  gameStartMessage: "",
  errorMessage: "",
  hasWon: false,
  hasLost: false,
  winnerScreen: false,
  gameOver: false,
};

let fps = 0;
const times = [];
let lastFpsUpdateTime = performance.now();
const fpsUpdateInterval = 500;

initState(state, () => {
  renderApp();
});

function namePage() {
  return createElement("div", {
    attrs: {
      class: "container",
    },
    children: [
      createElement("div", {
        attrs: {
          class: "image-overlay",
        },
        children: [
          createElement("div", {
            attrs: {
              class: "input-box",
            },
            children: [
              createElement("h2", {
                attrs: {
                  class: "title",
                },
                children: ["Enter your name to join"],
              }),

              createElement("input", {
                attrs: {
                  type: "text",
                  id: "playerName",
                  placeholder: "Enter your name",
                  class: "input",
                  onkeypress: (e) => {
                    if (e.key === "Enter") joinGame();
                  },
                },
              }),

              createElement("button", {
                attrs: {
                  id: "joinBtn",
                  onclick: joinGame,
                  class: "button",
                },
                children: ["Join"],
              }),

              state.errorMessage
                ? createElement("h1", {
                    attrs: {
                      class: "error",
                    },
                    children: [state.errorMessage],
                  })
                : "",
            ],
          }),
        ],
      }),
    ],
  });
}

function joinGame() {
  const input = document.getElementById("playerName");
  const name = input.value.trim();
  if (!name) return alert("Please enter a valid name!");

  socket = new WebSocket("ws://localhost:3000");

  socket.onopen = () => {
    setState({ playerName: name });
    window.onkeydown = function (e) {
      window.handleMovement(e);
      if (e.code === "Space") {
        window.dropBomb();
      }
    };

    socket.send(JSON.stringify({ type: "join", name }));

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "players") {
        setState({ players: data.players });
      }

      if (data.type === "message") {
        setState({ messages: [...state.messages, data.message] });
      }

      if (data.type === "game_start_message") {
        setState({ gameStartMessage: data.message });
      }
      if (data.type === "update_positions") {
        setState({
          players: data.players,
          powerUps: data.powerUps || [],
        });
      }

      if (data.type === "start") {
        setState({
          started: true,
          map: data.map,
          players: data.players,
        });
      }
      if (data.type === "nickname_taken") {
        setState({
          errorMessage:
            "This nickname is already taken. Please choose another one.",
          playerName: "",
        });
      }
      if (data.type === "bomb_dropped") {
        setState({ bombs: [...state.bombs, data.position] });
      }
      if (data.type === "bomb_exploded") {
        setState({
          explosions: [...state.explosions, ...data.tiles],
          bombs: state.bombs.filter(
            (b) => !data.tiles.some((t) => t.x === b.x && t.y === b.y)
          ),
          map: state.map.map((row, y) =>
            row.map((cell, x) => {
              return data.tiles.some(
                (t) => t.x === x && t.y === y && cell === "block"
              )
                ? "empty"
                : cell;
            })
          ),
          players: data.players,
          powerUps: data.powerUps || [],
        });
        setTimeout(() => {
          setState({
            explosions: state.explosions.filter(
              (e) => !data.tiles.some((t) => t.x === e.x && t.y === e.y)
            ),
          });
        }, 500);
      }
      if (data.type === "you_died") {
        alert("You died! GAME OVER💀");
        setState({ hasLost: true, gameOver: true });
      }
      if (data.type === "you_won") {
        setState({
          hasWon: true,
          hasLost: false,
          gameOverScreen: true,
        });
      }

      if (data.type === "game_over") {
        const didWin = data.winner === state.playerName;

        setState({
          hasWon: didWin,
          hasLost: !didWin,
          gameOverScreen: true,
        });
      }
    };
  };
}

function waitingRoom() {
  return createElement("div", {
    attrs: {
      style:
        "min-height: 100vh;display: flex;flex-direction: column;align-items: center;",
    },
    children: [
      createElement("h2", {
        children: [`Players in lobby: ${state.players.length}/4`],
      }),
      state.gameStartMessage
        ? createElement("h3", { children: [state.gameStartMessage] })
        : state.players.length >= 2
        ? createElement("h3", { children: ["Waiting for more players..."] })
        : createElement("h3", {
            children: ["Need at least 2 players to start"],
          }),
      createElement("ul", {
        attrs: { id: "playersList" },
        children: state.players.map((player) =>
          createElement("li", { children: [player] })
        ),
      }),
      createElement("div", {
        attrs: { id: "chatBox" },
        children: [
          createElement("h3", { children: ["💬 Chat"] }),
          createElement("div", {
            attrs: { id: "messages" },
            children: state.messages.map((msg) =>
              createElement("p", { children: [msg] })
            ),
          }),
          createElement("input", {
            attrs: {
              type: "text",
              id: "chatInput",
              placeholder: "Type a message",
              onkeypress: (e) => {
                if (e.key === "Enter") sendMessage();
              },
            },
          }),
          createElement("button", {
            attrs: {
              id: "sendBtn",
              onclick: sendMessage,
            },
            children: ["Send"],
          }),
        ],
      }),
    ],
  });
}

function gamePage() {
  const player = state.players.find((p) => p.name === state.playerName);

  return createElement("div", {
    children: [
      createElement("h1", { children: ["🧨 Game Started!"] }),
      createElement("p", {
        children: [`Players in game: ${state.players.length}`],
      }),
      createElement("p", {
        children: [`Lives: ${player?.lives ?? 3} ❤️`],
      }),
      createElement("p", {
        attrs: {
          id: "fpsCounter",
          class: "fps",
        },
        children: [`FPS: ${fps}`],
      }),

      renderMap(),
    ],
  });
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (message && socket) {
    socket.send(JSON.stringify({ type: "message", message }));
  }
}

///////////////// Event listener /////////////////////////
window.handleMovement = function (e) {
  if (!state.started || !socket || state.hasWon || state.hasLost) return;

  const me = state.players.find((p) => p.name === state.playerName);
  if (!me || me.lives === 0) return; // ⛔ the player is dead
  const directionKeys = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };

  const direction = directionKeys[e.key];
  if (!direction) return;
  // console.log("sending move:", direction);

  socket.send(
    JSON.stringify({
      type: "move",
      direction,
      name: state.playerName,
    })
  );
};

window.dropBomb = function () {
  const player = state.players.find((p) => p.name === state.playerName);
  if (!player || !socket) return;

  socket.send(
    JSON.stringify({
      type: "drop_bomb",
      position: player.position,
      name: state.playerName,
    })
  );
};

function gameOverScreen() {
  const title = state.hasWon ? "🏆 You Won!" : "❌ Game Over";
  const message = state.hasWon
    ? "Congratulations, you are the last one standing!"
    : "Better luck next time.";

  return createElement("div", {
    attrs: {
      class: "game-over-screen",
    },
    children: [
      createElement("h1", { children: [title] }),
      createElement("p", { children: [message] }),
      createElement("a", {
        attrs: {
          href: "/",
          class: "play-again-button",
        },
        children: ["🔁 Play Again"],
      }),
    ],
  });
}
function calculateFPS() {
  const now = performance.now();
  while (times.length > 0 && times[0] <= now - 1000) {
    times.shift();
  }
  times.push(now);
  fps = times.length;

  if (now - lastFpsUpdateTime >= fpsUpdateInterval) {
    const fpsEl = document.getElementById("fpsCounter");
    if (fpsEl) {
      setState({ fps: fps });
    }
    lastFpsUpdateTime = now;
  }

  requestAnimationFrame(calculateFPS);
}

calculateFPS();
function renderApp() {
  const $vApp = state.gameOverScreen
    ? gameOverScreen()
    : state.playerName
    ? state.started
      ? gamePage()
      : waitingRoom()
    : namePage();

  mount($vApp, document.getElementById("app"));
}

renderApp();
