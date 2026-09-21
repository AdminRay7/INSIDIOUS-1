const { initAuthCreds, BufferJSON, proto } = require("@whiskeysockets/baileys");

/**
 * Multi-session aware MongoDB auth state.
 * Every session gets its own key namespace: `${sessionId}:${key}`.
 * All sessions live in a single collection but never collide.
 */
async function useMongoDBAuthState(collection, sessionId) {
    if (!sessionId) throw new Error("sessionId is required for MongoDBAuthState");

    const prefix = `${sessionId}:`;

    const writeData = async (data, key) => {
        const value = JSON.parse(JSON.stringify(data, BufferJSON.replacer));
        await collection.updateOne(
            { _id: prefix + key },
            { $set: { value } },
            { upsert: true }
        );
    };

    const readData = async (key) => {
        try {
            const doc = await collection.findOne({ _id: prefix + key });
            if (!doc) return null;
            return JSON.parse(JSON.stringify(doc.value), BufferJSON.reviver);
        } catch {
            return null;
        }
    };

    const removeData = async (key) => {
        try {
            await collection.deleteOne({ _id: prefix + key });
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
                },
            },
        },
        saveCreds: async () => {
            await writeData(creds, "creds");
        },
    };
}

module.exports = { useMongoDBAuthState };