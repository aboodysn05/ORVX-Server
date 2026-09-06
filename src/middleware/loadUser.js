import pool from "../db/pool.js";
import { AppError } from "../utils/AppError.js";

// Runs after requireAuth. The JWT only carries { sub, role }, so anything that
// needs the caller's name / organization / coach identity loads the row here
// and attaches it as req.currentUser. Kept separate from requireAuth so the
// hot player routes stay a pure signature check with no DB hit.
export async function attachCurrentUser(req, res, next) {
  const result = await pool.query(
    `SELECT
       u.id, u.name, u.email, u.role, u.organization,
       c.id AS coach_id,
       COALESCE(c.is_platform_evaluator, false) AS is_platform_evaluator,
       c.display_name AS coach_display_name
     FROM users u
     LEFT JOIN coaches c ON c.user_id = u.id
     WHERE u.id = $1`,
    [req.user.id],
  );

  const row = result.rows[0];
  if (!row) {
    throw new AppError("Account no longer exists.", 401, "USER_NOT_FOUND");
  }

  req.currentUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    organization: row.organization,
    coachId: row.coach_id,
    isPlatformEvaluator: row.is_platform_evaluator,
    coachDisplayName: row.coach_display_name,
  };
  next();
}
