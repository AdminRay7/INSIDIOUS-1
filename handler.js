const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber } = require('./database/models');

// Store button handlers
const buttonHandlers = new Map();

module.exports = async (conn, m) => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "Unknown Soul";
        
        // Handle BUTTON interactions
        if (type === 'buttonsResponseMessage') {
            const buttonMsg = msg.message.buttonsResponseMessage;
            const buttonId = buttonMsg.selectedButtonId;
            const text = buttonMsg.selectedDisplayText;
            
            console.log(fancy(`[BUTTON] ${sender} pressed: ${buttonId}`));
            
            // Load menu module to handle button
            const menuPath = path.join(__dirname, 'commands', 'main', 'menu.js');
            if (fs.existsSync(menuPath)) {
                delete require.cache[require.resolve(menuPath)];
                const menuModule = require(menuPath);
                
                if (menuModule.handleButton) {
                    await menuModule.handleButton(conn, msg, buttonId, { from, sender });
                } else {
                    // Fallback button response
                    await conn.sendMessage(from, { 
                        text: fancy(`🔘 You pressed: ${text}\n\nType .menu to see full menu.`) 
                    });
                }
            }
            return;
        }
        
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
                        lastActive: new Date(),
                        messageCount: 1
                    });
                } else {
                    user.messageCount += 1;
                    user.lastActive = new Date();
                }
                await user.save();
                
                console.log(fancy(`[SAVE] ${pushname} (${sender})`));
            } catch (error) {
                console.error("Auto save error:", error);
            }
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
                    text: fancy(`╭── • 🥀 • ──╮\n  ${fancy("ᴄʜᴀɴɴᴇʟ ꜱᴜʙꜱᴄʀɪᴘᴛɪᴏɴ")}\n╰── • 🥀 • ──╯\n\n✅ Auto-subscribed!\n\n🔗 ${config.channelLink}\n\nYou can now use all features.`) 
                });
                
                console.log(fancy(`✅ Auto-subscribed ${sender}`));
            } else {
                subscriber.lastActive = new Date();
                await subscriber.save();
            }
        }

        // ANTI-BUG
        if (config.antibug && body) {
            const bugPatterns = ['\u200e', '\u200f', '\u202e', '\u202a', '\u202b', '\u202c', '\u202d', /[\u2066-\u2069]/g, /[\u2000-\u200F]/g, /[\u2028-\u202F]/g];
            const hasBug = bugPatterns.some(pattern => {
                if (typeof pattern === 'string') {
                    return body.includes(pattern);
                } else if (pattern instanceof RegExp) {
                    return pattern.test(body);
                }
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
            // ANTI-LINK
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

            // ANTI-SCAM
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

            // ANTI-PORN
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

            // ANTI-MEDIA
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
                } catch (error) {
                    // Silent fail
                }
            }
            
            try {
                const aiRes = await axios.get(`${config.aiModel}${encodeURIComponent(body)}`);
                const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiRes.data)}\n\n_ᴅᴇᴠᴇʟᴏᴘᴇʀ: ꜱᴛᴀɴʏᴛᴢ_`;
                
                await conn.sendMessage(from, { text: response }, { quoted: msg });
            } catch (e) { 
                console.error("AI Error:", e);
            }
        }

        // COMMAND HANDLING
        if (isCmd) {
            if (config.autoTyping) {
                try {
                    await conn.sendPresenceUpdate('composing', from);
                } catch (error) {
                    // Silent fail
                }
            }

            const cmdPath = path.join(__dirname, 'commands');
            
            try {
                if (fs.existsSync(cmdPath)) {
                    let commandFound = false;
                    
                    // Recursively search all folders for command
                    const searchCommand = async (dir) => {
                        const items = fs.readdirSync(dir);
                        
                        for (const item of items) {
                            const itemPath = path.join(dir, item);
                            const stat = fs.statSync(itemPath);
                            
                            if (stat.isDirectory()) {
                                await searchCommand(itemPath);
                            } else if (item === `${command}.js`) {
                                delete require.cache[require.resolve(itemPath)];
                                const cmdModule = require(itemPath);
                                commandFound = true;
                                
                                // Execute command with timeout
                                const timeoutPromise = new Promise((_, reject) => {
                                    setTimeout(() => reject(new Error('Command timeout')), 30000);
                                });
                                
                                await Promise.race([
                                    cmdModule.execute(conn, msg, args, { 
                                        from, sender, fancy, isOwner, pushname, config, conn, msg: m
                                    }),
                                    timeoutPromise
                                ]);
                                return;
                            }
                        }
                    };
                    
                    await searchCommand(cmdPath);
                    
                    // Command not found
                    if (!commandFound && command !== 'menu') {
                        await conn.sendMessage(from, { 
                            text: fancy(`❌ Command "${command}" not found.\n\n📋 Type ${config.prefix}menu for available commands.`) 
                        });
                    }
                }
            } catch (err) {
                console.error("Command error:", err);
                await conn.sendMessage(from, { 
                    text: fancy(`❌ Error: ${err.message}`) 
                });
            }
        }

    } catch (err) {
        console.error("Handler Error:", err);
    }
};
