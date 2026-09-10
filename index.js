const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs-extra");
const path = require("path");
const { fancy } = require("./lib/font");
const config = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;

const { User, Group, ChannelSubscriber } = require('./database/models');

// ---------------- DATABASE ----------------
const MONGODB_URI = config.mongodb || process.env.MONGODB_URI;
console.log(fancy("🔄 Connecting to MongoDB..."));
mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
})
.then(() => console.log(fancy("✅ Database connected.")))
.catch(err => console.error("DB Connection Error:", err));

// ---------------- GLOBAL STATE ----------------
global.conn = null;
global.socketReady = false;
global.pairingInProgress = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// ---------------- WEB UI ----------------
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>INSIDIOUS - WhatsApp Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            padding: 20px;
        }
        .container {
            background: rgba(0,0,0,0.85);
            backdrop-filter: blur(10px);
            border-radius: 28px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            border: 1px solid rgba(255,51,102,0.3);
            box-shadow: 0 0 40px rgba(255,51,102,0.1);
        }
        h1 {
            font-size: 2.8em;
            background: linear-gradient(135deg, #ff3366, #ff6633);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        .subtitle { color: #888; margin-bottom: 30px; font-size: 0.9em; }
        .status {
            display: inline-block;
            padding: 6px 18px;
            border-radius: 20px;
            font-size: 0.8em;
            margin-bottom: 20px;
        }
        .status.online { background: #00ff8822; color: #00ff88; border: 1px solid #00ff88; }
        .status.offline { background: #ff336622; color: #ff3366; border: 1px solid #ff3366; }
        .pair-box {
            background: #1a1a1a;
            padding: 30px;
            border-radius: 20px;
            margin: 20px 0;
        }
        .pair-box h3 { margin-bottom: 15px; color: #ff3366; }
        .pair-box p { color: #888; margin-bottom: 20px; font-size: 0.85em; }
        input {
            width: 100%;
            padding: 14px;
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 12px;
            color: white;
            font-size: 1em;
            margin-bottom: 15px;
            text-align: center;
        }
        input:focus { outline: none; border-color: #ff3366; }
        button {
            background: linear-gradient(135deg, #ff3366, #ff6633);
            color: white;
            border: none;
            padding: 14px 30px;
            border-radius: 12px;
            font-size: 1em;
            cursor: pointer;
            transition: transform 0.2s;
            width: 100%;
            font-weight: bold;
        }
        button:hover { transform: translateY(-2px); }
        button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 12px;
            display: none;
            font-size: 0.9em;
            word-break: break-all;
        }
        .result.success {
            background: #00ff8822;
            border: 1px solid #00ff88;
            display: block;
        }
        .result.error {
            background: #ff336622;
            border: 1px solid #ff3366;
            display: block;
        }
        .code-display {
            font-size: 1.8em;
            font-weight: bold;
            letter-spacing: 4px;
            margin: 15px 0;
            font-family: monospace;
        }
        .footer { margin-top: 30px; font-size: 0.7em; color: #555; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🥀 INSIDIOUS</h1>
        <div class="subtitle">WhatsApp Bot v2.1.1</div>
        <div class="status offline" id="status">● OFFLINE</div>
        
        <div class="pair-box">
            <h3>🔗 Connect Your Device</h3>
            <p>Enter your WhatsApp number (without + or spaces)</p>
            <input type="tel" id="phoneNumber" placeholder="Example: 2557xxxxxxxx" />
            <button onclick="pairDevice()" id="pairBtn">Get Pairing Code</button>
            <div id="result"></div>
        </div>
        
        <div class="footer">Developed by StanyTZ | Powered by Baileys</div>
    </div>

    <script>
        async function pairDevice() {
            const number = document.getElementById('phoneNumber').value;
            if (!number) { showResult('Please enter your phone number!', 'error'); return; }
            
            const btn = document.getElementById('pairBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Requesting code...';
            
            try {
                const response = await fetch('/api/pair?num=' + number);
                const data = await response.json();
                
                if (data.code) {
                    showResult('✅ <strong>Your pairing code:</strong><br><div class="code-display">' + data.code + '</div><br>📱 WhatsApp → Settings → Linked Devices → Link with phone number<br>🔑 Enter the code on your phone', 'success');
                } else {
                    showResult('❌ ' + (data.error || 'Pairing failed.'), 'error');
                }
            } catch (error) {
                showResult('❌ Network error. Try again.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Get Pairing Code';
            }
        }
        
        function showResult(message, type) {
            document.getElementById('result').innerHTML = '<div class="result ' + type + '">' + message + '</div>';
        }
        
        async function checkStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const statusDiv = document.getElementById('status');
                if (data.connected) {
                    statusDiv.className = 'status online';
                    statusDiv.innerHTML = '● ONLINE';
                } else if (data.ready) {
                    statusDiv.className = 'status online';
                    statusDiv.innerHTML = '● READY FOR PAIRING';
                } else {
                    statusDiv.className = 'status offline';
                    statusDiv.innerHTML = '● STARTING...';
                }
            } catch(e) {}
        }
        
        setInterval(checkStatus, 3000);
        checkStatus();
    </script>
</body>
</html>
    `);
});

// ---------------- STATUS ----------------
app.get('/api/status', (req, res) => {
    res.json({
        connected: global.conn?.user ? true : false,
        ready: global.socketReady,
        pairing: global.pairingInProgress,
        uptime: process.uptime()
    });
});

// ---------------- PAIRING ENDPOINT ----------------
app.get('/api/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ error: "Please provide a phone number!" });

    const cleanNumber = num.replace(/[^0-9]/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return res.json({ error: "Invalid phone number! Must be 10-15 digits." });
    }

    if (global.pairingInProgress) {
        return res.json({ error: "Another pairing request is in progress. Wait a few seconds." });
    }

    if (!global.conn || !global.socketReady) {
        return res.json({ error: "Bot is still starting up. Wait 10-15 seconds and try again." });
    }

    // If already authenticated, block new pairing
    if (global.conn.user) {
        return res.json({ error: "Bot is already connected to a WhatsApp account." });
    }

    global.pairingInProgress = true;

    try {
        console.log(fancy(`📱 Pairing requested for ${cleanNumber}`));

        // Small delay to let the WS fully settle
        await new Promise(r => setTimeout(r, 1000));

        const code = await global.conn.requestPairingCode(cleanNumber);
        if (!code) throw new Error("Empty code returned from WhatsApp");

        const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
        console.log(fancy(`✅ Pairing code for ${cleanNumber}: ${formattedCode}`));

        // Optional: store in DB
        try {
            if (mongoose.connection.readyState === 1) {
                await User.findOneAndUpdate(
                    { jid: cleanNumber + '@s.whatsapp.net' },
                    {
                        jid: cleanNumber + '@s.whatsapp.net',
                        name: `User_${cleanNumber.slice(-4)}`,
                        linkedAt: new Date(),
                        isActive: true
                    },
                    { upsert: true }
                );
            }
        } catch (dbErr) {
            console.log("DB save skipped:", dbErr.message);
        }

        return res.json({ success: true, code: formattedCode });

    } catch (err) {
        console.error("Pairing error:", err.message);

        if (err.message.includes("already exists")) {
            return res.json({ error: "Device already linked! Check WhatsApp linked devices." });
        }
        if (err.message.toLowerCase().includes("connection closed")) {
            return res.json({ error: "Socket closed. Wait 10 seconds and try again." });
        }
        if (err.message.includes("rate") || err.message.includes("429")) {
            return res.json({ error: "Too many attempts. Wait 15 minutes." });
        }

        return res.json({ error: "Pairing failed: " + err.message });

    } finally {
        // Release lock after a short cooldown
        setTimeout(() => { global.pairingInProgress = false; }, 5000);
    }
});

// ---------------- STATS ----------------
app.get('/api/stats', async (req, res) => {
    try {
        let userCount = 0;
        if (mongoose.connection.readyState === 1) userCount = await User.countDocuments();
        res.json({
            users: userCount,
            uptime: process.uptime(),
            connected: global.conn?.user ? true : false,
            ready: global.socketReady
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.get('/dashboard', (req, res) => res.redirect('/'));

// ---------------- BOT START ----------------
async function startInsidious() {
    // Clean stale listeners if a previous socket exists
    if (global.conn) {
        try {
            global.conn.ev.removeAllListeners('connection.update');
            global.conn.ev.removeAllListeners('creds.update');
            global.conn.ev.removeAllListeners('messages.upsert');
            global.conn.ev.removeAllListeners('call');
            global.conn.ws?.close();
        } catch (e) { /* ignore */ }
        global.conn = null;
    }

    global.socketReady = false;

    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    global.conn = conn;

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'connecting') {
            global.socketReady = true;
            console.log(fancy("🔌 Socket ready — pairing available."));
        }

        if (connection === 'open') {
            global.socketReady = true;
            reconnectAttempts = 0;
            console.log(fancy("✅ INSIDIOUS is alive and connected!"));

            try {
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n\n${fancy(config.footer)}`;
                await conn.sendMessage(ownerJid, { text: welcomeMsg });
            } catch (error) {
                console.error("Welcome message error:", error.message);
            }
        }

        if (connection === 'close') {
            global.socketReady = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || 'unknown';

            console.log(fancy(`❌ Connection closed (code: ${statusCode}, reason: ${reason})`));

            // Logged out → don't reconnect
            if (statusCode === DisconnectReason.loggedOut) {
                console.log(fancy("🚪 Logged out. Delete session folder and restart."));
                return;
            }

            // 405 during pairing is NORMAL — WhatsApp drops the socket
            // after issuing the code. Reconnect once cleanly.
            if (statusCode === 405 || statusCode === 515) {
                console.log(fancy("ℹ️ 405/515 — reconnecting after pairing handshake..."));
                setTimeout(() => startInsidious(), 5000);
                return;
            }

            // Cap reconnect attempts
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(5000 * reconnectAttempts, 30000);
                console.log(fancy(`🔄 Reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay/1000}s...`));
                setTimeout(() => startInsidious(), delay);
            } else {
                console.log(fancy("🛑 Max reconnect attempts reached. Restart the service."));
            }
        }
    });

    // ---------------- MESSAGES ----------------
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // Newsletter reaction
        if (config.newsletterJid && msg.key.remoteJid === config.newsletterJid) {
            try {
                const emojis = ['🥀', '❤️', '🔥', '⭐', '✨'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                await conn.sendMessage(config.newsletterJid, {
                    react: { text: randomEmoji, key: msg.key }
                });
            } catch (error) { /* silent */ }
        }

        try {
            require('./handler')(conn, m);
        } catch (err) {
            console.error("Handler error:", err);
        }
    });

    // ---------------- ANTICALL ----------------
    conn.ev.on('call', async (calls) => {
        if (!config.anticall) return;
        for (let call of calls) {
            if (call.status === 'offer') {
                try {
                    await conn.rejectCall(call.id, call.from);
                    await conn.sendMessage(call.from, {
                        text: fancy("🥀 No calls allowed. Only text messages.")
                    });
                } catch (error) {
                    console.error("Anticall error:", error.message);
                }
            }
        }
    });

    return conn;
}

// ---------------- BOOT ----------------
console.log(fancy("🚀 Starting INSIDIOUS Bot..."));
startInsidious().catch(err => {
    console.error("Failed to start bot:", err);
    setTimeout(() => startInsidious(), 10000);
});

app.listen(PORT, () => {
    console.log(fancy(`🌐 Web dashboard: http://localhost:${PORT}`));
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(fancy(`🌍 Public URL: ${process.env.RENDER_EXTERNAL_URL}`));
    }
});

module.exports = { startInsidious };
