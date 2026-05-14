const axios = require('axios');
module.exports = {
    name: "cv",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴘʀᴏᴠɪᴅᴇ ʏᴏᴜʀ ᴘʀᴏꜰᴇꜱꜱɪᴏɴ ᴀɴᴅ ᴇxᴘᴇʀɪᴇɴᴄᴇ (ᴇ.ɢ. ᴊᴜɴɪᴏʀ ᴅᴇᴠ, 2 ʏᴇᴀʀꜱ)"));
        msg.reply(fancy("🥀 ʙᴜɪʟᴅɪɴɢ ʏᴏᴜʀ ᴘʀᴏꜰɪʟᴇ..."));
        try {
            const res = await axios.get(`https://text.pollinations.ai/Act as a HR Manager. Write a powerful Resume/CV summary and professional experience bullet points for: ${args.join(' ')}`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ᴄᴠ/ʀᴇꜱᴜᴍᴇ ʙᴜɪʟᴅᴇʀ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴄᴀʀᴇᴇʀ ꜱᴇʀᴠᴇʀ ᴅᴏᴡɴ."); }
    }
};
