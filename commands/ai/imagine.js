module.exports = {
    name: "imagine",
    execute: async (conn, msg, args, { from, fancy }) => {
        if (!args[0]) return msg.reply(fancy("ᴡʜᴀᴛ ꜱʜᴏᴜʟᴅ ɪ ᴅʀᴀᴡ?"));
        const prompt = args.join(' ');
        const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1080&model=flux`;
        
        await conn.sendMessage(from, { 
            image: { url: imgUrl }, 
            caption: fancy(`🥀 ᴀʀᴛ ɢᴇɴᴇʀᴀᴛᴇᴅ:\n"${prompt}"`),
            contextInfo: { isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: "120363404317544295@newsletter", newsletterName: "ɪɴꜱɪᴅɪᴏᴜꜱ ᴀɪ" } }
        });
    }
};
