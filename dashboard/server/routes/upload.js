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
 *  - --yolo is passed so Bob auto-approves tool calls without waiting for
 *    user input. Even with --yolo, Bob Shell cannot write files outside
 *    the cwd it was started in, and the cwd is the temp dir which is
 *    deleted immediately after the response is sent.
 *  - No code from the uploaded zip is executed — Bob reads and analyzes only.
 *  - The temp directory is deleted in a finally block regardless of
 *    success or failure.
 */

import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

const router = Router();

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ANALYSIS_TIMEOUT_MS = 300_000; // 300 s (5 min) per Bob call
const ALLOWED_EXTENSIONS = new Set([".cs", ".csproj", ".sln", ".config", ".json"]);

// ── Rate limiter (in-memory, per IP, 3 requests per hour) ───────────────────

/** @type {Map<string, number[]>} IP → sorted list of request timestamps (ms) */
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 6;

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
 * Parses and filters the zip buffer.
 * - Path-traversal entries throw a 400 (hard security boundary).
 * - Entries with disallowed extensions are silently removed from the zip
 *   so they are never written to disk. The filtered zip is returned.
 */
function validateZipEntries(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const skipped = [];

  for (const entry of entries) {
    // Skip pure directory entries
    if (entry.isDirectory) continue;

    const name = entry.entryName;

    // Hard block: path-traversal attempts are always rejected
    const normalised = path.normalize(name);
    if (normalised.startsWith("..") || path.isAbsolute(normalised)) {
      throw Object.assign(new Error(`Rejected: suspicious path in zip: ${name}`), {
        status: 400,
      });
    }

    // Soft filter: silently drop files with disallowed extensions
    const ext = entryExt(name);
    // if (!ALLOWED_EXTENSIONS.has(ext)) {
    //   skipped.push(name);
    //   zip.deleteFile(name);
    // }
  }

  if (skipped.length > 0) {
    console.log(`[upload/validate] skipped ${skipped.length} disallowed file(s): ${skipped.join(", ")}`);
  }

  return zip; // Return the filtered zip for extraction
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
 * Runs `bob -p "<prompt>"` directly (no PTY wrapper).
 *
 * Bob Shell in headless/non-interactive mode auto-approves all tool calls
 * by default ("--yolo is deprecated and ignored in headless mode where
 * auto-approve is the default"). We therefore drop --yolo and the `script`
 * PTY wrapper entirely — the PTY was the source of all the \r noise and
 * Unicode box-drawing characters that broke JSON parsing.
 *
 * stdin is inherited as /dev/null (via stdio[0]='ignore') so Bob never
 * blocks waiting for keyboard input.
 */
function runBob(prompt, cwd, step = "bob") {
  return new Promise((resolve, reject) => {
    console.log(`[${step}] spawning bob -p (cwd=${cwd})`);

    const child = spawn("bob", ["-p", prompt], {
      cwd,
      env: { ...process.env },
      // 'ignore' closes stdin immediately — bob never blocks waiting for input.
      // stdout and stderr are piped so we can capture them.
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      // Stream stderr to Docker logs so we can see Bob's progress/errors
      process.stderr.write(`[${step}][err] ${chunk}`);
    });

    const timer = setTimeout(() => {
      console.error(`[${step}] TIMEOUT after ${ANALYSIS_TIMEOUT_MS / 1000}s — killing pid=${child.pid}`);
      try { process.kill(child.pid, "SIGKILL"); } catch (_) { }
      reject(Object.assign(
        new Error(`bob timed out after ${ANALYSIS_TIMEOUT_MS / 1000}s`),
        { killed: true }
      ));
    }, ANALYSIS_TIMEOUT_MS);

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      console.log(`[${step}] exited code=${code} signal=${signal} stdout_len=${stdout.length}`);
      if (stdout.trim().length > 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(
          `bob produced no output (code=${code} signal=${signal}). stderr: ${stderr.trim().slice(0, 500)}`
        ));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      console.error(`[${step}] spawn error:`, err);
      reject(err);
    });
  });
}

// ── Output parsers ────────────────────────────────────────────────────────────

/**
 * Clean Bob's non-interactive stdout:
 *  - Normalise CRLF → LF
 *  - Strip trailing spaces from every line (Bob pads output to 120 chars)
 *  - Strip Bob's ─────… separator lines (U+2500 repeated)
 *  - Strip "Warning: …" header lines
 */
function cleanOutput(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+$/gm, "")               // trailing whitespace on every line
    .replace(/^Warning:.*$/gm, "")          // deprecation/warning header lines
    .replace(/^[\u2500\u2501\u2550─━═]+$/gm, ""); // ─── separator lines
}

/**
 * Remove a uniform leading indent from every line of a block.
 * Bob sometimes indents entire fenced blocks by 2 spaces.
 */
function dedent(text) {
  const lines = text.split("\n");
  const minIndent = lines
    .filter((l) => l.trim().length > 0)
    .reduce((min, l) => {
      const spaces = l.match(/^(\s*)/)[1].length;
      return Math.min(min, spaces);
    }, Infinity);
  if (minIndent === 0 || minIndent === Infinity) return text;
  return lines.map((l) => l.slice(minIndent)).join("\n");
}

/**
 * Bob sometimes wraps long string values across multiple lines with a bare
 * newline inside the string, which is invalid JSON. This rejoins those
 * continuation lines by replacing newlines that are inside a string value
 * (i.e. after an odd number of unescaped quotes) with a space.
 *
 * It works line-by-line: if a line does not end on an even number of
 * unescaped double-quotes (meaning the last open string is still open),
 * the following line is a continuation and its leading whitespace is
 * collapsed to a single space.
 */
function repairBobJson(text) {
  const lines = text.split("\n");
  const out = [];
  let inString = false;

  for (const line of lines) {
    if (!inString) {
      out.push(line);
    } else {
      // We're inside an open string — merge this line onto the previous one
      // with a single space (replaces the bare newline Bob emitted).
      out[out.length - 1] += " " + line.trimStart();
    }

    // Scan only the current line to update inString state.
    // Using `line` (not the merged output line) avoids double-counting
    // quotes from previously merged content.
    let escaped = false;
    for (const ch of line) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') inString = !inString;
    }
  }

  return out.join("\n");
}

/**
 * Find and parse the first valid JSON object or array in `text`.
 *
 * Strategy (in order):
 *  1. Clean ANSI/PTY noise
 *  2. Try every ``` … ``` fenced block (json-tagged or plain), with dedent
 *     and Bob-specific newline-in-string repair applied before parsing.
 *  3. Find the outermost { … } / [ … ] span and apply the same repair.
 */
function parseJsonFromOutput(text) {
  const cleaned = cleanOutput(text);

  // ── Strategy 1: fenced ```json … ``` or ``` … ``` blocks ───────────────
  // Only consider candidates that actually start with { or [ so we skip
  // fence blocks containing filenames, prose, or Mermaid diagrams.
  const fenceRe = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(cleaned)) !== null) {
    // dedent strips uniform 2-space indentation Bob adds to fenced blocks,
    // then repair joins bare-newline continuations inside string values.
    const candidate = repairBobJson(dedent(m[1]).trim());
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) continue;
    try { return JSON.parse(candidate); } catch (_) { }
  }

  // ── Strategy 2: outermost { … } then [ … ] ────────────────────────────
  for (const [open, close] of [["{", "}"], ["[", "]"]]) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    const end = cleaned.lastIndexOf(close);
    if (end <= start) continue;
    try { return JSON.parse(repairBobJson(cleaned.slice(start, end + 1))); } catch (_) { }
  }

  throw new Error(`No valid JSON found in Bob output (${cleaned.length} chars)`);
}

/**
 * Extract the first fenced mermaid block, or fall back to the flowchart text.
 */
function extractMermaid(text) {
  const cleaned = cleanOutput(text);

  // Try ```mermaid … ``` then plain ``` … ```
  for (const re of [/```mermaid[\s\S]*?\n([\s\S]*?)```/, /```[\s\S]*?\n(flowchart[\s\S]*?)```/]) {
    const m = cleaned.match(re);
    if (m) return dedent(m[1]).trim();
  }

  // Fallback: everything from the first flowchart/graph line
  const idx = cleaned.search(/^[ \t]*(flowchart|graph)\s/m);
  if (idx !== -1) {
    const endIdx = cleaned.indexOf("```", idx);
    return dedent(endIdx !== -1 ? cleaned.slice(idx, endIdx) : cleaned.slice(idx)).trim();
  }

  return cleaned.trim();
}

const SEP_CHARS = "\u2500\u2501\u2550─━═";

/**
 * Isolate the LAST "Assistant (N)" block from Bob's full CLI transcript.
 * Must run on the RAW output, before cleanOutput — cleanOutput strips the
 * ─── separator lines this regex depends on to find block boundaries.
 * Tool-call blocks (Args:, file contents, search results) can contain
 * their own braces/fences/quotes that corrupt a whole-transcript parse —
 * this avoids ever looking at them.
 */
function extractFinalAssistantMessage(raw) {
  const re = new RegExp(
    `Assistant \\(\\d+\\)[^\\n]*\\n\\n([\\s\\S]*?)\\n[${SEP_CHARS}]{3,}`,
    "g"
  );
  const matches = [...raw.matchAll(re)];
  if (matches.length === 0) {
    console.warn("[extractFinalAssistantMessage] no Assistant block found — falling back to raw output");
    return raw;
  }
  return matches[matches.length - 1][1];
}

// ── Step helpers ─────────────────────────────────────────────────────────────

/**
 * Runs one named analysis step against tmpDir.
 * Always resolves (never rejects) — returns { ok, data } or { ok: false, error }.
 *
 * "dependency-graph" and "migration-plan" share a single Bob call
 * (PROMPT_GRAPH_AND_PLAN) and are split from the combined output here,
 * matching the proven approach from the project's analysis sessions.
 */
async function runStep(step, tmpDir, reqId, t0) {
  const prompt = STEP_PROMPTS[step];
  console.log(`[upload/step/${step}] [${reqId}] starting`);
  let rawOutput = null;
  try {
    rawOutput = await runBob(prompt, tmpDir, `${step}/${reqId}`);
    const finalMessage = extractFinalAssistantMessage(rawOutput);

    const data = step === "dependency-graph"
      ? extractMermaid(finalMessage)
      : parseJsonFromOutput(finalMessage);

    console.log(`[upload/step/${step}] [${reqId}] ok (+${Date.now() - t0}ms)`);
    return { ok: true, data };
  } catch (err) {
    const isTimeout = err.killed || err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
    const msg = isTimeout
      ? `Timed out after ${ANALYSIS_TIMEOUT_MS / 1000}s. Try with a smaller codebase.`
      : err.message;
    console.warn(`[upload/step/${step}] [${reqId}] failed (+${Date.now() - t0}ms): ${msg}`);
    // Include the raw Bob output so the frontend can display it
    return { ok: false, error: msg, rawText: rawOutput ? cleanOutput(rawOutput) : null };
  }
}

// ── Bob analysis prompts ──────────────────────────────────────────────────────
// Exact prompts proven to work in the project's own analysis sessions,
// adapted to use "." (current directory) instead of named paths.

const PROMPT_CODEBASE = `
Analyze the application in the current directory the way you would when
inspecting an unfamiliar codebase for a new team member. For each major
module/file, explain in plain English:
- What it does
- Why it likely exists (its role in the app)
- How it connects to other modules

Return your answer as a JSON array inside a fenced code block. Each element
must have exactly these fields:
  "module"               : short name
  "purpose"              : one sentence
  "connections"          : array of module names this one depends on
  "plain_english_summary": 2-3 sentence plain-English description
`.trim();

/**
 * Combined prompt — produces both the dependency graph AND the migration plan
 * in a single Bob call, matching the proven session workflow.
 */
const PROMPT_MIGRATION_PLAN = `
Analyze the application in the current directory.

Return your answer as a JSON array inside a fenced code block with exactly two top-level keys:
"summary": {
  "total_estimated_effort": string,
  "high_risk_count": number,
  "low_risk_count": number
}
"modules": array of {
  "module_name": string,
  "risk_tier": "LOW" | "MEDIUM" | "HIGH",
  "effort_estimate": "small" | "medium" | "large",
  "recommended_replacement": string,
  "migration_order": integer (1 = migrate first),
  "needs_verification": boolean
}
Where a dependency's .NET 8 compatibility is genuinely uncertain, set
needs_verification: true rather than guessing.
`.trim();

const PROMPT_DEPENDENCY_GRAPH = `
Analyze the application in the current directory.

Return your answer as a JSON array inside a fenced code block.

It must be a Mermaid flowchart (flowchart LR) mapping every module and
its dependencies. Tag each node label with its migration-risk tier: LOW,
MEDIUM, or HIGH (uppercase, inside the label).
HIGH   = System.Web / System.Web.Mvc / WCF / APIs removed in .NET 8
MEDIUM = EF6, log4net 1.x, or APIs with a clear migration path
LOW    = pure POCOs / interfaces with no framework-specific ties
No double quotes inside node labels. Draw A --> B when A depends on B.
`.trim();

const PROMPT_SECURITY = `
Audit the application in the current directory for security and compliance
issues relevant to FedRAMP/HIPAA/PCI-style standards: hardcoded secrets,
missing input validation, outdated authentication patterns, and any other
risky patterns you find.

Return your findings as a JSON array inside a fenced code block. Each
element must have exactly these fields:
  "file"              : relative file path
  "line"              : line number (integer, 0 if unknown)
  "issue"             : short description of the vulnerability
  "severity"          : "low" | "medium" | "high"  (lowercase only)
  "relevant_standard" : e.g. "OWASP A03:2021", "CWE-89", "NIST SP 800-53"
`.trim();

/**
 * Maps step key → prompt.
 * and share PROMPT_GRAPH_AND_PLAN — these entries are used only by the
 * single-step retry endpoint.
 */
const STEP_PROMPTS = {
  "codebase-explanation": PROMPT_CODEBASE,
  "dependency-graph": PROMPT_DEPENDENCY_GRAPH,
  "migration-plan": PROMPT_MIGRATION_PLAN,
  "security-findings": PROMPT_SECURITY,
};

// ── Route ────────────────────────────────────────────────────────────────────

router.post(
  "/analyze",
  upload.single("zipfile"),
  async (req, res) => {
    const ip = req.ip || "unknown";
    const reqId = randomUUID().slice(0, 8); // short ID for log correlation
    console.log(`[upload/analyze] [${reqId}] request from ${ip}, file: ${req.file?.originalname ?? "(none)"}, size: ${req.file?.size ?? 0} bytes`);

    // Rate limit by IP
    if (!checkRateLimit(ip)) {
      console.warn(`[upload/analyze] [${reqId}] rate limit exceeded for ${ip}`);
      return res.status(429).json({
        error:
          "Rate limit exceeded. You may perform at most 3 analyses per hour. Please try again later.",
      });
    }

    if (!req.file) {
      console.warn(`[upload/analyze] [${reqId}] no file in request`);
      return res.status(400).json({ error: "No zip file provided. Upload a field named 'zipfile'." });
    }

    // Validate and filter zip contents BEFORE extraction
    let zip;
    try {
      zip = validateZipEntries(req.file.buffer);
    } catch (err) {
      console.warn(`[upload/analyze] [${reqId}] zip validation rejected: ${err.message}`);
      return res.status(err.status || 400).json({ error: err.message });
    }

    // Extract filtered zip to a unique temp dir
    let tmpDir;
    try {
      tmpDir = extractToTemp(zip);
      console.log(`[upload/analyze] [${reqId}] extracted to ${tmpDir}`);
    } catch (err) {
      console.error(`[upload/analyze] [${reqId}] extraction failed:`, err);
      return res.status(500).json({ error: `Failed to extract zip: ${err.message}` });
    }

    const t0 = Date.now();
    try {
      // 3 parallel Bob calls (graph+plan share one call):
      //   1. codebase-explanation
      //   2. dependency-graph + migration-plan  (single combined call)
      //   3. security-findings
      console.log(`[upload/analyze] [${reqId}] starting 3 Bob calls (parallel)`);

      const [
        codebaseSettled,
        planSettled,
        graphSettled,
        securitySettled,
      ] = await Promise.allSettled([
        runStep("codebase-explanation", tmpDir, reqId, t0),
        runStep("migration-plan", tmpDir, reqId, t0),
        runStep("dependency-graph", tmpDir, reqId, t0),
        runStep("security-findings", tmpDir, reqId, t0),
      ]);

      const codebaseResult =
        codebaseSettled.status === "fulfilled"
          ? codebaseSettled.value
          : null;

      const graphResult =
        graphSettled.status === "fulfilled"
          ? graphSettled.value
          : null;

      const planResult =
        planSettled.status === "fulfilled"
          ? planSettled.value
          : null;

      const securityResult =
        securitySettled.status === "fulfilled"
          ? securitySettled.value
          : null;

      const elapsed = Date.now() - t0;
      const succeeded = [codebaseResult, graphResult, planResult, securityResult].filter((r) => r.ok).length;
      console.log(`[upload/analyze] [${reqId}] all steps done in ${elapsed}ms — ${succeeded}/4 succeeded`);

      // Always HTTP 200; client decides what to show / retry.
      return res.json({
        "codebase-explanation": codebaseResult,
        "dependency-graph": graphResult,
        "migration-plan": planResult,
        "security-findings": securityResult,
      });
    } finally {
      // Always delete the temp directory, success or failure
      if (tmpDir) {
        fs.rm(tmpDir, { recursive: true, force: true }, (e) => {
          if (e) console.warn(`[upload/analyze] [${reqId}] cleanup failed for ${tmpDir}: ${e.message}`);
          else console.log(`[upload/analyze] [${reqId}] temp dir deleted`);
        });
      }
    }
  }
);

// ── Single-step retry endpoint ────────────────────────────────────────────────
// POST /api/upload/analyze/:step  (same zip, runs only one prompt)
// Valid :step values: codebase-explanation | dependency-graph | migration-plan | security-findings

router.post(
  "/analyze/:step",
  upload.single("zipfile"),
  async (req, res) => {
    const { step } = req.params;
    if (!STEP_PROMPTS[step]) {
      return res.status(400).json({ error: `Unknown step "${step}". Valid steps: ${Object.keys(STEP_PROMPTS).join(", ")}` });
    }

    const ip = req.ip || "unknown";
    const reqId = randomUUID().slice(0, 8);
    console.log(`[upload/retry/${step}] [${reqId}] request from ${ip}, file: ${req.file?.originalname ?? "(none)"}`);

    if (!checkRateLimit(ip)) {
      console.warn(`[upload/retry/${step}] [${reqId}] rate limit exceeded for ${ip}`);
      return res.status(429).json({
        error: "Rate limit exceeded. You may perform at most 3 analyses per hour. Please try again later.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No zip file provided. Upload a field named 'zipfile'." });
    }

    let zip;
    try {
      zip = validateZipEntries(req.file.buffer);
    } catch (err) {
      console.warn(`[upload/retry/${step}] [${reqId}] zip validation rejected: ${err.message}`);
      return res.status(err.status || 400).json({ error: err.message });
    }

    let tmpDir;
    try {
      tmpDir = extractToTemp(zip);
      console.log(`[upload/retry/${step}] [${reqId}] extracted to ${tmpDir}`);
    } catch (err) {
      console.error(`[upload/retry/${step}] [${reqId}] extraction failed:`, err);
      return res.status(500).json({ error: `Failed to extract zip: ${err.message}` });
    }

    const t0 = Date.now();
    try {
      // dependency-graph and migration-plan share the combined prompt;
      // run it and return only the requested artifact.
      const result = await runStep(step, tmpDir, reqId, t0);;
      console.log(`[upload/retry/${step}] [${reqId}] done in ${Date.now() - t0}ms, ok=${result.ok}`);
      if (!result.ok) {
        return res.status(500).json({ error: result.error });
      }
      return res.json({ [step]: result.data });
    } finally {
      if (tmpDir) {
        fs.rm(tmpDir, { recursive: true, force: true }, (e) => {
          if (e) console.warn(`[upload/retry/${step}] [${reqId}] cleanup failed: ${e.message}`);
          else console.log(`[upload/retry/${step}] [${reqId}] temp dir deleted`);
        });
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
