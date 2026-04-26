import rateLimit from "express-rate-limit";

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
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: buildIdentifierKey,
  message: {
    message: "Too many login attempts. Try again later.",
  },
});

export const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildIdentifierKey,
  message: {
    message: "Too many reset attempts. Try again later.",
  },
});
