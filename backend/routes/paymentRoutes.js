import express from "express";
import { initiatePayment } from "../controllers/paymentController.js";
import { protect } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import { initiatePaymentValidator } from "../validators/transactionValidators.js";

const router = express.Router();

router.post("/initiate", protect, initiatePaymentValidator, validateRequest, initiatePayment);

export default router;
