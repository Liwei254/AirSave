import {
  changePassword,
  getAuthorizedUser,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateCurrentUser,
} from "./postgres/authService.js";
import { sanitizePrismaUser } from "./postgres/mappers.js";

export {
  changePassword,
  getAuthorizedUser,
  getCurrentUser,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateCurrentUser,
};

export function sanitizeUser(user) {
  return sanitizePrismaUser(user, user?.walletBalance || 0);
}
