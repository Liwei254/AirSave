import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";

/**
 * @desc    Get wallet details (balance + count)
 * @route   GET /api/wallet
 * @access  Private
 */
export const getWallet = async (req, res) => {
  try {
    // Find user's wallet
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Get all transactions for this wallet
    const transactions = await Ledger.find({ wallet: wallet._id });

    // Calculate balance from ledger
    let balance = 0;

    transactions.forEach((tx) => {
      if (tx.type === "CREDIT") balance += tx.amount;
      if (tx.type === "DEBIT") balance -= tx.amount;
    });

    res.status(200).json({
      walletId: wallet._id,
      balance,
      transactionsCount: transactions.length,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/**
 * @desc    Get transaction history
 * @route   GET /api/wallet/transactions
 * @access  Private
 */
export const getTransactionHistory = async (req, res) => {
  try {
    // Find user's wallet
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Fetch transactions (latest first)
    const transactions = await Ledger.find({ wallet: wallet._id })
      .select("_id amount type reference description status createdAt")
      .sort({ createdAt: -1 });

    res.status(200).json({
      walletId: wallet._id,
      count: transactions.length,
      transactions,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};