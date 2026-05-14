const axios = require('axios');
module.exports = {
    name: "eli5",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ᴄᴏᴍᴘʟᴇx ᴛʜɪɴɢ ꜱʜᴏᴜʟᴅ ɪ ᴇxᴘʟᴀɪɴ ꜱɪᴍᴘʟʏ?"));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Explain ${args.join(' ')} like I am 5 years old. Use simple analogies. Reply in the user's language.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ꜱɪᴍᴘʟɪꜰɪᴇᴅ ɪɴᴛᴇʟʟᴇᴄᴛ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴛᴏᴏ ᴄᴏᴍᴘʟᴇx ꜰᴏʀ ɴᴏᴡ."); }
    }
};
