import Redis from "ioredis";

const redisUrl =
  process.env.REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  process.env.REDIS_CLOUD_URL ||
  process.env.RAILWAY_REDIS_URL;
const redisDisabled = String(process.env.REDIS_DISABLED || "").toLowerCase() === "true";
const isTest = process.env.NODE_ENV === "test";

let lastErrorLogAt = 0;

function logRedisIssue(message, error) {
  const now = Date.now();
  if (now - lastErrorLogAt < 30_000) return;
  lastErrorLogAt = now;

  const detail = error?.message || error;
  console.warn(`[redis] ${message}${detail ? `: ${detail}` : ""}`);
}

function createRedisClient() {
  if (redisDisabled || !redisUrl) {
    if (!isTest && !redisDisabled) {
      console.info("[redis] REDIS_URL not configured; Redis-backed features will use in-memory fallback behavior.");
    }
    return null;
  }

  const client = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 5000),
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

  client.on("error", (error) => {
    logRedisIssue("connection error", error);
  });

  client.on("ready", () => {
    if (!isTest) {
      console.info("[redis] connected");
    }
  });

  client.connect().catch((error) => {
    logRedisIssue("initial connection failed", error);
  });

  return client;
}

export const redis = createRedisClient();

export function isRedisConfigured() {
  return Boolean(redis);
}

export function isRedisReady() {
  return redis?.status === "ready";
}

export function logRedisError(message, error) {
  logRedisIssue(message, error);
}

export async function closeRedis() {
  if (!redis) return;
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
}

export default redis;

