// lib/messageStore.js
const MAX_ENTRIES = 2000;
const TTL_MS = 60 * 60 * 1000; // 1 hour

const store = new Map(); // id -> { data, ts }

function save(id, data) {
    if (!id) return;
    store.set(id, { data, ts: Date.now() });
    if (store.size > MAX_ENTRIES) {
        const firstKey = store.keys().next().value;
        store.delete(firstKey);
    }
}

function get(id) {
    const entry = store.get(id);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) {
        store.delete(id);
        return null;
    }
    return entry.data;
}

function remove(id) {
    store.delete(id);
}

setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of store) {
        if (now - entry.ts > TTL_MS) store.delete(id);
    }
}, 5 * 60 * 1000).unref();

module.exports = { save, get, remove, size: () => store.size };