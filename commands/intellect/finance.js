const axios = require('axios');
module.exports = {
    name: "finance",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ꜰɪɴᴀɴᴄɪᴀʟ ᴄᴏɴᴄᴇᴘᴛ ᴅᴏ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ᴜɴᴅᴇʀꜱᴛᴀɴᴅ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Financial Consultant. Explain in detail the concept of: ${args.join(' ')}. Give practical advice on wealth building. Reply in the user's language.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ꜰɪɴᴀɴᴄɪᴀʟ ʟɪᴛᴇʀᴀᴄʏ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ᴍᴀʀᴋᴇᴛ ɪꜱ ᴄʟᴏꜱᴇᴅ."); }
    }
};
