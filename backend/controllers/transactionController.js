import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import Goal from "../models/Goal.js";
import Notification from "../models/Notification.js";
import { roundAmount } from "../utils/rounding.js";

// ================= SIMULATE TRANSACTION =================
export const simulateTransaction = async (req, res) => {
  try {
    const { amount, rule, goalId } = req.body;

    if (!amount) {
      return res.status(400).json({ message: "Amount required" });
    }

    // 🔢 ROUNDING
    const rounding = roundAmount(amount, rule || 10);

    // 💰 GET WALLET
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // 💾 SAVE TO LEDGER
    await Ledger.create({
      wallet: wallet._id,
      amount: rounding.savings,
      type: "CREDIT",
      reference: `ROUNDUP-${Date.now()}`,
      description: `Saved ${rounding.savings} from ${amount}`
    });

    // 🔔 NOTIFICATION
    await Notification.create({
      user: req.user._id,
      message: `You saved ${rounding.savings} KES 🎉`,
      type: "saving"
    });

    // 🎯 HANDLE SELECTED GOAL
    let selectedGoal = null;

    if (goalId) {
      selectedGoal = await Goal.findOne({
        _id: goalId,
        user: req.user._id
      });
    }

    if (selectedGoal) {
      selectedGoal.savedAmount += rounding.savings;

      if (selectedGoal.savedAmount >= selectedGoal.targetAmount) {
        selectedGoal.status = "completed";

        await Notification.create({
          user: req.user._id,
          message: `🎯 Goal "${selectedGoal.name}" completed!`,
          type: "goal"
        });
      }

      await selectedGoal.save();
    }

    res.status(200).json({
      message: "Transaction simulated",
      rounding
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};