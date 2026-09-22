// ---- Force heap cap on Render free tier ----
if (typeof global.gc === "function") {
    setInterval(() => { try { global.gc(); } catch {} }, 5 * 60 * 1000).unref();
}

require("dotenv").config();

const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    BufferJSON
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
const PORT = process.env.PORT || config.port || 3000;

const { User } = require("./database/models");

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/Assets", express.static(path.join(__dirname, "Assets")));

// ---------------- SESSION_ID PARSE ----------------
const SESSION_PREFIX = '_INSIDIOUS_"';
const SESSION_ID = process.env.SESSION_ID || config.sessionId;

let credsFromSession = null;
if (SESSION_ID) {
    try {
        if (!SESSION_ID.startsWith(SESSION_PREFIX)) {
            console.error(fancy(`❌ SESSION_ID must start with: ${SESSION_PREFIX}`));
            process.exit(1);
        }
        const raw = SESSION_ID.slice(SESSION_PREFIX.length);
        credsFromSession = JSON.parse(Buffer.from(raw, "base64").toString("utf-8"), BufferJSON.reviver);
        console.log(fancy("✅ SESSION_ID parsed successfully"));
    } catch (e) {
        console.error(fancy("❌ Invalid SESSION_ID: " + e.message));
        process.exit(1);
    }
}

// ---------------- DATABASE ----------------
if (config.mongodb) {
    console.log(fancy("🔄 Connecting to MongoDB (mongoose)..."));
    mongoose.connect(config.mongodb, {
        dbName: "insidious",
        serverSelectionTimeoutMS: 30000,
        connectTimeoutMS: 30000
    })
        .then(() => console.log(fancy("✅ Database connected.")))
        .catch(err => console.error("DB Error:", err));
}

// ---------------- GLOBAL STATE ----------------
global.sessions = new Map();
global.mongoClient = null;

const MAX_SESSIONS = 12;
let pairingQueue = Promise.resolve();

function enqueuePairing(fn) {
    const next = pairingQueue.then(fn, fn);
    pairingQueue = next.catch(() => {});
    return next;
}

// ---------------- HELPERS ----------------
function toJid(input) {
    if (!input || typeof input !== "string") return null;
    if (input.includes("@")) return input;
    const digits = input.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) return null;
    return digits + "@s.whatsapp.net";
}
function firstActiveSessionId() {
    for (const [id, s] of global.sessions) if (s.conn?.user) return id;
    return null;
}

// ---------------- API AUTH ----------------
const API_KEY = process.env.API_KEY || config.apiKey || "change-this-key-please";
function requireApiKey(req, res, next) {
    const key = req.headers["x-api-key"] || req.query.apiKey;
    if (!key || key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
    next();
}

// ---------------- ROUTES ----------------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/mobile", (req, res) => res.sendFile(path.join(__dirname, "public", "app.html")));

app.post("/api/login", (req, res) => {
    const { userId, apiKey } = req.body;
    if (!userId || !apiKey) return res.status(400).json({ error: "userId and apiKey required" });
    if (apiKey !== API_KEY) return res.status(401).json({ error: "Invalid API key" });
    res.json({ success: true, userId });
});

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
        return res.json({
            botName: config.botName,
            connected: all.some(s => s.connected),
            ready: all.some(s => s.ready),
            uptime: process.uptime(),
            totalSessions: global.sessions.size,
            maxSessions: MAX_SESSIONS,
            sessions: all
        });
    }
    const s = global.sessions.get(sessionId);
    if (!s) return res.json({ connected: false, ready: false, exists: false });
    res.json({
        connected: !!s.conn?.user,
        ready: s.socketReady,
        exists: true,
        pairing: s.pairing || null,
        startedAt: s.startedAt
    });
});

app.get("/api/me/sessions", requireApiKey, (req, res) => {
    const list = [];
    for (const [id, s] of global.sessions) {
        list.push({
            id,
            status: s.conn?.user ? "connected" : (s.socketReady ? "connecting" : "closed"),
            startedAt: s.startedAt
        });
    }
    res.json({ sessions: list, total: list.length, max: MAX_SESSIONS });
});

app.post("/api/send", requireApiKey, async (req, res) => {
    const { sessionId, to, text } = req.body;
    if (!to || !text) return res.status(400).json({ error: "to and text required" });

    const target = sessionId || firstActiveSessionId();
    const session = target ? global.sessions.get(target) : null;
    if (!session?.conn?.user) return res.status(400).json({ error: "Session not connected" });

    const jid = toJid(to);
    if (!jid) return res.status(400).json({ error: "Invalid recipient number" });

    try {
        const sent = await session.conn.sendMessage(jid, { text });
        res.json({ success: true, messageId: sent.key.id, to: jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/send-media", requireApiKey, async (req, res) => {
    const { sessionId, to, url, caption, type = "image" } = req.body;
    if (!to || !url) return res.status(400).json({ error: "to and url required" });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "invalid url" });

    const target = sessionId || firstActiveSessionId();
    const session = target ? global.sessions.get(target) : null;
    if (!session?.conn?.user) return res.status(400).json({ error: "Session not connected" });

    const jid = toJid(to);
    if (!jid) return res.status(400).json({ error: "Invalid recipient number" });

    const content = type === "video" ? { video: { url }, caption } : { image: { url }, caption };
    try {
        const sent = await session.conn.sendMessage(jid, content);
        res.json({ success: true, messageId: sent.key.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/check-number", requireApiKey, async (req, res) => {
    const { sessionId, number } = req.body;
    if (!number) return res.status(400).json({ error: "number required" });

    const target = sessionId || firstActiveSessionId();
    const session = target ? global.sessions.get(target) : null;
    if (!session?.conn?.user) return res.status(400).json({ error: "Session not connected" });

    const jid = toJid(number);
    if (!jid) return res.status(400).json({ error: "Invalid number" });

    try {
        const result = await session.conn.onWhatsApp(jid);
        res.json({ exists: result?.length > 0, jid });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/stats", async (req, res) => {
    try {
        let userCount = 0;
        if (mongoose.connection.readyState === 1) userCount = await User.countDocuments();
        let activeSessions = 0;
        for (const [, s] of global.sessions) if (s.conn?.user) activeSessions++;
        res.json({
            users: userCount,
            totalSessions: global.sessions.size,
            activeSessions,
            maxSessions: MAX_SESSIONS,
            uptime: process.uptime()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ---------- Pairing ----------
app.get("/api/pair", async (req, res) => {
    if (SESSION_ID && !config.mongodb) {
        return res.status(400).json({ error: "This bot uses SESSION_ID mode. Pairing disabled." });
    }
    const sessionId = String(req.query.sessionId || "").trim();
    const num = String(req.query.num || "").replace(/\D/g, "");

    if (!sessionId) return res.status(400).json({ error: "Provide ?sessionId=..." });
    if (!num) return res.status(400).json({ error: "Provide ?num=..." });
    if (num.length < 10 || num.length > 15) return res.status(400).json({ error: "Invalid phone number" });

    try {
        const code = await requestPairingCodeForSession(sessionId, num);
        res.json({ success: true, sessionId, code });
    } catch (e) {
        console.error("Pair error:", e);
        res.status(500).json({ error: e.message || "Pairing failed" });
    }
});

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
    if (!config.mongodb) return false;
    if (!global.mongoClient) {
        global.mongoClient = new MongoClient(config.mongodb);
        await global.mongoClient.connect();
        console.log(fancy("✅ MongoDB session store connected."));
    }
    return true;
}

async function requestPairingCodeForSession(sessionId, phoneNumber) {
    return enqueuePairing(async () => {
        await initMongo();
        let session = global.sessions.get(sessionId);

        if (session?.conn?.user) throw new Error("Session is already paired");
        if (session?.pairing && session.pairingNumber === phoneNumber) return session.pairing;

        if (!session) {
            if (global.sessions.size >= MAX_SESSIONS) {
                throw new Error(`Server is at capacity (${MAX_SESSIONS} sessions). Try again later.`);
            }
            session = {
                conn: null, socketReady: false,
                pairing: null, pairingNumber: null,
                startedAt: Date.now(), welcomed: false
            };
            global.sessions.set(sessionId, session);
            await bootSocket(sessionId, session);
        }

        const deadline = Date.now() + 30000;
        while (!session.socketReady && Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 500));
        }
        if (!session.socketReady) throw new Error("Socket not ready. Retry in a few seconds.");

        let code;
        try {
            code = await session.conn.requestPairingCode(phoneNumber);
        } catch (e) {
            await new Promise(r => setTimeout(r, 2000));
            code = await session.conn.requestPairingCode(phoneNumber);
        }

        const formatted = code.match(/.{1,4}/g)?.join("-") || code;
        session.pairing = formatted;
        session.pairingNumber = phoneNumber;
        console.log(fancy(`✅ [${sessionId}] pairing code: ${formatted}`));
        return formatted;
    });
}

async function bootSocket(sessionId, session, useSessionCreds = false) {
    const { version } = await fetchLatestBaileysVersion();
    let auth;

    if (useSessionCreds && credsFromSession) {
        auth = {
            creds: credsFromSession,
            keys: makeCacheableSignalKeyStore({}, pino({ level: "silent" }))
        };
    } else {
        const ok = await initMongo();
        if (!ok) throw new Error("No MongoDB — cannot use multi-session pairing");
        const collection = global.mongoClient.db("insidious").collection("authState");
        const { state, saveCreds } = await useMongoDBAuthState(collection, sessionId);
        auth = {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        };
        session._saveCreds = saveCreds;
        session._collection = collection;
    }

    const conn = makeWASocket({
        version,
        auth,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 60000,
        retryRequestDelayMs: 2000,
        maxMsgRetryCount: 2,
        fireInitQueries: false,
        emitOwnEvents: false
    });

    session.conn = conn;
    if (session._saveCreds) conn.ev.on("creds.update", session._saveCreds);

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
            console.log(fancy(`✅ [${sessionId}] connected as ${conn.user?.id}`));

            if (session._collection) {
                try {
                    await session._collection.updateOne(
                        { _id: `${sessionId}:meta` },
                        { $set: { value: { jid: conn.user?.id, linkedAt: Date.now() } } },
                        { upsert: true }
                    );
                } catch {}
            }

            if (!session.welcomed && config.ownerNumber) {
                session.welcomed = true;
                try {
                    const ownerJid = toJid(String(config.ownerNumber));
                    if (ownerJid) {
                        const welcomeMsg =
                            `╭─── • 🥀 • ───╮\n` +
                            `   ${config.botName || "INSIDIOUS"} ᴠ${config.version}\n` +
                            `╰─── • 🥀 • ───╯\n\n` +
                            `✅ Bot is online!\nSession: ${sessionId}\n\n` +
                            `${fancy(config.footer || "")}`;
                        await conn.sendMessage(ownerJid, { text: welcomeMsg });
                    }
                } catch {}
            }
        }

        if (connection === "close") {
            session.socketReady = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            console.log(fancy(`❌ [${sessionId}] closed (${code})`));

            if (code === 401 || code === DisconnectReason.loggedOut) {
                console.log(fancy(`🚪 [${sessionId}] logged out`));
                if (session._collection) await logoutSession(sessionId);
                return;
            }
            if (code === 440) {
                console.log(fancy(`🚨 [${sessionId}] 440 conflict`));
                return;
            }
            setTimeout(() => {
                if (!global.sessions.has(sessionId)) return;
                bootSocket(sessionId, session, useSessionCreds).catch(e =>
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
                await conn.sendMessage(config.newsletterJid, { react: { text: e, key: msg.key } });
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
                try { await conn.rejectCall(call.id, call.from); } catch {}
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
    if (config.mongodb) {
        try {
            await initMongo();
            const collection = global.mongoClient.db("insidious").collection("authState");
            await collection.deleteMany({ _id: { $regex: `^${sessionId}:` } });
            console.log(fancy(`🗑️ [${sessionId}] session data deleted`));
        } catch (e) {
            console.error(`[${sessionId}] cleanup error:`, e.message);
        }
    }
}

async function resumeAllSessions() {
    if (!config.mongodb) return;
    await initMongo();
    const collection = global.mongoClient.db("insidious").collection("authState");
    const metas = await collection.find({ _id: { $regex: ":meta$" } }).toArray();
    console.log(fancy(`🔄 Resuming ${metas.length} session(s)...`));

    for (const meta of metas) {
        const sessionId = meta._id.replace(/:meta$/, "");
        if (global.sessions.has(sessionId)) continue;
        if (global.sessions.size >= MAX_SESSIONS) break;

        const session = {
            conn: null, socketReady: false,
            pairing: null, pairingNumber: null,
            startedAt: Date.now(), welcomed: false
        };
        global.sessions.set(sessionId, session);

        try {
            await bootSocket(sessionId, session, false);
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
        if (mongoose.connection.readyState === 1) await mongoose.connection.close();
    } catch (e) { console.error("Shutdown error:", e); }
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

// ---------------- BOOT ----------------
(async () => {
    console.log(fancy(`🚀 Starting ${config.botName || "INSIDIOUS"}...`));
    try {
        if (SESSION_ID) {
            console.log(fancy("🔑 SESSION_ID mode"));
            const session = {
                conn: null, socketReady: false,
                pairing: null, pairingNumber: null,
                startedAt: Date.now(), welcomed: false
            };
            global.sessions.set("session_id", session);
            await bootSocket("session_id", session, true);
        } else if (config.mongodb) {
            console.log(fancy("🔑 Multi-session mode"));
            await resumeAllSessions();
        } else {
            console.error(fancy("❌ Neither SESSION_ID nor MONGODB_URI is set."));
            process.exit(1);
        }
    } catch (err) {
        console.error("Boot error:", err);
    }

    app.listen(PORT, () => {
        console.log(fancy(`🌐 Dashboard: http://localhost:${PORT}`));
    });
})();