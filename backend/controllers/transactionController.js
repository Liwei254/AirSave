import {
  getPaymentStatus as getPaymentStatusService,
  getSavingsActivity as getSavingsActivityService,
  handlePaymentCallback as handlePaymentCallbackService,
  processWalletPayment,
  submitWithdrawal as submitWithdrawalService,
} from "../services/transactionService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function initiatePayment(req, res, next) {
  try {
    const result = await processWalletPayment(req.user._id, { ...(req.body || {}), ...(req.validatedData || {}) });

    return sendSuccess(res, {
      statusCode: 201,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function handlePaymentCallback(req, res, next) {
  try {
    const result = await handlePaymentCallbackService(req.body);

    return sendSuccess(res, {
      message:
        result.status === "confirmed"
          ? "Payment confirmed and savings posted."
          : "Payment callback processed.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPaymentStatus(req, res, next) {
  try {
    const result = await getPaymentStatusService(req.user._id, req.params.reference);

    return sendSuccess(res, {
      message: "Payment status fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSavingsActivity(req, res, next) {
  try {
    const activity = await getSavingsActivityService(req.user._id);

    return sendSuccess(res, {
      message: "Savings activity fetched successfully",
      data: activity,
    });
  } catch (error) {
    return next(error);
  }
}

export async function submitWithdrawal(req, res, next) {
  try {
    const result = await submitWithdrawalService(req.user._id, { ...(req.body || {}), ...(req.validatedData || {}) });

    return sendSuccess(res, {
      statusCode: 201,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export const simulateTransaction = initiatePayment;
