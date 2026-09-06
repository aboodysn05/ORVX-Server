import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../db/pool.js";

// Creates (or updates) the platform admin account from env vars. The SQL
// migration runner can't read env, so admin provisioning is a script:
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
// Idempotent — safe to re-run.

const name = process.env.ADMIN_NAME || "ORVX Admin";
const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);
const result = await pool.query(
  `INSERT INTO users (name, email, password_hash, role)
   VALUES ($1, $2, $3, 'admin')
   ON CONFLICT (email) DO UPDATE SET
     role = 'admin',
     password_hash = EXCLUDED.password_hash,
     name = EXCLUDED.name
   RETURNING id, email, role`,
  [name, email, passwordHash],
);
console.log("Admin ready:", result.rows[0]);
await pool.end();
