import { AppError } from "../utils/AppError.js";

// Centralized error handler — must be the LAST app.use() in server.js.
// Every route/controller/service reports failure by throwing (an AppError
// for expected cases like "email taken", or letting a genuine bug bubble up)
// instead of formatting its own res.status(...).json(...) — this is the one
// place that decides what an error response looks like on the wire.
export function errorHandler(err, req, res, next) {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";

  // Anything that ISN'T one of our own expected AppErrors is a bug — log it
  // so it's visible during development instead of disappearing into a JSON
  // response nobody reads.
  if (!(err instanceof AppError)) {
    console.error(err);
  }

  res.status(statusCode).json({ error: { message: err.message, code } });
}
