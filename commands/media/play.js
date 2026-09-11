const axios = require('axios');

module.exports = {
    name: "play",
    aliases: ["song", "music", "ytmp3"],
    description: "Search and download music from YouTube",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) {
            return conn.sendMessage(from, {
                text: fancy("ᴇɴᴛᴇʀ ꜱᴏɴɢ ɴᴀᴍᴇ!")
            }, { quoted: msg });
        }

        const query = args.join(' ');

        // Notify user
        await conn.sendMessage(from, {
            text: fancy(`🥀 ꜱᴇᴀʀᴄʜɪɴɢ ꜰᴏʀ "${query}"...`)
        }, { quoted: msg });

        try {
            // Step 1 — Search YouTube
            const searchRes = await axios.get(
                `https://api.darlyn.my.id/api/yts?query=${encodeURIComponent(query)}`
            ).catch(() => null);

            let videoUrl = null;
            let title = query;

            if (searchRes?.data?.result?.length > 0) {
                const first = searchRes.data.result[0];
                videoUrl = first.url || `https://youtube.com/watch?v=${first.videoId}`;
                title = first.title || query;
            } else {
                // Fallback: assume user typed a direct URL
                if (query.includes('youtube.com') || query.includes('youtu.be')) {
                    videoUrl = query;
                } else {
                    return conn.sendMessage(from, {
                        text: fancy("❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ꜰɪɴᴅ ᴛʜᴀᴛ ꜱᴏɴɢ.")
                    }, { quoted: msg });
                }
            }

            // Step 2 — Download MP3
            const dlRes = await axios.get(
                `https://api.darlyn.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`
            );

            const audioUrl = dlRes?.data?.result?.url;

            if (!audioUrl) {
                return conn.sendMessage(from, {
                    text: fancy("❌ ᴅᴏᴡɴʟᴏᴀᴅ ʟɪɴᴋ ᴇxᴘɪʀᴇᴅ. ᴛʀʏ ᴀɢᴀɪɴ.")
                }, { quoted: msg });
            }

            // Step 3 — Send the audio
            await conn.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mp4',
                fileName: `${title}.mp3`
            }, { quoted: msg });

        } catch (e) {
            console.error("Play error:", e.message);
            await conn.sendMessage(from, {
                text: fancy("❌ ᴄᴏᴜʟᴅ ɴᴏᴛ ʀᴇᴛʀɪᴇᴠᴇ ᴛʜᴇ ꜱᴏᴜʟ ᴏꜰ ᴛʜɪꜱ ᴍᴜꜱɪᴄ.")
            }, { quoted: msg });
        }
    }
};