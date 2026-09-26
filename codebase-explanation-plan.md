# Plan: Codebase Explanation — /legacy-app

## Top-Level Overview

Analyze every file in `/legacy-app` (a .NET Framework 4.7.2 ASP.NET MVC + WCF application) and produce a single JSON artifact at `/analysis-output/codebase-explanation.json` that explains each major module in plain English for a new team member. The schema is fixed by AGENTS.md; no design freedom is needed — this is a pure analysis-and-write task.

---

## Sub-Tasks

### Sub-Task 1 — Produce `codebase-explanation.json`

**Intent**
Map every significant file/module in `/legacy-app` to one JSON entry, filling in `module`, `purpose`, `connections`, and `plain_english_summary` exactly as the AGENTS.md schema requires.

**Expected Outcomes**
- File `/analysis-output/codebase-explanation.json` exists and is valid JSON.
- Each entry uses the four required fields with no extras.
- `connections` lists only identifiers that actually appear in the codebase (no invented names).
- Language is plain English, accessible to a developer unfamiliar with the app.

**Todo List**
1. Read `AGENTS.md` to confirm schema (already done).
2. Use the sub-agent inventory to draft one entry per module.
3. Write the completed JSON to `/analysis-output/codebase-explanation.json`.
4. Validate the JSON is well-formed and every required field is present in every entry.

**Relevant Context**
Modules to cover (9 total):

| Module | File |
|--------|------|
| `Web.config` | `LegacyApp/Web.config` |
| `LegacyApp.csproj` | `LegacyApp/LegacyApp.csproj` |
| `Customer` | `LegacyApp/Models/Customer.cs` |
| `Order` | `LegacyApp/Models/Customer.cs` |
| `AppDbContext` | `LegacyApp/Models/AppDbContext.cs` |
| `OrderReportService` | `LegacyApp/Models/AppDbContext.cs` |
| `IOrderService` | `LegacyApp/Services/IOrderService.cs` |
| `OrderService` | `LegacyApp/Services/OrderService.cs` |
| `OrdersController` | `LegacyApp/Controllers/OrdersController.cs` |

Schema per entry:
```json
{
  "module": "string",
  "purpose": "string",
  "connections": ["string"],
  "plain_english_summary": "string"
}
```

**Status** — [ ] pending

---

## Notes for Implementation

- Write the JSON directly — no intermediate steps needed.
- Do NOT add fields beyond the four in the schema.
- The `module` field should be the class/file name (e.g. `"OrdersController"`, `"Web.config"`).
- The `connections` array should list other module names (from the table above) that this module directly depends on or is used by.
- `plain_english_summary` should be 2–4 readable sentences, no jargon.
