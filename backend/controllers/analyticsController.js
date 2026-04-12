import Ledger from "../models/Ledger.js";
import Wallet from "../models/Wallet.js";

// GET ANALYTICS
export const getAnalytics = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const transactions = await Ledger.find({
      wallet: wallet._id,
      type: "CREDIT"
    });

    // 🔢 Total Saved
    const totalSaved = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    // 📊 Number of transactions
    const transactionsCount = transactions.length;

    // 📅 This Month Savings
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonthTx = transactions.filter(
      tx => tx.createdAt >= startOfMonth
    );

    const thisMonth = thisMonthTx.reduce((sum, tx) => sum + tx.amount, 0);

    // 📈 Average Savings
    const avgSavings = transactionsCount > 0
      ? Math.round(totalSaved / transactionsCount)
      : 0;

    res.status(200).json({
      totalSaved,
      transactions: transactionsCount,
      thisMonth,
      avgSavings
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};