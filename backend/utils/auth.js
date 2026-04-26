import crypto from "crypto";

export const ACCESS_COOKIE_NAME = "airsave_access";
export const REFRESH_COOKIE_NAME = "airsave_refresh";
export const ACCESS_TOKEN_TTL = process.env.JWT_EXPIRE || "15m";
export const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_EXPIRE || "7d";
export const LOGIN_LOCKOUT_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const kenyanPhonePattern = /^\+254\d{9}$/;

export function normalizeEmail(value) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
}

export function isEmailIdentifier(value) {
  return typeof value === "string" && value.includes("@");
}

export function normalizePhone(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("254") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }

  if (digits.startsWith("7") && digits.length === 9) {
    return `+254${digits}`;
  }

  if (digits.startsWith("1") && digits.length === 9) {
    return `+254${digits}`;
  }

  if (raw.startsWith("+") && kenyanPhonePattern.test(raw)) {
    return raw;
  }

  return "";
}

export function isValidKenyanPhone(value) {
  return kenyanPhonePattern.test(normalizePhone(value));
}

export function getPhoneLookupCandidates(value) {
  const normalized = normalizePhone(value);
  if (!normalized) return [];

  const withoutPlus = normalized.slice(1);
  const local = `0${normalized.slice(4)}`;

  return [...new Set([normalized, withoutPlus, local])];
}

export function sanitizeFullName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim();
}

export function validatePasswordStrength(value) {
  const password = String(value || "");
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number";
  }

  return "";
}

export function hashToken(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function createSecureToken(size = 32) {
  return crypto.randomBytes(size).toString("hex");
}

export function createNumericOtp(length = 6) {
  const min = 10 ** (length - 1);
  const max = (10 ** length) - 1;
  return String(crypto.randomInt(min, max + 1));
}

export function parseCookies(header = "") {
  return header
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) return cookies;
      const key = entry.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(entry.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

export function getCookie(req, name) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[name] || "";
}

function buildCookieOptions(maxAge) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, buildCookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildCookieOptions(7 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res) {
  const options = { ...buildCookieOptions(0), maxAge: 0 };
  res.clearCookie(ACCESS_COOKIE_NAME, options);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

export function maskIdentifier(identifier) {
  const value = String(identifier || "").trim();
  if (!value) return "unknown";
  if (isEmailIdentifier(value)) {
    const [localPart, domain] = value.split("@");
    return `${localPart.slice(0, 2)}***@${domain}`;
  }
  const normalized = normalizePhone(value);
  return normalized ? `${normalized.slice(0, 5)}***${normalized.slice(-2)}` : "unknown";
}

export function buildPasswordResetPayload(channel) {
  const rawToken = channel === "phone" ? createNumericOtp(6) : createSecureToken(24);
  return {
    rawToken,
    hashedToken: hashToken(rawToken),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
}
