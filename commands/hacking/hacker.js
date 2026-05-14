const axios = require('axios');
module.exports = {
    name: "hacker",
    execute: async (conn, msg, args, { from, fancy }) => {
        const topic = args[0] ? args.join(' ') : "Metasploit Basics";
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Senior Ethical Hacker. Provide a professional tutorial on: ${topic}. Include tools needed and ethical warnings. Reply in the user's language.`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ʜᴀᴄᴋᴇʀ'ꜱ ᴍᴀɴᴜᴀʟ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter" } }
            });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ꜱʏꜱᴛᴇᴍ ɪꜱ ᴅᴏᴡɴ."); }
    }
};
