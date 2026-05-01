import axios from "axios";

const apiBaseUrl = import.meta.env.PROD
  ? import.meta.env.VITE_API_BASE_URL || "https://airsave-lg67.onrender.com/api"
  : import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const sessionTokenKey = "airsave-token";
const persistentTokenKey = "airsave-token-persistent";
const authEventName = "airsave:auth-expired";

function readStorage(storage, key) {
  if (typeof window === "undefined") return "";
  try {
    return storage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(storage, key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      storage.setItem(key, value);
    } else {
      storage.removeItem(key);
    }
  } catch {
    // Ignore storage access failures.
  }
}

export function getStoredToken() {
  if (typeof window === "undefined") return "";
  return readStorage(window.sessionStorage, sessionTokenKey) || readStorage(window.localStorage, persistentTokenKey);
}

export function hasStoredToken() {
  return Boolean(getStoredToken());
}

export function storeAuthToken(token, remember = false) {
  if (typeof window === "undefined") return;
  const normalizedToken = String(token || "").trim();

  if (!normalizedToken) {
    clearStoredAuth();
    return;
  }

  writeStorage(window.sessionStorage, sessionTokenKey, remember ? "" : normalizedToken);
  writeStorage(window.localStorage, persistentTokenKey, remember ? normalizedToken : "");
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  writeStorage(window.sessionStorage, sessionTokenKey, "");
  writeStorage(window.localStorage, persistentTokenKey, "");
}

function emitAuthExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(authEventName));
}

axios.defaults.withCredentials = true;

const API = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  const token = getStoredToken();
  const nextConfig = { ...config, headers: { ...(config.headers || {}) } };

  if (token) {
    nextConfig.headers.Authorization = `Bearer ${token}`;
  } else if (nextConfig.headers.Authorization) {
    delete nextConfig.headers.Authorization;
  }

  return nextConfig;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const shouldIgnoreAuthFailure =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/password-reset");

    if (status === 401 && !shouldIgnoreAuthFailure) {
      clearStoredAuth();
      emitAuthExpired();
    }

    return Promise.reject(error);
  }
);

async function requestData(request, transform = (data) => data) {
  try {
    const { data } = await request;
    return transform(data);
  } catch (error) {
    const message = error?.response?.data?.message || error.message || "Request failed";

    if (axios.isAxiosError(error)) {
      error.message = message;
      throw error;
    }

    const wrappedError = new Error(message);
    wrappedError.cause = error;
    throw wrappedError;
  }
}

function persistTokenFromResponse(data, remember = false) {
  const token = data?.token;
  if (token) {
    storeAuthToken(token, remember);
  }
  return data;
}

export async function loginUser(payload, options = {}) {
  return requestData(API.post("/auth/login", payload, { withCredentials: true }), (data) => persistTokenFromResponse(data, options.rememberMe));
}

export async function registerUser(payload, options = {}) {
  return requestData(API.post("/auth/register", payload, { withCredentials: true }), (data) => persistTokenFromResponse(data, options.rememberMe));
}

export async function logoutUser() {
  try {
    return await requestData(API.post("/auth/logout", {}, { withCredentials: true }));
  } finally {
    clearStoredAuth();
  }
}

export async function getCurrentUser() {
  if (!hasStoredToken()) {
    return null;
  }
  return requestData(API.get("/auth/me", { withCredentials: true }), (data) => data.user || null);
}

export async function updateCurrentUser(payload) {
  return requestData(API.patch("/auth/me", payload, { withCredentials: true }), (data) => data.user || null);
}

export async function changePassword(payload) {
  return requestData(API.post("/auth/change-password", payload, { withCredentials: true }));
}

export async function requestPasswordReset(payload) {
  return requestData(API.post("/auth/password-reset/request", payload, { withCredentials: true }));
}

export async function resetPassword(payload) {
  return requestData(API.post("/auth/password-reset/confirm", payload, { withCredentials: true }));
}

export async function getWallet() {
  return requestData(API.get("/wallet", { withCredentials: true }));
}

export async function getGoals() {
  return requestData(API.get("/goals", { withCredentials: true }));
}

export async function getActiveGoal() {
  return requestData(API.get("/goals/active", { withCredentials: true }), (data) => data.goal || null);
}

export async function createGoal(payload) {
  return requestData(API.post("/goals", payload, { withCredentials: true }));
}

export async function updateGoal(id, payload) {
  return requestData(API.put(`/goals/${id}`, payload, { withCredentials: true }));
}

export async function deleteGoal(id) {
  return requestData(API.delete(`/goals/${id}`, { withCredentials: true }));
}

export async function getTransactions() {
  return requestData(API.get("/wallet/transactions", { withCredentials: true }), (data) => data.transactions || []);
}

export async function getSavingsActivity() {
  return requestData(API.get("/transactions/activity", { withCredentials: true }));
}

export async function initiatePayment(payload) {
  return requestData(API.post("/transactions/payments/initiate", payload, { withCredentials: true }), (data) => ({
    ...data,
    status: data?.status || "pending",
    message: data?.message || "STK push sent",
    paymentReference:
      data?.paymentReference ||
      data?.reference ||
      data?.transactionReference ||
      data?.checkoutRequestId ||
      null,
  }));
}

export async function getPaymentStatus(reference) {
  return requestData(API.get(`/transactions/payments/${reference}`, { withCredentials: true }));
}

export async function submitWithdrawal(payload) {
  return requestData(API.post("/transactions/withdraw", payload, { withCredentials: true }));
}

export async function getNotifications() {
  return requestData(API.get("/notifications", { withCredentials: true }));
}

export async function markNotificationRead(id) {
  return requestData(API.put(`/notifications/${id}/read`, {}, { withCredentials: true }));
}

export { authEventName };
export default API;
