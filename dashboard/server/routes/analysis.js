import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config"

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// /analysis-output is two levels up from dashboard/server/routes/
const ANALYSIS_DIR = process.env.ANALYSIS_DIR
  ? path.resolve(process.env.ANALYSIS_DIR)
  : path.resolve(__dirname, "../../../analysis-output");

const router = Router();

/** Reads a file from the analysis output directory safely. */
function readAnalysisFile(filename) {
  const filePath = path.join(ANALYSIS_DIR, filename);
  // Guard against path traversal
  if (!filePath.startsWith(ANALYSIS_DIR)) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  if (!fs.existsSync(filePath)) {
    const err = new Error(`File not found: ${filename}`);
    err.status = 404;
    throw err;
  }
  return fs.readFileSync(filePath, "utf-8");
}

/** Reads all files in a sub-directory of analysis-output. */
function readSampleDir(sampleName) {
  const dir = path.join(ANALYSIS_DIR, "modernized-samples", sampleName);
  if (!fs.existsSync(dir)) {
    const err = new Error(`Sample not found: ${sampleName}`);
    err.status = 404;
    throw err;
  }
  return {
    name: sampleName,
    before: fs.readFileSync(path.join(dir, "before.cs"), "utf-8"),
    after: fs.readFileSync(path.join(dir, "after.cs"), "utf-8"),
    rationale: fs.readFileSync(path.join(dir, "rationale.md"), "utf-8"),
  };
}

// ── GET /api/analysis/codebase-explanation ────────────────────────────────
router.get("/codebase-explanation", (_req, res, next) => {
  try {
    const data = JSON.parse(readAnalysisFile("codebase-explanation.json"));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/migration-plan ─────────────────────────────────────
router.get("/migration-plan", (_req, res, next) => {
  try {
    const data = JSON.parse(readAnalysisFile("migration-plan.json"));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/security-findings ──────────────────────────────────
router.get("/security-findings", (_req, res, next) => {
  try {
    const data = JSON.parse(readAnalysisFile("security-findings.json"));
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/dependency-graph ───────────────────────────────────
router.get("/dependency-graph", (_req, res, next) => {
  try {
    const mmd = readAnalysisFile("dependency-graph.mmd");
    res.type("text/plain").send(mmd);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/modernized-samples ─────────────────────────────────
// Returns a list of available sample directory names
router.get("/modernized-samples", (_req, res, next) => {
  try {
    const samplesDir = path.join(ANALYSIS_DIR, "modernized-samples");
    const entries = fs
      .readdirSync(samplesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/modernized-samples/:name ───────────────────────────
router.get("/modernized-samples/:name", (req, res, next) => {
  try {
    const safe = path.basename(req.params.name); // strip any path components
    const sample = readSampleDir(safe);
    res.json(sample);
  } catch (err) {
    next(err);
  }
});

// ── Error handler ─────────────────────────────────────────────────────────
router.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message });
});

export default router;
