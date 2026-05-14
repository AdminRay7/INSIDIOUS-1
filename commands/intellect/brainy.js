const axios = require('axios');
module.exports = {
    name: "brainy",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ꜱᴄɪᴇɴᴛɪꜰɪᴄ ᴘʀᴏʙʟᴇᴍ."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a scientist and solve this with steps: ${args.join(' ')}`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ꜱᴄɪᴇɴᴛɪꜰɪᴄ ᴀɴᴀʟʏꜱɪꜱ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴄᴀʟᴄᴜʟᴀᴛɪᴏɴ ᴇʀʀᴏʀ."); }
    }
};
