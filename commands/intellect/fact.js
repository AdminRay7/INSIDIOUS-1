const axios = require('axios');
module.exports = {
    name: "fact",
    execute: async (conn, msg, args, { from, fancy }) => {
        try {
            const res = await axios.get(`https://text.pollinations.ai/Give me one mind-blowing scientific or historical fact.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ᴅɪᴅ ʏᴏᴜ ᴋɴᴏᴡ?*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            });
        } catch (e) { msg.reply("🥀 ɴᴏ ꜰᴀᴄᴛꜱ ꜰᴏᴜɴᴅ."); }
    }
};
