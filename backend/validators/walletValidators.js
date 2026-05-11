import { checkSchema } from "express-validator";
import { isValidKenyanPhone, normalizePhone } from "../utils/auth.js";

export const depositValidator = checkSchema({
  amount: {
    in: ["body"],
    notEmpty: { errorMessage: "Amount is required" },
    isFloat: {
      options: { gt: 0 },
      errorMessage: "Amount must be greater than zero",
    },
    toFloat: true,
  },
  phoneNumber: {
    in: ["body"],
    optional: true,
    trim: true,
    custom: {
      options: (value) => {
        if (value && !isValidKenyanPhone(value)) {
          throw new Error("Use a valid Kenyan phone number");
        }
        return true;
      },
    },
    customSanitizer: {
      options: (value) => (value ? normalizePhone(value) : value),
    },
  },
  phone: {
    in: ["body"],
    optional: true,
    trim: true,
    custom: {
      options: (value) => {
        if (value && !isValidKenyanPhone(value)) {
          throw new Error("Use a valid Kenyan phone number");
        }
        return true;
      },
    },
    customSanitizer: {
      options: (value) => (value ? normalizePhone(value) : value),
    },
  },
  sourceMethod: {
    in: ["body"],
    optional: true,
    trim: true,
    isLength: {
      options: { max: 40 },
      errorMessage: "Source method is too long",
    },
  },
});
