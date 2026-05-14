const axios = require('axios');
module.exports = {
    name: "cite",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ᴛʜᴇ ʀᴇꜱᴏᴜʀᴄᴇ ᴅᴇᴛᴀɪʟꜱ ᴛᴏ ᴄɪᴛᴇ."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Provide APA and MLA style citations for this resource: ${args.join(' ')}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴄɪᴛᴀᴛɪᴏɴ ʜᴇʟᴘᴇʀ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴄɪᴛᴀᴛɪᴏɴ ᴇʀʀᴏʀ."); }
    }
};
