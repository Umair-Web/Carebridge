const crypto = require('crypto');

const TTL_MS = 5 * 60 * 1000;
const store = new Map();

function makeKey(parts) {
  return crypto.createHash('md5').update(JSON.stringify(parts)).digest('hex');
}

function get(key) {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    store.delete(key);
    return null;
  }
  return row.value;
}

function set(key, value) {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

module.exports = { makeKey, get, set, TTL_MS };
