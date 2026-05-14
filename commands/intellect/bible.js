const axios = require('axios');
module.exports = {
    name: "bible",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴇɴᴛᴇʀ ᴀ ᴠᴇʀꜱᴇ ᴏʀ ᴛᴏᴘɪᴄ ꜰʀᴏᴍ ᴛʜᴇ ʜᴏʟʏ ʙɪʙʟᴇ."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Biblical Scholar. Provide deep theological insight, context, and life lessons for: ${args.join(' ')}. Reply in the user's language.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ʙɪʙʟɪᴄᴀʟ ᴡɪꜱᴅᴏᴍ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ꜱᴄʀɪᴘᴛᴜʀᴇꜱ ᴀʀᴇ ꜱᴇᴀʟᴇᴅ."); }
    }
};
