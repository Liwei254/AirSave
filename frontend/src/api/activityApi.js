import { getSavingsActivity, getTransactions } from "../services/api";

export function fetchActivity() {
  return getSavingsActivity();
}

export function fetchTransactions() {
  return getTransactions();
}

