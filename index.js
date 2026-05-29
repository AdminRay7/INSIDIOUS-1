const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs-extra");
const { fancy } = require("./lib/font");
const config = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;

// IMPORT DATABASE MODELS
const { User, Group, ChannelSubscriber } = require('./database/models');

// Global variables
let pendingPairRequest = null;

// DATABASE CONNECTION
mongoose.connect(config.mongodb, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log(fancy("🥀 database connected: insidious is eternal.")))
    .catch(err => console.error("DB Connection Error:", err));

// WEB PAIRING DASHBOARD
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/stats', async (req, res) => {
    try {
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const subscribers = await ChannelSubscriber.countDocuments();
        
        res.json({
            users,
            groups,
            subscribers,
            uptime: process.uptime(),
            version: config.version
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// FIXED PAIRING CODE ENDPOINT
app.get('/pair', async (req, res) => {
    let num = req.query.num;
    if (!num) return res.json({ error: "Provide a number!" });
    
    const cleanNumber = num.replace(/[^0-9]/g, '');
    
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ jid: cleanNumber + '@s.whatsapp.net' });
        if (existingUser && existingUser.isActive) {
            return res.json({ error: "User already registered!" });
        }
        
        // Check if we have a connection
        if (!global.conn) {
            return res.json({ error: "Bot is starting. Please wait 10 seconds and try again!" });
        }
        
        // Store the request to be processed when connection is ready
        pendingPairRequest = { number: cleanNumber, res };
        
        // Try immediate pairing if connection is ready
        try {
            const code = await global.conn.requestPairingCode(cleanNumber);
            const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
            
            // Save user to database
            await User.findOneAndUpdate(
                { jid: cleanNumber + '@s.whatsapp.net' },
                {
                    jid: cleanNumber + '@s.whatsapp.net',
                    deviceId: Math.random().toString(36).substr(2, 8),
                    linkedAt: new Date(),
                    isActive: true,
                    mustFollowChannel: true
                },
                { upsert: true }
            );
            
            pendingPairRequest = null;
            return res.json({ 
                success: true, 
                code: formattedCode,
                message: "Use this code in WhatsApp Linked Devices"
            });
        } catch (err) {
            // If immediate fails, wait for connection to be ready
            console.log("Waiting for connection to be ready...");
            
            // Set timeout for pair request
            setTimeout(() => {
                if (pendingPairRequest) {
                    pendingPairRequest.res.json({ error: "Timeout. Please try again in 30 seconds." });
                    pendingPairRequest = null;
                }
            }, 30000);
        }
        
    } catch (err) {
        console.error("Pairing error:", err);
        res.json({ error: "Pairing failed: " + err.message });
    }
});

async function startInsidious() {
    const { state, saveCreds } = await useMultiFileAuthState(config.sessionName);
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Safari"),
        syncFullHistory: true,
        generateHighQualityLinkPreview: true
    });

    // Store conn globally for pairing endpoint
    global.conn = conn;

    // Handle connection updates
    conn.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;
        
        if (qr) {
            console.log(fancy("📱 Scan QR code to connect (or use pairing)"));
        }
        
        if (connection === 'open') {
            console.log(fancy("👹 insidious is alive and connected."));
            
            // Auto subscribe owner to channel
            try {
                const ownerJid = config.ownerNumber + '@s.whatsapp.net';
                const existing = await ChannelSubscriber.findOne({ jid: ownerJid });
                if (!existing) {
                    await ChannelSubscriber.create({
                        jid: ownerJid,
                        name: config.ownerName,
                        subscribedAt: new Date(),
                        isActive: true
                    });
                }
                
                // Send welcome to owner
                const welcomeMsg = `╭─── • 🥀 • ───╮\n   ɪɴꜱɪᴅɪᴏᴜꜱ ᴠ${config.version}\n╰─── • 🥀 • ───╯\n\n✅ Bot is online!\n📊 Dashboard: https://${process.env.RENDER_EXTERNAL_URL || 'localhost'}\n\n${fancy(config.footer)}`;
                await conn.sendMessage(ownerJid, { text: welcomeMsg });
                
            } catch (error) {
                console.error("Channel subscription error:", error);
            }
        }
        
        // Handle pending pair request when connection is ready
        if (connection === 'connecting' && pendingPairRequest) {
            try {
                const { number, res } = pendingPairRequest;
                const code = await conn.requestPairingCode(number);
                const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
                
                await User.findOneAndUpdate(
                    { jid: number + '@s.whatsapp.net' },
                    {
                        jid: number + '@s.whatsapp.net',
                        deviceId: Math.random().toString(36).substr(2, 8),
                        linkedAt: new Date(),
                        isActive: true
                    },
                    { upsert: true }
                );
                
                res.json({ success: true, code: formattedCode });
                pendingPairRequest = null;
            } catch (err) {
                if (pendingPairRequest) {
                    pendingPairRequest.res.json({ error: err.message });
                    pendingPairRequest = null;
                }
            }
        }
        
        // Handle disconnection
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log(fancy("🔄 Reconnecting..."));
                setTimeout(startInsidious, 5000);
            }
        }
    });

    conn.ev.on('creds.update', saveCreds);

    // AUTO STATUS FEATURE
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        // Auto Status logic
        if (msg.key.remoteJid === 'status@broadcast' && config.autoStatus.view) {
            try {
                await conn.readMessages([msg.key]);
                
                if (config.autoStatus.like) {
                    const emojis = ['🥀', '❤️', '🔥', '⭐', '✨', '👏'];
                    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                    
                    await conn.sendMessage('status@broadcast', { 
                        react: { 
                            text: randomEmoji, 
                            key: msg.key 
                        } 
                    }, { statusJidList: [msg.key.participant] });
                }
                
                if (config.autoStatus.reply) {
                    const statusText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                    if (statusText) {
                        const aiResponse = await axios.get(`${config.aiModel}${encodeURIComponent("Reply to this status: " + statusText)}`);
                        await conn.sendMessage(msg.key.participant, { 
                            text: fancy(aiResponse.data) 
                        });
                    }
                }
            } catch (error) {
                console.error("Auto status error:", error);
            }
        }

        // Channel posts reaction
        if (config.newsletterJid && msg.key.remoteJid === config.newsletterJid) {
            try {
                const emojis = ['🥀', '❤️', '🔥', '⭐', '✨', '👏', '👍', '🎯'];
                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                
                await conn.sendMessage(config.newsletterJid, { 
                    react: { 
                        text: randomEmoji, 
                        key: msg.key 
                    } 
                });
                
                console.log(fancy(`Reacted to channel post with ${randomEmoji}`));
            } catch (error) {
                console.error("Channel react error:", error);
            }
        }

        // Pass to Master Handler
        require('./handler')(conn, m);
    });

    // WELCOME & GOODBYE WITH CHANNEL ENFORCEMENT
    conn.ev.on('group-participants.update', async (anu) => {
        try {
            const metadata = await conn.groupMetadata(anu.id);
            const participants = anu.participants;
            
            for (let num of participants) {
                const isSubscribed = await ChannelSubscriber.findOne({ jid: num });
                const user = await User.findOne({ jid: num });
                
                let pp = await conn.profilePictureUrl(num, 'image').catch(() => config.menuImage);
                let quote = await axios.get('https://api.quotable.io/random')
                    .then(res => res.data.content)
                    .catch(() => "Welcome to the Further.");

                if (anu.action == 'add') {
                    let welcome = `╭── • 🥀 • ──╮\n  ${fancy("ɴᴇᴡ ꜱᴏᴜʟ ᴅᴇᴛᴇᴄᴛᴇᴅ")}\n╰── • 🥀 • ──╯\n\n│ ◦ ᴜꜱᴇʀ: @${num.split("@")[0]}\n│ ◦ ɢʀᴏᴜᴘ: ${metadata.subject}\n│ ◦ ᴍᴇᴍʙᴇʀꜱ: ${metadata.participants.length}\n\n${!isSubscribed ? '⚠️ *MUST FOLLOW CHANNEL FIRST*\n' + config.channelLink + '\n\n' : ''}🥀 "${fancy(quote)}"\n\n${fancy(config.footer)}`;
                    
                    await conn.sendMessage(anu.id, { 
                        image: { url: pp }, 
                        caption: welcome, 
                        mentions: [num] 
                    });
                    
                    if (!user) {
                        await User.create({
                            jid: num,
                            name: `User${num.split('@')[0].slice(-4)}`,
                            joinedGroups: [anu.id],
                            joinedAt: new Date(),
                            mustFollowChannel: !isSubscribed
                        });
                    }
                    
                } else if (anu.action == 'remove') {
                    let goodbye = `╭── • 🥀 • ──╮\n  ${fancy("ꜱᴏᴜʟ ʟᴇꜰᴛ")}\n╰── • 🥀 • ──╯\n\n│ ◦ @${num.split('@')[0]} ʜᴀꜱ ᴇxɪᴛᴇᴅ.\n🥀 "${fancy(quote)}"`;
                    await conn.sendMessage(anu.id, { 
                        image: { url: pp }, 
                        caption: goodbye, 
                        mentions: [num] 
                    });
                }
            }
        } catch (e) { 
            console.error("Group event error:", e);
        }
    });

    // ANTICALL COMPLETE
    conn.ev.on('call', async (calls) => {
        if (config.anticall) {
            for (let call of calls) {
                if (call.status === 'offer') {
                    try {
                        await conn.rejectCall(call.id, call.from);
                        
                        const countryCode = call.from.split('@')[0].substring(0, 3);
                        if (config.autoblock && config.autoblock.includes(countryCode.replace('+', ''))) {
                            await conn.updateBlockStatus(call.from, 'block');
                            await conn.sendMessage(config.ownerNumber + "@s.whatsapp.net", { 
                                text: fancy(`🚫 ᴀᴜᴛᴏʙʟᴏᴄᴋ: ʙʟᴏᴄᴋᴇᴅ ᴄᴀʟʟ ꜰʀᴏᴍ ${countryCode}`) 
                            });
                        } else {
                            await conn.sendMessage(call.from, { 
                                text: fancy("🥀 ɪɴꜱɪᴅɪᴏᴜꜱ: ɴᴏ ᴄᴀʟʟꜱ ᴀʟʟᴏᴡᴇᴅ. ʏᴏᴜ ʜᴀᴠᴇ ʙᴇᴇɴ ʀᴇᴘᴏʀᴛᴇᴅ.") 
                            });
                        }
                    } catch (error) {
                        console.error("Anticall error:", error);
                    }
                }
            }
        }
    });

    // SLEEPING MODE ENHANCED
    if (config.sleepStart && config.sleepEnd && config.groupJid) {
        const [startH, startM] = config.sleepStart.split(':');
        const [endH, endM] = config.sleepEnd.split(':');

        cron.schedule(`${startM} ${startH} * * *`, async () => {
            try {
                await conn.groupSettingUpdate(config.groupJid, 'announcement');
                await conn.sendMessage(config.groupJid, { 
                    text: fancy("🥀 ꜱʟᴇᴇᴘɪɴɢ ᴍᴏᴅᴇ ᴀᴄᴛɪᴠᴀᴛᴇᴅ: ɢʀᴏᴜᴘ ᴄʟᴏꜱᴇᴅ.\n⏰ Will reopen at " + config.sleepEnd) 
                });
                
                await Group.updateMany({}, { $set: { sleeping: true } });
            } catch (error) {
                console.error("Sleep mode error:", error);
            }
        });

        cron.schedule(`${endM} ${endH} * * *`, async () => {
            try {
                await conn.groupSettingUpdate(config.groupJid, 'not_announcement');
                await conn.sendMessage(config.groupJid, { 
                    text: fancy("🥀 ᴀᴡᴀᴋᴇ ᴍᴏᴅᴇ: ɢʀᴏᴜᴘ ᴏᴘᴇɴᴇᴅ.") 
                });
                
                await Group.updateMany({}, { $set: { sleeping: false } });
            } catch (error) {
                console.error("Awake mode error:", error);
            }
        });
    }

    // AUTO BIO WITH UPTIME
    if (config.autoBio) {
        setInterval(() => {
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            const bio = `🤖 ${config.botName} | ⚡${days}d ${hours}h | 👑${config.ownerName}`;
            
            conn.updateProfileStatus(bio).catch(() => null);
        }, 60000);
    }

    // AUTO TYPING FOR ALL CHATS
    if (config.autoTyping) {
        setInterval(async () => {
            try {
                const chats = await conn.chats.all();
                for (const chat of chats.slice(0, 5)) {
                    await conn.sendPresenceUpdate('composing', chat.id);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await conn.sendPresenceUpdate('paused', chat.id);
                }
            } catch (error) {
                // Silently fail
            }
        }, 30000);
    }

    return conn;
}

// Start the bot
let conn;
startInsidious().then(c => {
    conn = c;
    global.conn = conn;
}).catch(console.error);

// Start web server
app.listen(PORT, () => console.log(fancy(`🌐 Dashboard running on port ${PORT}`)));

module.exports = { startInsidious };
