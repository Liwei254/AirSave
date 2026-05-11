import { getDashboardSummary } from "../services/dashboardService.js";
import { sendSuccess } from "../utils/apiResponse.js";

export async function getSummary(req, res, next) {
  try {
    const summary = await getDashboardSummary(req.user._id);

    return sendSuccess(res, {
      message: "Dashboard summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    return next(error);
  }
}
