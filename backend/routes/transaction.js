import express from "express";
import {
  getSavingsActivity,
  getPaymentStatus,
  handlePaymentCallback,
  initiatePayment,
  submitWithdrawal,
  simulateTransaction,
} from "../controllers/transactionController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/payments/initiate", protect, initiatePayment);
router.post("/payments/callback", handlePaymentCallback);
router.get("/payments/:reference", protect, getPaymentStatus);
router.get("/activity", protect, getSavingsActivity);
router.post("/withdraw", protect, submitWithdrawal);
router.post("/simulate", protect, simulateTransaction);

export default router;
