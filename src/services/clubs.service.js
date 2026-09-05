import pool from "../db/pool.js";

export async function listClubs() {
  const result = await pool.query("SELECT id, name, crest_code FROM clubs ORDER BY name");
  return result.rows.map((row) => ({ id: row.id, name: row.name, crestCode: row.crest_code }));
}
