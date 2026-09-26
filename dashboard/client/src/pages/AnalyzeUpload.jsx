import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { api } from "../api.js";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

let _graphId = 0;

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

// ── Sub-components (inline, no separate files needed) ──────────────────────

function MermaidView({ text }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!text || !ref.current) return;
    const id = `mermaid-upload-${_graphId++}`;
    mermaid
      .render(id, text)
      .then(({ svg }) => {
        if (ref.current) ref.current.innerHTML = svg;
      })
      .catch((e) => setErr(String(e)));
  }, [text]);

  if (err) return <p style={{ color: "var(--danger)", fontSize: 13 }}>Graph render error: {err}</p>;
  return (
    <div className="mermaid-wrapper">
      <div ref={ref} />
    </div>
  );
}

function SecurityTable({ findings }) {
  const [filter, setFilter] = useState("all");
  const sorted = [...findings].sort(
    (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
  );
  const visible = filter === "all" ? sorted : sorted.filter((f) => f.severity === filter);
  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach((f) => counts[f.severity] != null && counts[f.severity]++);

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        {["all", "high", "medium", "low"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 12px",
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: filter === f ? "var(--accent)" : "var(--surface)",
              color: filter === f ? "#fff" : "var(--text)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: filter === f ? 600 : 400,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" && ` (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>File</th>
              <th>Line</th>
              <th>Issue</th>
              <th>Standard</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f, i) => (
              <tr key={i}>
                <td>
                  <span className={`badge badge-${f.severity}`}>{f.severity}</span>
                </td>
                <td style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>
                  {f.file}
                </td>
                <td style={{ color: "var(--muted)", textAlign: "center" }}>{f.line}</td>
                <td>{f.issue}</td>
                <td style={{ fontSize: 11, color: "var(--muted)" }}>{f.relevant_standard}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MigrationTable({ modules }) {
  const sorted = [...modules].sort((a, b) => a.migration_order - b.migration_order);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Module</th>
            <th>Risk</th>
            <th>Effort</th>
            <th>Replacement</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.module_name}>
              <td style={{ color: "var(--muted)", textAlign: "center" }}>{m.migration_order}</td>
              <td>
                <strong>{m.module_name}</strong>
                {m.needs_verification && (
                  <span
                    title="Needs manual verification"
                    style={{ marginLeft: 6, fontSize: 11, color: "var(--warning)" }}
                  >
                    ⚠ verify
                  </span>
                )}
              </td>
              <td>
                <span className={`badge badge-risk-${m.risk_tier}`}>{m.risk_tier}</span>
              </td>
              <td>
                <span className={`badge badge-effort-${m.effort_estimate}`}>
                  {m.effort_estimate}
                </span>
              </td>
              <td style={{ fontSize: 12, color: "var(--muted)" }}>{m.recommended_replacement}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodebaseCards({ modules }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {modules.map((m, i) => (
        <div key={i} className="card" style={{ marginBottom: 0 }}>
          <h3>{m.module}</h3>
          <p style={{ marginBottom: 6 }}>{m.purpose}</p>
          <p style={{ marginBottom: 6, fontStyle: "italic" }}>{m.plain_english_summary}</p>
          {m.connections?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {m.connections.map((c) => (
                <span
                  key={c}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: "1px 8px",
                    fontSize: 11,
                    color: "var(--muted)",
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const RESULT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "codebase", label: "Codebase" },
  { key: "migration", label: "Migration Plan" },
  { key: "security", label: "Security" },
  { key: "dependency", label: "Dependency Graph" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyzeUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const abortRef = useRef(null);

  function handleFileChange(e) {
    setFile(e.target.files[0] || null);
    setError(null);
    setResults(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setProgress("Uploading and validating zip…");

    try {
      const data = await api.analyzeUpload(file, (ctrl) => {
        abortRef.current = ctrl;
      });
      setProgress("Analysis complete.");
      setResults(data);
      setActiveTab("overview");
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Analysis cancelled.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleCancel() {
    if (abortRef.current) abortRef.current.abort();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const migration = results?.["migration-plan"];
  const security = results?.["security-findings"];
  const codebase = results?.["codebase-explanation"];
  const depGraph = results?.["dependency-graph"];

  return (
    <div>
      <div className="page-header">
        <h2>Analyze Your Own Code</h2>
        <p>
          Upload a .zip of your .NET codebase — we'll run the same static analysis pipeline
          against it and show you the results here.
        </p>
      </div>

      {/* Upload form */}
      {!results && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label
                htmlFor="zip-upload"
                style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}
              >
                Select a .zip file (max 10 MB)
              </label>
              <input
                id="zip-upload"
                type="file"
                accept=".zip,application/zip"
                onChange={handleFileChange}
                disabled={loading}
                style={{ fontSize: 13 }}
              />
            </div>

            {/* Privacy note */}
            <p
              className="upload-privacy-note"
              style={{
                fontSize: 12,
                color: "var(--muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "8px 12px",
                marginBottom: 14,
              }}
            >
              🔒 Your code is analyzed and immediately deleted — nothing is stored.
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="submit"
                disabled={!file || loading}
                style={{
                  padding: "8px 20px",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: file && !loading ? "pointer" : "not-allowed",
                  opacity: file && !loading ? 1 : 0.6,
                }}
              >
                {loading ? "Analyzing…" : "Analyze"}
              </button>
              {loading && (
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    color: "var(--danger)",
                    border: "1px solid var(--danger)",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
              {loading && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{progress}</span>
              )}
            </div>

            {/* Accepted file types note */}
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
              Accepted file types inside the zip: .cs, .csproj, .sln, .config, .json
            </p>
          </form>

          {error && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 14px",
                background: "#ffebe9",
                border: "1px solid #ffc1bb",
                borderRadius: 6,
                color: "var(--danger)",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "var(--success)" }}>✓ Analysis complete</p>
            <button
              onClick={() => { setResults(null); setFile(null); setError(null); }}
              style={{
                padding: "5px 14px",
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                color: "var(--muted)",
              }}
            >
              Analyze another project
            </button>
          </div>

          <div className="tabs">
            {RESULT_TABS.map(({ key, label }) => (
              <button
                key={key}
                className={`tab-btn${activeTab === key ? " active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && migration && security && codebase && (
            <div>
              <div className="stat-grid">
                <div className="stat-card">
                  <div className="stat-value">{codebase.length}</div>
                  <div className="stat-label">Modules Analyzed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--danger)" }}>
                    {migration.summary.high_risk_count}
                  </div>
                  <div className="stat-label">High-Risk Modules</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: "var(--danger)" }}>
                    {security.filter((f) => f.severity === "high").length}
                  </div>
                  <div className="stat-label">Critical Security Issues</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{security.length}</div>
                  <div className="stat-label">Total Findings</div>
                </div>
              </div>

              <div className="card">
                <h3>Migration Summary</h3>
                <p style={{ marginBottom: 10 }}>{migration.summary.total_estimated_effort}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["large", "medium", "small"].map((e) => {
                    const count = migration.modules.filter((m) => m.effort_estimate === e).length;
                    return (
                      <span key={e} className={`badge badge-effort-${e}`}>
                        {count} {e}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <h3>Security Findings</h3>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {["high", "medium", "low"].map((sev) => {
                    const count = security.filter((f) => f.severity === sev).length;
                    return (
                      <span key={sev} className={`badge badge-${sev}`}>
                        {count} {sev}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="card">
                <h3>Modules by Risk Tier</h3>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {["HIGH", "MEDIUM", "LOW"].map((tier) => {
                    const count = migration.modules.filter((m) => m.risk_tier === tier).length;
                    return (
                      <span key={tier} className={`badge badge-risk-${tier}`}>
                        {count} {tier.toLowerCase()}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "codebase" && codebase && <CodebaseCards modules={codebase} />}

          {activeTab === "migration" && migration && (
            <div>
              <div className="card" style={{ marginBottom: 14 }}>
                <h3>Summary</h3>
                <p style={{ marginBottom: 6 }}>{migration.summary.total_estimated_effort}</p>
              </div>
              <MigrationTable modules={migration.modules} />
            </div>
          )}

          {activeTab === "security" && security && <SecurityTable findings={security} />}

          {activeTab === "dependency" && depGraph && (
            <div>
              <MermaidView text={depGraph} />
              <details style={{ marginTop: 16 }}>
                <summary
                  style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", userSelect: "none" }}
                >
                  View raw Mermaid source
                </summary>
                <pre className="code-block" style={{ marginTop: 10 }}>{depGraph}</pre>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  );
}
