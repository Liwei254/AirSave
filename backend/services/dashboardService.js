import { getActiveGoal } from "./goalService.js";
import { countUnreadNotifications } from "./notificationService.js";
import { getSavingsActivity } from "./transactionService.js";
import { getWallet } from "./walletService.js";
import { getDashboardSavingsMetrics } from "../repositories/postgres/prismaTransactionRepository.js";

const DASHBOARD_TIME_ZONE = process.env.APP_TIMEZONE || "Africa/Nairobi";

function startOfCalendarDayUtc(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getTodayInTimeZone(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
}

function getSavingsStreakFromDays(savingDays, timeZone = DASHBOARD_TIME_ZONE) {
  if (!savingDays.length) return 0;

  const uniqueDays = Array.from(
    new Set(
      savingDays
        .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
        .map(startOfCalendarDayUtc)
    )
  ).sort((left, right) => right - left);

  if (!uniqueDays.length) return 0;

  const today = getTodayInTimeZone(timeZone);
  const diffFromToday = Math.round((today - uniqueDays[0]) / 86400000);

  if (diffFromToday > 1) return 0;

  let streak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const dayDiff = Math.round((uniqueDays[index - 1] - uniqueDays[index]) / 86400000);
    if (dayDiff !== 1) break;
    streak += 1;
  }

  return streak;
}

export async function getDashboardSummary(userId) {
  // Dashboard headline metrics must reflect the current ledger state. Do not
  // serve a cached summary here because a newly confirmed savings movement
  // must be visible immediately on the next dashboard request.
  const [wallet, activeGoal, activity, dashboardSavings, unreadNotifications] = await Promise.all([
    getWallet(userId),
    getActiveGoal(userId),
    getSavingsActivity(userId),
    getDashboardSavingsMetrics(userId, DASHBOARD_TIME_ZONE),
    countUnreadNotifications(userId),
  ]);

  const goalProgress = activeGoal
    ? Math.min(100, Math.max(0, Number(activeGoal.progressPercent ?? 0)))
    : 0;

  return {
    walletBalance: Number(wallet.balance || 0),
    savedThisMonth: dashboardSavings.savedThisMonth,
    goalProgress,
    activeGoal,
    savingsStreak: getSavingsStreakFromDays(dashboardSavings.savingDays, DASHBOARD_TIME_ZONE),
    recentTransactions: activity.slice(0, 5),
    unreadNotifications,
  };
}
