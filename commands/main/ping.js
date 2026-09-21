const config = require('../../config');
const { fancy } = require('../../lib/font');

module.exports = {
    name: "ping",
    aliases: ["p", "speed"],
    description: "Check bot speed",

    execute: async (conn, msg, args, { from, pushname }) => {
        const start = Date.now();

        const sent = await conn.sendMessage(from, { text: "🏓 Pinging..." }, { quoted: msg });

        const speed = Date.now() - start;
        const botName = config.botName || "INSIDIOUS";

        const text =
            `╭━━━〔 🏓 PONG 〕━━━╮\n` +
            `┃\n` +
            `┃ ⚡ ${fancy("Speed")}  : ${speed} ms\n` +
            `┃ 🤖 ${fancy("Bot")}    : ${botName}\n` +
            `┃ 👤 ${fancy("User")}   : ${pushname}\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n` +
            `${fancy(config.footer || "")}`;

        await conn.sendMessage(from, {
            text: text,
            edit: sent.key
        });
    }
};