const config = require('../../config');
module.exports = {
    name: "setprefix",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]) return msg.reply("🥀 Provide a prefix (e.g !, #, $)");
        config.prefix = args[0];
        conn.sendMessage(from, { text: fancy(`🥀 ᴘʀᴇꜰɪx ᴄʜᴀɴɢᴇᴅ ᴛᴏ: ${args[0]}`) });
    }
};
