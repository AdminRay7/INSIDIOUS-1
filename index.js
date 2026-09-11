const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { MongoClient } = require("mongodb");
const { useMongoDBAuthState } = require("./lib/mongoAuthState");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const config = require("./config");
const { fancy } = require("./lib/font");

const app = express();
const PORT = process.env.PORT || 3000;

const { User } = require("./database/models");

// ---------------- MIDDLEWARE ----------------
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, "public")));

// Serve Assets for icons
app.use("/Assets", express.static(path.join(__dirname, "Assets")));

// ---------------- DATABASE ----------------
console.log(fancy("🔄 Connecting to MongoDB (mongoose)..."));
mongoose.connect(config.mongodb, {
    dbName: "insidious",
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
})
    .then(() => console.log(fancy("✅ Database connected.")))
    .catch(err => console.error("DB Error:", err));

// ---------------- GLOBAL STATE ----------------
global.conn = null;
global.socketReady = false;
global.mongoClient = null;
let hasWelcomed = false;

// ---------------- API AUTH ----------------
const API_KEY = process.env.API_KEY || config.apiKey || "changeme-please-rotate-this-key";

function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"] || req.query.apiKey;
    if (!key || key !== API_KEY) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

// ---------------- ROUTES ----------------

// Pairing UI (serves public/index.html automatically by express.static)
// Fallback to index.html for unknown routes
app.get("/", (req, res) => {
    const pairingPath = path.join(__dirname, "public", "index.html");
    res.sendFile(pairingPath);
});

// Mobile app
app.get("/mobile", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "app.html"));
});

// ---------- API: Login ----------
app.post("/api/login", (req, res) => {
    const { userId, apiKey } = req.body;
    if (!userId || !apiKey) {
        return res.status(400).json({ error: "userId and apiKey required" });
    }
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: "Invalid API key" });
    }
    res.json({
        success: true,
        userId,
        connected: global.conn?.user ? true : false
    });
});

// ---------- API: Sessions ----------
app.get("/api/me/sessions", requireApiKey, (req, res) => {
    const sessions = [];
    if (global.conn) {
        sessions.push({
            id: config.sessionName || "default",
            status: global.conn.user ? "connected" : (global.socketReady ? "connecting" : "closed"),
            startedAt: global._sessionStartedAt || Date.now()
        });
    }
    res.json({ sessions });
});

// ---------- API: Send text ----------
app.post("/api/send", requireApiKey, async (req, res) => {
    const { userId, to, text } = req.body;

    if (!to || !text) {
        return res.status(400).json({ error: "to and text required" });
    }
    if (!global.conn?.user) {
        return res.status(400).json({ error: "Bot is not connected" });
    }

    const jid = to.includes("@") ? to : to.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    try {
        const sent = await global.conn.sendMessage(jid, { text });
        res.json({ success: true, messageId: sent.key.id, to: jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- API: Send media ----------
app.post("/api/send-media", requireApiKey, async (req, res) => {
    const { to, url, caption, type = "image" } = req.body;

    if (!to || !url) {
        return res.status(400).json({ error: "to and url required" });
    }
    if (!global.conn?.user) {
        return res.status(400).json({ error: "Bot is not connected" });
    }

    const jid = to.includes("@") ? to : to.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const content = type === "video"
        ? { video: { url }, caption }
        : { image: { url }, caption };

    try {
        const sent = await global.conn.sendMessage(jid, content);
        res.json({ success: true, messageId: sent.key.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- API: Check number ----------
app.post("/api/check-number", requireApiKey, async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: "number required" });
    if (!global.conn?.user) return res.status(400).json({ error: "Bot not connected" });

    try {
        const jid = number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const result = await global.conn.onWhatsApp(jid);
        res.json({ exists: result?.length > 0, jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- API: Status ----------
app.get("/api/status", (req, res) => {
    res.json({
        connected: global.conn?.user ? true : false,
        ready: global.socketReady,
        uptime: process.uptime()
    });
});

// ---------- API: Stats ----------
app.get("/api/stats", async (req, res) => {
    try {
        let userCount = 0;
        if (mongoose.connection.readyState === 1) userCount = await User.countDocuments();
        res.json({
            users: userCount,
            uptime: process.uptime(),
            connected: global.conn?.user ? true : false
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// ---------- API: Pairing ----------
app.get("/api/pair", async (req, res) => {
    const num = req.query.num;
    if (!num) return res.json({ error: "Provide ?num=..." });

    const clean = num.replace(/[^0-9]/g, "");
    if (clean.length < 10 || clean.length > 15) {
        return res.json({ error: "Invalid phone number" });
    }

    if (!global.conn) {
        return res.json({ error: "Bot still starting up. Wait 10 seconds." });
    }
    if (global.conn.user) {
        return res.json({ error: "Bot is already paired." });
    }

    try {
        if (!global.socketReady) {
            const start = Date.now();
            while (!global.socketReady && Date.now() - start < 8000) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        if (!global.socketReady) throw new Error("Socket not ready");

        const code = await global.conn.requestPairingCode(clean);
        const formatted = code.match(/.{1,4}/g)?.join("-") || code;

        console.log(fancy(`✅ Pairing code: ${formatted}`));
        res.json({ success: true, code: formatted });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ---------- API: Reset Session ----------
app.get("/api/reset", async (req, res) => {
    try {
        if (!global.mongoClient) return res.json({ error: "DB not ready" });

        if (global.conn) {
            try {
                global.conn.ev.removeAllListeners();
                global.conn.ws?.close();
            } catch {}
            global.conn = null;
        }

        const collection = global.mongoClient.db("insidious").collection("authState");
        await collection.deleteMany({});
        console.log(fancy("🗑️ authState cleared."));

        global.socketReady = false;
        hasWelcomed = false;

        setTimeout(() => startInsidious().catch(e => console.error(e)), 1500);
        res.json({ success: true, message: "Session reset. Reconnecting..." });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ---------------- BOT START ----------------
async function startInsidious() {
    if (global.conn) {
        try {
            global.conn.ev.removeAllListeners();
            global.conn.ws?.close();
        } catch {}
        global.conn = null;
    }

    global.socketReady = false;

    if (!global.mongoClient) {
        global.mongoClient = new MongoClient(config.mongodb);
        await global.mongoClient.connect();
        console.log(fancy("✅ MongoDB session store connected."));
    }

    const collection = global.mongoClient.db("insidious").collection("authState");
    const { state, saveCreds } = await useMongoDBAuthState(collection);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
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
    global._sessionStartedAt = Date.now();
    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "connecting") {
            global.socketReady = true;
            console.log(fancy("🔌 Socket ready — pairing available."));
        }

        if (connection === "open") {
            global.socketReady = true;
            console.log(fancy("✅ INSIDIOUS is alive and connected!"));

            if (!hasWelcomed) {
                hasWelcomed = true;
                try {
                    const ownerJid = config.ownerNumber + "@s.whatsapp.net";
                    const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n\n${fancy(config.footer)}`;
                    await conn.sendMessage(ownerJid, { text: welcomeMsg });
                } catch (e) {
                    console.error("Welcome error:", e.message);
                }
            }
        }

        if (connection === "close") {
            global.socketReady = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(fancy(`❌ Connection closed (${code})`));

            if (code === 401 || code === DisconnectReason.loggedOut) {
                console.log(fancy("🚪 Logged out. Reset via /api/reset"));
                return;
            }

            if (code === 440) {
                console.log(fancy("🚨 440 CONFLICT — another instance running."));
                return;
            }

            if (code === 405 || code === 515) {
                setTimeout(() => startInsidious().catch(e => console.error(e)), 5000);
                return;
            }

            setTimeout(() => startInsidious().catch(e => console.error(e)), 5000);
        }
    });

    conn.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        if (config.newsletterJid && msg.key.remoteJid === config.newsletterJid) {
            try {
                const emojis = ["🥀", "❤️", "🔥", "⭐", "✨"];
                const e = emojis[Math.floor(Math.random() * emojis.length)];
                await conn.sendMessage(config.newsletterJid, {
                    react: { text: e, key: msg.key }
                });
            } catch {}
        }

        try {
            require("./handler")(conn, m, config.sessionName || "default");
        } catch (err) {
            console.error("Handler error:", err);
        }
    });

    conn.ev.on("call", async (calls) => {
        if (!config.anticall) return;
        for (const call of calls) {
            if (call.status === "offer") {
                try {
                    await conn.rejectCall(call.id, call.from);
                } catch {}
            }
        }
    });

    return conn;
}

// ---------------- BOOT ----------------
console.log(fancy("🚀 Starting INSIDIOUS Bot..."));
startInsidious().catch(err => {
    console.error("Boot error:", err);
    setTimeout(() => startInsidious().catch(e => console.error(e)), 10000);
});

app.listen(PORT, () => {
    console.log(fancy(`🌐 Pairing UI: http://localhost:${PORT}`));
    console.log(fancy(`📱 Mobile app: http://localhost:${PORT}/mobile`));
});