import { allocateSavings as allocateSavingsRequest, depositWallet, getWallet } from "../services/api";

export function fetchWallet() {
  return getWallet();
}

export function deposit(payload) {
  return depositWallet(payload);
}

export function allocateSavings(payload) {
  return allocateSavingsRequest(payload);
}
