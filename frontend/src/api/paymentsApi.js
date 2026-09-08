import { getPaymentStatus, initiatePayment, submitWithdrawal } from "../services/api";
import API from "../services/api";

export function fetchPaymentStatus(reference) { return getPaymentStatus(reference); }
export function sendMoney(payload) { return initiatePayment({ ...payload, transactionType: payload.transactionType || "send" }); }
export function buyGoods(payload) { return initiatePayment({ ...payload, transactionType: payload.transactionType || "purchase" }); }
export function buyAirtime(payload) {
  return API.post("/transactions/airtime", payload, { withCredentials: true }).then(({ data }) => {
    const result = data?.success && Object.prototype.hasOwnProperty.call(data, "data") ? data.data : data;
    return { ...result, status: result?.status || "pending", paymentReference: result?.paymentReference || result?.reference || null };
  });
}
export function paybill(payload) { return initiatePayment({ ...payload, transactionType: payload.transactionType || "bill" }); }
export function withdraw(payload) { return submitWithdrawal(payload); }
