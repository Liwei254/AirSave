import express from "express";
import { simulateTransaction } from "../controllers/transactionController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/simulate", protect, simulateTransaction);

export default router;