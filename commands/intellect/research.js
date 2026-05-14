const axios = require('axios');
module.exports = {
    name: "research",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ɪꜱ ʏᴏᴜʀ ʀᴇꜱᴇᴀʀᴄʜ ᴛᴏᴘɪᴄ?"));
        msg.reply(fancy("🥀 ᴅɪɢɢɪɴɢ ɪɴᴛᴏ ᴛʜᴇ ᴀʀᴄʜɪᴠᴇꜱ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Senior Researcher. Provide deep insights, historical context, current trends, and potential references for the topic: ${args.join(' ')}`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ʀᴇꜱᴇᴀʀᴄʜ ᴘᴀᴘᴇʀ ɪɴꜱɪɢʜᴛ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ʀᴇꜱᴇᴀʀᴄʜ ꜰᴀɪʟᴇᴅ."); }
    }
};
