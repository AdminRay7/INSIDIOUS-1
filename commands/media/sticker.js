const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
module.exports = {
    name: "sticker",
    execute: async (conn, msg, args, { from, fancy }) => {
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        const type = Object.keys(quoted)[0];
        if (type !== 'imageMessage' && type !== 'videoMessage') return msg.reply("🥀 ʀᴇᴘʟʏ ᴛᴏ ᴀ ᴘʜᴏᴛᴏ ᴏʀ ꜱʜᴏʀᴛ ᴠɪᴅᴇᴏ!");
        
        msg.reply(fancy("🥀 ᴄᴏɴᴠᴇʀᴛɪɴɢ ᴛᴏ ꜱᴛɪᴄᴋᴇʀ..."));
        const stream = await downloadContentFromMessage(quoted[type], type.replace('Message', ''));
        let buffer = Buffer.from([]);
        for await(const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
        
        await conn.sendMessage(from, { sticker: buffer }, { quoted: msg });
    }
};
