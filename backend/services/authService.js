import mongoose from "mongoose";
import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import AppError from "../utils/AppError.js";
import {
  buildPasswordResetPayload,
  getPhoneLookupCandidates,
  hashToken,
  isEmailIdentifier,
  LOGIN_LOCKOUT_ATTEMPTS,
  LOGIN_LOCKOUT_WINDOW_MS,
  maskIdentifier,
  normalizeEmail,
  normalizePhone,
  sanitizeFullName,
} from "../utils/auth.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";
import { updateUserSettings } from "./settingsService.js";

function logAuthEvent(event, details = {}) {
  console.info(
    JSON.stringify({
      scope: "auth",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

export function sanitizeUser(user) {
  if (!user) return null;

  const raw = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: raw._id,
    _id: raw._id,
    fullName: raw.fullName || "",
    email: raw.email || "",
    phone: raw.phone,
    role: raw.role,
    wallet: raw.wallet,
    status: raw.status,
    createdAt: raw.createdAt,
    roundUpRule: raw.roundUpRule || 50,
    avatar: raw.avatar || "",
    walletBalance: Number(raw.walletBalance || 0),
    preferences: {
      notifications: raw.preferences?.notifications ?? true,
      theme: raw.preferences?.theme || "light",
      privacyMode: raw.preferences?.privacyMode ?? false,
      securityAlerts: raw.preferences?.securityAlerts ?? true,
      linkedPaymentMethods: raw.preferences?.linkedPaymentMethods ?? true,
      autoSaveEnabled: raw.preferences?.autoSaveEnabled ?? true,
    },
  };
}

async function findUserByIdentifier(identifier, options = {}) {
  const rawIdentifier = String(identifier || "").trim();
  if (!rawIdentifier) return null;

  const selection =
    options.selection ||
    "+failedLoginAttempts +lockUntil +refreshTokenHash +refreshTokenExpiresAt +passwordResetTokenHash +passwordResetExpiresAt +passwordResetChannel";

  if (isEmailIdentifier(rawIdentifier)) {
    return User.findOne({ email: normalizeEmail(rawIdentifier) }).select(selection);
  }

  const candidates = getPhoneLookupCandidates(rawIdentifier);
  if (!candidates.length) return null;

  return User.findOne({ phone: { $in: candidates } }).select(selection);
}

async function persistNormalizedPhone(user, inputIdentifier) {
  if (!user || isEmailIdentifier(inputIdentifier)) return;

  const normalizedPhone = normalizePhone(inputIdentifier);
  if (normalizedPhone && user.phone !== normalizedPhone) {
    user.phone = normalizedPhone;
    await user.save();
  }
}

async function issueSession(user) {
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save();

  return { accessToken, refreshToken };
}

async function registerFailedAttempt(user) {
  if (!user) return;

  const nextAttempts = (user.failedLoginAttempts || 0) + 1;
  user.failedLoginAttempts = nextAttempts;

  if (nextAttempts >= LOGIN_LOCKOUT_ATTEMPTS) {
    user.lockUntil = new Date(Date.now() + LOGIN_LOCKOUT_WINDOW_MS);
    user.failedLoginAttempts = 0;
  }

  await user.save();
}

async function clearFailedAttempts(user) {
  if (!user) return;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();
}

export async function registerUser(payload = {}, context = {}) {
  const fullName = sanitizeFullName(payload.fullName);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const password = payload.password;

  const existingUser = await User.findOne({
    $or: [{ email }, { phone }],
  }).select("_id");

  if (existingUser) {
    logAuthEvent("register_failed_duplicate", {
      identifier: maskIdentifier(email || phone),
      ip: context.ip,
    });
    throw new AppError("An account already exists with those details", 409);
  }

  const walletId = new mongoose.Types.ObjectId();
  const user = await User.create({
    fullName,
    email,
    phone,
    password,
    wallet: walletId,
  });

  const wallet = await Wallet.create({
    _id: walletId,
    user: user._id,
  });

  user.wallet = wallet._id;
  const tokens = await issueSession(user);

  logAuthEvent("register_success", {
    userId: String(user._id),
    identifier: maskIdentifier(email),
    ip: context.ip,
  });

  const responseUser = sanitizeUser(user);

  return {
    user: responseUser,
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    _id: responseUser.id,
    fullName: responseUser.fullName,
    email: responseUser.email,
    phone: responseUser.phone,
    role: responseUser.role,
    wallet: responseUser.wallet,
    status: responseUser.status,
  };
}

export async function loginUser(payload = {}, context = {}) {
  const emailOrPhone = String(payload.emailOrPhone || "").trim();
  const password = payload.password || "";

  const user = await findUserByIdentifier(emailOrPhone);

  if (!user) {
    logAuthEvent("login_failed_unknown_identifier", {
      identifier: maskIdentifier(emailOrPhone),
      ip: context.ip,
    });
    throw new AppError("Invalid email/phone or password", 401);
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    logAuthEvent("login_locked", {
      userId: String(user._id),
      identifier: maskIdentifier(emailOrPhone),
      ip: context.ip,
    });
    throw new AppError("Invalid email/phone or password", 401);
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch || user.status === "suspended") {
    await registerFailedAttempt(user);
    logAuthEvent("login_failed_invalid_credentials", {
      userId: String(user._id),
      identifier: maskIdentifier(emailOrPhone),
      ip: context.ip,
    });
    throw new AppError("Invalid email/phone or password", 401);
  }

  await persistNormalizedPhone(user, emailOrPhone);
  await clearFailedAttempts(user);
  const tokens = await issueSession(user);

  logAuthEvent("login_success", {
    userId: String(user._id),
    identifier: maskIdentifier(emailOrPhone),
    ip: context.ip,
  });

  const responseUser = sanitizeUser(user);

  return {
    user: responseUser,
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    _id: responseUser.id,
    fullName: responseUser.fullName,
    email: responseUser.email,
    phone: responseUser.phone,
    role: responseUser.role,
    wallet: responseUser.wallet,
    status: responseUser.status,
  };
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw new AppError("Not authorized", 401);
  }

  const decoded = verifyToken(refreshToken);
  if (!decoded || decoded.type !== "refresh") {
    throw new AppError("Not authorized", 401);
  }

  const user = await User.findById(decoded.id).select("+refreshTokenHash +refreshTokenExpiresAt");
  if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError("Not authorized", 401);
  }

  if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    await user.save();
    throw new AppError("Not authorized", 401);
  }

  const tokens = await issueSession(user);

  return {
    user: sanitizeUser(user),
    token: tokens.accessToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;

  const decoded = verifyToken(refreshToken);
  if (!decoded?.id) return;

  const user = await User.findById(decoded.id).select("+refreshTokenHash +refreshTokenExpiresAt");
  if (!user) return;

  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId).select("-password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  return sanitizeUser(user);
}

export async function updateCurrentUser(userId, payload = {}) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const fullName = sanitizeFullName(payload.fullName);
  if (fullName) {
    user.fullName = fullName;
  }

  const email = normalizeEmail(payload.email);
  if (email && email !== user.email) {
    const existingEmailUser = await User.findOne({ email, _id: { $ne: user._id } }).select("_id");
    if (existingEmailUser) {
      throw new AppError("Email is already in use", 409);
    }
    user.email = email;
  }

  if (typeof payload.avatar === "string") {
    user.avatar = payload.avatar.trim().slice(0, 500);
  }

  await updateUserSettings(user, payload);

  return sanitizeUser(user);
}

export async function changePassword(userId, payload = {}) {
  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isMatch = await user.matchPassword(currentPassword);

  if (!isMatch) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.password = newPassword;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();
}

export async function requestPasswordReset(payload = {}, context = {}) {
  const identifier = String(payload.identifier || "").trim();
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    logAuthEvent("password_reset_requested_unknown", {
      identifier: maskIdentifier(identifier),
      ip: context.ip,
    });
    return;
  }

  const resolvedChannel = payload.channel || (isEmailIdentifier(identifier) ? "email" : "phone");
  const resetPayload = buildPasswordResetPayload(resolvedChannel);

  user.passwordResetTokenHash = resetPayload.hashedToken;
  user.passwordResetExpiresAt = resetPayload.expiresAt;
  user.passwordResetChannel = resolvedChannel;
  await user.save();

  logAuthEvent("password_reset_requested", {
    userId: String(user._id),
    identifier: maskIdentifier(identifier),
    channel: resolvedChannel,
    ip: context.ip,
    ...(process.env.NODE_ENV !== "production" ? { devResetToken: resetPayload.rawToken } : {}),
  });
}

export async function resetPassword(payload = {}, context = {}) {
  const identifier = String(payload.identifier || "").trim();
  const user = await findUserByIdentifier(identifier);

  if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
    throw new AppError("Reset token is invalid or expired", 400);
  }

  if (user.passwordResetExpiresAt < new Date()) {
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    user.passwordResetChannel = null;
    await user.save();
    throw new AppError("Reset token is invalid or expired", 400);
  }

  const providedTokenHash = hashToken(payload.token);
  if (providedTokenHash !== user.passwordResetTokenHash) {
    throw new AppError("Reset token is invalid or expired", 400);
  }

  user.password = payload.password;
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.passwordResetChannel = null;
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  logAuthEvent("password_reset_completed", {
    userId: String(user._id),
    identifier: maskIdentifier(identifier),
    ip: context.ip,
  });
}
