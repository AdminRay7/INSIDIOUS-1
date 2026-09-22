const { initAuthCreds, BufferJSON, proto } = require("@whiskeysockets/baileys");

async function useMongoDBAuthState(collection) {
    const writeData = async (data, id) => {
        const informationToStore = JSON.parse(
            JSON.stringify(data, BufferJSON.replacer)
        );
        await collection.updateOne(
            { _id: id },
            { $set: { data: informationToStore } },
            { upsert: true }
        );
    };

    const readData = async (id) => {
        try {
            const doc = await collection.findOne({ _id: id });
            if (!doc || !doc.data) return null;
            return JSON.parse(JSON.stringify(doc.data), BufferJSON.reviver);
        } catch {
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await collection.deleteOne({ _id: id });
        } catch {}
    };

    const creds = (await readData("creds")) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === "app-state-sync-key" && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, "creds");
        }
    };
}

module.exports = { useMongoDBAuthState };