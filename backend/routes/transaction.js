import express from "express";
import {
  allocateSavings,
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
  airtimeValidator,
  buyGoodsValidator,
  initiatePaymentValidator,
  paybillValidator,
  sendValidator,
  withdrawalValidator,
  savingsAllocationValidator,
} from "../validators/transactionValidators.js";

const router = express.Router();

function setTransactionType(transactionType) {
  return (req, res, next) => {
    req.body = { ...(req.body || {}), transactionType };
    next();
  };
}

router.post("/payments/initiate", protect, initiatePaymentValidator, validateRequest, initiatePayment);
router.post("/send", protect, setTransactionType("send"), sendValidator, validateRequest, initiatePayment);
router.post("/buy-goods", protect, setTransactionType("purchase"), buyGoodsValidator, validateRequest, initiatePayment);
router.post("/airtime", protect, setTransactionType("airtime"), airtimeValidator, validateRequest, initiatePayment);
router.post("/paybill", protect, setTransactionType("bill"), paybillValidator, validateRequest, initiatePayment);
router.post("/save", protect, savingsAllocationValidator, validateRequest, allocateSavings);
router.post("/payments/callback", handlePaymentCallback);
router.get("/payments/status/:reference", protect, getPaymentStatus);
router.get("/payments/:reference", protect, getPaymentStatus);
router.get("/activity", protect, getSavingsActivity);
router.post("/withdraw", protect, withdrawalValidator, validateRequest, submitWithdrawal);
router.post("/simulate", protect, initiatePaymentValidator, validateRequest, simulateTransaction);

export default router;
