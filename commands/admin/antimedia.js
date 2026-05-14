const config = require('../../config');
module.exports = {
    name: "antimedia",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]) return msg.reply(fancy("Usage: .antimedia image/video/sticker/all/off"));
        config.antimedia = args[0];
        msg.reply(fancy(`🥀 ᴀɴᴛɪᴍᴇᴅɪᴀ ꜱᴇᴛ ᴛᴏ: ${args[0].toUpperCase()}`));
    }
};
