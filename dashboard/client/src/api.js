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

export const api = {
  getCodebaseExplanation: () => get("/codebase-explanation"),
  getMigrationPlan: () => get("/migration-plan"),
  getSecurityFindings: () => get("/security-findings"),
  getDependencyGraph: () => getText("/dependency-graph"),
  listSamples: () => get("/modernized-samples"),
  getSample: (name) => get(`/modernized-samples/${name}`),
};
