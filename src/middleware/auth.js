import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

// Verifies the `Authorization: Bearer <token>` header and attaches the
// decoded identity as req.user = { id, role } for every layer downstream.
// Deliberately does NOT hit the database — trusting the signature is the
// whole point of a JWT (see auth.service.js's signToken).
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError("Not authenticated.", 401, "UNAUTHORIZED");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    throw new AppError("Invalid or expired token.", 401, "UNAUTHORIZED");
  }
}
