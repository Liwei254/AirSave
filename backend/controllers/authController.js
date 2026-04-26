import User from "../models/User.js";
import Wallet from "../models/Wallet.js";
import {
  buildPasswordResetPayload,
  clearAuthCookies,
  getCookie,
  getPhoneLookupCandidates,
  hashToken,
  isEmailIdentifier,
  LOGIN_LOCKOUT_ATTEMPTS,
  LOGIN_LOCKOUT_WINDOW_MS,
  maskIdentifier,
  normalizeEmail,
  normalizePhone,
  REFRESH_COOKIE_NAME,
  sanitizeFullName,
  setAuthCookies,
} from "../utils/auth.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";

function sanitizeUser(user) {
  return {
    id: user._id,
    fullName: user.fullName || "",
    email: user.email || "",
    phone: user.phone,
    role: user.role,
    wallet: user.wallet,
    status: user.status,
  };
}

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

async function findUserByIdentifier(identifier, options = {}) {
  const rawIdentifier = String(identifier || "").trim();
  if (!rawIdentifier) return null;

  const selection = options.selection || "+failedLoginAttempts +lockUntil +refreshTokenHash +refreshTokenExpiresAt +passwordResetTokenHash +passwordResetExpiresAt +passwordResetChannel";

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

async function issueSession(user, res) {
  const accessToken = signAccessToken(user._id, user.role);
  const refreshToken = signRefreshToken(user._id);

  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await user.save();

  setAuthCookies(res, { accessToken, refreshToken });

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

export async function registerUser(req, res) {
  try {
    const payload = req.validatedData || req.body;
    const fullName = sanitizeFullName(payload.fullName);
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);
    const password = payload.password;

    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    }).select("_id");

    if (existingUser) {
      logAuthEvent("register_failed_duplicate", { identifier: maskIdentifier(email || phone), ip: req.ip });
      return res.status(409).json({ message: "An account already exists with those details" });
    }

    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      wallet: "000000000000000000000000",
    });

    const wallet = await Wallet.create({
      user: user._id,
    });

    user.wallet = wallet._id;
    const { accessToken } = await issueSession(user, res);

    logAuthEvent("register_success", {
      userId: String(user._id),
      identifier: maskIdentifier(email),
      ip: req.ip,
    });

    const responseUser = sanitizeUser(user);

    return res.status(201).json({
      message: "Account created successfully",
      user: responseUser,
      token: accessToken,
      _id: responseUser.id,
      fullName: responseUser.fullName,
      email: responseUser.email,
      phone: responseUser.phone,
      role: responseUser.role,
      wallet: responseUser.wallet,
      status: responseUser.status,
    });
  } catch (error) {
    return res.status(500).json({ message: "Registration failed" });
  }
}

export async function loginUser(req, res) {
  const payload = req.validatedData || req.body;
  const emailOrPhone = String(payload.emailOrPhone || req.body.emailOrPhone || "").trim();
  const password = payload.password || req.body.password || "";

  if (!emailOrPhone) {
    return res.status(400).json({ message: "Email or phone number is required" });
  }

  if (!password) {
    return res.status(400).json({ message: "Password is required" });
  }

  try {
    const user = await findUserByIdentifier(emailOrPhone);

    if (!user) {
      logAuthEvent("login_failed_unknown_identifier", { identifier: maskIdentifier(emailOrPhone), ip: req.ip });
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      logAuthEvent("login_locked", { userId: String(user._id), identifier: maskIdentifier(emailOrPhone), ip: req.ip });
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch || user.status === "suspended") {
      await registerFailedAttempt(user);
      logAuthEvent("login_failed_invalid_credentials", {
        userId: String(user._id),
        identifier: maskIdentifier(emailOrPhone),
        ip: req.ip,
      });
      return res.status(401).json({ message: "Invalid email/phone or password" });
    }

    await persistNormalizedPhone(user, emailOrPhone);
    await clearFailedAttempts(user);
    const { accessToken } = await issueSession(user, res);

    logAuthEvent("login_success", {
      userId: String(user._id),
      identifier: maskIdentifier(emailOrPhone),
      ip: req.ip,
    });

    const responseUser = sanitizeUser(user);

    return res.status(200).json({
      message: "Login successful",
      user: responseUser,
      token: accessToken,
      _id: responseUser.id,
      fullName: responseUser.fullName,
      email: responseUser.email,
      phone: responseUser.phone,
      role: responseUser.role,
      wallet: responseUser.wallet,
      status: responseUser.status,
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed" });
  }
}

export async function refreshSession(req, res) {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
    if (!refreshToken) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== "refresh") {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(decoded.id).select("+refreshTokenHash +refreshTokenExpiresAt");
    if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
      clearAuthCookies(res);
      return res.status(401).json({ message: "Not authorized" });
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      user.refreshTokenHash = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
      clearAuthCookies(res);
      return res.status(401).json({ message: "Not authorized" });
    }

    const { accessToken } = await issueSession(user, res);

    return res.status(200).json({
      message: "Session refreshed",
      user: sanitizeUser(user),
      token: accessToken,
    });
  } catch (error) {
    clearAuthCookies(res);
    return res.status(401).json({ message: "Not authorized" });
  }
}

export async function logoutUser(req, res) {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);

    if (refreshToken) {
      const decoded = verifyToken(refreshToken);
      if (decoded?.id) {
        const user = await User.findById(decoded.id).select("+refreshTokenHash +refreshTokenExpiresAt");
        if (user) {
          user.refreshTokenHash = null;
          user.refreshTokenExpiresAt = null;
          await user.save();
        }
      }
    }

    clearAuthCookies(res);
    return res.status(200).json({ message: "Logged out" });
  } catch {
    clearAuthCookies(res);
    return res.status(200).json({ message: "Logged out" });
  }
}

export async function getCurrentSession(req, res) {
  return res.status(200).json({ user: sanitizeUser(req.user) });
}

export async function requestPasswordReset(req, res) {
  const payload = req.validatedData || req.body;
  const identifier = String(payload.identifier || "").trim();

  try {
    const user = await findUserByIdentifier(identifier);
    if (!user) {
      logAuthEvent("password_reset_requested_unknown", { identifier: maskIdentifier(identifier), ip: req.ip });
      return res.status(200).json({ message: "If the account exists, reset instructions have been sent." });
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
      ip: req.ip,
      ...(process.env.NODE_ENV !== "production" ? { devResetToken: resetPayload.rawToken } : {}),
    });

    return res.status(200).json({ message: "If the account exists, reset instructions have been sent." });
  } catch {
    return res.status(500).json({ message: "Unable to process password reset" });
  }
}

export async function resetPassword(req, res) {
  const payload = req.validatedData || req.body;
  const identifier = String(payload.identifier || "").trim();

  try {
    const user = await findUserByIdentifier(identifier);
    if (!user || !user.passwordResetTokenHash || !user.passwordResetExpiresAt) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }

    if (user.passwordResetExpiresAt < new Date()) {
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      user.passwordResetChannel = null;
      await user.save();
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }

    const providedTokenHash = hashToken(payload.token);
    if (providedTokenHash !== user.passwordResetTokenHash) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
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

    clearAuthCookies(res);

    logAuthEvent("password_reset_completed", {
      userId: String(user._id),
      identifier: maskIdentifier(identifier),
      ip: req.ip,
    });

    return res.status(200).json({ message: "Password reset successful" });
  } catch {
    return res.status(500).json({ message: "Unable to reset password" });
  }
}
