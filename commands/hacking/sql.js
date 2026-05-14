const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "sqli",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀ ᴜʀʟ ᴛᴏ ᴛᴇꜱᴛ."));
        msg.reply(fancy("🥀 ꜱᴄᴀɴɴɪɴɢ ᴅᴀᴛᴀʙᴀꜱᴇ ɪɴᴊᴇᴄᴛɪᴏɴ ᴘᴏɪɴᴛꜱ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Cybersecurity Expert. Analyze the following URL for potential SQL Injection vulnerabilities and provide payloads for testing (Educational Only): ${args[0]}`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ꜱǫʟɪ ᴠᴜʟɴᴇʀᴀʙɪʟɪᴛʏ ʀᴇᴘᴏʀᴛ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ꜱᴇᴄᴜʀɪᴛʏ" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ꜱᴄᴀɴ ᴇʀʀᴏʀ."); }
    }
};
