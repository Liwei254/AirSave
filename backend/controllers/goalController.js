import {
  closeGoal,
  createGoal as createGoalService,
  getActiveGoal as getActiveGoalService,
  getGoals as getGoalsService,
  updateGoal as updateGoalService,
} from "../services/goalService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function createGoal(req, res, next) {
  try {
    const goal = await createGoalService(req.user._id, { ...(req.body || {}), ...(req.validatedData || {}) });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Goal created successfully",
      data: goal,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getGoals(req, res, next) {
  try {
    const goals = await getGoalsService(req.user._id);

    return sendSuccess(res, {
      message: "Goals fetched successfully",
      data: goals,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getActiveGoal(req, res, next) {
  try {
    const goal = await getActiveGoalService(req.user._id);

    return sendSuccess(res, {
      message: "Active goal fetched successfully",
      data: { goal },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateGoal(req, res, next) {
  try {
    const goal = await updateGoalService(req.user._id, req.params.id, { ...(req.body || {}), ...(req.validatedData || {}) });

    return sendSuccess(res, {
      message: "Goal updated successfully",
      data: goal,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteGoal(req, res, next) {
  try {
    const goal = await closeGoal(req.user._id, req.params.id);

    return sendSuccess(res, {
      message: "Goal closed successfully.",
      data: { goal },
    });
  } catch (error) {
    return next(error);
  }
}
