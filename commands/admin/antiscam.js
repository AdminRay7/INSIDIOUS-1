const config = require('../../config');
module.exports = {
    name: "antiscam",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (args[0] === 'add') {
            let word = args.slice(1).join(' ');
            config.scamWords.push(word);
            return msg.reply(fancy(`🥀 ꜱᴄᴀᴍ ᴡᴏʀᴅ ᴀᴅᴅᴇᴅ: ${word}`));
        }
        config.antiscam = args[0] === 'on';
        msg.reply(fancy(`🥀 ᴀɴᴛɪꜱᴄᴀᴍ ꜰɪʟᴛᴇʀ ɪꜱ ${args[0].toUpperCase()}`));
    }
};
