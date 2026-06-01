import { checkPostgresHealth } from "../services/postgresHealthService.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";

export async function getPostgresHealth(req, res, next) {
  try {
    const health = await checkPostgresHealth();

    if (!health.ok) {
      return sendError(res, {
        statusCode: 503,
        message: "PostgreSQL health check failed",
        errors: [health],
      });
    }

    return sendSuccess(res, {
      message: "PostgreSQL health check passed",
      data: health,
    });
  } catch (error) {
    return sendError(res, {
      statusCode: 503,
      message: "PostgreSQL health check failed",
      errors: [{ message: error.message }],
    });
  }
}
