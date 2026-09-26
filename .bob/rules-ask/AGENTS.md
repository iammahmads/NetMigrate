# Project Documentation Rules (Non-Obvious Only)

- The canonical schemas for all analysis artifacts live in the root `AGENTS.md` — that file is the source of truth, not any README or inline comments.
- `/legacy-app` is a *synthetic* legacy app; its code quality issues are deliberate, not accidental oversights.
- `/analysis-output/` is a generated directory — its contents are produced by Bob analysis tasks, not written manually.
- The dashboard (`/dashboard`) is a visualizer only — it has no back-end; it reads static JSON/MMD files from `/analysis-output/`.
- `dependency-graph.mmd` uses Mermaid syntax; risk tier labels (`LOW`/`MEDIUM`/`HIGH`) are embedded in node labels — the dashboard may parse these strings directly.
