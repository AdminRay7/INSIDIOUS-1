const axios = require('axios');
module.exports = {
    name: "hash",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴀ ʜᴀꜱʜ ᴏʀ ᴛᴇxᴛ."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Identify this hash or explain how to encrypt text into MD5, SHA1, and SHA256: ${args[0]}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴄʀʏᴘᴛᴏɢʀᴀᴘʜʏ ʟᴀʙ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴄɪᴘʜᴇʀ ᴇʀʀᴏʀ."); }
    }
};
