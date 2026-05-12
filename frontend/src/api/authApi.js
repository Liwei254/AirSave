import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from "../services/api";

export function login(credentials, options = {}) {
  return loginUser(credentials, options);
}

export function register(payload, options = {}) {
  return registerUser(payload, options);
}

export function logout() {
  return logoutUser();
}

export function fetchSessionUser() {
  return getCurrentUser();
}
