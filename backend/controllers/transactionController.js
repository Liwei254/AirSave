import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import { roundAmount } from "../utils/rounding.js";

// Simulate airtime purchase + saving
export const simulateTransaction = async (req, res) => {
  try {
    const { amount, rule } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount required" });
    }

    const rounding = roundAmount(amount, rule || 10);

    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Save to ledger
    await Ledger.create({
      wallet: wallet._id,
      amount: rounding.savings,
      type: "CREDIT",
      reference: `TXN-${Date.now()}`,
      description: `Rounded from ${amount} to ${rounding.rounded}`
    });

    res.status(200).json({
      message: "Transaction simulated",
      rounding
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};