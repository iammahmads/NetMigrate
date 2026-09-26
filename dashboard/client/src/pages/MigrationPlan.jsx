import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function MigrationPlan() {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMigrationPlan()
      .then(setPlan)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="state-error">Error: {error}</div>;
  if (!plan) return <div className="state-loading">Loading…</div>;

  const sorted = [...plan.modules].sort((a, b) => a.migration_order - b.migration_order);

  return (
    <div>
      <div className="page-header">
        <h2>Migration Plan</h2>
        <p>{plan.summary.total_estimated_effort}</p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--danger)" }}>
            {plan.summary.high_risk_count}
          </div>
          <div className="stat-label">High-Risk Modules</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: "var(--success)" }}>
            {plan.summary.low_risk_count}
          </div>
          <div className="stat-label">Low-Risk Modules</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{plan.modules.length}</div>
          <div className="stat-label">Total Modules</div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Module</th>
              <th>Risk</th>
              <th>Effort</th>
              <th>Recommended Replacement</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.module_name}>
                <td style={{ color: "var(--muted)", width: 30 }}>{m.migration_order}</td>
                <td>
                  <strong>{m.module_name}</strong>
                  {m.needs_verification && (
                    <span
                      className="badge"
                      style={{ marginLeft: 6, background: "#fff3cd", color: "#856404" }}
                    >
                      Verify
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
                <td style={{ color: "var(--muted)", maxWidth: 380 }}>
                  {m.recommended_replacement}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
