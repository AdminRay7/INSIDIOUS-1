const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber } = require('./database/models');
const messageStore = require('./lib/messageStore');

// ---------------- COMMAND CACHE ----------------
const commandCache = new Map();
let cacheLoaded = false;

function loadCommands() {
    if (cacheLoaded) return;
    const cmdPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdPath)) return;

    const walk = (dir) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                walk(itemPath);
            } else if (item.endsWith('.js')) {
                try {
                    const mod = require(itemPath);
                    if (!mod || typeof mod.execute !== 'function') return;
                    const names = [
                        mod.name,
                        ...(Array.isArray(mod.aliases) ? mod.aliases : [])
                    ].filter(Boolean).map(s => s.toLowerCase());
                    for (const n of names) {
                        commandCache.set(n, mod);
                    }
                } catch (e) {
                    console.error(`⚠️ Failed to load ${itemPath}:`, e.message);
                }
            }
        }
    };

    walk(cmdPath);
    cacheLoaded = true;
    console.log(`✅ Loaded ${commandCache.size} commands into cache.`);
}

loadCommands();

// ---------------- HANDLER ----------------
module.exports = async (conn, m, userId = "default") => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "Unknown Soul";

        const body = (type === 'conversation') ? msg.message.conversation :
                    (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text :
                    (type === 'imageMessage') ? msg.message.imageMessage.caption :
                    (type === 'videoMessage') ? msg.message.videoMessage.caption : '';

        const isGroup = from.endsWith('@g.us');
        const isOwner = config.ownerNumber.includes(sender.split('@')[0]) || msg.key.fromMe;
        const prefix = config.prefix;
        const isCmd = body && body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args = body ? body.trim().split(/ +/).slice(1) : [];

        // SKIP CHANNEL MESSAGES
        if (from === config.newsletterJid) return;

        // ---------------- ANTIDELETE: SAVE MESSAGES ----------------
        if (config.antidelete && msg.key?.id && !msg.key.fromMe) {
            try {
                messageStore.save(msg.key.id, {
                    msg,
                    from,
                    sender,
                    pushname,
                    userId,
                    timestamp: Date.now()
                });
            } catch (e) { /* silent */ }
        }

        // ---------------- ANTIDELETE: HANDLE REVOKE ----------------
        const isRevoke =
            type === 'protocolMessage' &&
            msg.message.protocolMessage?.type === 0;

        if (isRevoke && config.antidelete) {
            try {
                const deletedKey = msg.message.protocolMessage.key;
                const original = messageStore.get(deletedKey.id);

                if (original) {
                    const who = msg.key.participant || msg.key.remoteJid;
                    const whoNumber = who.split('@')[0];

                    await conn.sendMessage(from, {
                        text: fancy(`🚨 ᴀɴᴛɪᴅᴇʟᴇᴛᴇ\n@${whoNumber} deleted a message:`),
                        mentions: [who]
                    });

                    const originalMsg = original.msg;
                    const originalText =
                        originalMsg.message?.conversation ||
                        originalMsg.message?.extendedTextMessage?.text;

                    if (originalText) {
                        await conn.sendMessage(from, {
                            text: `📄 ᴅᴇʟᴇᴛᴇᴅ ᴍᴇꜱꜱᴀɢᴇ:\n\n${originalText}`
                        });
                    } else if (originalMsg.message?.imageMessage) {
                        await conn.sendMessage(from, {
                            image: { url: originalMsg.message.imageMessage.url },
                            caption: `📷 ᴅᴇʟᴇᴛᴇᴅ ɪᴍᴀɢᴇ`
                        }).catch(() => {});
                    } else if (originalMsg.message?.videoMessage) {
                        await conn.sendMessage(from, {
                            video: { url: originalMsg.message.videoMessage.url },
                            caption: `🎥 ᴅᴇʟᴇᴛᴇᴅ ᴠɪᴅᴇᴏ`
                        }).catch(() => {});
                    } else if (originalMsg.message?.stickerMessage) {
                        await conn.sendMessage(from, {
                            sticker: { url: originalMsg.message.stickerMessage.url }
                        }).catch(() => {});
                    } else if (originalMsg.message?.audioMessage) {
                        await conn.sendMessage(from, {
                            audio: { url: originalMsg.message.audioMessage.url },
                            mimetype: 'audio/mp4'
                        }).catch(() => {});
                    }

                    // Forward to owner as audit log
                    if (config.ownerNumber && sender.split('@')[0] !== config.ownerNumber) {
                        try {
                            await conn.sendMessage(config.ownerNumber + '@s.whatsapp.net', {
                                text: `🚨 ᴀɴᴛɪᴅᴇʟᴇᴛᴇ ʟᴏɢ\n\nFrom: ${pushname} (${sender})\nChat: ${from}\nSession: ${userId}\n\nDeleted: ${originalText || '[media]'}`
                            });
                        } catch {}
                    }

                    messageStore.remove(deletedKey.id);
                }
            } catch (e) {
                console.error("Antidelete error:", e);
            }
            return;
        }

        // AUTO READ
        if (config.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (error) {
                console.error("Auto read error:", error);
            }
        }

        // AUTO REACT
        if (config.autoReact && !msg.key.fromMe && !isGroup) {
            try {
                const reactions = ['🥀', '❤️', '🔥', '⭐', '✨'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, {
                    react: { text: randomReaction, key: msg.key }
                });
            } catch (error) {
                console.error("Auto react error:", error);
            }
        }

        // AUTO SAVE CONTACT
        if (config.autoSave && !isOwner && !isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) {
                    user = new User({
                        jid: sender,
                        name: pushname,
                        sessionId: userId,
                        lastActive: new Date(),
                        messageCount: 1
                    });
                } else {
                    user.messageCount += 1;
                    user.lastActive = new Date();
                }
                await user.save();
            } catch (error) { /* silent */ }
        }

        // WORK MODE CHECK
        if (config.workMode === 'private' && !isOwner) return;

        // CHANNEL SUBSCRIPTION CHECK
        if (!isOwner && !isGroup && config.channelLink) {
            const subscriber = await ChannelSubscriber.findOne({
                jid: sender,
                isActive: true
            });

            if (!subscriber) {
                await ChannelSubscriber.create({
                    jid: sender,
                    name: pushname,
                    subscribedAt: new Date(),
                    isActive: true,
                    autoFollow: true
                });

                await conn.sendMessage(from, {
                    text: fancy(`✅ Auto-subscribed! You can now use all features.\n\n🔗 ${config.channelLink}`)
                });
            } else {
                subscriber.lastActive = new Date();
                await subscriber.save();
            }
        }

        // ANTI-BUG
        if (config.antibug && body) {
            const bugPatterns = ['\u200e', '\u200f', '\u202e', '\u202a', '\u202b', '\u202c', '\u202d', /[\u2066-\u2069]/g, /[\u2000-\u200F]/g, /[\u2028-\u202F]/g];
            const hasBug = bugPatterns.some(pattern => {
                if (typeof pattern === 'string') return body.includes(pattern);
                if (pattern instanceof RegExp) return pattern.test(body);
                return false;
            });

            if (hasBug) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    await conn.sendMessage(from, {
                        text: fancy(`🚫 ʙᴜɢ ᴅᴇᴛᴇᴄᴛᴇᴅ\n@${sender.split('@')[0]} sent malicious content`),
                        mentions: [sender]
                    });
                    return;
                } catch (error) {
                    console.error("Antibug error:", error);
                }
            }
        }

        // ANTI-SPAM
        if (config.antispam && !isOwner) {
            try {
                let user = await User.findOne({ jid: sender });
                const now = Date.now();

                if (user) {
                    const timeDiff = now - (user.lastMessageTime || 0);
                    if (timeDiff < 60000) {
                        user.spamCount = (user.spamCount || 0) + 1;

                        if (user.spamCount >= 5) {
                            if (isGroup) {
                                await conn.groupParticipantsUpdate(from, [sender], "remove");
                                await conn.sendMessage(from, {
                                    text: fancy(`🚫 ꜱᴘᴀᴍᴍᴇʀ ʀᴇᴍᴏᴠᴇᴅ\n@${sender.split('@')[0]} removed for spamming`),
                                    mentions: [sender]
                                });
                            } else {
                                await conn.updateBlockStatus(sender, 'block');
                            }
                            user.spamCount = 0;
                        }
                    } else {
                        user.spamCount = 0;
                    }
                    user.lastMessageTime = now;
                    await user.save();
                }
            } catch (error) {
                console.error("Antispam error:", error);
            }
        }

        // AUTO-BLOCK COUNTRY
        if (config.autoblock.length > 0 && !isOwner) {
            const countryCode = sender.split('@')[0].substring(0, 3);
            const cleanCode = countryCode.replace('+', '');

            if (config.autoblock.includes(cleanCode)) {
                try {
                    await conn.updateBlockStatus(sender, 'block');
                    return;
                } catch (error) {
                    console.error("Autoblock error:", error);
                }
            }
        }

        // GROUP SECURITY FEATURES
        if (isGroup && !isOwner) {
            if (config.antilink && body && body.match(/https?:\/\//gi)) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    await conn.sendMessage(from, {
                        text: fancy(`⚠️ ᴀɴᴛɪʟɪɴᴋ\n@${sender.split('@')[0]} links not allowed`),
                        mentions: [sender]
                    });
                    return;
                } catch (error) {
                    console.error("Antilink error:", error);
                }
            }

            if (config.antiscam && body && config.scamWords.some(w => body.toLowerCase().includes(w))) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    await conn.sendMessage(from, {
                        text: fancy(`⚠️ ꜱᴄᴀᴍ ᴀʟᴇʀᴛ!\n@${sender.split('@')[0]} sent scam content`),
                        mentions: [sender]
                    });
                    return;
                } catch (error) {
                    console.error("Antiscam error:", error);
                }
            }

            if (config.antiporn && body && config.pornWords.some(w => body.toLowerCase().includes(w))) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    await conn.sendMessage(from, {
                        text: fancy(`🚫 ᴀɴᴛɪᴘᴏʀɴ\n@${sender.split('@')[0]} content deleted`),
                        mentions: [sender]
                    });
                    return;
                } catch (error) {
                    console.error("Antiporn error:", error);
                }
            }

            if (config.antimedia !== 'off') {
                const mediaTypes = {
                    'imageMessage': 'photo',
                    'videoMessage': 'video',
                    'stickerMessage': 'sticker'
                };

                if (mediaTypes[type] &&
                    (config.antimedia === 'all' || config.antimedia === mediaTypes[type])) {
                    try {
                        await conn.sendMessage(from, { delete: msg.key });
                        await conn.sendMessage(from, {
                            text: fancy(`🚫 ᴀɴᴛɪᴍᴇᴅɪᴀ\n${mediaTypes[type]} not allowed`),
                            mentions: [sender]
                        });
                        return;
                    } catch (error) {
                        console.error("Antimedia error:", error);
                    }
                }
            }
        }

        // AI CHATBOT
        if (!isCmd && !msg.key.fromMe && body && body.trim().length > 1 && config.aiModel) {
            if (config.autoTyping) {
                try {
                    await conn.sendPresenceUpdate('composing', from);
                } catch (error) {}
            }

            try {
                const aiRes = await axios.get(`${config.aiModel}${encodeURIComponent(body)}`);
                const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiRes.data)}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;

                await conn.sendMessage(from, { text: response }, { quoted: msg });
            } catch (e) {
                console.error("AI Error:", e);
            }
        }

        // COMMAND HANDLING (cached)
        if (isCmd) {
            const handler = commandCache.get(command);

            if (handler && typeof handler.execute === 'function') {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Command timeout')), 30000);
                });

                try {
                    await Promise.race([
                        handler.execute(conn, msg, args, {
                            from,
                            sender,
                            fancy,
                            isOwner,
                            pushname,
                            config,
                            conn,
                            msg,
                            userId
                        }),
                        timeoutPromise
                    ]);
                } catch (cmdErr) {
                    console.error(`Command "${command}" error:`, cmdErr);
                    await conn.sendMessage(from, {
                        text: fancy(`❌ Command error: ${cmdErr.message}`)
                    });
                }
            } else if (command !== 'menu') {
                await conn.sendMessage(from, {
                    text: fancy(`❌ Command "${command}" not found.\n\n📋 Type ${config.prefix}menu for available commands.`)
                });
            }
        }

    } catch (err) {
        console.error("Handler Error:", err);
    }
};