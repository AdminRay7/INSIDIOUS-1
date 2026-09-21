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
// Map of sessionId -> { conn, socketReady, pairing, pairingNumber, startedAt, welcomed }
global.sessions = new Map();
global.mongoClient = null;

// ---------------- HELPERS ----------------
function toJid(input) {
    if (!input || typeof input !== "string") return null;
    if (input.includes("@")) return input;
    const digits = input.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return digits + "@s.whatsapp.net";
}

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

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

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
    res.json({ success: true, userId });
});

// ---------- API: Status (one session or all) ----------
app.get("/api/status", (req, res) => {
    const sessionId = req.query.sessionId;

    if (!sessionId) {
        const all = [];
        for (const [id, s] of global.sessions) {
            all.push({
                sessionId: id,
                connected: !!s.conn?.user,
                ready: s.socketReady,
                startedAt: s.startedAt
            });
        }
        return res.json({ sessions: all });
    }

    const s = global.sessions.get(sessionId);
    if (!s) {
        return res.json({ connected: false, ready: false, exists: false });
    }
    res.json({
        connected: !!s.conn?.user,
        ready: s.socketReady,
        exists: true,
        pairing: s.pairing || null,
        startedAt: s.startedAt
    });
});

// ---------- API: Sessions (list) ----------
app.get("/api/me/sessions", requireApiKey, (req, res) => {
    const list = [];
    for (const [id, s] of global.sessions) {
        list.push({
            id,
            status: s.conn?.user ? "connected" : (s.socketReady ? "connecting" : "closed"),
            startedAt: s.startedAt
        });
    }
    res.json({ sessions: list });
});

// ---------- API: Send text ----------
app.post("/api/send", requireApiKey, async (req, res) => {
    const { sessionId, to, text } = req.body;

    if (!sessionId || !to || !text) {
        return res.status(400).json({ error: "sessionId, to and text required" });
    }

    const session = global.sessions.get(sessionId);
    if (!session?.conn?.user) {
        return res.status(400).json({ error: "Session is not connected" });
    }

    const jid = toJid(to);
    if (!jid) {
        return res.status(400).json({ error: "Invalid recipient number" });
    }

    try {
        const sent = await session.conn.sendMessage(jid, { text });
        res.json({ success: true, messageId: sent.key.id, to: jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- API: Send media ----------
app.post("/api/send-media", requireApiKey, async (req, res) => {
    const { sessionId, to, url, caption, type = "image" } = req.body;

    if (!sessionId || !to || !url) {
        return res.status(400).json({ error: "sessionId, to and url required" });
    }
    if (!/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: "url must start with http:// or https://" });
    }

    const session = global.sessions.get(sessionId);
    if (!session?.conn?.user) {
        return res.status(400).json({ error: "Session is not connected" });
    }

    const jid = toJid(to);
    if (!jid) {
        return res.status(400).json({ error: "Invalid recipient number" });
    }

    const content = type === "video"
        ? { video: { url }, caption }
        : { image: { url }, caption };

    try {
        const sent = await session.conn.sendMessage(jid, content);
        res.json({ success: true, messageId: sent.key.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- API: Check number ----------
app.post("/api/check-number", requireApiKey, async (req, res) => {
    const { sessionId, number } = req.body;
    if (!sessionId || !number) {
        return res.status(400).json({ error: "sessionId and number required" });
    }

    const session = global.sessions.get(sessionId);
    if (!session?.conn?.user) {
        return res.status(400).json({ error: "Session not connected" });
    }

    const jid = toJid(number);
    if (!jid) {
        return res.status(400).json({ error: "Invalid number" });
    }

    try {
        const result = await session.conn.onWhatsApp(jid);
        res.json({ exists: result?.length > 0, jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- API: Stats ----------
app.get("/api/stats", async (req, res) => {
    try {
        let userCount = 0;
        if (mongoose.connection.readyState === 1) userCount = await User.countDocuments();

        let activeSessions = 0;
        for (const [, s] of global.sessions) {
            if (s.conn?.user) activeSessions++;
        }

        res.json({
            users: userCount,
            totalSessions: global.sessions.size,
            activeSessions,
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ---------- API: Pairing ----------
app.get("/api/pair", async (req, res) => {
    const sessionId = String(req.query.sessionId || "").trim();
    const num = String(req.query.num || "").replace(/[^0-9]/g, "");

    if (!sessionId) return res.status(400).json({ error: "Provide ?sessionId=..." });
    if (!num) return res.status(400).json({ error: "Provide ?num=..." });
    if (num.length < 10 || num.length > 15) {
        return res.status(400).json({ error: "Invalid phone number" });
    }

    try {
        const code = await requestPairingCodeForSession(sessionId, num);
        res.json({ success: true, sessionId, code });
    } catch (e) {
        console.error("Pair error:", e);
        res.status(500).json({ error: e.message || "Pairing failed" });
    }
});

// ---------- API: Logout session ----------
app.get("/api/logout", requireApiKey, async (req, res) => {
    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) return res.status(400).json({ error: "Provide ?sessionId=..." });

    try {
        await logoutSession(sessionId);
        res.json({ success: true, message: `Session ${sessionId} logged out.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------------- SESSION MANAGEMENT ----------------

async function initMongo() {
    if (!global.mongoClient) {
        global.mongoClient = new MongoClient(config.mongodb);
        await global.mongoClient.connect();
        console.log(fancy("✅ MongoDB session store connected."));
    }
}

async function requestPairingCodeForSession(sessionId, phoneNumber) {
    await initMongo();

    let session = global.sessions.get(sessionId);

    // If already connected, don't allow re-pairing
    if (session?.conn?.user) {
        throw new Error("Session is already paired");
    }

    // If pairing code already generated for this number, return it
    if (session?.pairing && session.pairingNumber === phoneNumber) {
        return session.pairing;
    }

    // Start a fresh socket if none exists
    if (!session) {
        session = {
            conn: null,
            socketReady: false,
            pairing: null,
            pairingNumber: null,
            startedAt: Date.now(),
            welcomed: false
        };
        global.sessions.set(sessionId, session);
        await bootSocket(sessionId, session);
    }

    // Wait for socket to be ready
    const deadline = Date.now() + 30000;
    while (!session.socketReady && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 500));
    }
    if (!session.socketReady) throw new Error("Socket not ready. Retry in a few seconds.");

    // Request the code (retry once if it fails on first try)
    let code;
    try {
        code = await session.conn.requestPairingCode(phoneNumber);
    } catch (e) {
        console.warn("Pairing first attempt failed, retrying:", e.message);
        await new Promise(r => setTimeout(r, 2000));
        code = await session.conn.requestPairingCode(phoneNumber);
    }

    const formatted = code.match(/.{1,4}/g)?.join("-") || code;
    session.pairing = formatted;
    session.pairingNumber = phoneNumber;
    console.log(fancy(`✅ [${sessionId}] pairing code: ${formatted}`));
    return formatted;
}

async function bootSocket(sessionId, session) {
    await initMongo();

    const collection = global.mongoClient.db("insidious").collection("authState");
    const { state, saveCreds } = await useMongoDBAuthState(collection, sessionId);
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

    session.conn = conn;
    conn.ev.on("creds.update", saveCreds);

    conn.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "connecting") {
            session.socketReady = true;
            console.log(fancy(`🔌 [${sessionId}] socket ready`));
        }

        if (connection === "open") {
            session.socketReady = true;
            session.pairing = null;
            session.pairingNumber = null;
            console.log(fancy(`✅ [${sessionId}] connected!`));

            // Save meta so we can resume on restart
            try {
                await collection.updateOne(
                    { _id: `${sessionId}:meta` },
                    { $set: { value: { jid: conn.user?.id, linkedAt: Date.now() } } },
                    { upsert: true }
                );
            } catch (e) {
                console.error(`[${sessionId}] meta save failed:`, e.message);
            }

            // Welcome message to bot owner (once)
            if (!session.welcomed && config.ownerNumber) {
                session.welcomed = true;
                try {
                    const ownerJid = toJid(String(config.ownerNumber));
                    if (ownerJid) {
                        const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ New session linked!\nSession: ${sessionId}\n\n${fancy(config.footer)}`;
                        await conn.sendMessage(ownerJid, { text: welcomeMsg });
                    }
                } catch (e) {
                    console.error("Welcome error:", e.message);
                }
            }
        }

        if (connection === "close") {
            session.socketReady = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(fancy(`❌ [${sessionId}] closed (${code})`));

            if (code === 401 || code === DisconnectReason.loggedOut) {
                console.log(fancy(`🚪 [${sessionId}] logged out`));
                await logoutSession(sessionId);
                return;
            }

            if (code === 440) {
                console.log(fancy(`🚨 [${sessionId}] 440 conflict`));
                return;
            }

            // Reconnect for any other reason
            setTimeout(() => {
                if (!global.sessions.has(sessionId)) return;
                console.log(fancy(`🔁 [${sessionId}] reconnecting...`));
                bootSocket(sessionId, session).catch(e =>
                    console.error(`[${sessionId}] reconnect failed:`, e.message)
                );
            }, 5000);
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
            require("./handler")(conn, m, sessionId);
        } catch (err) {
            console.error(`[${sessionId}] handler error:`, err);
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

async function logoutSession(sessionId) {
    const session = global.sessions.get(sessionId);
    if (session) {
        try {
            session.conn?.ev.removeAllListeners();
            session.conn?.ws?.close();
        } catch {}
        global.sessions.delete(sessionId);
    }

    try {
        await initMongo();
        const collection = global.mongoClient.db("insidious").collection("authState");
        await collection.deleteMany({ _id: { $regex: `^${sessionId}:` } });
        console.log(fancy(`🗑️ [${sessionId}] session data deleted`));
    } catch (e) {
        console.error(`[${sessionId}] cleanup error:`, e.message);
    }
}

async function resumeAllSessions() {
    await initMongo();
    const collection = global.mongoClient.db("insidious").collection("authState");
    const metas = await collection.find({ _id: { $regex: ":meta$" } }).toArray();

    console.log(fancy(`🔄 Resuming ${metas.length} session(s)...`));

    for (const meta of metas) {
        const sessionId = meta._id.replace(/:meta$/, "");
        if (global.sessions.has(sessionId)) continue;

        const session = {
            conn: null,
            socketReady: false,
            pairing: null,
            pairingNumber: null,
            startedAt: Date.now(),
            welcomed: false
        };
        global.sessions.set(sessionId, session);

        try {
            await bootSocket(sessionId, session);
        } catch (e) {
            console.error(`Resume ${sessionId} failed:`, e.message);
        }

        await new Promise(r => setTimeout(r, 1500));
    }
}

// ---------------- GRACEFUL SHUTDOWN ----------------
async function shutdown(sig) {
    console.log(fancy(`\n🛑 ${sig} — shutting down...`));
    try {
        for (const [, s] of global.sessions) {
            s.conn?.ev?.removeAllListeners();
            s.conn?.ws?.close();
        }
        if (global.mongoClient) await global.mongoClient.close();
        await mongoose.connection.close();
    } catch (e) {
        console.error("Shutdown error:", e);
    }
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
});

// ---------------- BOOT ----------------
(async () => {
    console.log(fancy("🚀 Starting INSIDIOUS Bot..."));

    try {
        await initMongo();
        await resumeAllSessions();
    } catch (err) {
        console.error("Boot error:", err);
    }

    app.listen(PORT, () => {
        console.log(fancy(`🌐 Pairing UI: http://localhost:${PORT}`));
        console.log(fancy(`📱 Mobile app: http://localhost:${PORT}/mobile`));
    });
})();