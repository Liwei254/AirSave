import User from "../models/User.js";
import AppError from "../utils/AppError.js";
import { invalidateDashboardCache } from "./cacheService.js";

const validRoundUpRules = [10, 50, 100];
const validThemes = ["light", "dark", "system"];
const booleanPreferenceFields = [
  "notifications",
  "privacyMode",
  "securityAlerts",
  "linkedPaymentMethods",
  "autoSaveEnabled",
];

export function assertValidRoundUpRule(value) {
  const roundUpRule = Number(value);

  if (!validRoundUpRules.includes(roundUpRule)) {
    throw new AppError("Round-up rule must be 10, 50, or 100", 400);
  }

  return roundUpRule;
}

export function normalizePreferences(input = {}, currentPreferences = {}) {
  const current =
    typeof currentPreferences?.toObject === "function"
      ? currentPreferences.toObject()
      : currentPreferences || {};
  const nextPreferences = { ...current };

  booleanPreferenceFields.forEach((field) => {
    if (typeof input[field] === "boolean") {
      nextPreferences[field] = input[field];
    }
  });

  if (validThemes.includes(input.theme)) {
    nextPreferences.theme = input.theme;
  }

  return nextPreferences;
}

export async function updateRoundUpRule(userId, roundUpRule) {
  const normalizedRule = assertValidRoundUpRule(roundUpRule);
  const user = await User.findByIdAndUpdate(
    userId,
    { roundUpRule: normalizedRule },
    { new: true }
  ).select("-password");

  if (!user) {
    throw new AppError("User not found", 404);
  }

  await invalidateDashboardCache(userId);
  return user;
}

export async function updateUserSettings(user, payload = {}) {
  if (typeof payload.roundUpRule !== "undefined") {
    user.roundUpRule = assertValidRoundUpRule(payload.roundUpRule);
  }

  if (payload.preferences && typeof payload.preferences === "object") {
    user.preferences = normalizePreferences(payload.preferences, user.preferences);
  }

  await user.save();
  if (typeof payload.roundUpRule !== "undefined") {
    await invalidateDashboardCache(user._id);
  }
  return user;
}
