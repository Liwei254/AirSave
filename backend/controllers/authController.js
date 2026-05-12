import {
  changePassword as changePasswordService,
  getCurrentUser,
  loginUser as loginUserService,
  logoutUser as logoutUserService,
  refreshSession as refreshSessionService,
  registerUser as registerUserService,
  requestPasswordReset as requestPasswordResetService,
  resetPassword as resetPasswordService,
  updateCurrentUser as updateCurrentUserService,
} from "../services/authService.js";
import { denyToken } from "../services/cacheService.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  ACCESS_COOKIE_NAME,
  clearAuthCookies,
  getCookie,
  hashToken,
  REFRESH_COOKIE_NAME,
  setAuthCookies,
} from "../utils/auth.js";
import { verifyToken } from "../utils/jwt.js";

function getBearerToken(header = "") {
  if (typeof header !== "string") return "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

async function denyCurrentAccessToken(req) {
  const accessToken = getBearerToken(req.headers.authorization || "") || getCookie(req, ACCESS_COOKIE_NAME);
  const decoded = verifyToken(accessToken);

  if (!decoded?.exp || decoded.type !== "access") return;

  const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
  await denyToken(hashToken(accessToken), ttlSeconds);
}

export async function registerUser(req, res, next) {
  try {
    const result = await registerUserService({ ...(req.body || {}), ...(req.validatedData || {}) }, { ip: req.ip });
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Account created successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function loginUser(req, res, next) {
  try {
    const result = await loginUserService({ ...(req.body || {}), ...(req.validatedData || {}) }, { ip: req.ip });
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return sendSuccess(res, {
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function refreshSession(req, res, next) {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
    const result = await refreshSessionService(refreshToken);
    setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    return sendSuccess(res, {
      message: "Session refreshed",
      data: result,
    });
  } catch (error) {
    clearAuthCookies(res);
    return next(error);
  }
}

export async function logoutUser(req, res, next) {
  try {
    const refreshToken = getCookie(req, REFRESH_COOKIE_NAME);
    await logoutUserService(refreshToken);
    await denyCurrentAccessToken(req);
    clearAuthCookies(res);

    return sendSuccess(res, {
      message: "Logged out",
      data: {},
    });
  } catch (error) {
    clearAuthCookies(res);
    return next(error);
  }
}

export async function getCurrentSession(req, res, next) {
  try {
    const user = await getCurrentUser(req.user._id);

    return sendSuccess(res, {
      message: "Current user fetched successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCurrentUser(req, res, next) {
  try {
    const user = await updateCurrentUserService(req.user._id, { ...(req.body || {}), ...(req.validatedData || {}) });

    return sendSuccess(res, {
      message: "Profile updated successfully",
      data: { user },
    });
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    await changePasswordService(req.user._id, { ...(req.body || {}), ...(req.validatedData || {}) });
    await denyCurrentAccessToken(req);
    clearAuthCookies(res);

    return sendSuccess(res, {
      message: "Password changed successfully. Please log in again.",
      data: {},
    });
  } catch (error) {
    return next(error);
  }
}

export async function requestPasswordReset(req, res, next) {
  try {
    await requestPasswordResetService({ ...(req.body || {}), ...(req.validatedData || {}) }, { ip: req.ip });

    return sendSuccess(res, {
      message: "If the account exists, reset instructions have been sent.",
      data: {},
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await resetPasswordService({ ...(req.body || {}), ...(req.validatedData || {}) }, { ip: req.ip });
    clearAuthCookies(res);

    return sendSuccess(res, {
      message: "Password reset successful",
      data: {},
    });
  } catch (error) {
    return next(error);
  }
}
