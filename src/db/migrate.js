import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pool from "./pool.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await pool.query("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    console.log(`Applying ${file}...`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      throw err;
    }
  }

  console.log("Migrations up to date.");
  await pool.end();
}

run().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
