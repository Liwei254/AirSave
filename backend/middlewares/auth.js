import User from "../models/User.js";
import { verifyToken } from "../utils/jwt.js";
import { ACCESS_COOKIE_NAME, getCookie } from "../utils/auth.js";

const protect = async (req, res, next) => {
  let token = "";

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    token = getCookie(req, ACCESS_COOKIE_NAME);
  }

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
