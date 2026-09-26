import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { api } from "../api.js";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

let _graphId = 0;

export default function DependencyGraph() {
  const [mmdText, setMmdText] = useState(null);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    api.getDependencyGraph()
      .then(setMmdText)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!mmdText || !containerRef.current) return;

    const id = `mermaid-graph-${_graphId++}`;
    mermaid
      .render(id, mmdText)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((e) => setError(String(e)));
  }, [mmdText]);

  if (error) return <div className="state-error">Error: {error}</div>;
  if (!mmdText) return <div className="state-loading">Loading…</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Dependency Graph</h2>
        <p>
          Visual map of module relationships with risk tier annotations. Labels indicate{" "}
          <span className="badge badge-risk-HIGH">HIGH</span>{" "}
          <span className="badge badge-risk-MEDIUM">MEDIUM</span>{" "}
          <span className="badge badge-risk-LOW">LOW</span> migration risk.
        </p>
      </div>

      <div className="mermaid-wrapper">
        <div ref={containerRef} />
      </div>

      <details style={{ marginTop: 20 }}>
        <summary
          style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", userSelect: "none" }}
        >
          View raw Mermaid source
        </summary>
        <pre className="code-block" style={{ marginTop: 10 }}>{mmdText}</pre>
      </details>
    </div>
  );
}
