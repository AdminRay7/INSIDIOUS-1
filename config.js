module.exports = {
    // Bot Info
    botName: "INSIDIOUS",
    ownerNumber: "254794376595",
    ownerName: "StanyTZ",
    version: "2.1.1",
    footer: "INSIDIOUS V2",
    prefix: ".",

    // Session
    sessionName: "insidious_session",

    // Database
    mongodb: "mongodb+srv://ryanraybot_db_user:mljhRdHoeVIB9gZa@cluster0.ng7nkwm.mongodb.net/?appName=Cluster0",

    // AI
    aiModel: "https://ai.servietsky1.workers.chat/?message=",

    // Channel (optional)
    newsletterJid: "",
    channelLink: "",

    // Features
    autoRead: true,
    autoReact: true,
    autoSave: true,
    autoTyping: false,
    autoBio: true,
    anticall: true,
    antibug: true,
    antispam: true,
    antilink: false,
    antiscam: true,
    antiporn: true,
    antitag: false,
    antimedia: "off",
    antidelete: true,
    workMode: "public",

    // Auto Status
    autoStatus: {
        view: true,
        like: true,
        reply: false
    },

    autoblock: [],

    scamWords: ["free money", "lottery", "winner", "cash prize"],
    pornWords: ["porn", "xxx", "adult", "nude", "sex"],

    sleepStart: "23:00",
    sleepEnd: "06:00",
    groupJid: "",

    menuImage: "https://telegra.ph/file/5f6b3c7a8d9e0f1a2b3c.jpg"
};