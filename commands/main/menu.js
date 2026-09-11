const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { fancy } = require('../../lib/font');

module.exports = {
    name: "menu",
    aliases: ["help", "cmds", "commands", "m"],
    description: "Show all commands grouped by category",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            // ---------------- LOAD MENU IMAGE FROM ASSETS ----------------
            const assetsDir = path.join(__dirname, '../../Assets');
            const imageCandidates = [
                path.join(assetsDir, 'menu.jpg'),
                path.join(assetsDir, 'menu.jpeg'),
                path.join(assetsDir, 'menu.png')
            ];

            let imagePath = null;
            for (const p of imageCandidates) {
                if (fs.existsSync(p)) {
                    imagePath = p;
                    break;
                }
            }

            if (!imagePath) {
                throw new Error("Menu image not found in Assets/ (expected menu.jpg / menu.png)");
            }

            const imageBuffer = fs.readFileSync(imagePath);

            // ---------------- COLLECT COMMANDS BY CATEGORY ----------------
            const cmdPath = path.join(__dirname, '../../commands');

            if (!fs.existsSync(cmdPath)) {
                throw new Error("Commands folder not found");
            }

            const categories = fs.readdirSync(cmdPath)
                .filter(f => fs.statSync(path.join(cmdPath, f)).isDirectory())
                .sort();

            let body = "";

            for (const cat of categories) {
                const catPath = path.join(cmdPath, cat);
                const files = fs.readdirSync(catPath).filter(f => f.endsWith('.js'));

                if (files.length === 0) continue;

                body += `\n╭─── • 📁 • ───╮\n`;
                body += `   ${cat.toUpperCase()}\n`;
                body += `╰─── • 📁 • ───╯\n`;

                for (const file of files.sort()) {
                    const cmdName = file.replace('.js', '');
                    body += `│ ◦ ${config.prefix}${cmdName}\n`;
                }
                body += `\n`;
            }

            // ---------------- HEADER ----------------
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);

            const header =
                `╭─── • 🥀 • ───╮\n` +
                `   ${fancy(config.botName.toUpperCase())} ᴠ${config.version}\n` +
                `╰─── • 🥀 • ───╯\n\n` +
                `│ 👑 Owner: ${config.ownerName}\n` +
                `│ ⚙️ Prefix: ${config.prefix}\n` +
                `│ ⏱️ Uptime: ${days}d ${hours}h ${minutes}m\n`;

            // ---------------- FOOTER ----------------
            const footer =
                `\n╭─── • 💡 • ───╮\n` +
                `   ʜᴏᴡ ᴛᴏ ᴜꜱᴇ\n` +
                `╰─── • 💡 • ───╯\n` +
                `│ ◦ Type ${config.prefix}<command>\n` +
                `│ ◦ Example: ${config.prefix}ping\n` +
                `│ ◦ Help: ${config.prefix}menu\n\n` +
                `${fancy(config.footer)}`;

            const fullMenu = header + body + footer;

            // ---------------- SEND IMAGE + CAPTION ----------------
            await conn.sendMessage(from, {
                image: imageBuffer,
                caption: fullMenu
            }, { quoted: msg });

        } catch (e) {
            console.error("Menu error:", e);
            await conn.sendMessage(from, {
                text: fancy("❌ Menu error: " + e.message)
            }, { quoted: msg });
        }
    }
};