const axios = require('axios');
module.exports = {
    name: "mythology",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜɪᴄʜ ᴀɴᴄɪᴇɴᴛ ᴍʏᴛʜ ꜱʜᴀʟʟ ɪ ᴜɴᴠᴇɪʟ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a Mythologist. Explain the legends and folklore of: ${args.join(' ')}. Respond in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴀɴᴄɪᴇɴᴛ ʟᴇɢᴇɴᴅꜱ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴛʜᴇ ɢᴏᴅꜱ ᴀʀᴇ ᴀɴɢʀʏ."); }
    }
};
