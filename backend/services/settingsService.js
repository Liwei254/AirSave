import AppError from "../utils/AppError.js";
import { invalidateDashboardCache } from "./cacheService.js";
import { updateCurrentUser } from "./postgres/authService.js";
import { defaultPreferences, normalizePreferencePayload } from "./postgres/mappers.js";

const validRoundUpRules = [10, 50, 100];

export function assertValidRoundUpRule(value) {
  const roundUpRule = Number(value);

  if (!validRoundUpRules.includes(roundUpRule)) {
    throw new AppError("Round-up rule must be 10, 50, or 100", 400);
  }

  return roundUpRule;
}

export function normalizePreferences(input = {}, currentPreferences = {}) {
  return normalizePreferencePayload(input, {
    ...defaultPreferences,
    ...(currentPreferences || {}),
  });
}

export async function updateRoundUpRule(userId, roundUpRule) {
  const normalizedRule = assertValidRoundUpRule(roundUpRule);
  const user = await updateCurrentUser(userId, { roundUpRule: normalizedRule });

  await invalidateDashboardCache(userId);
  return user;
}

export async function updateUserSettings(user, payload = {}) {
  const userId = user?._id || user?.id;
  const updatePayload = {};

  if (typeof payload.roundUpRule !== "undefined") {
    updatePayload.roundUpRule = assertValidRoundUpRule(payload.roundUpRule);
  }

  if (payload.preferences && typeof payload.preferences === "object") {
    updatePayload.preferences = normalizePreferences(payload.preferences, user?.preferences);
  }

  const updatedUser = await updateCurrentUser(userId, updatePayload);

  if (typeof payload.roundUpRule !== "undefined") {
    await invalidateDashboardCache(userId);
  }

  return updatedUser;
}
