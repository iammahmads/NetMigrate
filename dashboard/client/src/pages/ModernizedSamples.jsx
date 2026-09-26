import { useEffect, useState } from "react";
import { api } from "../api.js";

const LABELS = {
  "ef6-n-plus-one": "EF6 N+1 Query Fix",
  "hardcoded-secret": "Hardcoded Secret Removal",
  "wcf-service": "WCF → ASP.NET Core Migration",
};

function SampleView({ name }) {
  const [sample, setSample] = useState(null);
  const [tab, setTab] = useState("before");
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getSample(name)
      .then(setSample)
      .catch((e) => setError(e.message));
  }, [name]);

  if (error) return <div className="state-error" style={{ padding: 16 }}>Error: {error}</div>;
  if (!sample) return <div className="state-loading" style={{ padding: 16 }}>Loading…</div>;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 12 }}>
        {LABELS[name] || name}
      </h3>

      <div className="tabs">
        {["before", "after", "rationale"].map((t) => (
          <button
            key={t}
            className={`tab-btn${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "before" && (
        <pre className="code-block">{sample.before}</pre>
      )}
      {tab === "after" && (
        <pre className="code-block">{sample.after}</pre>
      )}
      {tab === "rationale" && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "14px 16px",
            fontSize: 13,
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
          }}
        >
          {sample.rationale}
        </div>
      )}
    </div>
  );
}

export default function ModernizedSamples() {
  const [sampleNames, setSampleNames] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.listSamples()
      .then(setSampleNames)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="state-error">Error: {error}</div>;
  if (!sampleNames) return <div className="state-loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Modernized Code Samples</h2>
        <p>
          Side-by-side before/after comparisons for the highest-impact migration patterns,
          with rationale.
        </p>
      </div>

      {sampleNames.map((name) => (
        <SampleView key={name} name={name} />
      ))}
    </div>
  );
}
