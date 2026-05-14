module.exports = {
    name: "shutdown",
    execute: async (conn, msg, args, { from, fancy, isOwner }) => {
        if (!isOwner) return;
        await conn.sendMessage(from, { text: fancy("🥀 Insidious is retreating into the shadows... (Shutdown)") });
        process.exit(0);
    }
};
