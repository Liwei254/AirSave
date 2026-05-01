export const currencyFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

export const dateFormatter = new Intl.DateTimeFormat("en-KE", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "Just now";
  return dateFormatter.format(new Date(value));
}

export function getGoalProgress(goal) {
  if (!goal?.targetAmount) return 0;
  const currentAmount = Number(goal.currentAmount ?? goal.savedAmount ?? 0);
  return Math.min(100, Math.round((currentAmount / Number(goal.targetAmount)) * 100));
}
