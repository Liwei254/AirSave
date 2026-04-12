import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";
import { roundAmount } from "../utils/rounding.js";
import Goal from "../models/Goal.js";
import Notification from "../models/Notification.js";

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

    // 💾 Save to ledger
    await Ledger.create({
      wallet: wallet._id,
      amount: rounding.savings,
      type: "CREDIT",
      reference: `ROUNDUP-${Date.now()}`,
      description: `Saved ${rounding.savings} from ${amount}`
    });

    // 🔔 Saving notification
    await Notification.create({
      user: req.user._id,
      message: `You saved ${rounding.savings} KES 🎉`,
      type: "saving"
    });

    // 🎯 AUTO-ALLOCATE TO ACTIVE GOAL
    const activeGoal = await Goal.findOne({
      user: req.user._id,
      status: "active"
    }).sort({ createdAt: 1 });

    if (activeGoal) {
      activeGoal.savedAmount += rounding.savings;

      // ✅ Goal completion check
      if (activeGoal.savedAmount >= activeGoal.targetAmount) {
        activeGoal.status = "completed";

        // 🔔 Goal completion notification
        await Notification.create({
          user: req.user._id,
          message: `🎯 Goal "${activeGoal.name}" completed!`,
          type: "goal"
        });
      }

      await activeGoal.save();
    }

    res.status(200).json({
      message: "Transaction simulated",
      rounding
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};