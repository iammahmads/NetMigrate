/**
 * POST /api/upload/analyze
 *
 * Accepts a .zip file (max 10 MB), validates that it contains only
 * .cs / .csproj / .sln / .config / .json files, extracts to a unique
 * temporary directory, runs the four Bob-shell analysis prompts against
 * that directory, and returns the results in the same schema used by
 * /analysis-output.
 *
 * Security notes:
 *  - Zip entries are validated BEFORE any extraction begins.
 *  - No code from the zip is ever executed — Bob Shell performs static
 *    analysis only (non-interactive mode, no --yolo flag).
 *  - The temp directory is deleted in a finally block regardless of
 *    success or failure.
 */

import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ANALYSIS_TIMEOUT_MS = 90_000; // 90 s per Bob call
const ALLOWED_EXTENSIONS = new Set([".cs", ".csproj", ".sln", ".config", ".json"]);

// ── Rate limiter (in-memory, per IP, 3 requests per hour) ───────────────────

/** @type {Map<string, number[]>} IP → sorted list of request timestamps (ms) */
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 3;

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;
  const timestamps = (rateLimitMap.get(ip) || []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_MAX) {
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
}

// ── Multer — memory storage so we can inspect before writing ─────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only .zip files are accepted."));
    }
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the lowercase extension of a zip entry name, e.g. ".cs" */
function entryExt(entryName) {
  return path.extname(entryName).toLowerCase();
}

/**
 * Validates every entry in the zip buffer.
 * Throws an error describing the first violation found.
 */
function validateZipEntries(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  for (const entry of entries) {
    // Skip pure directory entries
    if (entry.isDirectory) continue;

    const name = entry.entryName;

    // Block path-traversal attempts
    const normalised = path.normalize(name);
    if (normalised.startsWith("..") || path.isAbsolute(normalised)) {
      throw Object.assign(new Error(`Rejected: suspicious path in zip: ${name}`), {
        status: 400,
      });
    }

    const ext = entryExt(name);
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw Object.assign(
        new Error(
          `Rejected: file "${name}" has disallowed extension "${ext}". ` +
            `Only .cs, .csproj, .sln, .config, and .json files are permitted.`
        ),
        { status: 400 }
      );
    }
  }

  return zip; // Return the parsed zip for extraction
}

/**
 * Extracts the (already validated) zip to a unique temp directory.
 * Returns the temp directory path.
 */
function extractToTemp(zip) {
  const tmpDir = path.join(os.tmpdir(), `netmigrate-${randomUUID()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  zip.extractAllTo(tmpDir, /*overwrite=*/ true);
  return tmpDir;
}

/**
 * Runs `bob -p "<prompt>"` with cwd set to tmpDir and a 90-second timeout.
 * Returns the trimmed stdout string.
 */
async function runBob(prompt, cwd) {
  const { stdout } = await execFileAsync("bob", ["-p", prompt], {
    cwd,
    timeout: ANALYSIS_TIMEOUT_MS,
    maxBuffer: 8 * 1024 * 1024, // 8 MB output buffer
    env: { ...process.env },
  });
  return stdout.trim();
}

/**
 * Extracts the first fenced JSON block from Bob's output, or falls back to
 * parsing the entire string.
 */
function parseJsonFromOutput(output) {
  const fenceMatch = output.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : output;
  return JSON.parse(raw);
}

/**
 * Extracts the first fenced Mermaid block, or returns the raw output as-is.
 */
function extractMermaid(output) {
  const fenceMatch = output.match(/```(?:mermaid)?\s*([\s\S]*?)```/);
  return fenceMatch ? fenceMatch[1].trim() : output;
}

// ── Bob analysis prompts ──────────────────────────────────────────────────────

const PROMPT_CODEBASE = `
Analyze the .NET codebase in the current directory. Identify every module
(controllers, models, services, configuration files, etc.).

Return ONLY a JSON array — no prose, no markdown except the code fence.
Each element must have exactly these fields:
  "module"              : short name
  "purpose"             : one sentence
  "connections"         : array of module names this one depends on
  "plain_english_summary": 2-3 sentence plain-English description

Example structure (replace with real data):
\`\`\`json
[
  {
    "module": "OrdersController",
    "purpose": "Handles HTTP requests for order operations.",
    "connections": ["IOrderService", "AppDbContext"],
    "plain_english_summary": "This controller routes incoming web requests..."
  }
]
\`\`\`
`.trim();

const PROMPT_DEPENDENCY_GRAPH = `
Analyze the .NET codebase in the current directory and produce a Mermaid
dependency graph.

Rules:
- Use \`flowchart LR\` direction.
- Every node label MUST include one of: HIGH, MEDIUM, or LOW (uppercase) based
  on migration risk to .NET 8.
  HIGH   = depends on System.Web, System.Web.Mvc, WCF, or other APIs removed in .NET 8.
  MEDIUM = depends on EF6, log4net 1.x, or APIs with a clear migration path.
  LOW    = pure POCOs / interfaces with no framework-specific ties.
- Draw an arrow A --> B when A depends on B.
- No double quotes inside bracket labels.
- Return ONLY the fenced Mermaid block — no prose.

\`\`\`mermaid
flowchart LR
  ...
\`\`\`
`.trim();

const PROMPT_MIGRATION_PLAN = `
Analyze the .NET codebase in the current directory and produce a migration plan.

Return ONLY a fenced JSON object — no prose.
Top-level keys: "summary" and "modules".

"summary":
  "total_estimated_effort": string describing overall effort
  "high_risk_count": number
  "low_risk_count": number

"modules" is an array. Each element:
  "module_name"            : string
  "risk_tier"              : "LOW" | "MEDIUM" | "HIGH"  (uppercase only)
  "effort_estimate"        : "small" | "medium" | "large" (lowercase only)
  "recommended_replacement": string
  "migration_order"        : integer (1 = migrate first)
  "needs_verification"     : boolean

\`\`\`json
{ "summary": {...}, "modules": [...] }
\`\`\`
`.trim();

const PROMPT_SECURITY = `
Audit the .NET codebase in the current directory for security vulnerabilities.

Return ONLY a fenced JSON array — no prose.
Each finding:
  "file"              : relative path
  "line"              : line number (integer, 0 if unknown)
  "issue"             : short description
  "severity"          : "low" | "medium" | "high"  (lowercase only)
  "relevant_standard" : e.g. "OWASP A03:2021", "CWE-89", "NIST SP 800-53"

\`\`\`json
[...]
\`\`\`
`.trim();

// ── Route ────────────────────────────────────────────────────────────────────

router.post(
  "/analyze",
  upload.single("zipfile"),
  async (req, res) => {
    // Rate limit by IP
    const ip = req.ip || "unknown";
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error:
          "Rate limit exceeded. You may perform at most 3 analyses per hour. Please try again later.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No zip file provided. Upload a field named 'zipfile'." });
    }

    // Validate zip contents BEFORE extraction
    let zip;
    try {
      zip = validateZipEntries(req.file.buffer);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }

    // Extract to temp dir
    let tmpDir;
    try {
      tmpDir = extractToTemp(zip);
    } catch (err) {
      return res.status(500).json({ error: `Failed to extract zip: ${err.message}` });
    }

    try {
      // Run the four analysis prompts in sequence (Bob Shell is stateless per call)
      const [codebaseRaw, dependencyRaw, migrationRaw, securityRaw] = await Promise.all([
        runBob(PROMPT_CODEBASE, tmpDir).catch((e) => {
          throw Object.assign(e, { step: "codebase-explanation" });
        }),
        runBob(PROMPT_DEPENDENCY_GRAPH, tmpDir).catch((e) => {
          throw Object.assign(e, { step: "dependency-graph" });
        }),
        runBob(PROMPT_MIGRATION_PLAN, tmpDir).catch((e) => {
          throw Object.assign(e, { step: "migration-plan" });
        }),
        runBob(PROMPT_SECURITY, tmpDir).catch((e) => {
          throw Object.assign(e, { step: "security-findings" });
        }),
      ]);

      // Parse outputs
      const codebaseExplanation = parseJsonFromOutput(codebaseRaw);
      const dependencyGraph = extractMermaid(dependencyRaw);
      const migrationPlan = parseJsonFromOutput(migrationRaw);
      const securityFindings = parseJsonFromOutput(securityRaw);

      return res.json({
        "codebase-explanation": codebaseExplanation,
        "dependency-graph": dependencyGraph,
        "migration-plan": migrationPlan,
        "security-findings": securityFindings,
      });
    } catch (err) {
      const isTimeout = err.killed || (err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER");
      if (isTimeout || err.message?.includes("timeout")) {
        return res.status(504).json({
          error: `Analysis timed out after 90 seconds${err.step ? ` (step: ${err.step})` : ""}. Please try with a smaller codebase.`,
        });
      }
      console.error("[upload/analyze] error:", err);
      return res.status(500).json({
        error: `Analysis failed${err.step ? ` at step "${err.step}"` : ""}: ${err.message}`,
      });
    } finally {
      // Always delete the temp directory
      if (tmpDir) {
        fs.rm(tmpDir, { recursive: true, force: true }, () => {});
      }
    }
  }
);

// Multer error handler (e.g. file too large)
router.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File exceeds the 10 MB limit." });
  }
  const status = err.status || 500;
  return res.status(status).json({ error: err.message });
});

export default router;
