import { useEffect, useState } from "react";
import { api } from "../api.js";

const SEV_ORDER = { high: 0, medium: 1, low: 2 };

export default function SecurityFindings() {
  const [findings, setFindings] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getSecurityFindings()
      .then(setFindings)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="state-error">Error: {error}</div>;
  if (!findings) return <div className="state-loading">Loading…</div>;

  const sorted = [...findings].sort(
    (a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]
  );

  const visible =
    filter === "all" ? sorted : sorted.filter((f) => f.severity === filter);

  const counts = { high: 0, medium: 0, low: 0 };
  findings.forEach((f) => counts[f.severity]++);

  return (
    <div>
      <div className="page-header">
        <h2>Security Findings</h2>
        <p>{findings.length} issues found across the legacy codebase.</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--danger)" }}>{counts.high}</div>
          <div className="stat-label">High Severity</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--warning)" }}>{counts.medium}</div>
          <div className="stat-label">Medium Severity</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>{counts.low}</div>
          <div className="stat-label">Low Severity</div>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "high", "medium", "low"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px",
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
            {f !== "all" && ` (${counts[f]})`}
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
    </div>
  );
}
