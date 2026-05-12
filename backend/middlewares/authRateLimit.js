import rateLimit from "express-rate-limit";
import { sendError } from "../utils/apiResponse.js";
import { createRedisRateLimitStore } from "./redisRateLimitStore.js";

function buildIdentifierKey(req) {
  const rawIdentifier = String(
    req.body?.emailOrPhone || req.body?.identifier || req.body?.email || req.body?.phone || "anonymous"
  )
    .trim()
    .toLowerCase();

  return `${req.ip}:${rawIdentifier}`;
}

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: createRedisRateLimitStore({ prefix: "rate-limit:login" }),
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  skipSuccessfulRequests: true,
  keyGenerator: buildIdentifierKey,
  handler: (req, res) => {
    return sendError(res, {
      statusCode: 429,
      message: "Too many login attempts. Try again later.",
    });
  },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  store: createRedisRateLimitStore({ prefix: "rate-limit:password-reset" }),
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: true,
  keyGenerator: buildIdentifierKey,
  handler: (req, res) => {
    return sendError(res, {
      statusCode: 429,
      message: "Too many reset attempts. Try again later.",
    });
  },
});
