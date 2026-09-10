const fs = require('fs');
const path = require('path');
const config = require('../../config');

module.exports = {
    name: "menu",
    aliases: ["help", "cmds", "commands"],
    description: "Show all commands",
    execute: async (conn, msg, args, { from }) => {
        try {
            const cmdPath = path.join(__dirname, '../../commands');

            let text = `╭─── • 🥀 • ───╮\n`;
            text += `  ${config.botName} v${config.version}\n`;
            text += `╰─── • 🥀 • ───╯\n\n`;
            text += `👑 Owner: ${config.ownerName}\n`;
            text += `⚙️ Prefix: ${config.prefix}\n\n`;

            const pick = args[0] ? args[0].toLowerCase() : null;

            if (!fs.existsSync(cmdPath)) {
                return await conn.sendMessage(from, { text: "❌ No commands folder found." }, { quoted: msg });
            }

            const categories = fs.readdirSync(cmdPath).filter(f => {
                return fs.statSync(path.join(cmdPath, f)).isDirectory();
            }).sort();

            // Show one category
            if (pick && !isNaN(parseInt(pick))) {
                const idx = parseInt(pick) - 1;
                if (idx < 0 || idx >= categories.length) {
                    return await conn.sendMessage(from, { text: "❌ Invalid category number." }, { quoted: msg });
                }

                const cat = categories[idx];
                const files = fs.readdirSync(path.join(cmdPath, cat)).filter(f => f.endsWith('.js'));

                let out = `╭─── • 📁 • ───╮\n  ${cat.toUpperCase()}\n╰─── • 📁 • ───╯\n\n`;
                out += `Commands (${files.length}):\n\n`;

                for (const file of files) {
                    out += `◦ ${config.prefix}${file.replace('.js', '')}\n`;
                }

                out += `\n_Type ${config.prefix}menu to go back_`;
                return await conn.sendMessage(from, { text: out }, { quoted: msg });
            }

            // Show main menu
            text += `📂 CATEGORIES:\n\n`;
            categories.forEach((cat, i) => {
                const files = fs.readdirSync(path.join(cmdPath, cat)).filter(f => f.endsWith('.js'));
                text += `${i + 1}. ${cat.toUpperCase()} (${files.length})\n`;
            });

            text += `\n📖 HOW TO USE:\n`;
            text += `◦ ${config.prefix}menu 1  → open category 1\n`;
            text += `◦ ${config.prefix}menu all → every command\n\n`;
            text += `_${config.footer}_`;

            await conn.sendMessage(from, { text }, { quoted: msg });

        } catch (e) {
            console.error("Menu error:", e);
            await conn.sendMessage(from, { text: "❌ Menu error: " + e.message }, { quoted: msg });
        }
    }
};