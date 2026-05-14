const axios = require('axios');
module.exports = {
    name: "politics",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜɪᴄʜ ᴘᴏʟɪᴛɪᴄᴀʟ ɪᴅᴇᴏʟᴏɢʏ ᴏʀ ᴇᴠᴇɴᴛ ꜱʜᴀʟʟ ᴡᴇ ᴀɴᴀʟʏᴢᴇ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Political Scientist. Analyze: ${args.join(' ')}. Provide history, pros, and cons. Reply in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴘᴏʟɪᴛɪᴄᴀʟ ᴀɴᴀʟʏꜱɪꜱ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴘᴏʟɪᴛɪᴄᴀʟ ᴜɴʀᴇꜱᴛ ᴅᴇᴛᴇᴄᴛᴇᴅ."); }
    }
};
