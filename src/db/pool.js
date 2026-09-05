import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// A shared connection pool, not a single Client (see server.js / step notes) —
// this lets multiple concurrent requests each get their own connection
// instead of queuing behind one shared connection.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// A pooled connection can go bad while just sitting idle (network blip,
// Postgres restart). Without this handler, that error is unhandled and
// crashes the whole process — this just logs it so the pool can recover.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client", err);
});

export default pool;
