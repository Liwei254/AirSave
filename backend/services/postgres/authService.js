import bcrypt from "bcryptjs";
import prisma from "../../config/prisma.js";
import {
  createWalletWithDefaultAccounts,
  getWalletOrCreate,
} from "../../repositories/postgres/walletRepository.js";
import {
  findUserByEmailOrPhone,
  findUserById,
  findUserByIdentifier as findPrismaUserByIdentifier,
} from "../../repositories/postgres/userRepository.js";
import AppError from "../../utils/AppError.js";
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
} from "../../utils/auth.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../../utils/jwt.js";
import {
  defaultPreferences,
  normalizePreferencePayload,
  sanitizePrismaUser,
  toApiRole,
} from "./mappers.js";
import { getWalletBalance } from "../ledger/prismaLedgerService.js";

const validRoundUpRules = new Set([10, 50, 100]);

function logAuthEvent(event, details = {}) {
  console.info(
    JSON.stringify({
      scope: "auth",
      datastore: "postgres",
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}

function assertRoundUpRule(value) {
  const roundUpRule = Number(value || 50);

  if (!validRoundUpRules.has(roundUpRule)) {
    throw new AppError("Round-up rule must be 10, 50, or 100", 400);
  }

  return roundUpRule;
}

function assertRegistrationPayload({ fullName, email, phone, password }) {
  if (!fullName) {
    throw new AppError("Full name is required", 400);
  }

  if (!email) {
    throw new AppError("Email is required", 400);
  }

  if (!phone) {
    throw new AppError("Use a valid Kenyan phone number", 400);
  }

  if (!password) {
    throw new AppError("Password is required", 400);
  }
}

function mapUniqueConstraint(error) {
  if (error?.code === "P2002") {
    throw new AppError("An account already exists with those details", 409);
  }

  throw error;
}

async function findUserByIdentifier(identifier) {
  const rawIdentifier = String(identifier || "").trim();
  if (!rawIdentifier) return null;

  if (isEmailIdentifier(rawIdentifier)) {
    return findPrismaUserByIdentifier(prisma, {
      email: normalizeEmail(rawIdentifier),
    });
  }

  return findPrismaUserByIdentifier(prisma, {
    phoneCandidates: getPhoneLookupCandidates(rawIdentifier),
  });
}

async function persistNormalizedPhone(user, inputIdentifier) {
  if (!user || isEmailIdentifier(inputIdentifier)) return user;

  const normalizedPhone = normalizePhone(inputIdentifier);
  if (!normalizedPhone || user.phone === normalizedPhone) return user;

  return prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      phone: normalizedPhone,
    },
    include: {
      wallet: true,
    },
  });
}

async function issueSession(user, tx = prisma) {
  const accessToken = signAccessToken(user.id, toApiRole(user.role));
  const refreshToken = signRefreshToken(user.id);

  await tx.user.update({
    where: {
      id: user.id,
    },
    data: {
      refreshTokenHash: hashToken(refreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { accessToken, refreshToken };
}

async function registerFailedAttempt(user) {
  if (!user) return;

  const nextAttempts = Number(user.failedLoginAttempts || 0) + 1;
  const shouldLock = nextAttempts >= LOGIN_LOCKOUT_ATTEMPTS;

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      failedLoginAttempts: shouldLock ? 0 : nextAttempts,
      lockUntil: shouldLock ? new Date(Date.now() + LOGIN_LOCKOUT_WINDOW_MS) : user.lockUntil,
    },
  });
}

async function clearFailedAttempts(user) {
  if (!user) return;

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });
}

async function buildAuthResponse(user, tokens) {
  const walletBalance = user.wallet ? await getWalletBalance(user.wallet.id) : 0;
  const responseUser = sanitizePrismaUser(user, walletBalance);

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

export async function registerUser(payload = {}, context = {}) {
  const fullName = sanitizeFullName(payload.fullName);
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const password = payload.password;
  const roundUpRule = assertRoundUpRule(payload.roundUpRule || 50);

  assertRegistrationPayload({ fullName, email, phone, password });

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const { user, tokens } = await prisma.$transaction(async (tx) => {
      const existingUser = await findUserByEmailOrPhone(tx, { email, phone });

      if (existingUser) {
        throw new AppError("An account already exists with those details", 409);
      }

      const createdUser = await tx.user.create({
        data: {
          fullName,
          email,
          phone,
          passwordHash,
          roundUpRule,
          preferences: defaultPreferences,
        },
      });

      await createWalletWithDefaultAccounts(tx, createdUser.id);
      const userWithWallet = await findUserById(tx, createdUser.id);
      const sessionTokens = await issueSession(userWithWallet, tx);

      return {
        user: await findUserById(tx, createdUser.id),
        tokens: sessionTokens,
      };
    });

    logAuthEvent("register_success", {
      userId: user.id,
      identifier: maskIdentifier(email),
      ip: context.ip,
    });

    return buildAuthResponse(user, tokens);
  } catch (error) {
    if (error instanceof AppError) {
      logAuthEvent("register_failed", {
        identifier: maskIdentifier(email || phone),
        ip: context.ip,
        reason: error.message,
      });
      throw error;
    }

    mapUniqueConstraint(error);
  }
}

export async function loginUser(payload = {}, context = {}) {
  const emailOrPhone = String(payload.emailOrPhone || "").trim();
  const password = payload.password || "";
  let user = await findUserByIdentifier(emailOrPhone);

  if (!user) {
    logAuthEvent("login_failed_unknown_identifier", {
      identifier: maskIdentifier(emailOrPhone),
      ip: context.ip,
    });
    throw new AppError("Invalid email/phone or password", 401);
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    logAuthEvent("login_locked", {
      userId: user.id,
      identifier: maskIdentifier(emailOrPhone),
      ip: context.ip,
    });
    throw new AppError("Invalid email/phone or password", 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch || user.status === "SUSPENDED") {
    await registerFailedAttempt(user);
    logAuthEvent("login_failed_invalid_credentials", {
      userId: user.id,
      identifier: maskIdentifier(emailOrPhone),
      ip: context.ip,
    });
    throw new AppError("Invalid email/phone or password", 401);
  }

  user = await persistNormalizedPhone(user, emailOrPhone);
  await clearFailedAttempts(user);
  await prisma.$transaction((tx) => getWalletOrCreate(tx, user.id));
  user = await findUserById(prisma, user.id);
  const tokens = await issueSession(user);

  logAuthEvent("login_success", {
    userId: user.id,
    identifier: maskIdentifier(emailOrPhone),
    ip: context.ip,
  });

  return buildAuthResponse(user, tokens);
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw new AppError("Not authorized", 401);
  }

  const decoded = verifyToken(refreshToken);
  if (!decoded || decoded.type !== "refresh") {
    throw new AppError("Not authorized", 401);
  }

  const user = await findUserById(prisma, decoded.id);

  if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError("Not authorized", 401);
  }

  if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshTokenHash: null,
        refreshTokenExpiresAt: null,
      },
    });
    throw new AppError("Not authorized", 401);
  }

  const tokens = await issueSession(user);
  const updatedUser = await findUserById(prisma, user.id);

  return buildAuthResponse(updatedUser, tokens);
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;

  const decoded = verifyToken(refreshToken);
  if (!decoded?.id) return;

  await prisma.user.updateMany({
    where: {
      id: decoded.id,
    },
    data: {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
  });
}

export async function getCurrentUser(userId) {
  const user = await findUserById(prisma, userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const walletBalance = user.wallet ? await getWalletBalance(user.wallet.id) : 0;
  return sanitizePrismaUser(user, walletBalance);
}

export async function getAuthorizedUser(userId) {
  const user = await findUserById(prisma, userId);
  return sanitizePrismaUser(user);
}

export async function updateCurrentUser(userId, payload = {}) {
  const existingUser = await findUserById(prisma, userId);

  if (!existingUser) {
    throw new AppError("User not found", 404);
  }

  const data = {};
  const fullName = sanitizeFullName(payload.fullName);

  if (fullName) {
    data.fullName = fullName;
  }

  const email = normalizeEmail(payload.email);
  if (email && email !== existingUser.email) {
    const existingEmailUser = await prisma.user.findFirst({
      where: {
        email,
        id: {
          not: String(userId),
        },
      },
      select: {
        id: true,
      },
    });

    if (existingEmailUser) {
      throw new AppError("Email is already in use", 409);
    }

    data.email = email;
  }

  if (typeof payload.avatar === "string") {
    data.avatarUrl = payload.avatar.trim().slice(0, 500);
  }

  if (typeof payload.roundUpRule !== "undefined") {
    data.roundUpRule = assertRoundUpRule(payload.roundUpRule);
  }

  if (payload.preferences && typeof payload.preferences === "object") {
    data.preferences = normalizePreferencePayload(payload.preferences, existingUser.preferences);
  }

  if (!Object.keys(data).length) {
    const walletBalance = existingUser.wallet ? await getWalletBalance(existingUser.wallet.id) : 0;
    return sanitizePrismaUser(existingUser, walletBalance);
  }

  const updatedUser = await prisma.user.update({
    where: {
      id: String(userId),
    },
    data,
    include: {
      wallet: true,
    },
  });

  const walletBalance = updatedUser.wallet ? await getWalletBalance(updatedUser.wallet.id) : 0;
  return sanitizePrismaUser(updatedUser, walletBalance);
}

export async function changePassword(userId, payload = {}) {
  const currentPassword = String(payload.currentPassword || "");
  const newPassword = String(payload.newPassword || "");

  if (!currentPassword || !newPassword) {
    throw new AppError("Current password and new password are required", 400);
  }

  const user = await findUserById(prisma, userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!isMatch) {
    throw new AppError("Current password is incorrect", 400);
  }

  await prisma.user.update({
    where: {
      id: String(userId),
    },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    },
  });
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

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordResetTokenHash: resetPayload.hashedToken,
      passwordResetExpiresAt: resetPayload.expiresAt,
      passwordResetChannel: resolvedChannel,
    },
  });

  logAuthEvent("password_reset_requested", {
    userId: user.id,
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
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetChannel: null,
      },
    });
    throw new AppError("Reset token is invalid or expired", 400);
  }

  const providedTokenHash = hashToken(payload.token);
  if (providedTokenHash !== user.passwordResetTokenHash) {
    throw new AppError("Reset token is invalid or expired", 400);
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash: await bcrypt.hash(payload.password, 12),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      passwordResetChannel: null,
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
      failedLoginAttempts: 0,
      lockUntil: null,
    },
  });

  logAuthEvent("password_reset_completed", {
    userId: user.id,
    identifier: maskIdentifier(identifier),
    ip: context.ip,
  });
}
