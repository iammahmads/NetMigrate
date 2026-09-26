import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { api } from "../api.js";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

let _graphId = 0;

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

// ── Step metadata ─────────────────────────────────────────────────────────────

const STEPS = [
  { key: "codebase-explanation", label: "Codebase Explanation" },
  { key: "dependency-graph",     label: "Dependency Graph" },
  { key: "migration-plan",       label: "Migration Plan" },
  { key: "security-findings",    label: "Security Findings" },
];

// Initial per-step state: all pending
const INITIAL_STEPS = Object.fromEntries(
  STEPS.map(({ key }) => [key, { status: "pending" }])
  // status: "pending" | "running" | "ok" | "error"
  // ok:    { status: "ok",    data: <parsed payload> }
  // error: { status: "error", error: "<message>", retrying: false }
);

const RESULT_TABS = [
  { key: "overview",    label: "Overview" },
  { key: "codebase",    label: "Codebase" },
  { key: "migration",   label: "Migration Plan" },
  { key: "security",    label: "Security" },
  { key: "dependency",  label: "Dependency Graph" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function MermaidView({ text }) {
  const ref = useRef(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!text || !ref.current) return;
    const id = `mermaid-upload-${_graphId++}`;
    mermaid
      .render(id, text)
      .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg; })
      .catch((e) => setErr(String(e)));
  }, [text]);

  if (err) return <p style={{ color: "var(--danger)", fontSize: 13 }}>Graph render error: {err}</p>;
  return <div className="mermaid-wrapper"><div ref={ref} /></div>;
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
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: "4px 12px", borderRadius: 16,
              border: "1px solid var(--border)",
              background: filter === f ? "var(--accent)" : "var(--surface)",
              color: filter === f ? "#fff" : "var(--text)",
              cursor: "pointer", fontSize: 12, fontWeight: filter === f ? 600 : 400,
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
              <th>Severity</th><th>File</th><th>Line</th><th>Issue</th><th>Standard</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((f, i) => (
              <tr key={i}>
                <td><span className={`badge badge-${f.severity}`}>{f.severity}</span></td>
                <td style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all" }}>{f.file}</td>
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
            <th>#</th><th>Module</th><th>Risk</th><th>Effort</th><th>Replacement</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.module_name}>
              <td style={{ color: "var(--muted)", textAlign: "center" }}>{m.migration_order}</td>
              <td>
                <strong>{m.module_name}</strong>
                {m.needs_verification && (
                  <span title="Needs manual verification"
                    style={{ marginLeft: 6, fontSize: 11, color: "var(--warning)" }}>
                    ⚠ verify
                  </span>
                )}
              </td>
              <td><span className={`badge badge-risk-${m.risk_tier}`}>{m.risk_tier}</span></td>
              <td><span className={`badge badge-effort-${m.effort_estimate}`}>{m.effort_estimate}</span></td>
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
                <span key={c} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "1px 8px", fontSize: 11, color: "var(--muted)",
                }}>{c}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Raw response toggle ───────────────────────────────────────────────────────

function RawResponseToggle({ rawText }) {
  if (!rawText) return null;
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{
        cursor: "pointer", fontSize: 11, color: "var(--muted)",
        userSelect: "none", listStyle: "none", display: "inline-flex",
        alignItems: "center", gap: 4,
      }}>
        <span>▶</span> View raw response
      </summary>
      <pre style={{
        marginTop: 6, padding: "10px 12px",
        background: "#1e1e1e", color: "#d4d4d4",
        borderRadius: 6, fontSize: 11, lineHeight: 1.5,
        overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
        maxHeight: 400, overflowY: "auto",
      }}>
        {rawText}
      </pre>
    </details>
  );
}

// ── Step status strip shown while analysis is running (or partially done) ─────

function StepStatusBar({ steps, onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
      {STEPS.map(({ key, label }) => {
        const s = steps[key];
        const isPending  = s.status === "pending";
        const isRunning  = s.status === "running";
        const isOk       = s.status === "ok";
        const isError    = s.status === "error";

        let icon = "○";
        let color = "var(--muted)";
        if (isRunning) { icon = "◌"; color = "var(--accent)"; }
        if (isOk)      { icon = "✓"; color = "var(--success)"; }
        if (isError)   { icon = "✗"; color = "var(--danger)"; }

        return (
          <div key={key} style={{
            padding: "8px 14px",
            border: `1px solid ${isError ? "#ffc1bb" : "var(--border)"}`,
            borderRadius: 6,
            background: isError ? "#ffebe9" : isOk ? "#f0fff4" : "var(--surface)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color, minWidth: 16, textAlign: "center" }}>
                {icon}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: isError ? "var(--danger)" : "var(--text)" }}>
                {label}
                {isRunning && <span style={{ marginLeft: 6, color: "var(--accent)" }}>analyzing…</span>}
                {isPending && <span style={{ marginLeft: 6, color: "var(--muted)", fontSize: 11 }}>queued</span>}
                {isError && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--danger)" }}>
                    — {s.error}
                  </span>
                )}
              </span>
              {isError && onRetry && (
                <button
                  onClick={() => onRetry(key)}
                  disabled={s.retrying}
                  style={{
                    padding: "3px 12px",
                    borderRadius: 5,
                    border: "1px solid var(--danger)",
                    background: "none",
                    color: "var(--danger)",
                    cursor: s.retrying ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: s.retrying ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.retrying ? "Retrying…" : "Retry"}
                </button>
              )}
            </div>
            {isError && <RawResponseToggle rawText={s.rawText} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AnalyzeUpload() {
  const [file, setFile]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [globalError, setGlobalError] = useState(null);
  // Per-step state: maps step key → { status, data?, error?, retrying? }
  const [steps, setSteps]         = useState(INITIAL_STEPS);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const abortRef = useRef(null);

  // Helpers to update a single step's state
  function setStep(key, patch) {
    setSteps((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const anyOk    = Object.values(steps).some((s) => s.status === "ok");
  const anyError = Object.values(steps).some((s) => s.status === "error");
  const allDone  = Object.values(steps).every((s) => s.status === "ok" || s.status === "error");
  const allOk    = Object.values(steps).every((s) => s.status === "ok");

  function handleFileChange(e) {
    setFile(e.target.files[0] || null);
    setGlobalError(null);
    setSteps(INITIAL_STEPS);
    setAnalysisStarted(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setGlobalError(null);
    setAnalysisStarted(true);

    // Mark all steps as running
    setSteps(Object.fromEntries(STEPS.map(({ key }) => [key, { status: "running" }])));

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const data = await api.analyzeUpload(file, (ctrl) => { abortRef.current = ctrl; });

      // data is { [step]: { ok, data } | { ok: false, error, rawText? } }
      setSteps(Object.fromEntries(
        STEPS.map(({ key }) => {
          const payload = data[key];
          if (!payload) return [key, { status: "error", error: "No response from server" }];
          return payload.ok
            ? [key, { status: "ok",    data: payload.data }]
            : [key, { status: "error", error: payload.error ?? "Unknown error", rawText: payload.rawText ?? null }];
        })
      ));
    } catch (err) {
      if (err.name === "AbortError") {
        setGlobalError("Analysis cancelled.");
        setSteps(Object.fromEntries(
          STEPS.map(({ key }) => [key, { status: "error", error: "Cancelled" }])
        ));
      } else {
        setGlobalError(err.message);
        // Mark running steps as errored
        setSteps((prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([k, v]) =>
              [k, v.status === "running" ? { status: "error", error: err.message } : v]
            )
          )
        );
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  async function handleRetry(stepKey) {
    if (!file) return;
    setStep(stepKey, { status: "running", retrying: true, error: undefined });

    try {
      const data = await api.retryStep(stepKey, file);
      setStep(stepKey, { status: "ok", data, retrying: false, rawText: null });
    } catch (err) {
      // api.retryStep throws on hard HTTP errors; rawText not available here
      setStep(stepKey, { status: "error", error: err.message, retrying: false, rawText: null });
    }
  }

  function handleCancel() {
    if (abortRef.current) abortRef.current.abort();
  }

  function handleReset() {
    setFile(null);
    setGlobalError(null);
    setSteps(INITIAL_STEPS);
    setAnalysisStarted(false);
    setLoading(false);
  }

  // ── Derived data for rendering ────────────────────────────────────────────
  const codebase  = steps["codebase-explanation"].data;
  const depGraph  = steps["dependency-graph"].data;
  const migration = steps["migration-plan"].data;
  const security  = steps["security-findings"].data;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h2>Analyze Your Own Code</h2>
        <p>
          Upload a .zip of your .NET codebase — we'll run the same static analysis pipeline
          against it and show you the results here.
        </p>
      </div>

      {/* ── Upload form (always visible until analysis starts) ── */}
      {!analysisStarted && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="zip-upload"
                style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
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

            <p style={{
              fontSize: 12, color: "var(--muted)",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "8px 12px", marginBottom: 14,
            }}>
              🔒 Your code is analyzed and immediately deleted — nothing is stored.
            </p>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button type="submit" disabled={!file || loading} style={{
                padding: "8px 20px", background: "var(--accent)", color: "#fff",
                border: "none", borderRadius: 6, fontWeight: 600, fontSize: 13,
                cursor: file && !loading ? "pointer" : "not-allowed",
                opacity: file && !loading ? 1 : 0.6,
              }}>
                Analyze
              </button>
            </div>

            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 10 }}>
              Accepted file types inside the zip: .cs, .csproj, .sln, .config, .json
            </p>
          </form>

          {globalError && (
            <div style={{
              marginTop: 14, padding: "10px 14px",
              background: "#ffebe9", border: "1px solid #ffc1bb",
              borderRadius: 6, color: "var(--danger)", fontSize: 13,
            }}>
              {globalError}
            </div>
          )}
        </div>
      )}

      {/* ── In-progress / partial results view ── */}
      {analysisStarted && (
        <>
          {/* Header bar */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, color: allOk ? "var(--success)" : loading ? "var(--accent)" : anyError ? "var(--warning)" : "var(--muted)" }}>
              {allOk
                ? "✓ All steps complete"
                : loading
                  ? "⏳ Analysis in progress…"
                  : allDone
                    ? "⚠ Completed with errors — see failed steps below"
                    : "Partial results available"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {loading && (
                <button onClick={handleCancel} style={{
                  padding: "5px 14px", background: "none",
                  border: "1px solid var(--danger)", borderRadius: 6,
                  fontSize: 12, cursor: "pointer", color: "var(--danger)",
                }}>
                  Cancel
                </button>
              )}
              <button onClick={handleReset} style={{
                padding: "5px 14px", background: "none",
                border: "1px solid var(--border)", borderRadius: 6,
                fontSize: 12, cursor: "pointer", color: "var(--muted)",
              }}>
                Analyze another project
              </button>
            </div>
          </div>

          {/* Global hard error (e.g. rate-limit, network) */}
          {globalError && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "#ffebe9", border: "1px solid #ffc1bb",
              borderRadius: 6, color: "var(--danger)", fontSize: 13,
            }}>
              {globalError}
            </div>
          )}

          {/* Per-step status strip — always shown while loading or when errors exist */}
          {(loading || anyError) && (
            <StepStatusBar steps={steps} onRetry={!loading ? handleRetry : null} />
          )}

          {/* Results tabs — only rendered once at least one step is complete */}
          {anyOk && (
            <>
              <div className="tabs">
                {RESULT_TABS.map(({ key, label }) => {
                  // Determine which data key backs this tab
                  const stepKey = key === "overview"   ? null
                    : key === "codebase"   ? "codebase-explanation"
                    : key === "migration"  ? "migration-plan"
                    : key === "security"   ? "security-findings"
                    : "dependency-graph";
                  const stepState = stepKey ? steps[stepKey] : null;
                  const tabReady  = stepKey === null
                    ? (codebase && migration && security)   // overview needs 3
                    : stepState?.status === "ok";

                  return (
                    <button
                      key={key}
                      className={`tab-btn${activeTab === key ? " active" : ""}`}
                      onClick={() => setActiveTab(key)}
                      style={{ position: "relative" }}
                    >
                      {label}
                      {/* Small indicator dots */}
                      {stepKey && stepState?.status === "running" && (
                        <span style={{
                          marginLeft: 5, fontSize: 9, verticalAlign: "super",
                          color: "var(--accent)",
                        }}>●</span>
                      )}
                      {stepKey && stepState?.status === "error" && (
                        <span style={{
                          marginLeft: 5, fontSize: 9, verticalAlign: "super",
                          color: "var(--danger)",
                        }}>●</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Overview tab ── */}
              {activeTab === "overview" && (
                <div>
                  {!(codebase && migration && security) && (
                    <StepBanner
                      missing={[
                        !codebase  && "Codebase Explanation",
                        !migration && "Migration Plan",
                        !security  && "Security Findings",
                      ].filter(Boolean)}
                      steps={steps}
                      onRetry={handleRetry}
                      loading={loading}
                    />
                  )}
                  {codebase && migration && security && (
                    <>
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
                            return <span key={e} className={`badge badge-effort-${e}`}>{count} {e}</span>;
                          })}
                        </div>
                      </div>
                      <div className="card">
                        <h3>Security Findings</h3>
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          {["high", "medium", "low"].map((sev) => {
                            const count = security.filter((f) => f.severity === sev).length;
                            return <span key={sev} className={`badge badge-${sev}`}>{count} {sev}</span>;
                          })}
                        </div>
                      </div>
                      <div className="card">
                        <h3>Modules by Risk Tier</h3>
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          {["HIGH", "MEDIUM", "LOW"].map((tier) => {
                            const count = migration.modules.filter((m) => m.risk_tier === tier).length;
                            return <span key={tier} className={`badge badge-risk-${tier}`}>{count} {tier.toLowerCase()}</span>;
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Codebase tab ── */}
              {activeTab === "codebase" && (
                codebase
                  ? <CodebaseCards modules={codebase} />
                  : <StepBanner missing={["Codebase Explanation"]} steps={steps} onRetry={handleRetry} loading={loading} />
              )}

              {/* ── Migration tab ── */}
              {activeTab === "migration" && (
                migration
                  ? <>
                      <div className="card" style={{ marginBottom: 14 }}>
                        <h3>Summary</h3>
                        <p style={{ marginBottom: 6 }}>{migration.summary.total_estimated_effort}</p>
                      </div>
                      <MigrationTable modules={migration.modules} />
                    </>
                  : <StepBanner missing={["Migration Plan"]} steps={steps} onRetry={handleRetry} loading={loading} />
              )}

              {/* ── Security tab ── */}
              {activeTab === "security" && (
                security
                  ? <SecurityTable findings={security} />
                  : <StepBanner missing={["Security Findings"]} steps={steps} onRetry={handleRetry} loading={loading} />
              )}

              {/* ── Dependency Graph tab ── */}
              {activeTab === "dependency" && (
                depGraph
                  ? <>
                      <MermaidView text={depGraph} />
                      <details style={{ marginTop: 16 }}>
                        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", userSelect: "none" }}>
                          View raw Mermaid source
                        </summary>
                        <pre className="code-block" style={{ marginTop: 10 }}>{depGraph}</pre>
                      </details>
                    </>
                  : <StepBanner missing={["Dependency Graph"]} steps={steps} onRetry={handleRetry} loading={loading} />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Inline banner shown inside a tab when its step hasn't succeeded yet ───────

function StepBanner({ missing, steps, onRetry, loading }) {
  // Map label → step key
  const labelToKey = {
    "Codebase Explanation": "codebase-explanation",
    "Migration Plan":       "migration-plan",
    "Security Findings":    "security-findings",
    "Dependency Graph":     "dependency-graph",
  };

  return (
    <div style={{
      padding: "24px 20px", border: "1px solid var(--border)",
      borderRadius: 8, background: "var(--surface)", textAlign: "center",
    }}>
      {missing.map((label) => {
        const key = labelToKey[label];
        const s = steps[key];
        const isRunning = s?.status === "running";
        const isError   = s?.status === "error";

        return (
          <div key={label} style={{ marginBottom: missing.length > 1 ? 12 : 0 }}>
            {isRunning && (
              <p style={{ color: "var(--accent)", fontSize: 13 }}>
                ⏳ <strong>{label}</strong> is still being analyzed…
              </p>
            )}
            {isError && (
              <>
                <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>
                  ✗ <strong>{label}</strong> failed: {s.error}
                </p>
                {!loading && onRetry && (
                  <button onClick={() => onRetry(key)} disabled={s.retrying} style={{
                    padding: "6px 18px", background: "var(--accent)", color: "#fff",
                    border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: s.retrying ? "not-allowed" : "pointer",
                    opacity: s.retrying ? 0.6 : 1,
                  }}>
                    {s.retrying ? "Retrying…" : `Retry ${label}`}
                  </button>
                )}
                <div style={{ textAlign: "left", marginTop: 8 }}>
                  <RawResponseToggle rawText={s.rawText} />
                </div>
              </>
            )}
            {!isRunning && !isError && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                Waiting for <strong>{label}</strong>…
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
