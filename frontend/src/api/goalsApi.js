import {
  createGoal as createGoalRequest,
  deleteGoal as deleteGoalRequest,
  getActiveGoal,
  getGoals,
  updateGoal as updateGoalRequest,
} from "../services/api";

export function fetchGoals() {
  return getGoals();
}

export function fetchActiveGoal() {
  return getActiveGoal();
}

export function createGoal(payload) {
  return createGoalRequest(payload);
}

export function updateGoal({ goalId, payload }) {
  return updateGoalRequest(goalId, payload);
}

export function closeGoal(goalId) {
  return deleteGoalRequest(goalId);
}

