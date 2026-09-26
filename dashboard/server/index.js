import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import analysisRouter from "./routes/analysis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
// Analysis data endpoints — reads files from /analysis-output
app.use("/api/analysis", analysisRouter);

// Placeholder for future upload endpoints (not yet implemented)
// app.use("/api/upload", uploadRouter);

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
});
