import redis, { logRedisError } from "../config/redis.js";

const defaultDashboardTtlSeconds = Number(process.env.DASHBOARD_CACHE_TTL_SECONDS || 45);
const defaultTemporaryStateTtlSeconds = Number(process.env.TEMP_STATE_TTL_SECONDS || 15 * 60);

function normalizeUserId(userId) {
  return String(userId || "").trim();
}

function dashboardCacheKey(userId) {
  return `dashboard:${normalizeUserId(userId)}`;
}

function temporaryStateKey(namespace, id) {
  return `tmp:${namespace}:${String(id || "").trim()}`;
}

function tokenDenylistKey(tokenHash) {
  return `denylist:token:${String(tokenHash || "").trim()}`;
}

function unreadNotificationKey(userId) {
  return `notifications:unread:${normalizeUserId(userId)}`;
}

async function runRedis(commandName, fallback, callback) {
  if (!redis) return fallback;

  try {
    return await callback(redis);
  } catch (error) {
    logRedisError(`${commandName} failed`, error);
    return fallback;
  }
}

export async function getCachedDashboardSummary(userId) {
  const key = dashboardCacheKey(userId);
  const raw = await runRedis("dashboard cache read", null, (client) => client.get(key));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    logRedisError("dashboard cache parse failed", error);
    await runRedis("dashboard cache delete", null, (client) => client.del(key));
    return null;
  }
}

export async function setCachedDashboardSummary(userId, summary, ttlSeconds = defaultDashboardTtlSeconds) {
  if (!summary) return;
  const key = dashboardCacheKey(userId);
  const safeTtl = Math.max(5, Math.min(Number(ttlSeconds || defaultDashboardTtlSeconds), 300));

  await runRedis("dashboard cache write", null, (client) =>
    client.set(key, JSON.stringify(summary), "EX", safeTtl)
  );
}

export async function invalidateDashboardCache(userId) {
  if (!userId) return;
  await runRedis("dashboard cache invalidation", null, (client) => client.del(dashboardCacheKey(userId)));
}

export async function setTemporaryState(namespace, id, value, ttlSeconds = defaultTemporaryStateTtlSeconds) {
  if (!namespace || !id) return;
  const safeTtl = Math.max(30, Number(ttlSeconds || defaultTemporaryStateTtlSeconds));
  await runRedis("temporary state write", null, (client) =>
    client.set(temporaryStateKey(namespace, id), JSON.stringify(value || {}), "EX", safeTtl)
  );
}

export async function getTemporaryState(namespace, id) {
  const raw = await runRedis("temporary state read", null, (client) => client.get(temporaryStateKey(namespace, id)));
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    logRedisError("temporary state parse failed", error);
    return null;
  }
}

export async function deleteTemporaryState(namespace, id) {
  if (!namespace || !id) return;
  await runRedis("temporary state delete", null, (client) => client.del(temporaryStateKey(namespace, id)));
}

export async function denyToken(tokenHash, ttlSeconds) {
  if (!tokenHash || !ttlSeconds || ttlSeconds <= 0) return;
  await runRedis("token denylist write", null, (client) =>
    client.set(tokenDenylistKey(tokenHash), "1", "EX", Math.ceil(ttlSeconds))
  );
}

export async function isTokenDenied(tokenHash) {
  if (!tokenHash) return false;
  const value = await runRedis("token denylist read", null, (client) => client.get(tokenDenylistKey(tokenHash)));
  return value === "1";
}

export async function getUnreadNotificationCount(userId) {
  const value = await runRedis("notification counter read", null, (client) => client.get(unreadNotificationKey(userId)));
  if (value === null || typeof value === "undefined") return null;
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : null;
}

export async function setUnreadNotificationCount(userId, count, ttlSeconds = 60) {
  const safeCount = Math.max(0, Number(count || 0));
  await runRedis("notification counter write", null, (client) =>
    client.set(unreadNotificationKey(userId), String(safeCount), "EX", Math.max(10, Number(ttlSeconds || 60)))
  );
}

export async function incrementUnreadNotificationCount(userId) {
  if (!userId) return;
  await runRedis("notification counter increment", null, async (client) => {
    const key = unreadNotificationKey(userId);
    const exists = await client.exists(key);
    if (!exists) return null;
    const next = await client.incr(key);
    await client.expire(key, 60);
    return next;
  });
}

export async function decrementUnreadNotificationCount(userId) {
  if (!userId) return;
  await runRedis("notification counter decrement", null, async (client) => {
    const key = unreadNotificationKey(userId);
    const exists = await client.exists(key);
    if (!exists) return null;
    const next = await client.decr(key);
    if (next < 0) {
      await client.set(key, "0", "EX", 60);
      return 0;
    }
    await client.expire(key, 60);
    return next;
  });
}
