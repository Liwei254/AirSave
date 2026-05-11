import {
  depositWallet as depositWalletService,
  getTransactionHistory as getTransactionHistoryService,
  getWallet as getWalletService,
} from "../services/walletService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getWallet(req, res, next) {
  try {
    const wallet = await getWalletService(req.user._id);

    return sendSuccess(res, {
      message: "Wallet fetched successfully",
      data: wallet,
    });
  } catch (error) {
    return next(error);
  }
}

export async function depositWallet(req, res, next) {
  try {
    const result = await depositWalletService(req.user._id, { ...(req.body || {}), ...(req.validatedData || {}) }, req.user);

    return sendSuccess(res, {
      statusCode: 201,
      message: result.message,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getTransactionHistory(req, res, next) {
  try {
    const result = await getTransactionHistoryService(req.user._id);

    return sendSuccess(res, {
      message: "Transaction history fetched successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
