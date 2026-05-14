const axios = require('axios');
module.exports = {
    name: "proxy",
    execute: async (conn, msg, args, { from, fancy }) => {
        msg.reply(fancy("🥀 ꜰᴇᴛᴄʜɪɴɢ ᴀɴᴏɴʏᴍᴏᴜꜱ ᴘʀᴏxɪᴇꜱ..."));
        try {
            const res = await axios.get(`https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all`);
            const proxies = res.data.split('\n').slice(0, 10).join('\n');
            await conn.sendMessage(from, { text: fancy(`🥀 *ꜰʀᴇꜱʜ ʜᴛᴛᴘ ᴘʀᴏxɪᴇꜱ:*\n\n${proxies}`) });
        } catch (e) { msg.reply("🥀 ᴘʀᴏxʏ ꜱᴇʀᴠᴇʀ ᴅᴏᴡɴ."); }
    }
};
