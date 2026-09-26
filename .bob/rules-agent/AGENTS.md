# Project Coding Rules (Non-Obvious Only)

- All analysis output files go in `/analysis-output/` — never nest them in sub-project directories.
- The `/legacy-app` project is an analysis **target** — do not refactor, fix warnings, or harden it; its flaws are intentional inputs for the analysis pipeline.
- Artifact field names are a binding contract — see root `AGENTS.md` for exact schemas. Any schema drift will break the `/dashboard` visualizer.
- `risk_tier` values must be uppercase strings: `"LOW"`, `"MEDIUM"`, `"HIGH"` — the dashboard filters on exact string equality.
- `effort_estimate` must be lowercase: `"small"`, `"medium"`, `"large"` — same reason.
- `severity` in `security-findings.json` must be lowercase: `"low"`, `"medium"`, `"high"`.
- When scaffolding `/dashboard`, it must read from `/analysis-output/` at a **relative path** so the repo stays self-contained.
- This is a hackathon prototype — skip production hardening; focus on demo completeness.
