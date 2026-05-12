import {
  changePassword,
  getCurrentUser,
  logoutUser,
  updateCurrentUser,
} from "../services/api";

export function fetchProfile() {
  return getCurrentUser();
}

export function updateProfile(payload) {
  return updateCurrentUser(payload);
}

export function updatePassword(payload) {
  return changePassword(payload);
}

export function logoutProfile() {
  return logoutUser();
}

