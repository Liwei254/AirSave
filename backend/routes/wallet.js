import express from "express";
import { protect } from "../middlewares/auth.js";
import { validateRequest } from "../middlewares/validation.js";
import { depositWallet, getWallet, getTransactionHistory } from "../controllers/walletController.js";
import { depositValidator } from "../validators/walletValidators.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.post("/deposit", protect, depositValidator, validateRequest, depositWallet);
router.get("/transactions", protect, getTransactionHistory);

export default router;
