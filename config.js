// config.js
require("dotenv").config();

// ---------------- HELPERS ----------------
function bool(v, fallback) {
    if (v === undefined || v === null || v === "") return fallback;
    return String(v).toLowerCase() === "true";
}
function num(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function str(v, fallback) {
    if (v === undefined || v === null || v === "") return fallback;
    return String(v);
}
function list(v, fallback = []) {
    if (v === undefined || v === null || v === "") return fallback;
    return String(v).split(",").map(s => s.trim()).filter(Boolean);
}

module.exports = {
    // ---------------- Bot Info ----------------
    botName:     str(process.env.BOT_NAME,     "INSIDIOUS"),
    ownerNumber: str(process.env.OWNER_NUMBER, "254794376595"),
    ownerName:   str(process.env.OWNER_NAME,   "StanyTZ"),
    version:     str(process.env.VERSION,      "2.1.1"),
    footer:      str(process.env.FOOTER,       "INSIDIOUS V2"),
    prefix:      str(process.env.PREFIX,       "."),

    // ---------------- Session ----------------
    // Session ID from the generator (used by SESSION_ID mode in index.js)
    sessionId:   str(process.env.SESSION_ID,   ""),
    sessionName: str(process.env.SESSION_NAME, "insidious_session"),

    // ---------------- Database ----------------
    mongodb: str(
        process.env.MONGODB_URI,
        "mongodb+srv://ryanraybot_db_user:mljhRdHoeVIB9gZa@cluster0.ng7nkwm.mongodb.net/?appName=Cluster0"
    ),

    // ---------------- API ----------------
    apiKey: str(process.env.API_KEY, "change-this-key-please"),
    port:   num(process.env.PORT, 3000),

    // ---------------- AI ----------------
    aiModel: str(
        process.env.AI_MODEL,
        "https://ai.servietsky1.workers.chat/?message="
    ),

    // ---------------- Channel (optional) ----------------
    newsletterJid: str(process.env.NEWSLETTER_JID, ""),
    channelLink:   str(process.env.CHANNEL_LINK,   ""),

    // ---------------- Features ----------------
    autoRead:    bool(process.env.AUTO_READ,    true),
    autoReact:   bool(process.env.AUTO_REACT,   true),
    autoSave:    bool(process.env.AUTO_SAVE,    true),
    autoTyping:  bool(process.env.AUTO_TYPING,  false),
    autoBio:     bool(process.env.AUTO_BIO,     true),
    anticall:    bool(process.env.ANTICALL,     true),
    antibug:     bool(process.env.ANTIBUG,      true),
    antispam:    bool(process.env.ANTISPAM,     true),
    antilink:    bool(process.env.ANTILINK,     false),
    antiscam:    bool(process.env.ANTISCAM,     true),
    antiporn:    bool(process.env.ANTIPORN,     true),
    antitag:     bool(process.env.ANTITAG,      false),
    antimedia:   str(process.env.ANTIMEDIA,     "off"),
    antidelete:  bool(process.env.ANTIDELETE,   true),
    workMode:    str(process.env.WORK_MODE,     "public"),

    // ---------------- Auto Status ----------------
    autoStatus: {
        view:  bool(process.env.AUTO_STATUS_VIEW,  true),
        like:  bool(process.env.AUTO_STATUS_LIKE,  true),
        reply: bool(process.env.AUTO_STATUS_REPLY, true)
    },

    // ---------------- Autoblock (country codes) ----------------
    autoblock: list(process.env.AUTOBLOCK, []),

    // ---------------- Word filters ----------------
    scamWords: list(
        process.env.SCAM_WORDS,
        ["free money", "lottery", "winner", "cash prize"]
    ),
    pornWords: list(
        process.env.PORN_WORDS,
        ["porn", "xxx", "adult", "nude", "sex"]
    ),

    // ---------------- Sleep Mode ----------------
    sleepStart: str(process.env.SLEEP_START, "23:00"),
    sleepEnd:   str(process.env.SLEEP_END,   "06:00"),

    // ---------------- Misc ----------------
    groupJid:  str(process.env.GROUP_JID, ""),
    menuImage: str(
        process.env.MENU_IMAGE,
        "https://telegra.ph/file/5f6b3c7a8d9e0f1a2b3c.jpg"
    )
};