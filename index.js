const express = require("express");
const mongoose = require("mongoose");
const config = require("./config");
const { fancy } = require("./lib/font");
const {
    startSession,
    getSession,
    listSessions,
    removeSession,
    loadAllSessions
} = require("./lib/sessionManager");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

const { User } = require("./database/models");

// ---------------- DATABASE (mongoose for user data) ----------------
console.log(fancy("🔄 Connecting to MongoDB (mongoose)..."));
mongoose.connect(config.mongodb, {
    dbName: "insidious",
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000
})
    .then(() => console.log(fancy("✅ Database connected.")))
    .catch(err => console.error("DB Error:", err));

// ---------------- WEB UI ----------------
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>INSIDIOUS — Multi-User WhatsApp Bot</title>
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
            border-radius: 28px;
            padding: 40px;
            max-width: 540px;
            width: 100%;
            border: 1px solid rgba(255,51,102,0.3);
            box-shadow: 0 0 40px rgba(255,51,102,0.1);
        }
        h1 {
            font-size: 2.6em;
            background: linear-gradient(135deg, #ff3366, #ff6633);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            margin-bottom: 6px;
        }
        .subtitle { color: #888; margin-bottom: 26px; font-size: 0.85em; text-align: center; }
        label { color: #bbb; font-size: 0.85em; display: block; margin-top: 10px; }
        input {
            width: 100%;
            padding: 13px;
            background: #2a2a2a;
            border: 1px solid #3a3a3a;
            border-radius: 12px;
            color: white;
            font-size: 1em;
            margin-top: 6px;
            text-align: center;
        }
        input:focus { outline: none; border-color: #ff3366; }
        button {
            background: linear-gradient(135deg, #ff3366, #ff6633);
            color: white;
            border: none;
            padding: 14px;
            border-radius: 12px;
            font-size: 1em;
            cursor: pointer;
            width: 100%;
            font-weight: bold;
            margin-top: 14px;
        }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        .pair-box {
            background: #1a1a1a;
            padding: 24px;
            border-radius: 20px;
            margin-top: 16px;
        }
        .result {
            margin-top: 16px;
            padding: 14px;
            border-radius: 12px;
            display: none;
            font-size: 0.9em;
            word-break: break-all;
        }
        .result.success { background: #00ff8822; border: 1px solid #00ff88; display: block; }
        .result.error { background: #ff336622; border: 1px solid #ff3366; display: block; }
        .code-display { font-size: 1.8em; font-weight: bold; letter-spacing: 4px; margin: 12px 0; font-family: monospace; }
        .sessions { margin-top: 20px; font-size: 0.85em; }
        .session { padding: 8px; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; }
        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .dot.on { background: #00ff88; }
        .dot.off { background: #ff3366; }
        .footer { margin-top: 24px; font-size: 0.7em; color: #555; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🥀 INSIDIOUS</h1>
        <div class="subtitle">Multi-User WhatsApp Bot v${config.version}</div>

        <div class="pair-box">
            <label>Your Session ID (unique)</label>
            <input id="userId" placeholder="e.g. stany, john123, business2" />

            <label>WhatsApp Number (no +, no spaces)</label>
            <input id="phoneNumber" placeholder="e.g. 2547xxxxxxxx" />

            <button onclick="pairDevice()" id="pairBtn">🔗 Get Pairing Code</button>
            <button onclick="loadSessions()" style="background:#2a2a2a;color:#ff3366;border:1px solid #ff3366;font-size:0.85em;">🔄 Refresh Sessions</button>

            <div id="result"></div>
        </div>

        <div class="sessions" id="sessions"></div>

        <div class="footer">Developed by ${config.ownerName} | Powered by Baileys</div>
    </div>

    <script>
        async function pairDevice() {
            const userId = document.getElementById('userId').value.trim();
            const num = document.getElementById('phoneNumber').value.trim();
            if (!userId) return showResult('Enter a Session ID', 'error');
            if (!num) return showResult('Enter your phone number', 'error');

            const btn = document.getElementById('pairBtn');
            btn.disabled = true; btn.textContent = '⏳ Requesting...';

            try {
                const res = await fetch('/api/pair/' + encodeURIComponent(userId) + '?num=' + encodeURIComponent(num));
                const data = await res.json();
                if (data.code) {
                    showResult('✅ <strong>Pairing Code</strong><br><div class="code-display">' + data.code + '</div><br>📱 WhatsApp → Linked Devices → Link with phone number<br>🔑 Enter the code', 'success');
                    setTimeout(loadSessions, 3000);
                } else {
                    showResult('❌ ' + (data.error || 'Pairing failed'), 'error');
                }
            } catch (e) {
                showResult('❌ Network error', 'error');
            } finally {
                btn.disabled = false; btn.textContent = '🔗 Get Pairing Code';
            }
        }

        function showResult(msg, type) {
            document.getElementById('result').innerHTML = '<div class="result ' + type + '">' + msg + '</div>';
        }

        async function loadSessions() {
            try {
                const res = await fetch('/api/sessions');
                const data = await res.json();
                const box = document.getElementById('sessions');
                if (!data.sessions || data.sessions.length === 0) {
                    box.innerHTML = '<div style="color:#666;text-align:center;padding:10px;">No active sessions</div>';
                    return;
                }
                box.innerHTML = '<div style="color:#888;margin-bottom:8px;">Active Sessions (' + data.sessions.length + ')</div>' +
                    data.sessions.map(s =>
                        '<div class="session"><span><span class="dot ' + (s.status === 'connected' ? 'on' : 'off') + '"></span>' + s.id + '</span><span style="color:#888;">' + s.status + '</span></div>'
                    ).join('');
            } catch (e) {}
        }

        setInterval(loadSessions, 8000);
        loadSessions();
    </script>
</body>
</html>
    `);
});

// ---------------- API ----------------
app.get("/api/pair/:userId", async (req, res) => {
    const { userId } = req.params;
    const num = req.query.num;

    if (!userId) return res.json({ error: "Missing userId" });
    if (!num) return res.json({ error: "Missing num" });

    const clean = num.replace(/[^0-9]/g, "");
    if (clean.length < 10 || clean.length > 15) {
        return res.json({ error: "Invalid phone number" });
    }

    try {
        let session = getSession(userId);
        if (!session) {
            await startSession(userId);
            // Wait for socket to be ready for pairing
            await new Promise(r => setTimeout(r, 4000));
            session = getSession(userId);
        }

        if (!session?.socket) {
            return res.json({ error: "Session failed to start" });
        }

        if (session.socket.user) {
            return res.json({ error: "This session is already paired with a number" });
        }

        const code = await session.socket.requestPairingCode(clean);
        const formatted = code.match(/.{1,4}/g)?.join("-") || code;

        console.log(fancy(`✅ [${userId}] pairing code: ${formatted}`));

        // Save user record
        try {
            if (mongoose.connection.readyState === 1) {
                await User.findOneAndUpdate(
                    { jid: clean + "@s.whatsapp.net" },
                    {
                        jid: clean + "@s.whatsapp.net",
                        sessionId: userId,
                        linkedAt: new Date(),
                        isActive: true
                    },
                    { upsert: true }
                );
            }
        } catch {}

        res.json({ success: true, code: formatted, userId });
    } catch (e) {
        console.error("Pair error:", e.message);
        res.json({ error: e.message });
    }
});

app.get("/api/sessions", (req, res) => {
    res.json({ sessions: listSessions() });
});

app.get("/api/reset/:userId", async (req, res) => {
    try {
        await removeSession(req.params.userId);
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get("/api/stats", (req, res) => {
    const s = listSessions();
    res.json({
        total: s.length,
        connected: s.filter(x => x.status === "connected").length,
        uptime: process.uptime()
    });
});

// ---------------- BOOT ----------------
app.listen(PORT, () => {
    console.log(fancy(`🌐 Web dashboard: http://localhost:${PORT}`));
});

(async () => {
    console.log(fancy("🚀 Starting INSIDIOUS Multi-User Bot..."));
    await loadAllSessions();
})().catch(e => console.error("Boot error:", e));

process.on("uncaughtException", err => console.error("uncaughtException:", err));
process.on("unhandledRejection", err => console.error("unhandledRejection:", err));