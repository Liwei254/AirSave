import Wallet from "../models/Wallet.js";
import Ledger from "../models/Ledger.js";

// GET WALLET BALANCE
export const getMyWallet = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user._id });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Calculate balance from ledger
    const transactions = await Ledger.find({ wallet: wallet._id });

    let balance = 0;

    transactions.forEach(tx => {
      if (tx.type === "CREDIT") balance += tx.amount;
      if (tx.type === "DEBIT") balance -= tx.amount;
    });

    res.status(200).json({
      walletId: wallet._id,
      balance,
      transactionsCount: transactions.length
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};