import User from "../models/User.js";
import { ACCESS_COOKIE_NAME, getCookie } from "../utils/auth.js";
import { verifyToken } from "../utils/jwt.js";

function getBearerToken(header = "") {
  if (typeof header !== "string") return "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

const protect = async (req, res, next) => {
  try {
    const bearerToken = getBearerToken(req.headers.authorization || "");
    const cookieToken = getCookie(req, ACCESS_COOKIE_NAME);
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "access") {
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Not authorized" });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Not authorized" });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Role ${req.user?.role || "unknown"} is not authorized` });
    }
    return next();
  };
};

export { protect, authorize };
