import express from "express";
import { protect } from "../middlewares/auth.js";
import { depositWallet, getWallet, getTransactionHistory } from "../controllers/walletController.js";

const router = express.Router();

router.get("/", protect, getWallet);
router.post("/deposit", protect, depositWallet);
router.get("/transactions", protect, getTransactionHistory);

export default router;
