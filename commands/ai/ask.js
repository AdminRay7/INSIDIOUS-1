const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "ask",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ʜᴏᴡ ᴄᴀɴ ɪ ʜᴇʟᴘ ʏᴏᴜ ꜱᴏᴜʟ?"));
        
        const prompt = args.join(' ');
        const url = `${config.aiApi}${encodeURIComponent(prompt)}?system=You are INSIDIOUS V2, a human-like horror bot. Always reply in the user's language. Use Swahili slang if the user uses it.`;
        
        try {
            const res = await axios.get(url);
            await conn.sendMessage(from, { 
                text: fancy(res.data),
                contextInfo: { 
                    isForwarded: true, 
                    forwardedNewsletterMessageInfo: { 
                        newsletterJid: config.newsletterJid, 
                        newsletterName: config.botName 
                    } 
                }
            }, { quoted: msg });
        } catch (e) { msg.reply("AI is busy in the shadows..."); }
    }
};
