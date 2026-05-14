
const axios = require('axios');
module.exports = {
    name: "nature",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜɪᴄʜ ᴘᴀʀᴛ ᴏꜰ ɴᴀᴛᴜʀᴇ ꜱʜᴀʟʟ ᴡᴇ ᴇxᴘʟᴏʀᴇ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Biologist. Explain the wonders and science of: ${args.join(' ')}. Reply in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ɴᴀᴛᴜʀᴇ'ꜱ ꜱᴇᴄʀᴇᴛꜱ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ɴᴀᴛᴜʀᴇ ɪꜱ ʜɪᴅɪɴɢ."); }
    }
};
