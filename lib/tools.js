module.exports = {
    fancy: (t) => {
        const s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const f = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ₀₁₂₃₄₅₆₇₈₉";
        return t.split('').map(c => s.indexOf(c) === -1 ? c : f[s.indexOf(c)]).join('');
    },
    runtime: (s) => {
        let d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = Math.floor(s % 60);
        return `${d}ᴅ ${h}ʜ ${m}ᴍ ${sec}ꜱ`;
    }
};
