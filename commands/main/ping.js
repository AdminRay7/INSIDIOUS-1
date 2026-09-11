const os = require('os');
const config = require('../../config');
const { fancy } = require('../../lib/font');

module.exports = {
    name: "ping",
    aliases: ["p", "speed", "latency"],
    description: "Check bot response speed and uptime",
    execute: async (conn, msg, args, { from, sender, pushname }) => {
        try {
            const start = Date.now();

            // Send an initial "measuring" message
            const sent = await conn.sendMessage(from, {
                text: fancy("🏓 Pinging...")
            }, { quoted: msg });

            const end = Date.now();
            const latency = end - start;

            // Uptime
            const uptime = process.uptime();
            const days = Math.floor(uptime / 86400);
            const hours = Math.floor((uptime % 86400) / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = Math.floor(uptime % 60);

            // Memory
            const usedMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
            const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);

            // CPU load
            const loadAvg = os.loadavg()[0].toFixed(2);

            // Response speed rating
            let speedEmoji = "🟢";
            let speedText = "Excellent";
            if (latency > 500) { speedEmoji = "🟡"; speedText = "Good"; }
            if (latency > 1500) { speedEmoji = "🟠"; speedText = "Slow"; }
            if (latency > 3000) { speedEmoji = "🔴"; speedText = "Very Slow"; }

            const text =
                `╭─── • 🏓 • ───╮\n` +
                `  ${fancy("PONG!")}\n` +
                `╰─── • 🏓 • ───╯\n\n` +
                `│ ${fancy("⚡ RESPONSE")}\n` +
                `│ ◦ Latency: ${latency} ms\n` +
                `│ ◦ Speed: ${speedEmoji} ${speedText}\n\n` +
                `│ ${fancy("⏱️ UPTIME")}\n` +
                `│ ◦ ${days}d ${hours}h ${minutes}m ${seconds}s\n\n` +
                `│ ${fancy("💻 SYSTEM")}\n` +
                `│ ◦ RAM: ${usedMem} MB / ${totalMem} MB\n` +
                `│ ◦ CPU Load: ${loadAvg}\n` +
                `│ ◦ Platform: ${process.platform}\n` +
                `│ ◦ Node: ${process.version}\n\n` +
                `│ ${fancy("👤 USER")}\n` +
                `│ ◦ ${pushname}\n\n` +
                `└────────────────\n${fancy(config.footer)}`;

            // Edit the "Pinging..." message with real results
            await conn.sendMessage(from, {
                text: text,
                edit: sent.key
            });

        } catch (e) {
            console.error("Ping error:", e);
            await conn.sendMessage(from, {
                text: fancy("❌ Ping failed: " + e.message)
            }, { quoted: msg });
        }
    }
};