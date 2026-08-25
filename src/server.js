import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ error: { message: err.message, code: err.code } });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`ORVX-Server listening on port ${PORT}`);
});
