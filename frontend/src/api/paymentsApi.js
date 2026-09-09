import { getPaymentStatus, initiatePayment, submitWithdrawal } from "../services/api";

export function fetchPaymentStatus(reference) {
  return getPaymentStatus(reference);
}

export function sendMoney(payload) {
  return initiatePayment({
    ...payload,
    transactionType: payload.transactionType || "send",
  });
}

export function buyGoods(payload) {
  return initiatePayment({
    ...payload,
    transactionType: payload.transactionType || "purchase",
  });
}

export function paybill(payload) {
  return initiatePayment({
    ...payload,
    transactionType: payload.transactionType || "bill",
  });
}

export function buyAirtime(payload) {
  return initiatePayment({ ...payload, transactionType: "airtime" });
}

export function withdraw(payload) {
  return submitWithdrawal(payload);
}

