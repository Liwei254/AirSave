import { getCurrentUser, sanitizeUser } from "../services/authService.js";
import { updateRoundUpRule } from "../services/settingsService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getSettings(req, res, next) {
  try {
    const user = await getCurrentUser(req.user._id);

    return sendSuccess(res, {
      message: "Settings fetched successfully",
      data: {
        roundUpRule: user.roundUpRule,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateRoundUp(req, res, next) {
  try {
    const payload = { ...(req.body || {}), ...(req.validatedData || {}) };
    const user = await updateRoundUpRule(req.user._id, payload.roundUpRule);

    return sendSuccess(res, {
      message: "Round-up rule updated successfully",
      data: { user: sanitizeUser(user) },
    });
  } catch (error) {
    return next(error);
  }
}
