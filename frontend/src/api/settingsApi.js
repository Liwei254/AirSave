import { getCurrentUser, updateCurrentUser } from "../services/api";

export function fetchSettings() {
  return getCurrentUser();
}

export function updateSettings(payload) {
  return updateCurrentUser(payload);
}

