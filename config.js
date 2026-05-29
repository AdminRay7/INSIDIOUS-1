require('dotenv').config();

module.exports = {
    // Bot Info
    botName: process.env.BOT_NAME || "INSIDIOUS",
    ownerNumber: process.env.OWNER_NUMBER || "2557xxxxxx",
    ownerName: process.env.OWNER_NAME || "StanyTZ",
    version: "2.1.1",
    footer: "INSIDIOUS V2",
    prefix: process.env.PREFIX || ".",
    
    // Session
    sessionName: "insidious_session",
    
    // Database
    mongodb: process.env.MONGODB_URI || "mongodb://localhost:27017/insidious",
    
    // AI
    aiModel: process.env.AI_MODEL || "https://ai.servietsky1.workers.chat/?message=",
    
    // Channel
    newsletterJid: process.env.NEWSLETTER_JID || "",
    channelLink: process.env.CHANNEL_LINK || "",
    
    // Features
    autoRead: process.env.AUTO_READ === 'true',
    autoReact: process.env.AUTO_REACT === 'true',
    autoSave: process.env.AUTO_SAVE === 'true',
    autoTyping: process.env.AUTO_TYPING === 'true',
    autoBio: process.env.AUTO_BIO === 'true',
    anticall: process.env.ANTICALL === 'true',
    antibug: process.env.ANTIBUG === 'true',
    antispam: process.env.ANTISPAM === 'true',
    antilink: process.env.ANTILINK === 'true',
    antiscam: process.env.ANTISCAM === 'true',
    antiporn: process.env.ANTIPORN === 'true',
    antitag: process.env.ANTITAG === 'false',
    antimedia: process.env.ANTIMEDIA || "off",
    workMode: process.env.WORK_MODE || "public",
    
    // Auto Status
    autoStatus: {
        view: process.env.AUTO_STATUS_VIEW === 'true',
        like: process.env.AUTO_STATUS_LIKE === 'true',
        reply: process.env.AUTO_STATUS_REPLY === 'true'
    },
    
    // Autoblock countries
    autoblock: process.env.AUTOBLOCK ? process.env.AUTOBLOCK.split(',') : [],
    
    // Scam/Porn words
    scamWords: ["free money", "lottery", "winner", "cash prize", "whatsapp gold", "earn money", "rich quick"],
    pornWords: ["porn", "xxx", "adult", "nude", "sex", "18+", "nsfw"],
    
    // Sleep mode
    sleepStart: process.env.SLEEP_START || "23:00",
    sleepEnd: process.env.SLEEP_END || "06:00",
    groupJid: process.env.GROUP_JID || "",
    
    // Menu image
    menuImage: process.env.MENU_IMAGE || "https://telegra.ph/file/5f6b3c7a8d9e0f1a2b3c.jpg",
    
    // Render Web URL
    webUrl: process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`
};
