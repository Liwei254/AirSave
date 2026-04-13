import axios from "axios";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  `${window.location.protocol}//${window.location.hostname}:5000/api`;

const API = axios.create({
  baseURL: apiBaseUrl
});

// 🔥 ADD TOKEN TO EVERY REQUEST
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

export async function loginUser(payload) {
  const { data } = await API.post("/auth/login", payload);
  return data;
}

export async function registerUser(payload) {
  const { data } = await API.post("/auth/register", payload);
  return data;
}

export async function getWallet() {
  const { data } = await API.get("/wallet");
  return data;
}

export async function getGoals() {
  const { data } = await API.get("/goals");
  return data;
}

export async function createGoal(payload) {
  const { data } = await API.post("/goals", payload);
  return data;
}

export async function getTransactions() {
  const { data } = await API.get("/wallet/transactions");
  return data.transactions || [];
}

export async function simulateTransaction(payload) {
  const { data } = await API.post("/transactions/simulate", payload);
  return data;
}

export async function getNotifications() {
  const { data } = await API.get("/notifications");
  return data;
}

export async function markNotificationRead(id) {
  const { data } = await API.put(`/notifications/${id}/read`);
  return data;
}

export default API;
