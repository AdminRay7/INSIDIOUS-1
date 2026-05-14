const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "law",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ʟᴇɢᴀʟ ᴛᴏᴘɪᴄ ᴏʀ ʀɪɢʜᴛ ᴅᴏ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴋɴᴏᴡ?"));
        msg.reply(fancy("🥀 ꜱᴇᴀʀᴄʜɪɴɢ ᴛʜᴇ ʟᴇɢᴀʟ ᴀʀᴄʜɪᴠᴇꜱ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a senior legal expert. Explain in detail the laws and rights regarding: ${args.join(' ')}. Respond in the language used by the user.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ʟᴇɢᴀʟ ɪɴꜱɪɢʜᴛ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ʟᴀᴡ" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ᴄᴏᴜʀᴛ ɪꜱ ᴀᴅᴊᴏᴜʀɴᴇᴅ."); }
    }
};
