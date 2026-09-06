import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../db/pool.js";
import { PLATFORM_EVALUATOR_ORG } from "../utils/roles.js";

// Provisions the Platform Evaluator ("Coach #9") from env vars — a coach-role
// user flagged both by organization and by coaches.is_platform_evaluator.
//   EVALUATOR_EMAIL=... EVALUATOR_PASSWORD=... npm run seed:evaluator
// Idempotent.

const name = process.env.EVALUATOR_NAME || "Platform Evaluator";
const email = (process.env.EVALUATOR_EMAIL || "").trim().toLowerCase();
const password = process.env.EVALUATOR_PASSWORD || "";

if (!email || !password) {
  console.error("Set EVALUATOR_EMAIL and EVALUATOR_PASSWORD in the environment.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("EVALUATOR_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const userResult = await client.query(
    `INSERT INTO users (name, email, password_hash, role, organization)
     VALUES ($1, $2, $3, 'coach', $4)
     ON CONFLICT (email) DO UPDATE SET
       role = 'coach',
       organization = EXCLUDED.organization,
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name
     RETURNING id, email`,
    [name, email, passwordHash, PLATFORM_EVALUATOR_ORG],
  );
  const userId = userResult.rows[0].id;
  await client.query(
    `INSERT INTO coaches (user_id, display_name, is_platform_evaluator)
     VALUES ($1, $2, true)
     ON CONFLICT (user_id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       is_platform_evaluator = true`,
    [userId, name],
  );
  await client.query("COMMIT");
  console.log("Platform Evaluator ready:", userResult.rows[0]);
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();
  await pool.end();
}
