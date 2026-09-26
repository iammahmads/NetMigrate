# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project: NetMigrate

A legacy .NET modernization accelerator built for the IBM Bob 2.0 Hackathon.
Prioritize a working end-to-end demo over exhaustive edge-case handling or production hardening.

## Repository Layout

```
/legacy-app       — sample legacy ASP.NET (.NET Framework 4.x) app; analysis TARGET only, not production code
/dashboard        — web dashboard that visualizes analysis artifacts
/analysis-output  — ALL generated analysis artifacts go here (see schema contracts below)
```

## Build / Lint / Test Commands

These directories do not exist yet. Commands will be added here once sub-projects are scaffolded.
Until then, commands follow standard conventions for each sub-project's stack.

## Analysis Artifact Schema Contracts (BINDING — field names must never drift between sessions)

All files produced during analysis go in `/analysis-output/`.

### `codebase-explanation.json`
```json
[
  {
    "module": "string",
    "purpose": "string",
    "connections": ["string"],
    "plain_english_summary": "string"
  }
]
```

### `dependency-graph.mmd`
Mermaid diagram. Node labels MUST include the risk tier as **`LOW`**, **`MEDIUM`**, or **`HIGH`** (uppercase, exact strings).

### `migration-plan.json`
```json
{
  "summary": {
    "total_estimated_effort": "string",
    "high_risk_count": 0,
    "low_risk_count": 0
  },
  "modules": [
    {
      "module_name": "string",
      "risk_tier": "LOW | MEDIUM | HIGH",
      "effort_estimate": "small | medium | large",
      "recommended_replacement": "string",
      "migration_order": 0,
      "needs_verification": true
    }
  ]
}
```

### `security-findings.json`
```json
[
  {
    "file": "string",
    "line": 0,
    "issue": "string",
    "severity": "low | medium | high",
    "relevant_standard": "string"
  }
]
```

## Key Rules

- `risk_tier` values in all artifacts must be `"LOW"`, `"MEDIUM"`, or `"HIGH"` — uppercase, never lowercase.
- `effort_estimate` must be exactly `"small"`, `"medium"`, or `"large"` — lowercase only.
- `severity` in security findings must be lowercase: `"low"`, `"medium"`, or `"high"`.
- `/legacy-app` is an analysis target only — do not treat it as production code to fix or harden.
- `/dashboard` consumes the files in `/analysis-output` — keep schemas stable or update both in tandem.
