import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  createGoal,
  deleteGoal,
  getActiveGoal,
  getGoals,
  updateGoal,
} from "../controllers/goalController.js";

const router = express.Router();

router.post("/", protect, createGoal);
router.get("/", protect, getGoals);
router.get("/active", protect, getActiveGoal);
router.put("/:id", protect, updateGoal);
router.delete("/:id", protect, deleteGoal);

export default router;
