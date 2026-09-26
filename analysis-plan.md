# NetMigrate Analysis Plan

## Top-Level Overview

Analyze the `LegacyApp` ASP.NET MVC 5 / .NET Framework 4.7.2 project in `/legacy-app` and produce two artifacts in `/analysis-output` conforming exactly to the schemas in `AGENTS.md`. No source files in `/legacy-app` are to be modified.

---

## Sub-Task 1 — Produce `dependency-graph.mmd`

**Intent**: Map every module (Controllers, Models, Services, configuration) and its inter-module dependencies as a Mermaid flowchart. Tag each node with its migration-risk tier (LOW / MEDIUM / HIGH). Risk tier is derived from how many .NET-8-incompatible dependencies the module carries.

**Risk-tier rationale**:
- **HIGH** — directly depends on APIs that do not exist in .NET 8 without a rewrite: `System.Web`, `System.Web.Mvc`, `System.ServiceModel` (WCF), or legacy frameworks with no upgrade path.
- **MEDIUM** — depends on APIs that require migration effort but have a clear path: Entity Framework 6 → EF Core, log4net 1.x → log4net 2.x / Serilog, hardcoded config.
- **LOW** — pure POCOs, interfaces, or DTOs with no framework-specific ties.

**Module list and tiers**:
| Module | File(s) | Risk |
|---|---|---|
| OrdersController | Controllers/OrdersController.cs | HIGH (System.Web.Mvc, HttpContext.Current, Session, Application cache) |
| OrderService | Services/OrderService.cs | HIGH (System.ServiceModel WCF, log4net 1.x, no DI, no async) |
| IOrderService | Services/IOrderService.cs | HIGH (System.ServiceModel ServiceContract/DataContract) |
| AppDbContext + OrderReportService | Models/AppDbContext.cs | MEDIUM (EF6, hardcoded config, N+1 query) |
| Customer + Order (entities) | Models/Customer.cs | LOW (pure POCOs, no framework APIs) |
| Web.config | Web.config | HIGH (WCF system.serviceModel, Forms auth, hardcoded secrets) |

**Expected Outcomes**: `/analysis-output/dependency-graph.mmd` is a valid Mermaid file renderable by Mermaid v10+. Every node label includes its risk tier as `LOW`, `MEDIUM`, or `HIGH` (uppercase).

**Todo List**:
- [ ] Write `dependency-graph.mmd` with nodes for each module, risk tier in node label, and edges for all inter-module dependencies.

**Relevant Context**:
- Schema requirement: node labels MUST include `LOW`, `MEDIUM`, or `HIGH`.
- Use `flowchart LR` or `flowchart TD` direction.
- No double quotes inside bracket labels.

**Status**: [ ] pending — content fully determined, blocked only by file write requiring Agent mode

---

## Sub-Task 2 — Produce `migration-plan.json`

**Intent**: Produce a structured JSON migration plan listing every module with its risk tier, effort estimate, recommended .NET 8 replacement, migration order (topological — low-dependency modules first), and a `needs_verification` flag for any replacement where .NET 8 compatibility is genuinely uncertain.

**Effort estimate rationale**:
- `small` — rename or swap package, no API surface change.
- `medium` — API surface change but well-documented migration guide exists.
- `large` — architectural rewrite required (WCF → REST, MVC 5 → ASP.NET Core, EF6 → EF Core).

**Module-level plan**:
| # | Module | risk_tier | effort_estimate | Replacement | needs_verification |
|---|---|---|---|---|---|
| 1 | Customer + Order entities | LOW | small | Keep as-is; remove `virtual` for EF Core eager-load | false |
| 2 | IOrderService (WCF contract) | HIGH | large | Replace `[ServiceContract]` with ASP.NET Core controller interface or gRPC proto | false |
| 3 | AppDbContext + OrderReportService | MEDIUM | medium | Migrate to EF Core `DbContext`, add `.Include()` eager-load, move `OrderReportService` to Services | false |
| 4 | OrderService | HIGH | large | Rewrite as ASP.NET Core service with DI; replace WCF attributes; replace log4net 1.x with `Microsoft.Extensions.Logging` | false |
| 5 | OrdersController | HIGH | large | Rewrite as ASP.NET Core `ControllerBase`; replace `HttpContext.Current` with injected `IHttpContextAccessor`; replace Session with distributed cache | false |
| 6 | Web.config | HIGH | medium | Migrate to `appsettings.json` + `IConfiguration`; move secrets to environment variables or Azure Key Vault; remove `system.serviceModel` block | false |

**Summary fields**:
- `total_estimated_effort`: "3 large, 1 medium, 1 small modules"
- `high_risk_count`: 4
- `low_risk_count`: 1

**Expected Outcomes**: `/analysis-output/migration-plan.json` is valid JSON matching the schema in `AGENTS.md` exactly, with a top-level `summary` object and a `modules` array.

**Todo List**:
- [ ] Write `migration-plan.json` conforming to the AGENTS.md schema.

**Relevant Context**:
- `risk_tier` must be uppercase: `"LOW"`, `"MEDIUM"`, `"HIGH"`.
- `effort_estimate` must be lowercase: `"small"`, `"medium"`, `"large"`.
- `migration_order` is 1-based, ordered by dependency depth (entities first, controller last).
- `needs_verification` = true only when .NET 8 compat is genuinely unknown.

**Status**: [ ] pending — content fully determined, blocked only by file write requiring Agent mode

---

## Schema Validation Checklist (before delivery)

- [ ] `dependency-graph.mmd`: each node label contains exactly one of `LOW`, `MEDIUM`, `HIGH` (uppercase).
- [ ] `migration-plan.json`: top-level keys are exactly `summary` and `modules`.
- [ ] `migration-plan.json`: `summary` has `total_estimated_effort` (string), `high_risk_count` (number), `low_risk_count` (number).
- [ ] `migration-plan.json`: each module has `module_name`, `risk_tier`, `effort_estimate`, `recommended_replacement`, `migration_order`, `needs_verification`.
- [ ] No files in `/legacy-app` are modified.
