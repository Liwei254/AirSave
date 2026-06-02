export {
  allocateSavingsToGoal,
  closeGoal,
  createGoal,
  creditActiveGoal,
  getActiveGoal,
  getActiveGoal as findActiveGoal,
  getGoalProgress,
  getGoals,
  roundUpSavings,
  updateGoal,
} from "./postgres/prismaGoalService.js";
