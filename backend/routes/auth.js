import express from "express";
import {
  changePassword,
  getCurrentSession,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  requestPasswordReset,
  resetPassword,
  updateCurrentUser,
} from "../controllers/authController.js";
import { protect } from "../middlewares/auth.js";
import { loginRateLimiter, passwordResetRateLimiter } from "../middlewares/authRateLimit.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  changePasswordValidator,
  loginValidator,
  passwordResetConfirmValidator,
  passwordResetRequestValidator,
  registerValidator,
  updateProfileValidator,
} from "../validators/authValidators.js";

const router = express.Router();

router.post("/register", registerValidator, validateRequest, registerUser);
router.post("/login", loginRateLimiter, loginValidator, validateRequest, loginUser);
router.post("/refresh", refreshSession);
router.post("/logout", logoutUser);
router.get("/me", protect, getCurrentSession);
router.patch("/me", protect, updateProfileValidator, validateRequest, updateCurrentUser);
router.post("/change-password", protect, changePasswordValidator, validateRequest, changePassword);
router.post(
  "/password-reset/request",
  passwordResetRateLimiter,
  passwordResetRequestValidator,
  validateRequest,
  requestPasswordReset
);
router.post(
  "/password-reset/confirm",
  passwordResetConfirmValidator,
  validateRequest,
  resetPassword
);

export default router;
