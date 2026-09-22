const yt = require('chama-yt-scraper');
const { fancy } = require('../../lib/font');

module.exports = {
    name: "song",
    aliases: ["play", "music", "audio"],
    description: "Download a song by name or YouTube URL",

    execute: async (conn, msg, args, { from }) => {
        const query = args.join(' ').trim();
        if (!query) {
            return conn.sendMessage(from, {
                text: fancy("🎵 Usage: .song <song name or YouTube URL>\nExample: .song Faded Alan Walker")
            }, { quoted: msg });
        }

        await conn.sendMessage(from, {
            text: fancy(`🔍 Searching for: ${query}...`)
        }, { quoted: msg });

        try {
            // Search and get direct download links
            const res = await yt.download(query);

            if (!res || !res.status || !res.data || !res.data.downloads || !res.data.downloads[0]) {
                return conn.sendMessage(from, {
                    text: fancy("❌ Song not found or download link unavailable.")
                }, { quoted: msg });
            }

            const song = res.data;
            const audioUrl = song.downloads[0].url;

            await conn.sendMessage(from, {
                text: fancy(`⬇️ Found: ${song.title}\n📤 Uploading audio...`)
            }, { quoted: msg });

            // Send audio directly using the URL (no local download needed)
            await conn.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                caption: `🎵 ${song.title}\n\n_ᴅᴏᴡɴʟᴏᴀᴅᴇᴅ ʙʏ ɪɴꜱɪᴅɪᴏᴜꜱ_`
            }, { quoted: msg });

        } catch (e) {
            console.error("Song command error:", e);
            await conn.sendMessage(from, {
                text: fancy(`❌ Download failed: ${e.message}\n\n_Try a different song or check the name._`)
            }, { quoted: msg });
        }
    }
};