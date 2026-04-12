import express from "express";
import { protect } from "../middlewares/auth.js";
import { getWallet, getTransactionHistory } from "../controllers/walletController.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.get("/transactions", protect, getTransactionHistory);

export default router;