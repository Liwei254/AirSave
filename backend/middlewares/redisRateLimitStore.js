import redis, { logRedisError } from "../config/redis.js";

export class RedisRateLimitStore {
  constructor({ prefix = "rate-limit" } = {}) {
    this.prefix = prefix;
    this.windowMs = 60_000;
  }

  init(options = {}) {
    this.windowMs = options.windowMs || this.windowMs;
  }

  key(key) {
    return `${this.prefix}:${key}`;
  }

  async increment(key) {
    const resetTime = new Date(Date.now() + this.windowMs);

    if (!redis) {
      return { totalHits: 1, resetTime };
    }

    try {
      const redisKey = this.key(key);
      const hits = await redis.incr(redisKey);

      if (hits === 1) {
        await redis.pexpire(redisKey, this.windowMs);
      }

      const ttl = await redis.pttl(redisKey);
      return {
        totalHits: hits,
        resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)),
      };
    } catch (error) {
      logRedisError("rate-limit store failed open", error);
      return { totalHits: 1, resetTime };
    }
  }

  async decrement(key) {
    if (!redis) return;

    try {
      const redisKey = this.key(key);
      const hits = await redis.decr(redisKey);
      if (hits <= 0) {
        await redis.del(redisKey);
      }
    } catch (error) {
      logRedisError("rate-limit decrement failed", error);
    }
  }

  async resetKey(key) {
    if (!redis) return;

    try {
      await redis.del(this.key(key));
    } catch (error) {
      logRedisError("rate-limit reset failed", error);
    }
  }
}

export function createRedisRateLimitStore(options) {
  if (!redis) return undefined;
  return new RedisRateLimitStore(options);
}

