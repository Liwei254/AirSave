import Transaction from "../models/Transaction.js";
import Ledger from "../models/Ledger.js";
import Wallet from "../models/Wallet.js";
import { simulateMpesaPayment } from "../services/mpesaMock.js";

// ================= INITIATE PAYMENT =================
export const initiatePayment = async (req, res) => {
  try {
    let { amount } = req.body;

    // 🔒 VALIDATION
    amount = Number(amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // 🔢 ROUNDING LOGIC
    // 🔢 GET ROUNDING RULE (default = 10)
const rule = Number(req.body.rule) || 10;

// 🔒 VALIDATE RULE
if (![10, 50, 100].includes(rule)) {
  return res.status(400).json({ message: "Invalid rounding rule" });
}

// 🔢 CALCULATE
const rounded = Math.ceil(amount / rule) * rule;
const savings = rounded - amount;




    // 🧾 CREATE TRANSACTION (CORRECT FIELDS)
const transaction = await Transaction.create({
  user: req.user._id,
  phone: req.user.phone,

  originalAmount: amount,
  roundedAmount: rounded,
  savingsAmount: savings,
  roundingType: String(rule), // ✅ IMPORTANT

  status: "pending",
  reference: `TXN-${Date.now()}`
});

    // 🔥 SIMULATE M-PESA
    simulateMpesaPayment(transaction, async (response) => {
      if (response.success) {
        await handleCallback(transaction._id);
      } else {
        await handleFailure(transaction._id);
      }
    });

    res.status(200).json({
      message: "Payment initiated",
      transactionId: transaction._id,
      rounded,
      savings
    });

  } catch (error) {
    console.error("Initiate error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

// ================= SUCCESS CALLBACK =================
export const handleCallback = async (transactionId) => {
try {
    // 🔍 FETCH TRANSACTION
    const transaction = await Transaction.findById(transactionId);

    // 🔒 HARD STOP: invalid or already processed
    if (!transaction) {
      console.log("❌ Transaction not found");
      return;
    }

    if (transaction.status !== "pending") {
      console.log("⚠️ Already processed:", transaction.reference);
      return;
    }

    // 🔍 FETCH WALLET
    const wallet = await Wallet.findOne({ user: transaction.user });

    if (!wallet) {
      console.log("❌ Wallet not found");
      return;
    }

    // 💰 CREATE LEDGER FIRST (SAFER)
    const ledger = await Ledger.create({
      user: transaction.user,
      wallet: wallet._id,
      amount: transaction.savingsAmount,
      type: "CREDIT",
      reference: transaction.reference,
      description: `Saved ${transaction.savingsAmount} from ${transaction.originalAmount}`
    });

    // ✅ UPDATE TRANSACTION AFTER LEDGER
    transaction.status = "success";
    transaction.ledgerRef = ledger._id;

    await transaction.save();

    console.log("💰 Wallet credited:", transaction.savingsAmount);

  } catch (error) {
    console.error("Callback error:", error.message);
  }
};

// ================= FAILURE HANDLER =================
export const handleFailure = async (transactionId) => {
  try {
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) return;

    // ❌ MARK FAILED
    transaction.status = "failed";
    await transaction.save();

    console.log("❌ Payment failed:", transaction.reference);

  } catch (error) {
    console.error("Failure handler error:", error.message);
  }
};