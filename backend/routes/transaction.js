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
import { validateRequest } from "../middlewares/validation.js";
import {
  buyGoodsValidator,
  initiatePaymentValidator,
  paybillValidator,
  sendValidator,
  withdrawalValidator,
} from "../validators/transactionValidators.js";

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

router.post("/payments/initiate", protect, initiatePaymentValidator, validateRequest, initiatePayment);
router.post("/send", protect, setTransactionType("send"), sendValidator, validateRequest, initiatePayment);
router.post("/buy-goods", protect, setTransactionType("purchase"), buyGoodsValidator, validateRequest, initiatePayment);
router.post("/paybill", protect, setTransactionType("bill"), paybillValidator, validateRequest, initiatePayment);
router.post("/payments/callback", handlePaymentCallback);
router.get("/payments/status/:reference", protect, getPaymentStatus);
router.get("/payments/:reference", protect, getPaymentStatus);
router.get("/activity", protect, getSavingsActivity);
router.post("/withdraw", protect, withdrawalValidator, validateRequest, submitWithdrawal);
router.post("/simulate", protect, initiatePaymentValidator, validateRequest, simulateTransaction);

export default router;
