const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "osint",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴅᴏᴍᴀɪɴ ᴏʀ ɪᴘ ᴀᴅᴅʀᴇꜱꜱ."));
        msg.reply(fancy("🥀 ᴛʀᴀᴄɪɴɢ ᴛʜᴇ ᴅɪɢɪᴛᴀʟ ꜰᴏᴏᴛᴘʀɪɴᴛ..."));
        try {
            const res = await axios.get(`http://ip-api.com/json/${args[0]}?fields=66846719`);
            const d = res.data;
            let txt = `╭── • 🥀 • ──╮\n  ${fancy("ᴏꜱɪɴᴛ ʀᴇᴘᴏʀᴛ")}\n╰── • 🥀 • ──╯\n\n` +
                `🌐 *ɪᴘ:* ${d.query}\n` +
                `🌍 *ᴄᴏᴜɴᴛʀʏ:* ${d.country}\n` +
                `🏢 *ɪꜱᴘ:* ${d.isp}\n` +
                `🛰️ *ᴏʀɢ:* ${d.org}\n` +
                `📍 *ʟᴀᴛ/ʟᴏɴ:* ${d.lat}, ${d.lon}\n` +
                `⏰ *ᴛɪᴍᴇᴢᴏɴᴇ:* ${d.timezone}\n\n` +
                `${fancy("ɴᴏ ᴏɴᴇ ɪꜱ ʜɪᴅᴅᴇɴ ꜰʀᴏᴍ ɪɴꜱɪᴅɪᴏᴜꜱ.")}`;
            
            await conn.sendMessage(from, { 
                text: txt,
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ᴏꜱɪɴᴛ" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴛᴀʀɢᴇᴛ ɪꜱ ɢʜᴏꜱᴛᴇᴅ."); }
    }
};
