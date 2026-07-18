import { config } from './config.js';
import { log } from './logger.js';

/**
 * Cache abstraction: Redis when REDIS_URL is set, in-process Map otherwise.
 * Same contract either way, so callers never know which backend is live.
 */
class MemoryCache {
  constructor() { this.store = new Map(); }
  async get(key) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.exp && e.exp < Date.now()) { this.store.delete(key); return null; }
    return e.val;
  }
  async set(key, val, ttlSeconds) {
    this.store.set(key, { val, exp: ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0 });
  }
  async del(key) { this.store.delete(key); }
  async incr(key) {
    const cur = Number(await this.get(key)) || 0;
    await this.set(key, String(cur + 1));
    return cur + 1;
  }
}

class RedisCache {
  constructor(client) { this.client = client; }
  async get(key) { return this.client.get(key); }
  async set(key, val, ttlSeconds) {
    return ttlSeconds ? this.client.set(key, val, { EX: ttlSeconds }) : this.client.set(key, val);
  }
  async del(key) { return this.client.del(key); }
  async incr(key) { return this.client.incr(key); }
}

let cache = new MemoryCache();

export async function initCache() {
  if (!config.redisUrl) {
    log.info('cache: using in-memory store (set REDIS_URL to enable Redis)');
    return cache;
  }
  try {
    const { createClient } = await import('redis');
    const client = createClient({ url: config.redisUrl });
    client.on('error', err => log.error('redis error', { err: err.message }));
    await client.connect();
    cache = new RedisCache(client);
    log.info('cache: connected to Redis');
  } catch (err) {
    log.warn('cache: Redis unavailable, falling back to memory', { err: err.message });
  }
  return cache;
}

export const getCache = () => cache;
