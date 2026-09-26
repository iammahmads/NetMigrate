import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Overview() {
  const [migration, setMigration] = useState(null);
  const [security, setSecurity] = useState(null);
  const [codebase, setCodebase] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getMigrationPlan(),
      api.getSecurityFindings(),
      api.getCodebaseExplanation(),
    ])
      .then(([m, s, c]) => {
        setMigration(m);
        setSecurity(s);
        setCodebase(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="state-error">Error: {error}</div>;
  if (!migration || !security || !codebase)
    return <div className="state-loading">Loading…</div>;

  const highSec = security.filter((f) => f.severity === "high").length;
  const medSec = security.filter((f) => f.severity === "medium").length;
  const lowSec = security.filter((f) => f.severity === "low").length;

  const effortCounts = migration.modules.reduce((acc, m) => {
    acc[m.effort_estimate] = (acc[m.effort_estimate] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h2>Overview</h2>
        <p>High-level summary of the NetMigrate analysis for the legacy ASP.NET application.</p>
      </div>

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
            {highSec}
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
        <p style={{ marginBottom: 12 }}>{migration.summary.total_estimated_effort}</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="badge badge-effort-large">{effortCounts.large || 0} large</span>
          <span className="badge badge-effort-medium">{effortCounts.medium || 0} medium</span>
          <span className="badge badge-effort-small">{effortCounts.small || 0} small</span>
        </div>
      </div>

      <div className="card">
        <h3>Security Findings Breakdown</h3>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <span className="badge badge-high">{highSec} high</span>
          <span className="badge badge-medium">{medSec} medium</span>
          <span className="badge badge-low">{lowSec} low</span>
        </div>
      </div>

      <div className="card">
        <h3>Modules by Risk Tier</h3>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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

      <div className="card">
        <h3>Migration Order</h3>
        <ol style={{ paddingLeft: 20, marginTop: 8 }}>
          {[...migration.modules]
            .sort((a, b) => a.migration_order - b.migration_order)
            .map((m) => (
              <li key={m.module_name} style={{ marginBottom: 4 }}>
                <strong>{m.module_name}</strong>{" "}
                <span className={`badge badge-risk-${m.risk_tier}`}>{m.risk_tier}</span>
              </li>
            ))}
        </ol>
      </div>
    </div>
  );
}
