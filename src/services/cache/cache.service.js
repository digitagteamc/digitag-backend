const Redis = require('ioredis');
const logger = require('../../utils/logger');

let client = null;
let connected = false;

function getClient() {
  if (client) return client;

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);

  client = new Redis({
    host,
    port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    retryStrategy: (times) => {
      // Stop retrying after 3 attempts — let the app work without cache
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  client.on('connect', () => {
    connected = true;
    logger.info('[Redis] Connected');
  });

  client.on('error', (err) => {
    if (connected) logger.error('[Redis] Error', { err: err.message });
    connected = false;
  });

  client.on('close', () => {
    connected = false;
  });

  client.connect().catch(() => {
    // Non-fatal — app works without Redis
    logger.warn('[Redis] Could not connect, caching disabled');
  });

  return client;
}

/**
 * Get a cached value. Returns null on miss or Redis unavailable.
 */
async function get(key) {
  try {
    const raw = await getClient().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Set a value with TTL in seconds. Fails silently if Redis is down.
 */
async function set(key, value, ttlSeconds) {
  try {
    await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Non-fatal
  }
}

/**
 * Delete one or more keys. Supports glob patterns via SCAN+DEL.
 */
async function del(...keys) {
  try {
    if (keys.length) await getClient().del(...keys);
  } catch {
    // Non-fatal
  }
}

/**
 * Delete all keys matching a pattern (e.g. "feed:userId:*").
 * Uses SCAN to avoid blocking Redis with KEYS on large datasets.
 */
async function delPattern(pattern) {
  try {
    const c = getClient();
    let cursor = '0';
    do {
      const [next, keys] = await c.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await c.del(...keys);
    } while (cursor !== '0');
  } catch {
    // Non-fatal
  }
}

/**
 * Cache-aside helper: returns cached value if fresh, otherwise calls
 * fn(), stores the result, and returns it.
 */
async function wrap(key, ttlSeconds, fn) {
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await fn();
  await set(key, fresh, ttlSeconds);
  return fresh;
}

module.exports = { get, set, del, delPattern, wrap };
