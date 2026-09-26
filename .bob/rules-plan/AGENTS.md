# Project Architecture Rules (Non-Obvious Only)

- Three distinct concerns, three distinct directories: `/legacy-app` (input), `/analysis-output` (pipeline output), `/dashboard` (consumer). Never cross-wire them.
- The pipeline is **one-directional**: Bob reads `/legacy-app` → writes `/analysis-output` → `/dashboard` reads and renders. No feedback loops.
- `/dashboard` must remain a static frontend — no server-side code, no database; it reads JSON/MMD files directly from the filesystem (or via a simple static server during demo).
- Schema stability is the single biggest architectural risk: the four artifact files in `/analysis-output` are the API contract between the analysis pipeline and the dashboard. Any field rename or type change requires updating both sides.
- `dependency-graph.mmd` is the only non-JSON artifact and requires Mermaid rendering support in the dashboard.
- This is a hackathon prototype — architecture decisions should optimize for demo clarity, not scalability.
