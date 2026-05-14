module.exports = {
    name: "block",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || args[0]?.replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        if (!user) return msg.reply("🥀 Tag a user to block.");
        await conn.updateBlockStatus(user, "block");
        conn.sendMessage(from, { text: fancy("🥀 User banished to the further (Blocked).") });
    }
};
