import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

const API = axios.create({
  baseURL: apiBaseUrl
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

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
  return requestData(API.post("/auth/login", payload));
}

export async function registerUser(payload) {
  return requestData(API.post("/auth/register", payload));
}

export async function getWallet() {
  return requestData(API.get("/wallet"));
}

export async function getGoals() {
  return requestData(API.get("/goals"));
}

export async function createGoal(payload) {
  return requestData(API.post("/goals", payload));
}

export async function getTransactions() {
  return requestData(API.get("/wallet/transactions"), (data) => data.transactions || []);
}

export async function getSavingsActivity() {
  return requestData(API.get("/transactions/activity"));
}

export async function initiatePayment(payload) {
  return requestData(API.post("/transactions/payments/initiate", payload), (data) => ({
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
  return requestData(API.get(`/transactions/payments/${reference}`));
}

export async function submitWithdrawal(payload) {
  return requestData(API.post("/transactions/withdraw", payload));
}

export async function getNotifications() {
  return requestData(API.get("/notifications"));
}

export async function markNotificationRead(id) {
  return requestData(API.put(`/notifications/${id}/read`));
}

export default API;
