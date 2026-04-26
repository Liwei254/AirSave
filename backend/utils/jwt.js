import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from "./auth.js";

export function signAccessToken(id, role) {
  return jwt.sign({ id, role, type: "access" }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(id) {
  return jwt.sign({ id, type: "refresh" }, process.env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}
