import express from "express";
import cors from "cors";
import "dotenv/config";
import pool from "./db/pool.js";
import routes from "./routes/index.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/error.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS db_time");
    res.json({ status: "ok", db: "connected", dbTime: result.rows[0].db_time });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected", message: err.message });
  }
});

app.use("/api", routes);

// Order matters: notFound catches anything no route above matched, then
// errorHandler is the single place that formats every error as JSON — both
// must be the LAST two app.use() calls.
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ORVX-Server listening on port ${PORT}`);
});
