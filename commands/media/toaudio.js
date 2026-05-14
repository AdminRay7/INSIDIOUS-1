const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: "toaudio",
    execute: async (conn, msg, args, { from, fancy }) => {
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted?.videoMessage) return msg.reply("🥀 ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴠɪᴅᴇᴏ!");
        
        msg.reply(fancy("🥀 ᴇxᴛʀᴀᴄᴛɪɴɢ ꜱᴏᴜʟ (ᴀᴜᴅɪᴏ)..."));
        const stream = await downloadContentFromMessage(quoted.videoMessage, 'video');
        let buffer = Buffer.from([]);
        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
        
        await conn.sendMessage(from, { audio: buffer, mimetype: 'audio/mp4' }, { quoted: msg });
    }
};
