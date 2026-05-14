module.exports = {
    name: "getstatus",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!msg.message.extendedTextMessage?.contextInfo?.quotedMessage) return msg.reply("🥀 Reply to a status first!");
        let quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
        await conn.sendMessage(conn.user.id, { forward: quoted });
        msg.reply(fancy("ꜱᴛᴀᴛᴜꜱ ʜᴀꜱ ʙᴇᴇɴ ᴄᴀᴘᴛᴜʀᴇᴅ ᴛᴏ ʏᴏᴜʀ ᴅᴍ."));
    }
};
