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

function setTransactionType(transactionType) {
  return (req, res, next) => {
    req.body = {
      ...(req.body || {}),
      transactionType,
    };
    next();
  };
}

router.post("/payments/initiate", protect, initiatePayment);
router.post("/send", protect, setTransactionType("send"), initiatePayment);
router.post("/buy-goods", protect, setTransactionType("purchase"), initiatePayment);
router.post("/paybill", protect, setTransactionType("bill"), initiatePayment);
router.post("/payments/callback", handlePaymentCallback);
router.get("/payments/status/:reference", protect, getPaymentStatus);
router.get("/payments/:reference", protect, getPaymentStatus);
router.get("/activity", protect, getSavingsActivity);
router.post("/withdraw", protect, submitWithdrawal);
router.post("/simulate", protect, simulateTransaction);

export default router;
