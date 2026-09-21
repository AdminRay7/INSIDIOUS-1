const {
    default: makeWASocket,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    delay
} = require("@whiskeysockets/baileys");
const { MongoClient, ObjectId } = require("mongodb");
const pino = require("pino");
const config = require("../config");
const { fancy } = require("./font");
const { useMongoDBAuthState } = require("./mongoAuthState");

class SessionManager {
    constructor() {
        this.sessions = new Map();          // sessionId -> { conn, ready, pairing, startedAt }
        this.mongoClient = null;
        this.collection = null;
    }

    async init() {
        if (this.mongoClient) return;
        this.mongoClient = new MongoClient(config.mongodb);
        await this.mongoClient.connect();
        this.collection = this.mongoClient.db("insidious").collection("authState");
        // Unique index on _id is automatic in MongoDB; nothing else needed
        console.log(fancy("✅ MongoDB session store connected."));
    }

    get(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    list() {
        return Array.from(this.sessions.entries()).map(([id, s]) => ({
            sessionId: id,
            connected: !!s.conn?.user,
            ready: s.ready,
            startedAt: s.startedAt
        }));
    }

    /**
     * Start (or reuse) a socket for a given session.
     * If the session already has an active socket, returns it.
     */
    async start(sessionId, phoneNumber = null) {
        await this.init();

        if (this.sessions.has(sessionId)) {
            const existing = this.sessions.get(sessionId);
            if (existing.conn && !existing.conn.ws?.isClosed) {
                return existing;
            }
            // Dead socket — clean it up and restart
            this.sessions.delete(sessionId);
        }

        const entry = {
            sessionId,
            conn: null,
            ready: false,
            pairing: null,
            pairingNumber: null,
            startedAt: Date.now(),
            phoneNumber
        };
        this.sessions.set(sessionId, entry);

        try {
            await this._bootSocket(entry);
        } catch (e) {
            console.error(`[${sessionId}] boot failed:`, e.message);
            this.sessions.delete(sessionId);
            throw e;
        }

        return entry;
    }

    async _bootSocket(entry) {
        const { sessionId } = entry;

        const { state, saveCreds } = await useMongoDBAuthState(this.collection, sessionId);
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

        entry.conn = conn;
        conn.ev.on("creds.update", saveCreds);

        conn.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === "connecting") {
                entry.ready = true;
                console.log(fancy(`🔌 [${sessionId}] socket ready`));
            }

            if (connection === "open") {
                entry.ready = true;
                entry.pairing = null;
                entry.pairingNumber = null;
                console.log(fancy(`✅ [${sessionId}] connected!`));

                // Persist the linked phone number for this session
                try {
                    const jid = conn.user?.id;
                    if (jid) {
                        await this.collection.updateOne(
                            { _id: `${sessionId}:meta` },
                            { $set: { value: { jid, linkedAt: Date.now() } } },
                            { upsert: true }
                        );
                    }
                } catch (e) {
                    console.error(`[${sessionId}] meta save failed:`, e.message);
                }

                // Welcome message to owner
                try {
                    if (config.ownerNumber && !entry.welcomed) {
                        entry.welcomed = true;
                        const ownerJid = String(config.ownerNumber).replace(/\D/g, "") + "@s.whatsapp.net";
                        await conn.sendMessage(ownerJid, {
                            text: fancy(`✅ New session linked: ${sessionId}`)
                        });
                    }
                } catch {}
            }

            if (connection === "close") {
                entry.ready = false;
                const code = lastDisconnect?.error?.output?.statusCode;
                console.log(fancy(`❌ [${sessionId}] closed (${code})`));

                if (code === 401 || code === DisconnectReason.loggedOut) {
                    console.log(fancy(`🚪 [${sessionId}] logged out — deleting session`));
                    await this.logout(sessionId);
                    return;
                }

                if (code === 440) {
                    console.log(fancy(`🚨 [${sessionId}] 440 conflict — not reconnecting`));
                    return;
                }

                // Reconnect after delay
                setTimeout(() => {
                    if (!this.sessions.has(sessionId)) return;
                    console.log(fancy(`🔁 [${sessionId}] reconnecting...`));
                    this._bootSocket(entry).catch(e =>
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
                require("../handler")(conn, m, sessionId);
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

        return entry;
    }

    /**
     * Request a pairing code for a session.
     * Waits for socket readiness, then calls requestPairingCode.
     */
    async requestPairingCode(sessionId, phoneNumber) {
        const entry = await this.start(sessionId, phoneNumber);

        if (entry.conn?.user) {
            throw new Error("Session already paired");
        }
        if (entry.pairing && entry.pairingNumber === phoneNumber) {
            return entry.pairing;
        }

        // Wait for "connecting"
        const deadline = Date.now() + 30000;
        while (!entry.ready && Date.now() < deadline) {
            await delay(500);
        }
        if (!entry.ready) throw new Error("Socket not ready");

        let code;
        try {
            code = await entry.conn.requestPairingCode(phoneNumber);
        } catch (e) {
            await delay(2000);
            code = await entry.conn.requestPairingCode(phoneNumber);
        }

        const formatted = code.match(/.{1,4}/g)?.join("-") || code;
        entry.pairing = formatted;
        entry.pairingNumber = phoneNumber;
        console.log(fancy(`✅ [${sessionId}] pairing code: ${formatted}`));
        return formatted;
    }

    async sendText(sessionId, to, text) {
        const entry = this.sessions.get(sessionId);
        if (!entry?.conn?.user) throw new Error("Session not connected");
        const jid = to.includes("@") ? to : to.replace(/\D/g, "") + "@s.whatsapp.net";
        const sent = await entry.conn.sendMessage(jid, { text });
        return sent.key.id;
    }

    async sendMedia(sessionId, to, url, caption, type = "image") {
        const entry = this.sessions.get(sessionId);
        if (!entry?.conn?.user) throw new Error("Session not connected");
        const jid = to.includes("@") ? to : to.replace(/\D/g, "") + "@s.whatsapp.net";
        const content = type === "video"
            ? { video: { url }, caption }
            : { image: { url }, caption };
        const sent = await entry.conn.sendMessage(jid, content);
        return sent.key.id;
    }

    async logout(sessionId) {
        const entry = this.sessions.get(sessionId);
        if (entry) {
            try {
                entry.conn?.ev.removeAllListeners();
                entry.conn?.ws?.close();
            } catch {}
            this.sessions.delete(sessionId);
        }
        // Remove all credentials for this session from MongoDB
        try {
            await this.init();
            await this.collection.deleteMany({
                _id: { $regex: `^${sessionId}:` }
            });
            console.log(fancy(`🗑️ [${sessionId}] session data deleted`));
        } catch (e) {
            console.error(`[${sessionId}] logout cleanup error:`, e.message);
        }
    }

    /**
     * On startup, resume all sessions that were previously linked.
     * Reads all `*:meta` docs (written on successful pairing) and restarts them.
     */
    async resumeAll() {
        await this.init();
        const metas = await this.collection.find({ _id: { $regex: ":meta$" } }).toArray();
        console.log(fancy(`🔄 Resuming ${metas.length} session(s)...`));
        for (const meta of metas) {
            const sessionId = meta._id.replace(/:meta$/, "");
            if (this.sessions.has(sessionId)) continue;
            try {
                await this.start(sessionId);
            } catch (e) {
                console.error(`Resume ${sessionId} failed:`, e.message);
            }
            // Small stagger so we don't hammer WhatsApp
            await delay(1500);
        }
    }
}

module.exports = new SessionManager();