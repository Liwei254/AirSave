import express from "express";
import { protect } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import {
  createGoal,
  deleteGoal,
  getActiveGoal,
  getGoals,
  updateGoal,
} from "../controllers/goalController.js";
import { createGoalValidator, updateGoalValidator } from "../validators/goalValidators.js";

const router = express.Router();

router.post("/", protect, createGoalValidator, validateRequest, createGoal);
router.get("/", protect, getGoals);
router.get("/active", protect, getActiveGoal);
router.put("/:id", protect, updateGoalValidator, validateRequest, updateGoal);
router.delete("/:id", protect, deleteGoal);

export default router;
