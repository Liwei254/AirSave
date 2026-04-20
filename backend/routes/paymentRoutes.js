import express from "express";
import { initiatePayment } from "../controllers/paymentController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/initiate", protect, initiatePayment);

export default router;