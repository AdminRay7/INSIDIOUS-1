const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber } = require('./database/models');

module.exports = async (conn, m) => {
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

        if (from === config.newsletterJid) return;

        if (config.autoRead) {
            try { await conn.readMessages([msg.key]); } catch (e) {}
        }

        if (config.autoReact && !msg.key.fromMe && !isGroup) {
            try {
                const reactions = ['🥀', '❤️', '🔥', '⭐', '✨'];
                const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
                await conn.sendMessage(from, { react: { text: randomReaction, key: msg.key } });
            } catch (e) {}
        }

        if (config.autoSave && !isOwner && !isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) {
                    user = new User({ jid: sender, name: pushname, lastActive: new Date(), messageCount: 1 });
                } else {
                    user.messageCount += 1;
                    user.lastActive = new Date();
                }
                await user.save();
            } catch (e) {}
        }

        if (config.workMode === 'private' && !isOwner) return;

        if (!isOwner && !isGroup && config.channelLink) {
            const subscriber = await ChannelSubscriber.findOne({ jid: sender, isActive: true });
            if (!subscriber) {
                await ChannelSubscriber.create({
                    jid: sender, name: pushname, subscribedAt: new Date(), isActive: true, autoFollow: true
                });
                await conn.sendMessage(from, {
                    text: fancy(`✅ Auto-subscribed! You can now use all features.`)
                });
            } else {
                subscriber.lastActive = new Date();
                await subscriber.save();
            }
        }

        // AI fallback
        if (!isCmd && !msg.key.fromMe && body && body.trim().length > 1 && config.aiModel) {
            try {
                const aiRes = await axios.get(`${config.aiModel}${encodeURIComponent(body)}`);
                const response = `╭─── • 🥀 • ───╮\n   ʀ ᴇ ᴘ ʟ ʏ\n╰─── • 🥀 • ───╯\n\n${fancy(aiRes.data)}`;
                await conn.sendMessage(from, { text: response }, { quoted: msg });
            } catch (e) {}
        }

        // COMMAND HANDLING
        if (isCmd) {
            const cmdPath = path.join(__dirname, 'commands');
            try {
                if (fs.existsSync(cmdPath)) {
                    let foundModule = null;

                    const searchCommand = async (dir) => {
                        const items = fs.readdirSync(dir);
                        for (const item of items) {
                            const itemPath = path.join(dir, item);
                            const stat = fs.statSync(itemPath);
                            if (stat.isDirectory()) {
                                if (await searchCommand(itemPath)) return true;
                            } else if (item.endsWith('.js')) {
                                try {
                                    delete require.cache[require.resolve(itemPath)];
                                    const mod = require(itemPath);
                                    const names = [
                                        mod.name,
                                        ...(Array.isArray(mod.aliases) ? mod.aliases : [])
                                    ].filter(Boolean).map(s => s.toLowerCase());
                                    if (names.includes(command)) {
                                        foundModule = mod;
                                        return true;
                                    }
                                } catch (loadErr) {
                                    console.error(`⚠️ Failed to load ${itemPath}:`, loadErr.message);
                                }
                            }
                        }
                        return false;
                    };

                    await searchCommand(cmdPath);

                    if (foundModule && typeof foundModule.execute === 'function') {
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('Command timeout')), 30000);
                        });
                        try {
                            await Promise.race([
                                foundModule.execute(conn, msg, args, {
                                    from, sender, fancy, isOwner, pushname, config, conn, msg
                                }),
                                timeoutPromise
                            ]);
                        } catch (cmdErr) {
                            console.error(`Command "${command}" error:`, cmdErr);
                            await conn.sendMessage(from, { text: fancy(`❌ Command error: ${cmdErr.message}`) });
                        }
                    } else if (command !== 'menu') {
                        await conn.sendMessage(from, {
                            text: fancy(`❌ Command "${command}" not found.\n\n📋 Type ${config.prefix}menu for available commands.`)
                        });
                    }
                }
            } catch (err) {
                console.error("Command error:", err);
            }
        }

    } catch (err) {
        console.error("Handler Error:", err);
    }
};