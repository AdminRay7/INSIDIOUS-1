const fs = require('fs-extra');
const config = require('../../config');

let warnDB = {}; // Hii iunganishe na MongoDB yako

module.exports = {
    name: "warn",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        if (!user) return msg.reply(fancy("ᴛᴀɢ ᴛʜᴇ ꜱᴏᴜʟ ᴛᴏ ᴡᴀʀɴ."));

        if (!warnDB[user]) warnDB[user] = 0;
        warnDB[user] += 1;

        if (warnDB[user] >= 3) {
            warnDB[user] = 0;
            await conn.groupParticipantsUpdate(from, [user], "remove");
            return conn.sendMessage(from, { text: fancy(`🥀 @${user.split('@')[0]} ʜᴀꜱ ʙᴇᴇɴ ᴇxɪʟᴇᴅ ᴀꜰᴛᴇʀ 3 ᴡᴀʀɴɪɴɢꜱ.`), mentions: [user] });
        }

        let reason = args.slice(1).join(' ') || "No reason provided.";
        let txt = `╭── • 🥀 • ──╮\n  ${fancy("ꜱʏꜱᴛᴇᴍ ᴡᴀʀɴɪɴɢ")}\n╰── • 🥀 • ──╯\n\n` +
                  `│ ◦ ${fancy("ᴜꜱᴇʀ")}: @${user.split('@')[0]}\n` +
                  `│ ◦ ${fancy("ᴡᴀʀɴꜱ")}: ${warnDB[user]}/3\n` +
                  `│ ◦ ${fancy("ʀᴇᴀꜱᴏɴ")}: ${reason}\n\n` +
                  `🥀 ${fancy("Behave or you will be dragged into the Further.")}`;

        conn.sendMessage(from, { 
            text: txt, 
            mentions: [user],
            contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.newsletterJid, newsletterName: config.botName } }
        });
    }
};
