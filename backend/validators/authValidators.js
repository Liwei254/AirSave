import { checkSchema } from "express-validator";
import {
  isEmailIdentifier,
  isValidKenyanPhone,
  normalizeEmail,
  normalizePhone,
  sanitizeFullName,
  validatePasswordStrength,
} from "../utils/auth.js";

function validateIdentifier(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    throw new Error("Enter email or phone number");
  }

  if (isEmailIdentifier(raw)) {
    const email = normalizeEmail(raw);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address");
    }
    return true;
  }

  if (!isValidKenyanPhone(raw)) {
    throw new Error("Use a valid Kenyan phone number");
  }

  return true;
}

function validatePassword(value) {
  const message = validatePasswordStrength(value);
  if (message) {
    throw new Error(message);
  }
  return true;
}

export const registerValidator = checkSchema({
  fullName: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Full name is required" },
    isLength: {
      options: { min: 2, max: 120 },
      errorMessage: "Full name must be between 2 and 120 characters",
    },
    customSanitizer: {
      options: (value) => sanitizeFullName(value),
    },
  },
  email: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Email is required" },
    isEmail: { errorMessage: "Enter a valid email address" },
    customSanitizer: {
      options: (value) => normalizeEmail(value),
    },
  },
  phone: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Phone number is required" },
    custom: {
      options: (value) => {
        if (!isValidKenyanPhone(value)) {
          throw new Error("Use a valid Kenyan phone number");
        }
        return true;
      },
    },
    customSanitizer: {
      options: (value) => normalizePhone(value),
    },
  },
  password: {
    in: ["body"],
    trim: false,
    notEmpty: { errorMessage: "Password is required" },
    custom: {
      options: validatePassword,
    },
  },
});

export const passwordResetRequestValidator = checkSchema({
  identifier: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Enter email or phone number" },
    custom: {
      options: validateIdentifier,
    },
  },
  channel: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [["email", "phone"]],
      errorMessage: "Reset channel must be email or phone",
    },
  },
});

export const passwordResetConfirmValidator = checkSchema({
  identifier: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Enter email or phone number" },
    custom: {
      options: validateIdentifier,
    },
  },
  token: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Reset token is required" },
    isLength: {
      options: { min: 6, max: 128 },
      errorMessage: "Reset token is invalid",
    },
  },
  password: {
    in: ["body"],
    trim: false,
    notEmpty: { errorMessage: "Password is required" },
    custom: {
      options: validatePassword,
    },
  },
});
