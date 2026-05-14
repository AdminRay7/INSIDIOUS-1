const axios = require('axios');
module.exports = {
    name: "assignment",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ɪꜱ ʏᴏᴜʀ ᴀꜱꜱɪɢɴᴍᴇɴᴛ ǫᴜᴇꜱᴛɪᴏɴ?"));
        msg.reply(fancy("🥀 ᴄᴏɴᴊᴜʀɪɴɢ ᴛʜᴇ ᴀɴꜱᴡᴇʀ ꜰᴏʀ ʏᴏᴜ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a University Professor. Provide a detailed, well-structured assignment answer for: ${args.join(' ')}. Include introduction, main body points, and conclusion.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ᴀꜱꜱɪɢɴᴍᴇɴᴛ ʜᴇʟᴘᴇʀ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ᴠᴏɪᴅ ɪꜱ ʙᴜꜱʏ."); }
    }
};
