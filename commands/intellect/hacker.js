const axios = require('axios');
module.exports = {
    name: "hacker",
    execute: async (conn, msg, args, { from, fancy }) => {
        const topic = args[0] ? args.join(' ') : "Ethical Hacking Basics";
        const res = await axios.get(`https://text.pollinations.ai/Explain ${topic} for educational purposes and ethical hacking only. Use advanced technical terms but keep it simple.`);
        let txt = `╭── • 🥀 • ──╮\n  ${fancy("ʜᴀᴄᴋᴇʀ ɪɴꜱɪɢʜᴛ")}\n╰── • 🥀 • ──╯\n\n` +
            `${res.data}\n\n` +
            `⚠️ *ᴡᴀʀɴɪɴɢ:* ꜰᴏʀ ᴇᴅᴜᴄᴀᴛɪᴏɴᴀʟ ᴜꜱᴇ ᴏɴʟʏ.`;
        conn.sendMessage(from, { text: fancy(txt) });
    }
};
