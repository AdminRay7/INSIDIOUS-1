const { MongoClient } = require("mongodb");
const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { useMongoDBAuthState } = require("./mongoAuthState");
const pino = require("pino");
const config = require("../config");
const { fancy } = require("./font");

// Map<userId, { socket, status, number, startedAt, reconnectAttempts }>
const sessions = new Map();

let mongoClient = null;

async function getMongo() {
    if (!mongoClient) {
        mongoClient = new MongoClient(config.mongodb);
        await mongoClient.connect();
        console.log(fancy("✅ MongoDB (session manager) connected."));
    }
    return mongoClient;
}

async function startSession(userId) {
    // Clean any existing socket
    if (sessions.has(userId)) {
        const old = sessions.get(userId);
        try {
            old.socket?.ev?.removeAllListeners();
            old.socket?.ws?.close();
        } catch {}
        sessions.delete(userId);
    }

    const client = await getMongo();
    const collection = client.db("insidious").collection(`auth_${userId}`);

    const { state, saveCreds } = await useMongoDBAuthState(collection);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
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
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 2000
    });

    const session = {
        socket: sock,
        status: "connecting",
        userId,
        startedAt: Date.now(),
        reconnectAttempts: 0
    };
    sessions.set(userId, session);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "connecting") {
            session.status = "connecting";
            console.log(fancy(`🔌 [${userId}] connecting...`));
        }

        if (connection === "open") {
            session.status = "connected";
            session.reconnectAttempts = 0;
            console.log(fancy(`✅ [${userId}] connected`));
        }

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;
            const reason = lastDisconnect?.error?.message || "unknown";
            session.status = "closed";
            console.log(fancy(`❌ [${userId}] closed (code ${code}, ${reason})`));

            // 401 / loggedOut → never reconnect
            if (code === 401 || code === DisconnectReason.loggedOut) {
                console.log(fancy(`🚪 [${userId}] logged out — session removed`));
                sessions.delete(userId);
                return;
            }

            // 440 → conflict, do NOT reconnect
            if (code === 440) {
                console.log(fancy(`🚨 [${userId}] CONFLICT — another instance using this session`));
                return;
            }

            // 405/515 → normal during pairing
            if (code === 405 || code === 515) {
                setTimeout(() => startSession(userId), 5000);
                return;
            }

            // Other → backoff
            if (session.reconnectAttempts < 10) {
                session.reconnectAttempts++;
                const delay = Math.min(3000 * session.reconnectAttempts, 30000);
                setTimeout(() => startSession(userId), delay);
            }
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        if (config.newsletterJid && msg.key.remoteJid === config.newsletterJid) {
            try {
                const emojis = ["🥀", "❤️", "🔥", "⭐", "✨"];
                const e = emojis[Math.floor(Math.random() * emojis.length)];
                await sock.sendMessage(config.newsletterJid, {
                    react: { text: e, key: msg.key }
                });
            } catch {}
        }

        try {
            require("../handler")(sock, m, userId);
        } catch (e) {
            console.error(`[${userId}] handler error:`, e);
        }
    });

    sock.ev.on("call", async (calls) => {
        if (!config.anticall) return;
        for (const call of calls) {
            if (call.status === "offer") {
                try {
                    await sock.rejectCall(call.id, call.from);
                } catch {}
            }
        }
    });

    return sock;
}

function getSession(userId) {
    return sessions.get(userId);
}

function listSessions() {
    return Array.from(sessions.entries()).map(([id, s]) => ({
        id,
        status: s.status,
        startedAt: s.startedAt
    }));
}

async function removeSession(userId) {
    const s = sessions.get(userId);
    if (s) {
        try {
            s.socket?.ev?.removeAllListeners();
            s.socket?.ws?.close();
        } catch {}
        sessions.delete(userId);
    }

    // Wipe MongoDB collection for this user
    try {
        const client = await getMongo();
        await client.db("insidious").collection(`auth_${userId}`).deleteMany({});
        console.log(fancy(`🗑️ [${userId}] session wiped from MongoDB.`));
    } catch (e) {
        console.error(`Failed to wipe [${userId}]:`, e.message);
    }
}

// Auto-start all existing sessions on boot
async function loadAllSessions() {
    try {
        const client = await getMongo();
        const collections = await client.db("insidious").listCollections().toArray();
        const userIds = collections
            .map(c => c.name)
            .filter(n => n.startsWith("auth_"))
            .map(n => n.replace("auth_", ""));

        console.log(fancy(`🔄 Found ${userIds.length} saved session(s) to load.`));

        for (const id of userIds) {
            try {
                await startSession(id);
                await new Promise(r => setTimeout(r, 1500)); // stagger starts
            } catch (e) {
                console.error(`Failed to start [${id}]:`, e.message);
            }
        }
    } catch (e) {
        console.error("loadAllSessions error:", e.message);
    }
}

module.exports = {
    startSession,
    getSession,
    listSessions,
    removeSession,
    loadAllSessions
};