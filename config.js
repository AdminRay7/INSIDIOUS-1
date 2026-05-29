module.exports = {
    // Bot Info
    botName: "INSIDIOUS",
    ownerNumber: "254794376265", // Your WhatsApp number
    ownerName: "StanyTZ",
    version: "2.1.1",
    footer: "INSIDIOUS V2",
    prefix: ".",
    
    // Session
    sessionName: "insidious_session",
    
    // Database - Hardcoded with your credentials
    mongodb: "mongodb+srv://admin:ryan.3063@cluster0.iylgadk.mongodb.net/insidious?retryWrites=true&w=majority",
    
    // AI
    aiModel: "https://ai.servietsky1.workers.chat/?message=",
    
    // Channel (optional - leave empty if you don't have)
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
    workMode: "public",
    
    // Auto Status
    autoStatus: {
        view: true,
        like: true,
        reply: false
    },
    
    // Autoblock (empty = no blocking)
    autoblock: [],
    
    // Warning words
    scamWords: ["free money", "lottery", "winner", "cash prize"],
    pornWords: ["porn", "xxx", "adult", "nude", "sex"],
    
    // Sleep mode (optional)
    sleepStart: "23:00",
    sleepEnd: "06:00",
    groupJid: "",
    
    // Menu image
    menuImage: "https://telegra.ph/file/5f6b3c7a8d9e0f1a2b3c.jpg"
};
