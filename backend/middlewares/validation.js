import { matchedData, validationResult } from "express-validator";
import { sendError } from "../utils/apiResponse.js";

export function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const readableErrors = errors.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    }));

    return sendError(res, {
      statusCode: 400,
      message: readableErrors[0]?.message || "Invalid request",
      errors: readableErrors,
    });
  }

  req.validatedData = matchedData(req, {
    locations: ["body", "params", "query"],
    includeOptionals: false,
  });

  return next();
}
