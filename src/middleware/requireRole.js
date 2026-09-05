import { AppError } from "../utils/AppError.js";

// Must run after requireAuth (needs req.user). Raises the 403 here, before
// the controller runs, rather than deep inside a service.
export function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("You don't have permission to do that.", 403, "FORBIDDEN");
    }
    next();
  };
}
