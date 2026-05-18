const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber } = require('./database/models');

// Caches
const commandCache = new Map();
const reactionCooldown = new Map();
const commandCooldown = new Map();
const messageQueue = [];
let isProcessingQueue = false;

const COMMAND_COOLDOWN = 2000;
const REACTION_COOLDOWN = 5000;

// Message queue processor
async function processMessageQueue() {
    if (isProcessingQueue || messageQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    while (messageQueue.length > 0) {
        const { conn, m, resolve, reject } = messageQueue.shift();
        try {
            const result = await processMessage(conn, m);
            if (resolve) resolve(result);
        } catch (error) {
            console.error("Queue error:", error.message);
            if (reject) reject(error);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    isProcessingQueue = false;
}

async function processMessage(conn, m) {
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

        // ========== HANDLE BUTTON INTERACTIONS ==========
        if (msg.message?.buttonsResponseMessage) {
            const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
            const from = msg.key.remoteJid;
            const sender = msg.key.participant || msg.key.remoteJid;
            
            if (buttonId && buttonId.startsWith('menu_')) {
                try {
                    // Check if menu command exists
                    const menuPath = path.join(__dirname, 'commands', 'general', 'menu.js');
                    const altMenuPath = path.join(__dirname, 'commands', 'menu.js');
                    
                    let menuCommand = null;
                    if (await fs.pathExists(menuPath)) {
                        menuCommand = require(menuPath);
                    } else if (await fs.pathExists(altMenuPath)) {
                        menuCommand = require(altMenuPath);
                    }
                    
                    if (menuCommand && typeof menuCommand.handleButton === 'function') {
                        await menuCommand.handleButton(conn, msg, buttonId, { from, sender });
                    } else {
                        console.log("Menu button handler not found");
                    }
                } catch (error) {
                    console.error("Button handler error:", error);
                }
            }
            return;
        }

        // ========== HANDLE LIST RESPONSES ==========
        if (msg.message?.listResponseMessage) {
            const selectedItem = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
            if (selectedItem && selectedItem.startsWith('menu_')) {
                try {
                    const menuPath = path.join(__dirname, 'commands', 'general', 'menu.js');
                    const altMenuPath = path.join(__dirname, 'commands', 'menu.js');
                    
                    let menuCommand = null;
                    if (await fs.pathExists(menuPath)) {
                        menuCommand = require(menuPath);
                    } else if (await fs.pathExists(altMenuPath)) {
                        menuCommand = require(altMenuPath);
                    }
                    
                    if (menuCommand && typeof menuCommand.handleListResponse === 'function') {
                        await menuCommand.handleListResponse(conn, msg, selectedItem, { from, sender });
                    }
                } catch (error) {
                    console.error("List response error:", error);
                }
            }
            return;
        }

        // Skip channel messages
        if (from === config.newsletterJid) return;

        // Auto read
        if (config.autoRead) {
            try {
                await conn.readMessages([msg.key]);
            } catch (error) {}
        }

        // Auto react with rate limiting
        if (config.autoReact && !msg.key.fromMe && !isGroup) {
            const lastReact = reactionCooldown.get(sender);
            const now = Date.now();
            
            if (!lastReact || now - lastReact > REACTION_COOLDOWN) {
                try {
                    const reactions = ['🥀', '❤️', '🔥', '⭐', '✨'];
                    const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                    await conn.sendMessage(from, { 
                        react: { text: randomReaction, key: msg.key } 
                    });
                    reactionCooldown.set(sender, now);
                } catch (error) {}
            }
        }

        // Auto save contact
        if (config.autoSave && !isOwner && !isGroup) {
            setImmediate(async () => {
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
                } catch (error) {}
            });
        }

        // Work mode check
        if (config.workMode === 'private' && !isOwner) return;

        // Channel subscription check
        if (!isOwner && !isGroup) {
            try {
                let subscriber = await ChannelSubscriber.findOne({ 
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
                        text: fancy(`╭── • 🥀 • ──╮\n  ${fancy("ᴄʜᴀɴɴᴇʟ ꜱᴜʙꜱᴄʀɪᴘᴛɪᴏɴ")}\n╰── • 🥀 • ──╯\n\n✅ Auto-subscribed!\n🔗 ${config.channelLink}`) 
                    });
                }
            } catch (error) {}
        }

        // Anti-spam
        if (config.antispam && !isOwner) {
            setImmediate(async () => {
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
                                } else {
                                    await conn.updateBlockStatus(sender, 'block');
                                }
                                user.spamCount = 0;
                            }
                        } else {
                            user.spamCount = Math.max(0, (user.spamCount || 0) - 1);
                        }
                        user.lastMessageTime = now;
                        await user.save();
                    }
                } catch (error) {}
            });
        }

        // Group security features
        if (isGroup && !isOwner) {
            // Check if admin
            let isAdmin = false;
            try {
                const groupMetadata = await conn.groupMetadata(from);
                isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin === 'admin' ||
                         groupMetadata.participants.find(p => p.id === sender)?.admin === 'superadmin';
            } catch (error) {}
            
            if (!isAdmin) {
                // Anti-link
                if (config.antilink && body && body.match(/https?:\/\//gi)) {
                    try {
                        await conn.sendMessage(from, { delete: msg.key });
                        await conn.sendMessage(from, { 
                            text: fancy(`⚠️ No links allowed @${sender.split('@')[0]}`),
                            mentions: [sender]
                        });
                        return;
                    } catch (error) {}
                }

                // Anti-scam
                if (config.antiscam && body && config.scamWords?.some(w => body.toLowerCase().includes(w))) {
                    try {
                        await conn.sendMessage(from, { delete: msg.key });
                        await conn.groupParticipantsUpdate(from, [sender], "remove");
                        return;
                    } catch (error) {}
                }
            }
        }

        // AI Chatbot
        if (!isCmd && !msg.key.fromMe && body && body.trim().length > 1 && config.aiModel) {
            if (config.autoTyping) {
                conn.sendPresenceUpdate('composing', from).catch(() => {});
            }
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);
                
                const aiRes = await axios.get(`${config.aiModel}${encodeURIComponent(body)}`, {
                    signal: controller.signal,
                    timeout: 15000
                });
                
                clearTimeout(timeoutId);
                
                const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiRes.data.substring(0, 1000))}\n\n_${config.footer}_`;
                
                await conn.sendMessage(from, { text: response }, { quoted: msg });
            } catch (error) {
                const fallback = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy("I'm here, tell me more!")}\n\n_${config.footer}_`;
                await conn.sendMessage(from, { text: fallback });
            }
        }

        // Command handling
        if (isCmd) {
            // Command cooldown
            const cooldownKey = `${sender}:${command}`;
            const lastCommand = commandCooldown.get(cooldownKey);
            const now = Date.now();
            
            if (lastCommand && (now - lastCommand) < COMMAND_COOLDOWN) {
                return;
            }
            commandCooldown.set(cooldownKey, now);
            
            if (config.autoTyping) {
                conn.sendPresenceUpdate('composing', from).catch(() => {});
            }

            const cmdPath = path.join(__dirname, 'commands');
            
            try {
                if (await fs.pathExists(cmdPath)) {
                    const categories = await fs.readdir(cmdPath);
                    let commandFound = false;
                    
                    for (const cat of categories) {
                        const commandFile = path.join(cmdPath, cat, `${command}.js`);
                        if (await fs.pathExists(commandFile)) {
                            let cmd = commandCache.get(commandFile);
                            if (!cmd) {
                                cmd = require(commandFile);
                                commandCache.set(commandFile, cmd);
                            }
                            
                            await cmd.execute(conn, msg, args, { 
                                from, sender, fancy, isOwner, pushname, config 
                            });
                            commandFound = true;
                            break;
                        }
                    }
                    
                    // Check root commands folder
                    const rootCommandFile = path.join(cmdPath, `${command}.js`);
                    if (!commandFound && await fs.pathExists(rootCommandFile)) {
                        let cmd = commandCache.get(rootCommandFile);
                        if (!cmd) {
                            cmd = require(rootCommandFile);
                            commandCache.set(rootCommandFile, cmd);
                        }
                        
                        await cmd.execute(conn, msg, args, { 
                            from, sender, fancy, isOwner, pushname, config 
                        });
                        commandFound = true;
                    }
                    
                    if (!commandFound) {
                        await conn.sendMessage(from, { 
                            text: fancy(`❌ Command "${command}" not found.\n📝 Type ${config.prefix}menu for available commands.`) 
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
        console.error("Handler Error:", err.message);
    }
}

module.exports = async (conn, m) => {
    return new Promise((resolve, reject) => {
        messageQueue.push({ conn, m, resolve, reject });
        processMessageQueue();
    });
};wnKey = `${sender}:${command}`;
            const lastCommand = commandCooldown.get(cooldownKey);
            const now = Date.now();
            
            if (lastCommand && (now - lastCommand) < COMMAND_COOLDOWN) {
                return;
            }
            commandCooldown.set(cooldownKey, now);
            
            // Send typing indicator
            conn.sendPresenceUpdate('composing', from).catch(() => {});

            const cmdPath = path.join(__dirname, 'commands');
            
            try {
                if (await fs.pathExists(cmdPath)) {
                    const categories = await fs.readdir(cmdPath);
                    let commandFound = false;
                    
                    for (const cat of categories) {
                        const commandFile = path.join(cmdPath, cat, `${command}.js`);
                        if (await fs.pathExists(commandFile)) {
                            let cmd = commandCache.get(commandFile);
                            if (!cmd) {
                                cmd = require(commandFile);
                                commandCache.set(commandFile, cmd);
                            }
                            
                            // Limit cache size for Render
                            if (commandCache.size > 50) {
                                const firstKey = commandCache.keys().next().value;
                                commandCache.delete(firstKey);
                            }
                            
                            await cmd.execute(conn, msg, args, { 
                                from, sender, fancy, isOwner, pushname, config 
                            });
                            commandFound = true;
                            break;
                        }
                    }
                    
                    // Check root commands folder
                    const rootCommandFile = path.join(cmdPath, `${command}.js`);
                    if (!commandFound && await fs.pathExists(rootCommandFile)) {
                        let cmd = commandCache.get(rootCommandFile);
                        if (!cmd) {
                            cmd = require(rootCommandFile);
                            commandCache.set(rootCommandFile, cmd);
                        }
                        
                        await cmd.execute(conn, msg, args, { 
                            from, sender, fancy, isOwner, pushname, config 
                        });
                        commandFound = true;
                    }
                    
                    if (!commandFound) {
                        await conn.sendMessage(from, { 
                            text: fancy(`❌ Command "${command}" not found.\n📝 Type ${config.prefix}menu for available commands.`) 
                        });
                    }
                }
            } catch (err) {
                console.error("Command error:", err.message);
                await conn.sendMessage(from, { 
                    text: fancy(`❌ Error: ${err.message}`) 
                });
            }
        }

    } catch (err) {
        console.error("Handler Error:", err.message);
    }
}

module.exports = async (conn, m) => {
    // Limit queue size to prevent memory issues on Render free tier
    if (messageQueue.length >= MAX_QUEUE_SIZE) {
        messageQueue.shift();
    }
    
    return new Promise((resolve, reject) => {
        messageQueue.push({ conn, m, resolve, reject });
        processMessageQueue();
    });
};

// Clean up caches periodically (for Render memory management)
setInterval(() => {
    if (commandCache.size > 100) {
        const keysToDelete = Array.from(commandCache.keys()).slice(0, 50);
        keysToDelete.forEach(key => commandCache.delete(key));
    }
    
    if (reactionCooldown.size > 1000) {
        const now = Date.now();
        for (const [key, time] of reactionCooldown.entries()) {
            if (now - time > 60000) {
                reactionCooldown.delete(key);
            }
        }
    }
    
    if (commandCooldown.size > 1000) {
        const now = Date.now();
        for (const [key, time] of commandCooldown.entries()) {
            if (now - time > 30000) {
                commandCooldown.delete(key);
            }
        }
    }
}, 60000); // Clean every minute
