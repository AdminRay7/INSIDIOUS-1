const axios = require('axios');

module.exports = {
    name: "wifi",
    aliases: ["aircrack", "wpa"],
    description: "WiFi security audit guide",
    execute: async (conn, msg, args, { from, fancy }) => {
        const topic = args.length > 0 ? args.join(' ') : "WPA2 Handshake Cracking";

        try {
            const res = await axios.get(
                `https://text.pollinations.ai/Act as a WiFi Security Expert. Explain step-by-step how to audit a wireless network using Aircrack-ng or Fluxion for ${encodeURIComponent(topic)}. Include ethical guidelines.`
            );

            await conn.sendMessage(from, {
                text: fancy(`🥀 *ᴡɪꜰɪ ꜱᴇᴄᴜʀɪᴛʏ ʟᴀʙ:*\n\n${res.data}`),
                contextInfo: {
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: "120363404317544295@newsletter"
                    }
                }
            }, { quoted: msg });

        } catch (e) {
            console.error("WiFi error:", e.message);
            await conn.sendMessage(from, {
                text: fancy("🥀 ꜱɪɢɴᴀʟ ᴊᴀᴍᴍᴇᴅ.")
            }, { quoted: msg });
        }
    }
};