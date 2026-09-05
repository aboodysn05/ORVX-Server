// A typed error services/controllers throw instead of returning null/false on
// failure. The centralized error middleware (middleware/error.js) reads
// statusCode/code off of this to build a consistent JSON error response.
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
