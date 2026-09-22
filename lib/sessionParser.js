const { BufferJSON } = require("@whiskeysockets/baileys");

const SESSION_PREFIX = '_INSIDIOUS_"';

function parseSession(sessionId) {
    if (!sessionId || typeof sessionId !== "string") {
        throw new Error("SESSION_ID is empty or not a string");
    }
    if (!sessionId.startsWith(SESSION_PREFIX)) {
        throw new Error(`SESSION_ID must start with ${SESSION_PREFIX}`);
    }
    const raw = sessionId.slice(SESSION_PREFIX.length);
    let creds;
    try {
        const decoded = Buffer.from(raw, "base64").toString("utf-8");
        creds = JSON.parse(decoded, BufferJSON.reviver);
    } catch (e) {
        throw new Error("Failed to decode SESSION_ID: " + e.message);
    }
    if (!creds.noiseKey || !creds.signedIdentityKey) {
        throw new Error("SESSION_ID is missing required credential fields");
    }
    return creds;
}

module.exports = { parseSession, SESSION_PREFIX };