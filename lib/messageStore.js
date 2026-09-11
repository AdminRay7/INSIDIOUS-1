// In-memory store: Map<messageId, {msg, sender, from, timestamp}>
// Auto-evicts after 2 hours

const store = new Map();
const EVICT_MS = 2 * 60 * 60 * 1000; // 2 hours

function save(key, data) {
    store.set(key, { ...data, savedAt: Date.now() });

    // Auto-evict
    setTimeout(() => store.delete(key), EVICT_MS);
}

function get(key) {
    return store.get(key);
}

function remove(key) {
    store.delete(key);
}

function cleanup() {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
        if (now - v.savedAt > EVICT_MS) store.delete(k);
    }
}

setInterval(cleanup, 30 * 60 * 1000); // cleanup every 30 min

module.exports = { save, get, remove, size: () => store.size };