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
            const cmdPath = path.join(__dirname, '../../commands');

            if (!fs.existsSync(cmdPath)) {
                return await conn.sendMessage(from, {
                    text: fancy("❌ Commands folder not found.")
                }, { quoted: msg });
            }

            // ---------------- Collect commands by category ----------------
            const categories = fs.readdirSync(cmdPath)
                .filter(f => fs.statSync(path.join(cmdPath, f)).isDirectory())
                .sort();

            let totalCmds = 0;
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
                    totalCmds++;
                }
                body += `\n`;
            }

            // ---------------- Assemble full menu text ----------------
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
                `│ 📦 Commands: ${totalCmds}\n` +
                `│ ⏱️ Uptime: ${days}d ${hours}h ${minutes}m\n` +
                `│ 🎯 Mode: ${config.workMode.toUpperCase()}\n`;

            const footer =
                `\n╭─── • 💡 • ───╮\n` +
                `   ʜᴏᴡ ᴛᴏ ᴜꜱᴇ\n` +
                `╰─── • 💡 • ───╯\n` +
                `│ ◦ Type ${config.prefix}<command>\n` +
                `│ ◦ Example: ${config.prefix}ping\n` +
                `│ ◦ Help: ${config.prefix}menu\n\n` +
                `${fancy(config.footer)}`;

            const fullMenu = header + body + footer;

            // ---------------- Load image from Assets ----------------
            const imagePath = path.join(__dirname, '../../Assets/menu.png');
            const fallbackPath = path.join(__dirname, '../../Assets/menu.jpg');

            let imageBuffer = null;
            if (fs.existsSync(imagePath)) {
                imageBuffer = fs.readFileSync(imagePath);
            } else if (fs.existsSync(fallbackPath)) {
                imageBuffer = fs.readFileSync(fallbackPath);
            }

            // ---------------- Send ----------------
            if (imageBuffer) {
                await conn.sendMessage(from, {
                    image: imageBuffer,
                    caption: fullMenu
                }, { quoted: msg });
            } else {
                // Fallback: send text only if image missing
                await conn.sendMessage(from, {
                    text: fullMenu
                }, { quoted: msg });
            }

        } catch (e) {
            console.error("Menu error:", e);
            await conn.sendMessage(from, {
                text: fancy("❌ Menu error: " + e.message)
            }, { quoted: msg });
        }
    }
};