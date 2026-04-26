import { matchedData, validationResult } from "express-validator";

export function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0]?.msg || "Invalid request",
      errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    });
  }

  req.validatedData = matchedData(req, {
    locations: ["body", "params", "query"],
    includeOptionals: true,
  });

  return next();
}
