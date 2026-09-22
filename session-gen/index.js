const {
    default: makeWASocket,
    useMultiFileAuthState,
    BufferJSON,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const express = require("express");
const pino = require("pino");
const fs = require("fs-extra");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const SESSION_PREFIX = '_INSIDIOUS_"';
const PORT = process.env.PORT || 4000;

const tempSessions = new Map();

app.post("/api/generate", async (req, res) => {
    const { number } = req.body;
    if (!number) return res.status(400).json({ error: "number required" });

    const cleanNumber = String(number).replace(/\D/g, "");
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        return res.status(400).json({ error: "Invalid phone number" });
    }

    const sessionId = "gen_" + Math.random().toString(36).slice(2, 10);
    const authDir = path.join(__dirname, "temp_auth", sessionId);
    await fs.ensureDir(authDir);

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        printQRInTerminal: false
    });

    tempSessions.set(sessionId, {
        conn, authDir,
        result: null,
        status: "starting"
    });

    conn.ev.on("creds.update", saveCreds);

    let pairingSent = false;

    conn.ev.on("connection.update", async (update) => {
        const s = tempSessions.get(sessionId);
        if (!s) return;

        if (update.connection === "connecting" && !pairingSent) {
            pairingSent = true;
            s.status = "pairing";
            try {
                const code = await conn.requestPairingCode(cleanNumber);
                s.pairingCode = code.match(/.{1,4}/g)?.join("-") || code;
                console.log(`[${sessionId}] pairing code: ${s.pairingCode}`);
            } catch (e) {
                s.status = "error";
                s.error = e.message;
            }
        }

        if (update.connection === "open") {
            s.status = "linked";
            console.log(`[${sessionId}] linked!`);

            setTimeout(async () => {
                try {
                    const credsPath = path.join(authDir, "creds.json");
                    if (!fs.existsSync(credsPath)) {
                        s.status = "error";
                        s.error = "creds.json not found";
                        return;
                    }

                    const creds = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
                    const serialized = Buffer.from(
                        JSON.stringify(creds, BufferJSON.replacer)
                    ).toString("base64");

                    s.result = SESSION_PREFIX + serialized;
                    s.status = "ready";
                    console.log(`[${sessionId}] session ready (${s.result.length} chars)`);

                    try { conn.ev.removeAllListeners(); conn.ws?.close(); } catch {}

                    setTimeout(() => {
                        fs.remove(authDir).catch(() => {});
                        tempSessions.delete(sessionId);
                    }, 60000);
                } catch (e) {
                    s.status = "error";
                    s.error = e.message;
                }
            }, 2500);
        }

        if (update.connection === "close") {
            const code = update.lastDisconnect?.error?.output?.statusCode;
            if (s.status !== "ready" && code !== 401) s.status = "closed";
        }
    });

    res.json({ sessionId });
});

app.get("/api/status/:sessionId", (req, res) => {
    const s = tempSessions.get(req.params.sessionId);
    if (!s) return res.status(404).json({ error: "Not found or expired" });
    res.json({
        status: s.status,
        pairingCode: s.pairingCode || null,
        sessionId: s.result || null,
        error: s.error || null
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Generator: http://localhost:${PORT}`);
    console.log(`🔖 Prefix: ${SESSION_PREFIX}`);
});