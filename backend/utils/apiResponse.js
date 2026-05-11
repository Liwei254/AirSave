export function sendSuccess(res, { statusCode = 200, message = "Action completed successfully", data = {} } = {}) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? {},
  });
}

export function sendError(res, { statusCode = 500, message = "Server Error", errors = [] } = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [],
  });
}
