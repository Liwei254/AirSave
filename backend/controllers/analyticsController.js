import { getSavingsActivity } from "../services/transactionService.js";
import { sendSuccess } from "../utils/apiResponse.js";

function isConfirmed(status) {
  return ["confirmed", "completed", "success", "successful"].includes(String(status || "").toLowerCase());
}

export async function getAnalytics(req, res, next) {
  try {
    const activity = await getSavingsActivity(req.user._id);
    const savingsActivity = activity.filter((item) => {
      const type = String(item.type || item.transactionType || "").toLowerCase();
      return isConfirmed(item.status) && !["withdraw", "send"].includes(type);
    });
    const totalSaved = savingsActivity.reduce((sum, tx) => sum + Math.max(0, Number(tx.savings ?? tx.amount ?? 0)), 0);
    const transactions = savingsActivity.length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = savingsActivity
      .filter((tx) => new Date(tx.date || tx.createdAt || 0) >= startOfMonth)
      .reduce((sum, tx) => sum + Math.max(0, Number(tx.savings ?? tx.amount ?? 0)), 0);
    const avgSavings = transactions > 0 ? Math.round(totalSaved / transactions) : 0;

    return sendSuccess(res, {
      message: "Analytics fetched successfully",
      data: {
        totalSaved,
        transactions,
        thisMonth,
        avgSavings,
      },
    });
  } catch (error) {
    return next(error);
  }
}
