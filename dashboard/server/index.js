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
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins.length
      ? (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin '${origin}' not allowed`));
      }
      : true, // allow all when env var is unset
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

// ── Serve React client in production ─────────────────────────────────────────
const clientDist = path.resolve(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, () => {
  console.log(`NetMigrate API server listening on http://localhost:${PORT}`);

  // ── Keep-alive ping every 5 minutes ────────────────────────────────────────
  const HOST = process.env.HOST;
  if (HOST) {
    setInterval(() => {
      fetch(`${HOST}/api/health`)
        .then((r) => console.log(`[keep-alive] /api/health → ${r.status}`))
        .catch((err) => console.error("[keep-alive] ping failed:", err.message));
    }, 5 * 60 * 1000);
  }
});
