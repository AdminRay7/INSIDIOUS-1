const axios = require('axios');
module.exports = {
    name: "puzzle",
    execute: async (conn, msg, args, { from, fancy }) => {
        try {
            const res = await axios.get(`https://text.pollinations.ai/Give me a very hard logic riddle or IQ puzzle with the answer hidden at the bottom.`);
            await conn.sendMessage(from, { text: fancy(`🥀 *ɪɴꜱɪᴅɪᴏᴜꜱ ɪǫ ᴛᴇꜱᴛ:*\n\n${res.data}`) });
        } catch (e) { msg.reply("🥀 ᴘᴜᴢᴢʟᴇ ᴇʀʀᴏʀ."); }
    }
};
