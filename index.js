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
const path = require("path");
const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs-extra");
const { fancy } = require("./lib/font");
const config = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORT DATABASE MODELS
const { User, Group, ChannelSubscriber } = require('./database/models');

// DATABASE CONNECTION - FIXED
const MONGODB_URI = config.mongodb || process.env.MONGODB_URI;
console.log(fancy("🔄 Connecting to MongoDB..."));
mongoose.connect(MONGODB_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
})
.then(() => console.log(fancy("✅ database connected: insidious is eternal.")))
.catch(err => console.error("DB Connection Error:", err));

// Simple HTML page for pairing
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
        .loading { animation: pulse 1s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
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
        
        <div class="footer">
            Developed by StanyTZ | Powered by Baileys
        </div>
    </div>

    <script>
        async function pairDevice() {
            const number = document.getElementById('phoneNumber').value;
            if (!number) {
                showResult('Please enter your phone number!', 'error');
                return;
            }
            
            const btn = document.getElementById('pairBtn');
            btn.disabled = true;
            btn.textContent = '⏳ Processing...';
            
            try {
                const response = await fetch('/api/pair?num=' + number);
                const data = await response.json();
                
                if (data.code) {
                    showResult('✅ <strong>Your pairing code:</strong><br><div class="code-display">' + data.code + '</div><br>📱 Open WhatsApp → Settings → Linked Devices → Link with phone number<br>🔑 Enter this code', 'success');
                } else {
                    showResult('❌ ' + (data.error || 'Pairing failed. Try again.'), 'error');
                }
            } catch (error) {
                showResult('❌ Network error. Please try again.', 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Get Pairing Code';
            }
        }
        
        function showResult(message, type) {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="result ' + type + '">' + message + '</div>';
        }
        
        async function checkStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const statusDiv = document.getElementById('status');
                if (data.connected) {
                    statusDiv.className = 'status online';
                    statusDiv.innerHTML = '● ONLINE - Ready to pair';
                } else {
                    statusDiv.className = 'status offline';
                    statusDiv.innerHTML = '● OFFLINE - Starting up...';
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

// API endpoints
app.get('/api/status', (req, res) => {
    res.json({ 
        connected: global.conn ? true : false,
        uptime: process.uptime()
    });
});

// FIXED PAIRING ENDPOINT - NO DATABASE REQUIRED FOR BASIC PAIRING
app.get('/api/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) {
        return res.json({ error: "Please provide a phone number!" });
    }
    
    // Clean the number - remove any +, spaces, dashes
    const cleanNumber = num.replace(/[^0-9]/g, '');
    
    // Validate number length (basic check)
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return res.json({ error: "Invalid phone number! Must be 10-15 digits." });
    }
    
    try {
        // Check if bot is connected
        if (!global.conn) {
            return res.json({ error: "Bot is starting. Please wait 15 seconds and refresh the page." });
        }
        
        console.log(fancy(`📱 Requesting pairing code for ${cleanNumber}`));
        
        // Request the pairing code
        const code = await global.conn.requestPairingCode(cleanNumber);
        
        if (!code) {
            return res.json({ error: "Failed to get code. Please try again." });
        }
        
        // Format code with dashes for readability
        const formattedCode = code.match(/.{1,4}/g)?.join("-") || code;
        
        console.log(fancy(`✅ Pairing code sent for ${cleanNumber}: ${formattedCode}`));
        
        // Try to save to database if connected (but don't fail if it doesn't work)
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
            console.log("Database save skipped:", dbErr.message);
        }
        
        return res.json({ 
            success: true, 
            code: formattedCode
        });
        
    } catch (err) {
        console.error("Pairing error:", err);
        
        // Handle specific errors
        if (err.message.includes("already exists")) {
            return res.json({ error: "Device already connected! Check WhatsApp linked devices." });
        }
        if (err.message.includes("timeout")) {
            return res.json({ error: "Connection timeout. Please wait and try again." });
        }
        
        return res.json({ error: "Pairing failed: " + err.message });
    }
});

// Stats endpoint
app.get('/api/stats', async (req, res) => {
    try {
        let userCount = 0;
        if (mongoose.connection.readyState === 1) {
            userCount = await User.countDocuments();
        }
        res.json({ 
            users: userCount,
            uptime: process.uptime(),
            connected: global.conn ? true : false
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    res.redirect('/');
});

async function startInsidious() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: true,
        generateHighQualityLinkPreview: true,
        // Increase timeouts for better stability
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000
    });

    // Store conn globally for pairing endpoint
    global.conn = conn;

    // Handle connection updates
    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'open') {
            console.log(fancy("✅ INSIDIOUS is alive and connected!"));
            
            // Send welcome to owner
            try {
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n\n${fancy(config.footer)}`;
                await conn.sendMessage(ownerJid, { text: welcomeMsg });
            } catch (error) {
                console.error("Welcome message error:", error);
            }
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(fancy("🔄 Reconnecting in 5 seconds..."));
                setTimeout(startInsidious, 5000);
            } else {
                console.log(fancy("❌ Logged out. Please restart the bot."));
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // Message handler
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // Channel posts reaction
        if (config.newsletterJid && msg.key.remoteJid === config.newsletterJid) {
            try {
                const emojis = ['🥀', '❤️', '🔥', '⭐', '✨'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                await conn.sendMessage(config.newsletterJid, { 
                    react: { text: randomEmoji, key: msg.key } 
                });
            } catch (error) {
                // Silently fail
            }
        }

        // Pass to Master Handler
        try {
            require('./handler')(conn, m);
        } catch (err) {
            console.error("Handler error:", err);
        }
    });

    // Anti-call feature
    conn.ev.on('call', async (calls) => {
        if (config.anticall) {
            for (let call of calls) {
                if (call.status === 'offer') {
                    try {
                        await conn.rejectCall(call.id, call.from);
                        await conn.sendMessage(call.from, { 
                            text: fancy("🥀 No calls allowed. Only text messages.") 
                        });
                    } catch (error) {
                        console.error("Anticall error:", error);
                    }
                }
            }
        }
    });

    return conn;
}

// Start the bot
console.log(fancy("🚀 Starting INSIDIOUS Bot..."));
startInsidious().catch(err => {
    console.error("Failed to start bot:", err);
    setTimeout(() => {
        console.log(fancy("🔄 Restarting bot..."));
        startInsidious();
    }, 10000);
});

// Start web server
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web dashboard: http://localhost:${PORT}`));
    if (process.env.RENDER_EXTERNAL_URL) {
        console.log(fancy(`🌍 Public URL: ${process.env.RENDER_EXTERNAL_URL}`));
    }
});

module.exports = { startInsidious };
