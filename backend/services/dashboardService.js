import { getActiveGoal } from "./goalService.js";
import { countUnreadNotifications } from "./notificationService.js";
import { getSavingsActivity } from "./transactionService.js";
import { getWallet } from "./walletService.js";
import {
  getCachedDashboardSummary,
  setCachedDashboardSummary,
} from "./cacheService.js";

function isConfirmed(status) {
  return ["confirmed", "completed", "success", "successful"].includes(String(status || "").toLowerCase());
}

function getItemAmount(item) {
  return Number(item?.savings ?? item?.amount ?? 0);
}

function isSavingsInflow(item) {
  const type = String(item?.type || item?.transactionType || "").toLowerCase();
  const savingsAmount = Number(item?.savings ?? item?.savingsAmount ?? 0);

  if (type === "save") return savingsAmount > 0 || Number(item?.amount ?? 0) > 0;
  if (["purchase", "bill", "airtime"].includes(type)) return savingsAmount > 0;
  return false;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getActivityDate(item) {
  return new Date(item?.date || item?.createdAt || 0);
}

function startOfCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getSavingsStreak(confirmedSavings) {
  if (!confirmedSavings.length) return 0;

  const savingDays = Array.from(
    new Set(
      confirmedSavings
        .map((item) => getActivityDate(item))
        .filter((date) => !Number.isNaN(date.getTime()))
        .map((date) => startOfCalendarDay(date).getTime())
    )
  ).sort((left, right) => right - left);

  if (!savingDays.length) return 0;

  const today = startOfCalendarDay(new Date());
  const newestDay = new Date(savingDays[0]);
  const diffFromToday = Math.round((today - newestDay) / (24 * 60 * 60 * 1000));

  // Keep the streak alive through a missed current day when the user saved yesterday.
  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let index = 1; index < savingDays.length; index += 1) {
    const previous = savingDays[index - 1];
    const current = savingDays[index];
    const dayDiff = Math.round((previous - current) / (24 * 60 * 60 * 1000));

    if (dayDiff !== 1) break;
    streak += 1;
  }

  return streak;
}

export async function getDashboardSummary(userId) {
  const cachedSummary = await getCachedDashboardSummary(userId);
  if (cachedSummary) {
    return cachedSummary;
  }

  const [wallet, activeGoal, activity, unreadNotifications] = await Promise.all([
    getWallet(userId),
    getActiveGoal(userId),
    getSavingsActivity(userId),
    countUnreadNotifications(userId),
  ]);

  const confirmedSavings = activity.filter((item) => isConfirmed(item.status) && isSavingsInflow(item));
  const monthStart = startOfMonth();
  const savedThisMonth = confirmedSavings
    .filter((item) => getActivityDate(item) >= monthStart)
    .reduce((sum, item) => sum + Math.max(0, getItemAmount(item)), 0);
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
