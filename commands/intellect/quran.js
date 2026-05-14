const axios = require('axios');
module.exports = {
    name: "quran",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴇɴᴛᴇʀ ᴀ ꜱᴜʀᴀʜ, ᴀʏᴀʜ, ᴏʀ ᴛᴏᴘɪᴄ ꜰʀᴏᴍ ᴛʜᴇ ǫᴜʀᴀɴ."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as an Islamic Scholar (Alim). Provide a deep Tafsir and spiritual guidance for: ${args.join(' ')}. Reply in the user's language.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ǫᴜʀᴀɴɪᴄ ʀᴇꜰʟᴇᴄᴛɪᴏɴ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴇʀʀᴏʀ ꜰᴇᴛᴄʜɪɴɢ ᴛᴀꜰꜱɪʀ."); }
    }
};
