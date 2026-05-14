const axios = require('axios');
module.exports = {
    name: "debate",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ɪꜱ ᴛʜᴇ ᴛᴏᴘɪᴄ ᴏꜰ ᴅᴇʙᴀᴛᴇ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Provide a professional debate analysis (Pros and Cons) for the topic: ${args.join(' ')}. Use logical reasoning. Respond in the user's language.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ᴅᴇʙᴀᴛᴇ ʟᴏɢɪᴄ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            });
        } catch (e) { msg.reply("🥀 ɴᴏ ʟᴏɢɪᴄ ꜰᴏᴜɴᴅ."); }
    }
};
