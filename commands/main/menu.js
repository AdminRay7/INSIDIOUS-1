const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy } = require('../../lib/font');

// Per-chat menu state (which page each user is on)
const menuState = new Map();

module.exports = {
    name: "menu",
    aliases: ["help", "commands", "cmdlist", "cmds", "m"],
    description: "Show all available commands",
    execute: async (conn, msg, args, { from, sender, isOwner, pushname }) => {
        try {
            await conn.sendPresenceUpdate('composing', from);

            // If args provided, handle selection
            if (args.length > 0) {
                return await handleSelection(conn, msg, from, sender, args.join(' ').trim());
            }

            // ---------- Build command index ----------
            const cmdPath = path.join(__dirname, '../../commands');
            const categories = [];
            const commandsByCategory = {};
            let totalCmds = 0;

            if (await fs.pathExists(cmdPath)) {
                const items = await fs.readdir(cmdPath);
                for (const item of items) {
                    const itemPath = path.join(cmdPath, item);
                    const stat = await fs.stat(itemPath);
                    if (!stat.isDirectory()) continue;

                    const files = await fs.readdir(itemPath);
                    const cmds = [];

                    for (const file of files) {
                        if (!file.endsWith('.js')) continue;
                        const filePath = path.join(itemPath, file);
                        try {
                            delete require.cache[require.resolve(filePath)];
                            const mod = require(filePath);
                            const mainName = (mod.name || file.replace('.js', '')).toLowerCase();
                            const aliases = Array.isArray(mod.aliases) ? mod.aliases : [];
                            cmds.push({ name: mainName, aliases, file: file.replace('.js', '') });
                        } catch (loadErr) {
                            console.error(`⚠️ Cannot load ${filePath}:`, loadErr.message);
                        }
                    }

                    if (cmds.length > 0) {
                        categories.push(item);
                        commandsByCategory[item] = cmds;
                        totalCmds += cmds.length;
                    }
                }
            }

            categories.sort();
            menuState.set(from, { categories, commandsByCategory, totalCmds, page: 0 });

            // ---------- Show main menu ----------
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
            menu += `│ ◦ Reply with a number: ${config.prefix}menu 1\n`;
            menu += `│ ◦ View stats:         ${config.prefix}menu stats\n`;
            menu += `│ ◦ Owner info:         ${config.prefix}menu owner\n`;
            menu += `│ ◦ All commands:       ${config.prefix}menu all\n\n`;

            menu += `└────────────────\n${fancy(config.footer)}`;

            await conn.sendMessage(from, { text: menu }, { quoted: msg });

        } catch (e) {
            console.error("Menu error:", e);
            await conn.sendMessage(from, { text: fancy("❌ Menu failed: " + e.message) });
        }
    }
};

// ================= SELECTION HANDLER =================
async function handleSelection(conn, msg, from, sender, pick) {
    const state = menuState.get(from);
    if (!state) {
        return conn.sendMessage(from, {
            text: fancy(`❌ Menu expired. Type ${config.prefix}menu again.`)
        }, { quoted: msg });
    }

    const lower = pick.toLowerCase();

    // --- Special: stats ---
    if (lower === 'stats') {
        const stats = await getBotStats();
        return conn.sendMessage(from, {
            text: `╭─── • 📊 • ───╮\n  ${fancy("BOT STATISTICS")}\n╰─── • 📊 • ───╯\n\n${stats}\n\n${config.footer}`,
        }, { quoted: msg });
    }

    // --- Special: owner ---
    if (lower === 'owner') {
        const card =
            `╭─── • 👑 • ───╮\n  ${fancy("OWNER INFO")}\n╰─── • 👑 • ───╯\n\n` +
            `│ ◦ ${fancy("Name")}: ${config.ownerName}\n` +
            `│ ◦ ${fancy("Number")}: ${config.ownerNumber}\n` +
            `│ ◦ ${fancy("Bot")}: ${config.botName}\n` +
            `│ ◦ ${fancy("Version")}: ${config.version}\n\n` +
            `📢 wa.me/${config.ownerNumber}\n\n${config.footer}`;
        return conn.sendMessage(from, { text: card }, { quoted: msg });
    }

    // --- Special: all ---
    if (lower === 'all') {
        let out = `╭─── • 📜 • ───╮\n  ${fancy("ALL COMMANDS")}\n╰─── • 📜 • ───╯\n\n`;
        for (const cat of state.categories) {
            const list = state.commandsByCategory[cat];
            out += `│ ${fancy("📁 " + cat.toUpperCase())}\n`;
            list.forEach(c => {
                out += `│ ◦ ${config.prefix}${c.name}\n`;
            });
            out += `\n`;
        }
        out += `└────────────────\n${config.footer}`;
        return conn.sendMessage(from, { text: out }, { quoted: msg });
    }

    // --- Numeric category pick ---
    const num = parseInt(lower, 10);
    if (!isNaN(num) && num >= 1 && num <= state.categories.length) {
        const cat = state.categories[num - 1];
        const cmds = state.commandsByCategory[cat];

        let card = `╭─── • 📁 • ───╮\n  ${fancy(cat.toUpperCase())}\n╰─── • 📁 • ───╯\n\n`;
        card += `│ ${fancy("📝 COMMANDS (" + cmds.length + ")")}\n`;
        cmds.forEach(c => {
            card += `│ ◦ ${config.prefix}${c.name}\n`;
            if (c.aliases.length > 0) {
                card += `│   ↳ aliases: ${c.aliases.map(a => config.prefix + a).join(', ')}\n`;
            }
        });
        card += `\n└────────────────\n${config.footer}`;
        card += `\n\n_Type ${config.prefix}menu to go back_`;
        return conn.sendMessage(from, { text: card }, { quoted: msg });
    }

    // --- Unknown option ---
    return conn.sendMessage(from, {
        text: fancy(`❌ Invalid option "${pick}". Type ${config.prefix}menu to see categories.`)
    }, { quoted: msg });
}

// ================= BOT STATS =================
async function getBotStats() {
    const { User, Group, ChannelSubscriber } = require('../../database/models');
    try {
        const [users, groups, subs] = await Promise.all([
            User.countDocuments().catch(() => 0),
            Group.countDocuments().catch(() => 0),
            ChannelSubscriber.countDocuments().catch(() => 0)
        ]);
        return (
            `│ ${fancy("📈 DATABASE")}\n` +
            `│ ◦ Users: ${users}\n` +
            `│ ◦ Groups: ${groups}\n` +
            `│ ◦ Subscribers: ${subs}\n\n` +
            `│ ${fancy("💻 SYSTEM")}\n` +
            `│ ◦ Node: ${process.version}\n` +
            `│ ◦ Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n` +
            `│ ◦ Platform: ${process.platform}`
        );
    } catch {
        return `│ ${fancy("📈 STATS")}\n│ ◦ Status: Active\n│ ◦ Uptime: Online`;
    }
}

// Expose state for the handler (optional)
module.exports._menuState = menuState;