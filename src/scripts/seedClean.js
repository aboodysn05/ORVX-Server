import "dotenv/config";
import bcrypt from "bcryptjs";
import pool from "../db/pool.js";
import { PLATFORM_EVALUATOR_ORG } from "../utils/roles.js";

// Reset the database to a clean "fresh deploy" state:
//   - every user removed (cascades players / coaches / submissions /
//     memberships / applications), then two staff accounts recreated;
//   - every club removed (cascades matches / goals / memberships /
//     applications) — the admin provisions clubs into the 8 slots after
//     deploy;
//   - the 10 migration-seeded base drills kept and reactivated, any
//     admin-created drills removed;
//   - the two base competitions kept as empty shells (the league and the
//     cup — the admin can rename / re-season them), every match / goal
//     removed.
//
// Credentials come from the environment (falling back to the two names the
// project owner asked for):
//   ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD
//   EVALUATOR_NAME / EVALUATOR_EMAIL / EVALUATOR_PASSWORD
//
//   npm run seed:clean

const adminName = process.env.ADMIN_NAME || "Abdullah Yaseen";
const adminEmail = (process.env.ADMIN_EMAIL || "abdullah.yaseen@orvx.app").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "Orvx-Admin-2026";

const evalName = process.env.EVALUATOR_NAME || "Abdulrahman Hawamdeh";
const evalEmail = (process.env.EVALUATOR_EMAIL || "abdulrahman.hawamdeh@orvx.app")
  .trim()
  .toLowerCase();
const evalPassword = process.env.EVALUATOR_PASSWORD || "Orvx-Eval-2026";

for (const [label, pw] of [
  ["ADMIN_PASSWORD", adminPassword],
  ["EVALUATOR_PASSWORD", evalPassword],
]) {
  if (pw.length < 8) {
    console.error(`${label} must be at least 8 characters.`);
    process.exit(1);
  }
}

const client = await pool.connect();
try {
  await client.query("BEGIN");

  console.log("Wiping users, submissions, memberships, applications…");
  await client.query("DELETE FROM users"); // cascades players/coaches/submissions/memberships/apps

  console.log("Clearing matches + goals, resetting the two base competitions…");
  await client.query("DELETE FROM match_goals");
  await client.query("DELETE FROM matches");
  await client.query("DELETE FROM competitions WHERE id > 2");
  // Normalise the two shells to neutral names — the admin renames / re-seasons
  // them from the console.
  await client.query(
    `UPDATE competitions SET name = 'OVRX League',  season = '2025/26' WHERE type = 'league'`,
  );
  await client.query(
    `UPDATE competitions SET name = 'OVRX Cup',     season = '2025/26' WHERE type = 'knockout'`,
  );

  console.log("Removing every club (cascades any remaining matches / goals)…");
  await client.query("DELETE FROM clubs");

  console.log("Resetting the drill catalogue to the 10 base drills…");
  await client.query("DELETE FROM drills WHERE id > 10");
  await client.query(
    `UPDATE drills SET active = true, coach_display_name = NULL,
       completions_count = 0, rating = 0`,
  );

  console.log("Creating the admin + Platform Evaluator…");
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')`,
    [adminName, adminEmail, adminHash],
  );

  const evalHash = await bcrypt.hash(evalPassword, 10);
  const evalUser = await client.query(
    `INSERT INTO users (name, email, password_hash, role, organization)
     VALUES ($1, $2, $3, 'coach', $4) RETURNING id`,
    [evalName, evalEmail, evalHash, PLATFORM_EVALUATOR_ORG],
  );
  await client.query(
    `INSERT INTO coaches (user_id, display_name, is_platform_evaluator)
     VALUES ($1, $2, true)`,
    [evalUser.rows[0].id, evalName],
  );

  await client.query("COMMIT");

  console.log("\nDatabase reset. No clubs, no matches. Only these two accounts exist:\n");
  console.log(`  ${adminEmail}   (admin · ${adminName})`);
  console.log(`  ${evalEmail}   (Platform Evaluator · ${evalName})`);
  console.log(`\n  admin password:     ${adminPassword}`);
  console.log(`  evaluator password: ${evalPassword}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("seed:clean failed:", err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
