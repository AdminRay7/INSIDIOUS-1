const express = require("express");
const { getSession, listSessions, startSession } = require("./sessionManager");
const { User } = require("../database/models");
const config = require("../config");

// ---------- Simple API key auth ----------
const API_KEYS = new Set([
    process.env.API_KEY || "changeme-please-rotate-this-key"
]);

function authMiddleware(req, res, next) {
    const key = req.headers["x-api-key"] || req.query.apiKey;
    if (!key || !API_KEYS.has(key)) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    next();
}

// ---------- Rate limit ----------
const buckets = new Map();
function rateLimit(max = 30, windowMs = 60000) {
    return (req, res, next) => {
        const ip = req.ip;
        const now = Date.now();
        const bucket = buckets.get(ip) || { count: 0, resetAt: now + windowMs };

        if (now > bucket.resetAt) {
            bucket.count = 0;
            bucket.resetAt = now + windowMs;
        }
        bucket.count++;
        buckets.set(ip, bucket);

        if (bucket.count > max) {
            return res.status(429).json({ error: "Too many requests" });
        }
        next();
    };
}

function registerAPI(app) {
    app.use(express.json({ limit: "2mb" }));
    app.use("/api", rateLimit(60, 60000));

    // ---------- Health ----------
    app.get("/api/health", (req, res) => {
        res.json({ ok: true, ts: Date.now() });
    });

    // ---------- Login (exchange password for session token) ----------
    app.post("/api/login", (req, res) => {
        const { userId, apiKey } = req.body;
        if (!API_KEYS.has(apiKey)) {
            return res.status(401).json({ error: "Bad API key" });
        }
        const session = getSession(userId);
        if (!session) {
            return res.status(404).json({ error: "No such session" });
        }
        res.json({
            success: true,
            userId,
            status: session.status,
            connected: !!session.socket?.user
        });
    });

    // ---------- List sessions ----------
    app.get("/api/me/sessions", authMiddleware, (req, res) => {
        res.json({ sessions: listSessions() });
    });

    // ---------- Send a message ----------
    app.post("/api/send", authMiddleware, async (req, res) => {
        const { userId, to, text, quotedId } = req.body;

        if (!userId || !to || !text) {
            return res.status(400).json({ error: "userId, to, text required" });
        }

        const session = getSession(userId);
        if (!session?.socket?.user) {
            return res.status(400).json({ error: "Session not connected" });
        }

        // Normalize number
        const jid = to.includes("@") ? to : to.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

        try {
            const sent = await session.socket.sendMessage(jid, { text });
            res.json({ success: true, messageId: sent.key.id, to: jid });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ---------- Send image ----------
    app.post("/api/send-media", authMiddleware, async (req, res) => {
        const { userId, to, url, caption, type = "image" } = req.body;
        if (!userId || !to || !url) {
            return res.status(400).json({ error: "userId, to, url required" });
        }

        const session = getSession(userId);
        if (!session?.socket?.user) {
            return res.status(400).json({ error: "Session not connected" });
        }

        const jid = to.includes("@") ? to : to.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        const content = type === "video" ? { video: { url }, caption } : { image: { url }, caption };

        try {
            const sent = await session.socket.sendMessage(jid, content);
            res.json({ success: true, messageId: sent.key.id });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ---------- Get recent contacts ----------
    app.get("/api/me/contacts/:userId", authMiddleware, async (req, res) => {
        try {
            const contacts = await User.find({ sessionId: req.params.userId })
                .sort({ lastActive: -1 })
                .limit(100)
                .lean();
            res.json({ contacts });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // ---------- Check if a number is on WhatsApp ----------
    app.post("/api/check-number", authMiddleware, async (req, res) => {
        const { userId, number } = req.body;
        const session = getSession(userId);
        if (!session?.socket?.user) return res.status(400).json({ error: "Session not connected" });

        try {
            const jid = number.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
            const result = await session.socket.onWhatsApp(jid);
            res.json({ exists: result?.length > 0, jid });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    console.log("✅ Mobile API routes registered at /api/*");
}

module.exports = { registerAPI, authMiddleware };