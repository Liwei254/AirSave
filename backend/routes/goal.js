import express from "express";
import { protect } from "../middlewares/auth.js";
import { createGoal, getGoals } from "../controllers/goalController.js";

const router = express.Router();

router.post("/", protect, createGoal);
router.get("/", protect, getGoals);

export default router;