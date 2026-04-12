import express from "express";
import { protect } from "../middlewares/auth.js";
import { getAnalytics } from "../controllers/analyticsController.js";

const router = express.Router();

router.get("/", protect, getAnalytics);

export default router;