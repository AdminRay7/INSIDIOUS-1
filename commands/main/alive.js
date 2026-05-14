const config = require('../../config');
const { fancy, runtime } = require('../../lib/font');

module.exports = {
    name: "alive",
    execute: async (conn, msg, args, { from, isOwner }) => {
        const status = config.workMode === 'public' ? "ᴘᴜʙʟɪᴄ" : "ꜱᴇʟꜰ (ᴘʀɪᴠᴀᴛᴇ)";
        const aliveMsg = `╭── • 🥀 • ──╮\n  ${fancy(config.botName)}\n╰── • 🥀 • ──╯\n\n` +
            `│ ◦ ${fancy("ᴅᴇᴠᴇʟᴏᴘᴇʀ")}: ${config.ownerName}\n` +
            `│ ◦ ${fancy("ᴜᴘᴛɪᴍᴇ")}: ${runtime(process.uptime())}\n` +
            `│ ◦ ${fancy("ᴍᴏᴅᴇ")}: ${status}\n` +
            `│ ◦ ${fancy("ᴠᴇʀꜱɪᴏɴ")}: 2.1.1\n\n` +
            `🥀 "${fancy("I'm not just a bot, I'm the key to the Further.")}"\n\n` +
            `└──────────────\n${fancy(config.footer)}`;

        await conn.sendMessage(from, { 
            image: { url: "https://files.catbox.moe/insidious-alive.jpg" }, // Weka link ya picha yako ya kutisha
            caption: fancy(aliveMsg),
            contextInfo: { 
                isForwarded: true, 
                forwardedNewsletterMessageInfo: { 
                    newsletterJid: config.newsletterJid, 
                    newsletterName: config.botName 
                } 
            }
        }, { quoted: msg });
    }
};
