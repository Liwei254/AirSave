import { checkSchema } from "express-validator";
import { isValidKenyanPhone, normalizePhone } from "../utils/auth.js";

function validPhone(value) {
  if (!isValidKenyanPhone(value)) {
    throw new Error("Use a valid Kenyan phone number");
  }
  return true;
}

const amountRule = {
  in: ["body"],
  notEmpty: { errorMessage: "Amount is required" },
  isFloat: {
    options: { gt: 0 },
    errorMessage: "Amount must be greater than zero",
  },
  toFloat: true,
};

export const initiatePaymentValidator = checkSchema({
  amount: amountRule,
  phone: {
    in: ["body"],
    optional: true,
    trim: true,
    custom: { options: validPhone },
    customSanitizer: { options: (value) => normalizePhone(value) },
  },
  transactionType: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [["purchase", "bill", "send", "save"]],
      errorMessage: "Invalid transaction type",
    },
  },
});

export const savingsAllocationValidator = checkSchema({
  amount: amountRule,
  goalId: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Goal is required" },
  },
  idempotencyKey: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Idempotency key is required" },
    isLength: {
      options: { max: 255 },
      errorMessage: "Idempotency key is too long",
    },
  },
  description: {
    in: ["body"],
    optional: true,
    trim: true,
    isLength: {
      options: { max: 240 },
      errorMessage: "Description is too long",
    },
  },
});

export const sendValidator = checkSchema({
  amount: amountRule,
  phone: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Recipient phone is required" },
    custom: { options: validPhone },
    customSanitizer: { options: (value) => normalizePhone(value) },
  },
});

export const buyGoodsValidator = checkSchema({
  amount: amountRule,
  tillNumber: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Till number is required" },
    matches: {
      options: [/^\d{5,}$/],
      errorMessage: "A valid till number is required",
    },
  },
});

export const paybillValidator = checkSchema({
  amount: amountRule,
  businessNumber: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Business number is required" },
    matches: {
      options: [/^\d{5,}$/],
      errorMessage: "A valid business number is required",
    },
  },
  accountNumber: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Account number is required" },
    isLength: {
      options: { max: 64 },
      errorMessage: "Account number is too long",
    },
  },
});

export const withdrawalValidator = checkSchema({
  amount: amountRule,
  sourceType: {
    in: ["body"],
    optional: true,
    isIn: {
      options: [["wallet", "goal"]],
      errorMessage: "Invalid withdrawal source",
    },
  },
  sourceId: {
    in: ["body"],
    optional: true,
    trim: true,
  },
  phoneNumber: {
    in: ["body"],
    trim: true,
    notEmpty: { errorMessage: "Recipient is required" },
    custom: { options: validPhone },
    customSanitizer: { options: (value) => normalizePhone(value) },
  },
  fee: {
    in: ["body"],
    optional: true,
    isFloat: {
      options: { min: 0 },
      errorMessage: "Withdrawal fee cannot be negative",
    },
    toFloat: true,
  },
  totalDeducted: {
    in: ["body"],
    optional: true,
    isFloat: {
      options: { gt: 0 },
      errorMessage: "Withdrawal total must be greater than zero",
    },
    toFloat: true,
  },
});
