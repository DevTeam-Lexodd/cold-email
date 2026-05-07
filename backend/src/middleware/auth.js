import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

const JWT_SECRET = env.JWT_SECRET || "coldmail-dev-secret-change-in-production";
const TOKEN_EXPIRY = "7d";

export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export async function verifyAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: { message: "Authentication required" } });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub).select("_id email name");
    if (!user) {
      return res.status(401).json({ error: { message: "User not found" } });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: { message: "Token expired" } });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ error: { message: "Invalid token" } });
    }
    next(err);
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return next();

  const token = header.slice(7);
  jwt.verify(token, JWT_SECRET, async (err, payload) => {
    if (err) return next();
    try {
      req.user = await User.findById(payload.sub).select("_id email name");
    } catch (_) {
      /* ignore */
    }
    next();
  });
}