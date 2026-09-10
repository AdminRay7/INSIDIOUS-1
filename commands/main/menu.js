const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy } = require('../../lib/font');

// In-memory state per chat
const menuState = {};

module.exports = {
    name: "menu",
    description: "Show all available commands",
    aliases: ["help", "commands", "cmdlist", "cmds"],
    execute: async (conn, msg, args, { from, sender, isOwner, pushname }) => {
        try {
            await conn.sendPresenceUpdate('composing', from);

            // ---------- Handle numbered selection ----------
            if (args.length > 0) {
                const pick = args[0].trim();
                return await handleSelection(conn, msg, from, sender, pick);
            }

            // ---------- Build menu ----------
            const cmdPath = path.join(__dirname, '../../commands');
            let categories = [];
            let totalCmds = 0;
            const commandsByCategory = {};

            if (await fs.pathExists(cmdPath)) {
                const items = await fs.readdir(cmdPath);
                for (const item of items) {
                    const itemPath = path.join(cmdPath, item);
                    const stat = await fs.stat(itemPath);
                    if (stat.isDirectory()) {
                        const files = await fs.readdir(itemPath);
                        const cmds = files.filter(f => f.endsWith('.js')).map(f => f.replace('.js', ''));
                        if (cmds.length > 0) {
                            categories.push(item);
                            commandsByCategory[item] = cmds;
                            totalCmds += cmds.length;
                        }
                    }
                }
            }

            // Save state
            menuState[from] = { categories, commandsByCategory, totalCmds };

            // Build text menu
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);

            let menu = `╭─── • 🥀 • ───╮\n`;
            menu += `  ${fancy(config.botName.toUpperCase())}\n`;
            menu += `╰─── • 🥀 • ───╯\n\n`;
            menu += `│ ${fancy("📱 STATUS")}\n`;
            menu += `│ ◦ ${fancy("Owner")}: ${config.ownerName}\n`;
            menu += `│ ◦ ${fancy("Uptime")}: ${days}d ${hours}h ${minutes}m\n`;
            menu += `│ ◦ ${fancy("Mode")}: ${config.workMode.toUpperCase()}\n`;
            menu += `│ ◦ ${fancy("Commands")}: ${totalCmds}\n`;
            menu += `│ ◦ ${fancy("Prefix")}: ${config.prefix}\n\n`;

            menu += `│ ${fancy("📂 CATEGORIES")}\n`;
            categories.forEach((cat, i) => {
                const count = commandsByCategory[cat].length;
                menu += `│ ${i + 1}. ${cat.toUpperCase()} (${count})\n`;
            });
            menu += `\n`;

            menu += `│ ${fancy("🎯 HOW TO USE")}\n`;
            menu += `│ Reply with a number to open a category\n`;
            menu += `│ Example: ${config.prefix}menu 1\n\n`;

            menu += `│ ${fancy("⚡ QUICK")}\n`;
            menu += `│ ${config.prefix}menu stats - Bot statistics\n`;
            menu += `│ ${config.prefix}menu owner - Owner info\n`;
            menu += `│ ${config.prefix}menu all   - All commands\n\n`;

            menu += `└────────────────\n${fancy(config.footer)}`;

            await conn.sendMessage(from, { text: menu }, { quoted: msg });

        } catch (e) {
            console.error("Menu error:", e);
            await conn.sendMessage(from, { text: fancy("❌ Menu failed to load.") });
        }
    }
};

// ---------------- Selection handler ----------------
async function handleSelection(conn, msg, from, sender, pick) {
    const state = menuState[from];
    if (!state) {
        return conn.sendMessage(from, {
            text: fancy(`❌ Menu expired. Type ${config.prefix}menu to reload.`)
        });
    }

    const lower = pick.toLowerCase();

    // Special keywords
    if (lower === 'stats') {
        const stats = await getBotStats();
        return conn.sendMessage(from, {
            text: `╭─── • 📊 • ───╮\n  ${fancy("BOT STATISTICS")}\n╰─── • 📊 • ───╯\n\n${stats}\n\n${config.footer}`
        }, { quoted: msg });
    }

    if (lower === 'owner') {
        const card = `╭─── • 👑 • ───╮\n  ${fancy("OWNER INFO")}\n╰─── • 👑 • ───╯\n\n│ ◦ ${fancy("Name")}: ${config.ownerName}\n│ ◦ ${fancy("Number")}: ${config.ownerNumber}\n│ ◦ ${fancy("Bot")}: ${config.botName}\n│ ◦ ${fancy("Version")}: ${config.version}\n\n📢 wa.me/${config.ownerNumber}\n\n${config.footer}`;
        return conn.sendMessage(from, { text: card }, { quoted: msg });
    }

    if (lower === 'all') {
        let out = `╭─── • 📜 • ───╮\n  ${fancy("ALL COMMANDS")}\n╰─── • 📜 • ───╯\n\n`;
        for (const cat of state.categories) {
            out += `│ ${fancy("📁 " + cat.toUpperCase())}\n`;
            out += `│ ◦ ${state.commandsByCategory[cat].join(`, ${config.prefix}`)}\n`.replace(` ${config.prefix}`, ` ${config.prefix}`);
            out += `\n`;
        }
        out += `└────────────────\n${config.footer}`;
        return conn.sendMessage(from, { text: out }, { quoted: msg });
    }

    // Numeric pick
    const num = parseInt(lower);
    if (!isNaN(num) && num >= 1 && num <= state.categories.length) {
        const cat = state.categories[num - 1];
        const cmds = state.commandsByCategory[cat];

        let card = `╭─── • 📁 • ───╮\n  ${fancy(cat.toUpperCase())}\n╰─── • 📁 • ───╯\n\n`;
        card += `│ ${fancy("📝 COMMANDS (" + cmds.length + ")")}\n`;
        cmds.forEach(c => {
            card += `│ ◦ ${config.prefix}${c}\n`;
        });
        card += `\n└────────────────\n${config.footer}`;
        card += `\n\n_Type ${config.prefix}menu to go back_`;

        return conn.sendMessage(from, { text: card }, { quoted: msg });
    }

    // Unknown
    return conn.sendMessage(from, {
        text: fancy(`❌ Invalid option. Type ${config.prefix}menu to see categories.`)
    });
}

// ---------------- Stats helper ----------------
async function getBotStats() {
    const { User, Group, ChannelSubscriber } = require('../../database/models');
    try {
        const [users, groups, subs] = await Promise.all([
            User.countDocuments(),
            Group.countDocuments(),
            ChannelSubscriber.countDocuments()
        ]);
        return `│ ${fancy("📈 DATABASE")}\n│ ◦ Users: ${users}\n│ ◦ Groups: ${groups}\n│ ◦ Subscribers: ${subs}\n\n│ ${fancy("💻 SYSTEM")}\n│ ◦ Node: ${process.version}\n│ ◦ Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n│ ◦ Platform: ${process.platform}`;
    } catch {
        return `│ ${fancy("📈 STATS")}\n│ ◦ Status: Active\n│ ◦ Uptime: Online`;
    }
}

// Export state so handler can reset if needed
module.exports._menuState = menuState;