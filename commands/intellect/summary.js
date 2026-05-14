const axios = require('axios');
const config = require('../../config');

module.exports = {
    name: "summarize",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0] && !msg.message.extendedTextMessage?.contextInfo?.quotedMessage) 
            return msg.reply(fancy("ᴘʟᴇᴀꜱᴇ ᴘᴀꜱᴛᴇ ᴛʜᴇ ᴛᴇxᴛ ᴏʀ ʀᴇᴘʟʏ ᴛᴏ ᴀ ʟᴏɴɢ ᴍᴇꜱꜱᴀɢᴇ ᴛᴏ ꜱᴜᴍᴍᴀʀɪᴢᴇ."));
        
        const textToSum = args.join(' ') || msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation;
        msg.reply(fancy("🥀 ʀᴇᴀᴅɪɴɢ ᴛʜrough ᴛʜᴇ ꜱʜᴀᴅᴏᴡꜱ..."));

        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as an academic expert. Summarize the following text into clear bullet points and a concluding paragraph: ${textToSum}`);
            await conn.sendMessage(from, { 
                text: fancy(`🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ꜱᴜᴍᴍᴀʀʏ:*\n\n${res.data}`),
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ᴀᴄᴀᴅᴇᴍɪᴀ" } }
            }, { quoted: msg });
        } catch (e) { msg.reply("🥀 ꜰᴀɪʟᴇᴅ ᴛᴏ ᴘʀᴏᴄᴇꜱꜱ ꜱᴜᴍᴍᴀʀʏ."); }
    }
};
