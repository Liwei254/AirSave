import User from "../models/User.js";
import { isTokenDenied } from "../services/cacheService.js";
import { sendError } from "../utils/apiResponse.js";
import { ACCESS_COOKIE_NAME, getCookie, hashToken } from "../utils/auth.js";
import { verifyToken } from "../utils/jwt.js";

function getBearerToken(header = "") {
  if (typeof header !== "string") return "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

const protectedUserFields = "_id fullName phone email role roundUpRule wallet status";

const protect = async (req, res, next) => {
  try {
    const bearerToken = getBearerToken(req.headers.authorization || "");
    const cookieToken = getCookie(req, ACCESS_COOKIE_NAME);
    const token = bearerToken || cookieToken;

    if (!token) {
      return sendError(res, { statusCode: 401, message: "Not authorized" });
    }

    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "access") {
      return sendError(res, { statusCode: 401, message: "Invalid or expired token" });
    }

    if (await isTokenDenied(hashToken(token))) {
      return sendError(res, { statusCode: 401, message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.id).select(protectedUserFields);
    if (!user) {
      return sendError(res, { statusCode: 401, message: "Not authorized" });
    }

    req.user = user;
    return next();
  } catch {
    return sendError(res, { statusCode: 401, message: "Not authorized" });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, {
        statusCode: 403,
        message: `Role ${req.user?.role || "unknown"} is not authorized`,
      });
    }
    return next();
  };
};

export { protect, authorize };
