import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function CodebaseExplanation() {
  const [modules, setModules] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getCodebaseExplanation()
      .then(setModules)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="state-error">Error: {error}</div>;
  if (!modules) return <div className="state-loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Codebase Explanation</h2>
        <p>Plain-English breakdown of every module in the legacy application.</p>
      </div>

      {modules.map((mod) => (
        <div key={mod.module} className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <h3 style={{ fontSize: 15 }}>{mod.module}</h3>
          </div>
          <p style={{ marginBottom: 10 }}>{mod.plain_english_summary}</p>
          {mod.connections.length > 0 && (
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Connects to:{" "}
              </span>
              {mod.connections.map((c) => (
                <span
                  key={c}
                  style={{
                    display: "inline-block",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    padding: "1px 7px",
                    fontSize: 11,
                    marginRight: 4,
                    marginTop: 4,
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
