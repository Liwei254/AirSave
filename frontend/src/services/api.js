import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

axios.defaults.withCredentials = true;

const API = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

let refreshPromise = null;

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const requestUrl = originalRequest?.url || "";

    const shouldSkipRefresh =
      !originalRequest ||
      originalRequest._retry ||
      status !== 401 ||
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/refresh");

    if (shouldSkipRefresh) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = API.post("/auth/refresh", {}, { withCredentials: true }).finally(() => {
          refreshPromise = null;
        });
      }

      await refreshPromise;
      return API({ ...originalRequest, withCredentials: true });
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
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

export async function loginUser(payload) {
  return requestData(API.post("/auth/login", payload, { withCredentials: true }));
}

export async function registerUser(payload) {
  return requestData(API.post("/auth/register", payload, { withCredentials: true }));
}

export async function logoutUser() {
  return requestData(API.post("/auth/logout", {}, { withCredentials: true }));
}

export async function getCurrentUser() {
  return requestData(API.get("/auth/me", { withCredentials: true }), (data) => data.user || null);
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

export async function createGoal(payload) {
  return requestData(API.post("/goals", payload, { withCredentials: true }));
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

export default API;
