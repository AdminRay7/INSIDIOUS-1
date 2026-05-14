const config = require('../../config');
module.exports = {
    name: "bc",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        if (!args[0]) return msg.reply("🥀 What is the message?");
        let getGroups = await conn.groupFetchAllParticipating();
        let groups = Object.keys(getGroups);
        conn.sendMessage(from, { text: fancy(`🥀 ꜱᴇɴᴅɪɴɢ ʙʀᴏᴀᴅᴄᴀꜱᴛ ᴛᴏ ${groups.length} ɢʀᴏᴜᴘꜱ...`) });
        
        for (let i of groups) {
            await conn.sendMessage(i, { 
                text: `╭── • 🥀 • ──╮\n  ${fancy("ɪɴꜱɪᴅɪᴏᴜꜱ ʙʀᴏᴀᴅᴄᴀꜱᴛ")}\n╰── • 🥀 • ──╯\n\n${args.join(' ')}\n\n${fancy(config.footer)}`,
                contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: config.botName } }
            });
        }
        msg.reply(fancy("🥀 Broadcast complete."));
    }
};
