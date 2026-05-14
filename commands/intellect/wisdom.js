const axios = require('axios');
module.exports = {
    name: "wisdom",
    execute: async (conn, msg, args, { from, fancy }) => {
        const topic = args[0] ? args.join(' ') : "Life and Respect";
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as an African Elder. Give several powerful African proverbs and their deep meanings related to: ${topic}. Reply in the user's language.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ᴀꜰʀɪᴄᴀɴ ᴡɪꜱᴅᴏᴍ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ᴇʟᴅᴇʀꜱ ᴀʀᴇ ꜱɪʟᴇɴᴛ."); }
    }
};
