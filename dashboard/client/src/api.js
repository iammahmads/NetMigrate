const BASE = "/api/analysis";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getText(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * Uploads a .zip file for full analysis.
 * Returns an object where each key is a step name and each value is
 * { ok: true, data } or { ok: false, error } — HTTP is always 200.
 */
async function analyzeUpload(file, onAbort) {
  const formData = new FormData();
  formData.append("zipfile", file);

  const controller = new AbortController();
  if (onAbort) onAbort(controller);

  const res = await fetch("/api/upload/analyze", {
    method: "POST",
    body: formData,
    signal: controller.signal,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

/**
 * Re-runs a single failed step.
 * step: "codebase-explanation" | "dependency-graph" | "migration-plan" | "security-findings"
 * Returns { data } on success, throws on hard failure.
 */
async function retryStep(step, file) {
  const formData = new FormData();
  formData.append("zipfile", file);

  const res = await fetch(`/api/upload/analyze/${step}`, {
    method: "POST",
    body: formData,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  // Response is { [step]: data }
  return body[step];
}

export const api = {
  getCodebaseExplanation: () => get("/codebase-explanation"),
  getMigrationPlan: () => get("/migration-plan"),
  getSecurityFindings: () => get("/security-findings"),
  getDependencyGraph: () => getText("/dependency-graph"),
  listSamples: () => get("/modernized-samples"),
  getSample: (name) => get(`/modernized-samples/${name}`),
  analyzeUpload,
  retryStep,
};
