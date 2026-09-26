import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import analysisRouter from "./routes/analysis.js";
import uploadRouter from "./routes/upload.js";
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? (() => {
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(process.env.ALLOWED_ORIGINS);
      if (Array.isArray(parsed)) return parsed;
      // If not array, fallback to comma split
      return process.env.ALLOWED_ORIGINS.split(",");
    } catch {
      // If not JSON, fallback to comma split
      return process.env.ALLOWED_ORIGINS.split(",");
    }
  })()
  : ["https://netmigrate.onrender.com", "http://localhost:5173"];

console.log("ALLOWED_ORIGINS: ", ALLOWED_ORIGINS)
app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    origin: ALLOWED_ORIGINS,
    //credentials: true,
  })
);
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
// Analysis data endpoints — reads files from /analysis-output
app.use("/api/analysis", analysisRouter);

// Upload & analyze your own code
app.use("/api/upload", uploadRouter);

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`NetMigrate API server listening on http://localhost:${PORT}`);

  // ── Keep-alive ping every 5 minutes ────────────────────────────────────────
  // const HOST = process.env.HOST;
  // if (HOST) {
  //   setInterval(() => {
  //     fetch(`${HOST}/api/health`)
  //       .then((r) => console.log(`[keep-alive] /api/health → ${r.status}`))
  //       .catch((err) => console.error("[keep-alive] ping failed:", err.message));
  //   }, 5 * 60 * 1000);
  // }
});
