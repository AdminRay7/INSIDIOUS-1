// ================= SELECTION HANDLER (STATELESS) =================
async function handleSelection(conn, msg, from, sender, pick) {
    const lower = pick.toLowerCase();

    // ---------- Rebuild categories fresh each time ----------
    const cmdPath = path.join(__dirname, '../../commands');
    const categories = [];
    const commandsByCategory = {};

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
            }
        }
    }
    categories.sort();

    // ---------- Special keywords ----------
    if (lower === 'stats') {
        const stats = await getBotStats();
        return conn.sendMessage(from, {
            text: `╭─── • 📊 • ───╮\n  ${fancy("BOT STATISTICS")}\n╰─── • 📊 • ───╯\n\n${stats}\n\n${config.footer}`
        }, { quoted: msg });
    }

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

    if (lower === 'all') {
        let out = `╭─── • 📜 • ───╮\n  ${fancy("ALL COMMANDS")}\n╰─── • 📜 • ───╯\n\n`;
        for (const cat of categories) {
            out += `│ ${fancy("📁 " + cat.toUpperCase())}\n`;
            commandsByCategory[cat].forEach(c => {
                out += `│ ◦ ${config.prefix}${c.name}\n`;
            });
            out += `\n`;
        }
        out += `└────────────────\n${config.footer}`;
        return conn.sendMessage(from, { text: out }, { quoted: msg });
    }

    // ---------- Numeric pick ----------
    const num = parseInt(lower, 10);
    if (!isNaN(num) && num >= 1 && num <= categories.length) {
        const cat = categories[num - 1];
        const cmds = commandsByCategory[cat];

        let card = `╭─── • 📁 • ───╮\n  ${fancy(cat.toUpperCase())}\n╰─── • 📁 • ───╯\n\n`;
        card += `│ ${fancy("📝 COMMANDS (" + cmds.length + ")")}\n`;
        cmds.forEach(c => {
            card += `│ ◦ ${config.prefix}${c.name}\n`;
            if (c.aliases.length > 0) {
                card += `│   ↳ ${c.aliases.map(a => config.prefix + a).join(', ')}\n`;
            }
        });
        card += `\n└────────────────\n${config.footer}`;
        card += `\n\n_Type ${config.prefix}menu to go back_`;
        return conn.sendMessage(from, { text: card }, { quoted: msg });
    }

    // ---------- Unknown option ----------
    return conn.sendMessage(from, {
        text: fancy(`❌ Invalid option "${pick}". Type ${config.prefix}menu to see categories.`)
    }, { quoted: msg });
}