export const roundingOptions = [
  { value: 10, label: "Round to 10" },
  { value: 50, label: "Round to 50" },
  { value: 100, label: "Round to 100" },
];

export const quickAddOptions = [100, 500, 1000];

export const activityFilters = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

export const goalTemplates = [
  { name: "Emergency Fund", targetAmount: 30000, durationValue: "6", durationUnit: "months" },
  { name: "Rent", targetAmount: 18000, durationValue: "1", durationUnit: "months" },
  { name: "School Fees", targetAmount: 45000, durationValue: "9", durationUnit: "months" },
];

export const durationUnits = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

export const phonePattern = /^(0[17]\d{8}|\+?254[17]\d{8})$/;
export const recentPhoneStorageKey = "airsave:last-phone";
export const recentGoalStorageKey = "airsave:last-goal";

export function toAmount(value) {
  return Number(value || 0);
}

export function sortActivityByNewest(items) {
  return [...(items || [])].sort(
    (left, right) => new Date(right.date || right.createdAt || 0) - new Date(left.date || left.createdAt || 0)
  );
}

export function isConfirmedSavingsStatus(status) {
  return ["confirmed", "completed", "success", "successful"].includes(String(status || "").toLowerCase());
}

export function getActivityDate(item) {
  return new Date(item?.date || item?.createdAt || 0);
}

export function isWithinActivityFilter(item, filter) {
  const itemDate = getActivityDate(item);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === "today") {
    return itemDate >= startOfToday;
  }

  if (filter === "week") {
    const day = startOfToday.getDay();
    const offset = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - offset);
    return itemDate >= startOfWeek;
  }

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return itemDate >= startOfMonth;
}

export function getSavingsSummary(items) {
  return (items || [])
    .filter((item) => isConfirmedSavingsStatus(item.status))
    .reduce((sum, item) => sum + toAmount(item.savings), 0);
}

export function getGoalProgress(goal) {
  const targetAmount = toAmount(goal?.targetAmount);
  if (!targetAmount) return 0;
  return Math.min(100, Math.round((toAmount(goal?.currentAmount ?? goal?.savedAmount) / targetAmount) * 100));
}

export function getGoalRemaining(goal) {
  return Math.max(0, toAmount(goal?.targetAmount) - toAmount(goal?.currentAmount ?? goal?.savedAmount));
}

export function getGoalMotivation(goal, formatCurrency) {
  const remaining = getGoalRemaining(goal);
  if (!remaining) {
    return "Goal completed. Keep the momentum going.";
  }

  return `You are ${formatCurrency(remaining)} away from ${goal.name}.`;
}

export function getEstimatedCompletion(goal, weeklySavingsRate) {
  const remaining = getGoalRemaining(goal);
  if (!remaining || weeklySavingsRate <= 0) {
    return "Add consistent savings to estimate completion time.";
  }

  const weeksRemaining = Math.ceil(remaining / weeklySavingsRate);
  if (weeksRemaining <= 4) {
    return `At your current pace, you could finish in about ${weeksRemaining} week${weeksRemaining === 1 ? "" : "s"}.`;
  }

  const monthsRemaining = Math.ceil(weeksRemaining / 4);
  return `At your current pace, you could finish in about ${monthsRemaining} month${monthsRemaining === 1 ? "" : "s"}.`;
}

export function getFilterLabel(filter) {
  if (filter === "today") return "today";
  if (filter === "week") return "this week";
  return "this month";
}

export function getSuggestedPlan(targetAmount, durationValue, durationUnit) {
  const target = toAmount(targetAmount);
  const duration = toAmount(durationValue);

  if (!target || !duration) {
    return null;
  }

  if (durationUnit === "days") {
    return { amount: Math.ceil(target / duration), label: "day" };
  }

  if (durationUnit === "weeks") {
    return { amount: Math.ceil(target / duration), label: "week" };
  }

  return { amount: Math.ceil(target / duration), label: "month" };
}

export function getMostRecentGoalId(goals, activityItems) {
  const activeGoals = (goals || []).filter((goal) => goal.status === "active");
  const storedGoalId = localStorage.getItem(recentGoalStorageKey);

  if (storedGoalId && activeGoals.some((goal) => goal._id === storedGoalId)) {
    return storedGoalId;
  }

  const latestActivity = (activityItems || []).find((item) =>
    activeGoals.some(
      (goal) =>
        goal._id === item.goalId ||
        goal._id === item.goal?._id ||
        goal.name?.toLowerCase() === item.goalName?.toLowerCase()
    )
  );

  if (!latestActivity) {
    return activeGoals[0]?._id || "";
  }

  const matchedGoal = activeGoals.find(
    (goal) =>
      goal._id === latestActivity.goalId ||
      goal._id === latestActivity.goal?._id ||
      goal.name?.toLowerCase() === latestActivity.goalName?.toLowerCase()
  );

  return matchedGoal?._id || activeGoals[0]?._id || "";
}

export function getWeeklySavingsRate(activityItems) {
  const confirmed = (activityItems || []).filter((item) => isConfirmedSavingsStatus(item.status));
  if (!confirmed.length) {
    return 0;
  }

  const newest = getActivityDate(confirmed[0]);
  const oldest = getActivityDate(confirmed[confirmed.length - 1]);
  const spanDays = Math.max(7, Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)) + 1);
  const total = getSavingsSummary(confirmed);

  return Math.max(0, Math.round((total / spanDays) * 7));
}

