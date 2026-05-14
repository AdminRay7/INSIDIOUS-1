const fs = require('fs-extra');
const path = require('path');
const config = require('../../config');
const { fancy, runtime } = require('../../lib/font');

module.exports = {
    name: "menu",
    description: "Show all available commands with interactive cards",
    aliases: ["help", "commands", "cmdlist", "cmds"],
    execute: async (conn, msg, args, { from, sender, isOwner, pushname }) => {
        try {
            await conn.sendPresenceUpdate('composing', from);

            // Get all commands
            const cmdPath = path.join(__dirname, '../../commands');
            let categories = [];
            let totalCmds = 0;
            let commandsByCategory = {};

            if (await fs.pathExists(cmdPath)) {
                categories = await fs.readdir(cmdPath);
                
                for (const cat of categories) {
                    const catPath = path.join(cmdPath, cat);
                    const stat = await fs.stat(catPath);
                    
                    if (stat.isDirectory()) {
                        const files = await fs.readdir(catPath);
                        const cmdFiles = files.filter(f => f.endsWith('.js'));
                        totalCmds += cmdFiles.length;
                        commandsByCategory[cat] = cmdFiles.map(f => f.replace('.js', ''));
                    }
                }
            }

            // Create interactive buttons for categories
            const categoryButtons = categories.slice(0, 5).map(cat => ({
                buttonId: `menu_cat_${cat}`,
                buttonText: { displayText: `📁 ${cat.toUpperCase()}` },
                type: 1
            }));

            // Add navigation buttons
            const navButtons = [
                {
                    buttonId: `menu_next`,
                    buttonText: { displayText: `➡️ NEXT` },
                    type: 1
                },
                {
                    buttonId: `menu_stats`,
                    buttonText: { displayText: `📊 STATS` },
                    type: 1
                },
                {
                    buttonId: `menu_owner`,
                    buttonText: { displayText: `👑 OWNER` },
                    type: 1
                }
            ];

            // Main Menu Card
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            
            let mainMenu = `╭─── • 🥀 • ───╮\n`;
            mainMenu += `  ${fancy(config.botName.toUpperCase())}\n`;
            mainMenu += `╰─── • 🥀 • ───╯\n\n`;
            mainMenu += `│ ${fancy("📱 STATUS")}\n`;
            mainMenu += `│ ◦ ${fancy("Owner")}: ${config.ownerName}\n`;
            mainMenu += `│ ◦ ${fancy("Uptime")}: ${days}d ${hours}h ${minutes}m\n`;
            mainMenu += `│ ◦ ${fancy("Mode")}: ${config.workMode.toUpperCase()}\n`;
            mainMenu += `│ ◦ ${fancy("Commands")}: ${totalCmds}\n`;
            mainMenu += `│ ◦ ${fancy("Prefix")}: ${config.prefix}\n\n`;
            mainMenu += `│ ${fancy("🎯 QUICK GUIDE")}\n`;
            mainMenu += `│ ◦ Use buttons below to navigate\n`;
            mainMenu += `│ ◦ Click category to view commands\n`;
            mainMenu += `│ ◦ Type ${config.prefix}help for details\n\n`;
            mainMenu += `└────────────────\n`;
            mainMenu += `${fancy(config.footer)}`;

            // Send interactive menu with buttons
            await conn.sendMessage(from, {
                text: mainMenu,
                buttons: categoryButtons.concat(navButtons),
                headerType: 1,
                viewOnce: true
            }, { quoted: msg });

            // Store menu state for navigation
            global.menuState = global.menuState || {};
            global.menuState[from] = {
                currentPage: 0,
                categories: categories,
                commandsByCategory: commandsByCategory,
                totalCmds: totalCmds
            };

        } catch (e) {
            console.error("Menu error:", e);
            // Fallback to simple menu if interactive fails
            await sendSimpleMenu(conn, msg, from);
        }
    }
};

// Handle button interactions
module.exports.handleButton = async (conn, msg, buttonId, { from, sender }) => {
    try {
        const [action, param] = buttonId.split('_');
        
        if (action === 'menu' && param === 'stats') {
            // Show stats card
            const stats = await getBotStats();
            const statsCard = `╭─── • 📊 • ───╮\n  ${fancy("BOT STATISTICS")}\n╰─── • 📊 • ───╯\n\n${stats}`;
            
            await conn.sendMessage(from, {
                text: statsCard,
                buttons: [
                    {
                        buttonId: `menu_back`,
                        buttonText: { displayText: `🔙 BACK TO MENU` },
                        type: 1
                    }
                ],
                headerType: 1
            });
            
        } else if (action === 'menu' && param === 'owner') {
            // Show owner card
            const ownerCard = `╭─── • 👑 • ───╮\n  ${fancy("OWNER INFO")}\n╰─── • 👑 • ───╯\n\n│ ◦ ${fancy("Name")}: ${config.ownerName}\n│ ◦ ${fancy("Number")}: ${config.ownerNumber}\n│ ◦ ${fancy("Bot")}: ${config.botName}\n│ ◦ ${fancy("Version")}: ${config.version}\n\n📢 ${fancy("Support")}\n│ ◦ WhatsApp: wa.me/${config.ownerNumber}\n│ ◦ Channel: ${config.channelLink}\n\n${config.footer}`;
            
            await conn.sendMessage(from, {
                text: ownerCard,
                buttons: [
                    {
                        buttonId: `menu_back`,
                        buttonText: { displayText: `🔙 BACK TO MENU` },
                        type: 1
                    }
                ],
                headerType: 1
            });
            
        } else if (action === 'menu' && param === 'cat') {
            // Show category commands
            const category = param;
            const commands = global.menuState[from]?.commandsByCategory[category] || [];
            
            let categoryCard = `╭─── • 📁 • ───╮\n  ${fancy(category.toUpperCase())}\n╰─── • 📁 • ───╯\n\n`;
            categoryCard += `│ ${fancy("📝 COMMANDS")}\n`;
            
            commands.slice(0, 15).forEach(cmd => {
                categoryCard += `│ ◦ ${config.prefix}${cmd}\n`;
            });
            
            if (commands.length > 15) {
                categoryCard += `│ ◦ ... and ${commands.length - 15} more\n`;
            }
            
            categoryCard += `\n└────────────────\n${fancy(config.footer)}`;
            
            const navButtons = [
                {
                    buttonId: `menu_back`,
                    buttonText: { displayText: `🔙 BACK` },
                    type: 1
                },
                {
                    buttonId: `menu_next_page_${category}_1`,
                    buttonText: { displayText: `📜 MORE` },
                    type: 1
                }
            ];
            
            await conn.sendMessage(from, {
                text: categoryCard,
                buttons: navButtons,
                headerType: 1
            });
            
        } else if (action === 'menu' && param === 'next') {
            // Next page (more categories)
            const state = global.menuState[from];
            if (state && state.categories.length > 5) {
                const startIdx = (state.currentPage + 1) * 5;
                const nextCategories = state.categories.slice(startIdx, startIdx + 5);
                
                if (nextCategories.length > 0) {
                    const nextButtons = nextCategories.map(cat => ({
                        buttonId: `menu_cat_${cat}`,
                        buttonText: { displayText: `📁 ${cat.toUpperCase()}` },
                        type: 1
                    }));
                    
                    nextButtons.push({
                        buttonId: `menu_prev`,
                        buttonText: { displayText: `⬅️ PREV` },
                        type: 1
                    });
                    
                    if (startIdx + 5 < state.categories.length) {
                        nextButtons.push({
                            buttonId: `menu_next`,
                            buttonText: { displayText: `➡️ NEXT` },
                            type: 1
                        });
                    }
                    
                    await conn.sendMessage(from, {
                        text: `╭─── • 📑 • ───╮\n  ${fancy("MORE CATEGORIES")}\n╰─── • 📑 • ───╯\n\n│ Click any category to view commands\n│ Page ${state.currentPage + 2}\n\n${config.footer}`,
                        buttons: nextButtons,
                        headerType: 1
                    });
                    
                    state.currentPage++;
                }
            }
            
        } else if (action === 'menu' && param === 'prev') {
            // Previous page
            const state = global.menuState[from];
            if (state && state.currentPage > 0) {
                state.currentPage--;
                const startIdx = state.currentPage * 5;
                const prevCategories = state.categories.slice(startIdx, startIdx + 5);
                
                const prevButtons = prevCategories.map(cat => ({
                    buttonId: `menu_cat_${cat}`,
                    buttonText: { displayText: `📁 ${cat.toUpperCase()}` },
                    type: 1
                }));
                
                prevButtons.push({
                    buttonId: `menu_prev`,
                    buttonText: { displayText: `⬅️ PREV` },
                    type: 1
                });
                
                if (startIdx + 5 < state.categories.length) {
                    prevButtons.push({
                        buttonId: `menu_next`,
                        buttonText: { displayText: `➡️ NEXT` },
                        type: 1
                    });
                }
                
                await conn.sendMessage(from, {
                    text: `╭─── • 📑 • ───╮\n  ${fancy("CATEGORIES")}\n╰─── • 📑 • ───╯\n\n│ Page ${state.currentPage + 1}\n\n${config.footer}`,
                    buttons: prevButtons,
                    headerType: 1
                });
            }
            
        } else if (action === 'menu' && param === 'back') {
            // Back to main menu
            module.exports.execute(conn, msg, [], { from, sender, isOwner: false, pushname: "" });
        }
        
    } catch (error) {
        console.error("Button handler error:", error);
        await conn.sendMessage(from, { text: fancy("❌ Error processing button. Try using .menu again.") });
    }
};

// Helper function for simple menu fallback
async function sendSimpleMenu(conn, msg, from) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    const simpleMenu = `╭─── • 🥀 • ───╮
  ${fancy(config.botName)}
╰─── • 🥀 • ───╯

│ ${fancy("📊 INFO")}
│ ◦ Owner: ${config.ownerName}
│ ◦ Uptime: ${hours}h ${minutes}m
│ ◦ Prefix: ${config.prefix}

│ ${fancy("🎯 BASIC COMMANDS")}
│ ◦ ${config.prefix}menu - Show menu
│ ◦ ${config.prefix}ping - Test bot
│ ◦ ${config.prefix}ai <text> - Chat
│ ◦ ${config.prefix}owner - Contact

└────────────────
${fancy(config.footer)}

_Type ${config.prefix}help for more_`;

    await conn.sendMessage(from, { text: simpleMenu }, { quoted: msg });
}

// Helper function to get bot stats
async function getBotStats() {
    const { User, Group, ChannelSubscriber } = require('../../database/models');
    
    try {
        const users = await User.countDocuments();
        const groups = await Group.countDocuments();
        const subscribers = await ChannelSubscriber.countDocuments();
        
        return `│ ${fancy("📈 DATABASE")}\n│ ◦ Users: ${users}\n│ ◦ Groups: ${groups}\n│ ◦ Subscribers: ${subscribers}\n\n│ ${fancy("💻 SYSTEM")}\n│ ◦ Node: ${process.version}\n│ ◦ Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n│ ◦ Platform: ${process.platform}\n`;
    } catch (error) {
        return `│ ${fancy("📈 STATS")}\n│ ◦ Status: Active\n│ ◦ Uptime: Online\n`;
    }
}