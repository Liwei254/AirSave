import { getActiveGoal } from "./goalService.js";
import { countUnreadNotifications } from "./notificationService.js";
import { getSavingsActivity } from "./transactionService.js";
import { getWallet } from "./walletService.js";

function isConfirmed(status) {
  return ["confirmed", "completed", "success", "successful"].includes(String(status || "").toLowerCase());
}

function getItemAmount(item) {
  return Number(item?.savings ?? item?.amount ?? 0);
}

function isSavingsInflow(item) {
  return !["withdraw", "send"].includes(String(item?.type || item?.transactionType || "").toLowerCase());
}

function startOfWeek() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = start.getDay();
  const offset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - offset);
  return start;
}

export async function getDashboardSummary(userId) {
  const [wallet, activeGoal, activity, unreadNotifications] = await Promise.all([
    getWallet(userId),
    getActiveGoal(userId),
    getSavingsActivity(userId),
    countUnreadNotifications(userId),
  ]);
  const weekStart = startOfWeek();
  const confirmedSavings = activity.filter((item) => isConfirmed(item.status) && isSavingsInflow(item));
  const totalSaved = confirmedSavings.reduce((sum, item) => sum + Math.max(0, getItemAmount(item)), 0);
  const weeklySavings = confirmedSavings
    .filter((item) => new Date(item.date || item.createdAt || 0) >= weekStart)
    .reduce((sum, item) => sum + Math.max(0, getItemAmount(item)), 0);

  return {
    walletBalance: Number(wallet.balance || 0),
    totalSaved,
    weeklySavings,
    activeGoal,
    recentTransactions: activity.slice(0, 5),
    unreadNotifications,
  };
}
