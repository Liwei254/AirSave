import express from "express";
import { getSettings, updateRoundUp } from "../controllers/settingsController.js";
import { protect } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import { roundUpRuleValidator } from "../validators/settingsValidators.js";

const router = express.Router();

router.get("/", protect, getSettings);
router.patch("/round-up", protect, roundUpRuleValidator, validateRequest, updateRoundUp);

export default router;
