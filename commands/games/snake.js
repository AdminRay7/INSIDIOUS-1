/**
 * SNAKE GAME — WhatsApp Edition
 * Real moving animation with buttons.
 */

const config = require("../../config");
const { fancy } = require("../../lib/font");

// ---------- CONFIG ----------
const BOARD_W = 10;
const BOARD_H = 10;
const TICK_MS = 1500;          // auto-tick speed
const GAME_TTL = 5 * 60 * 1000; // game expires after 5 min idle

// ---------- EMULATOR STATE ----------
// Map<chatId, gameState>
const games = new Map();

// ---------- HELPERS ----------
const EMOJI = {
    empty: "⬛",
    snake: "🟩",
    head:  "🟢",
    food:  "🍎",
    wall:  "⬜"
};

function randInt(n) { return Math.floor(Math.random() * n); }

function spawnFood(state) {
    let x, y, tries = 0;
    do {
        x = randInt(BOARD_W);
        y = randInt(BOARD_H);
        tries++;
    } while (state.snake.some(p => p.x === x && p.y === y) && tries < 200);
    state.food = { x, y };
}

function createGame(chatId, playerJid) {
    const startX = Math.floor(BOARD_W / 2);
    const startY = Math.floor(BOARD_H / 2);
    const state = {
        chatId,
        player: playerJid,
        snake: [
            { x: startX, y: startY },
            { x: startX - 1, y: startY },
            { x: startX - 2, y: startY }
        ],
        dir: "right",
        food: { x: 0, y: 0 },
        score: 0,
        alive: true,
        messageId: null,
        lastMove: Date.now(),
        timer: null
    };
    spawnFood(state);
    return state;
}

function render(state) {
    const grid = Array.from({ length: BOARD_H }, () =>
        Array.from({ length: BOARD_W }, () => EMOJI.empty)
    );

    // Food
    if (state.food) grid[state.food.y][state.food.x] = EMOJI.food;

    // Snake body
    for (let i = state.snake.length - 1; i >= 1; i--) {
        const p = state.snake[i];
        if (p.y >= 0 && p.y < BOARD_H && p.x >= 0 && p.x < BOARD_W) {
            grid[p.y][p.x] = EMOJI.snake;
        }
    }

    // Head
    const head = state.snake[0];
    if (head.y >= 0 && head.y < BOARD_H && head.x >= 0 && head.x < BOARD_W) {
        grid[head.y][head.x] = EMOJI.head;
    }

    const board = grid.map(row => row.join("")).join("\n");

    return (
        `╭─── • 🐍 • ───╮\n` +
        `   ꜱɴᴀᴋᴇ ɢᴀᴍᴇ\n` +
        `╰─── • 🐍 • ───╯\n\n` +
        `${board}\n\n` +
        `🍎 ꜱᴄᴏʀᴇ: *${state.score}*\n` +
        `📏 ʟᴇɴɢᴛʜ: *${state.snake.length}*\n` +
        `⚡ ᴅɪʀ: *${state.dir.toUpperCase()}*\n\n` +
        `_ᴛᴀᴘ ᴀ ʙᴜᴛᴛᴏɴ ᴛᴏ ᴍᴏᴠᴇ_`
    );
}

function buttons() {
    return [
        { buttonId: "snake_up",    buttonText: { displayText: "⬆️" }, type: 1 },
        { buttonId: "snake_down",  buttonText: { displayText: "⬇️" }, type: 1 },
        { buttonId: "snake_left",  buttonText: { displayText: "⬅️" }, type: 1 },
        { buttonId: "snake_right", buttonText: { displayText: "➡️" }, type: 1 },
        { buttonId: "snake_quit",  buttonText: { displayText: "❌ Quit" }, type: 1 }
    ];
}

async function sendGame(conn, jid, state, quoted) {
    const sent = await conn.sendMessage(
        jid,
        {
            text: render(state),
            footer: "Insidious Snake",
            buttons: buttons(),
            headerType: 1
        },
        quoted ? { quoted } : undefined
    );
    state.messageId = sent.key;
    return sent;
}

async function updateGame(conn, state) {
    try {
        await conn.sendMessage(state.chatId, {
            text: render(state),
            edit: state.messageId,
            buttons: buttons(),
            footer: "Insidious Snake",
            headerType: 1
        });
    } catch (e) {
        console.error("updateGame error:", e.message);
    }
}

function opposite(d1, d2) {
    return (
        (d1 === "up" && d2 === "down") ||
        (d1 === "down" && d2 === "up") ||
        (d1 === "left" && d2 === "right") ||
        (d1 === "right" && d2 === "left")
    );
}

function tick(state) {
    if (!state.alive) return;

    const head = { ...state.snake[0] };

    if (state.dir === "up") head.y -= 1;
    if (state.dir === "down") head.y += 1;
    if (state.dir === "left") head.x -= 1;
    if (state.dir === "right") head.x += 1;

    // Wall collision
    if (head.x < 0 || head.x >= BOARD_W || head.y < 0 || head.y >= BOARD_H) {
        state.alive = false;
        return;
    }

    // Self collision (ignore tail tip that will move)
    const bodyWithoutTail = state.snake.slice(0, -1);
    if (bodyWithoutTail.some(p => p.x === head.x && p.y === head.y)) {
        state.alive = false;
        return;
    }

    state.snake.unshift(head);

    if (state.food && head.x === state.food.x && head.y === state.food.y) {
        state.score += 1;
        spawnFood(state);
    } else {
        state.snake.pop();
    }

    state.lastMove = Date.now();
}

function startTimer(conn, state) {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(async () => {
        const game = games.get(state.chatId);
        if (!game || !game.alive) {
            clearInterval(state.timer);
            return;
        }

        tick(game);

        if (!game.alive) {
            clearInterval(game.timer);
            await endGame(conn, game);
            return;
        }

        await updateGame(conn, game);
    }, TICK_MS);
}

async function endGame(conn, state) {
    state.alive = false;
    if (state.timer) clearInterval(state.timer);

    const overMsg =
        `╭─── • 💀 • ───╮\n` +
        `   ɢᴀᴍᴇ ᴏᴠᴇʀ\n` +
        `╰─── • 💀 • ───╯\n\n` +
        `🍎 ꜰɪɴᴀʟ ꜱᴄᴏʀᴇ: *${state.score}*\n` +
        `📏 ʟᴇɴɢᴛʜ: *${state.snake.length}*\n\n` +
        `_ᴛʏᴘᴇ .ꜱɴᴀᴋᴇ ᴛᴏ ᴘʟᴀʏ ᴀɢᴀɪɴ_`;

    try {
        await conn.sendMessage(state.chatId, {
            text: overMsg,
            edit: state.messageId
        });
    } catch {
        try {
            await conn.sendMessage(state.chatId, { text: overMsg });
        } catch {}
    }

    games.delete(state.chatId);
}

// ---------- COMMAND ----------
module.exports = {
    name: "snake",
    aliases: ["snek", "snakegame"],
    category: "games",
    description: "Play a real Snake game with WhatsApp buttons",

    async execute(conn, msg, args, opts) {
        const { from, sender } = opts;

        // Only allow one game per chat
        if (games.has(from)) {
            return conn.sendMessage(from, {
                text: fancy("⚠️ A game is already running in this chat.")
            }, { quoted: msg });
        }

        const state = createGame(from, sender);
        games.set(from, state);

        await sendGame(conn, from, state, msg);
        startTimer(conn, state);
    },

    /**
     * Called from handler when a button reply is received.
     * Button ID format: snake_up / snake_down / snake_left / snake_right / snake_quit
     */
    async handleButton(conn, msg, buttonId, opts) {
        const { from, sender } = opts;
        const state = games.get(from);

        if (!state) {
            return conn.sendMessage(from, {
                text: fancy("❌ No active game here. Type .ꜱɴᴀᴋᴇ to start.")
            }, { quoted: msg });
        }

        // Only the original player can control
        if (state.player !== sender) {
            return conn.sendMessage(from, {
                text: fancy("⚠️ Only the player who started the game can control it.")
            }, { quoted: msg });
        }

        if (!state.alive) {
            games.delete(from);
            return conn.sendMessage(from, {
                text: fancy("💀 The game has ended. Type .ꜱɴᴀᴋᴇ to play again.")
            }, { quoted: msg });
        }

        if (buttonId === "snake_quit") {
            return endGame(conn, state);
        }

        const map = {
            snake_up: "up",
            snake_down: "down",
            snake_left: "left",
            snake_right: "right"
        };
        const newDir = map[buttonId];

        if (newDir) {
            // Prevent 180-degree turn
            if (!opposite(state.dir, newDir)) {
                state.dir = newDir;
            }

            // Advance immediately so the tap feels responsive
            tick(state);

            if (!state.alive) {
                await endGame(conn, state);
                return;
            }

            await updateGame(conn, state);
        }
    }
};