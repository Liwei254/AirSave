import { getActiveGoal } from "./goalService.js";
import { countUnreadNotifications } from "./notificationService.js";
import { getSavingsActivity } from "./transactionService.js";
import { getWallet } from "./walletService.js";
import {
  getCachedDashboardSummary,
  setCachedDashboardSummary,
} from "./cacheService.js";

const CONFIRMED_STATUSES = new Set(["confirmed", "completed", "success", "successful"]);
const SAVINGS_TYPES = new Set(["save", "purchase", "bill", "airtime"]);

function isConfirmed(status) {
  return CONFIRMED_STATUSES.has(String(status || "").toLowerCase());
}

function getSavingsAmount(item) {
  const type = String(item?.type || item?.transactionType || "").toLowerCase();
  if (type === "save") return Math.max(0, Number(item?.savings ?? item?.amount ?? 0));
  if (["purchase", "bill", "airtime"].includes(type)) {
    return Math.max(0, Number(item?.savings ?? item?.savingsAmount ?? 0));
  }
  return 0;
}

function isSavingsActivity(item) {
  const type = String(item?.type || item?.transactionType || "").toLowerCase();
  return SAVINGS_TYPES.has(type) && getSavingsAmount(item) > 0;
}

function getActivityDate(item) {
  return new Date(item?.date || item?.createdAt || 0);
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getSavingsStreak(savingsItems) {
  const savingDays = Array.from(
    new Set(
      savingsItems
        .map(getActivityDate)
        .filter((date) => !Number.isNaN(date.getTime()))
        .map((date) => startOfCalendarDay(date).getTime())
    )
  ).sort((left, right) => right - left);

  if (!savingDays.length) return 0;

  const today = startOfCalendarDay(new Date());
  const newestDay = new Date(savingDays[0]);
  const diffFromToday = Math.round((today - newestDay) / 86400000);

  // The streak remains active through today when the latest savings happened today or yesterday.
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let index = 1; index < savingDays.length; index += 1) {
    const dayDiff = Math.round((savingDays[index - 1] - savingDays[index]) / 86400000);
    if (dayDiff !== 1) break;
    streak += 1;
  }

  return streak;
}

export async function getDashboardSummary(userId) {
  const cachedSummary = await getCachedDashboardSummary(userId);
  if (cachedSummary) return cachedSummary;

  const [wallet, activeGoal, activity, unreadNotifications] = await Promise.all([
    getWallet(userId),
    getActiveGoal(userId),
    getSavingsActivity(userId),
    countUnreadNotifications(userId),
  ]);

  const confirmedSavings = activity.filter((item) => isConfirmed(item.status) && isSavingsActivity(item));
  const monthStart = startOfMonth();

  const savedThisMonth = confirmedSavings
    .filter((item) => getActivityDate(item) >= monthStart)
    .reduce((sum, item) => sum + getSavingsAmount(item), 0);

  const savingsStreak = getSavingsStreak(confirmedSavings);

  const summary = {
    walletBalance: Number(wallet.balance || 0),
    savedThisMonth,
    activeGoal,
    savingsStreak,
    recentTransactions: activity.slice(0, 5),
    unreadNotifications,
  };

  await setCachedDashboardSummary(userId, summary);
  return summary;
}
