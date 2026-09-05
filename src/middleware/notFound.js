import { AppError } from "../utils/AppError.js";

// Runs only when no route matched at all (wrong path or method) — mounted
// right before errorHandler in server.js.
export function notFound(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, "NOT_FOUND"));
}
