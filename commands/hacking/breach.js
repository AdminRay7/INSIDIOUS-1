const axios = require('axios');
module.exports = {
    name: "breach",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴇɴᴛᴇʀ ᴇᴍᴀɪʟ ᴛᴏ ᴄʜᴇᴄᴋ."));
        try {
            // Using a free breach checker API
            const res = await axios.get(`https://api.proxynova.com/comb?query=${args[0]}`);
            let txt = `╭── • 🥀 • ──╮\n  ${fancy("ʙʀᴇᴀᴄʜ ᴅᴇᴛᴇᴄᴛᴏʀ")}\n╰── • 🥀 • ──╯\n\n` +
                `📧 *ᴇᴍᴀɪʟ:* ${args[0]}\n` +
                `📉 *ꜱᴛᴀᴛᴜꜱ:* ${res.data.results > 0 ? 'ᴘᴡɴᴇᴅ! 🥀' : 'ꜱᴀꜰᴇ ✅'}\n` +
                `📊 *ꜰᴏᴜɴᴅ ɪɴ:* ${res.data.results} ʟᴇᴀᴋꜱ\n\n` +
                `${fancy("ᴄʜᴀɴɢᴇ ʏᴏᴜʀ ᴘᴀꜱꜱᴡᴏʀᴅꜱ ɪᴍᴍᴇᴅɪᴀᴛᴇʟʏ.")}`;
            conn.sendMessage(from, { text: txt });
        } catch (e) { msg.reply("🥀 ᴅᴀᴛᴀʙᴀꜱᴇ ᴜɴʀᴇᴀᴄʜᴀʙʟᴇ."); }
    }
};
