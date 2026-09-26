# Security Audit Plan — /legacy-app → /analysis-output/security-findings.json

## Top-Level Overview

Audit the legacy ASP.NET Framework 4.7.2 app under `/legacy-app` for security and compliance
issues relevant to FedRAMP, HIPAA, and PCI-DSS style standards, then write all findings into
`/analysis-output/security-findings.json` using the exact schema defined in AGENTS.md.

The output schema is:
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

Rules: `severity` must be lowercase (`low`, `medium`, `high`). No extra fields. No "critical" tier —
map critical findings to `"high"`.

---

## Sub-Task 1 — Write security-findings.json

**Status**: [ ] pending

**Intent**  
Translate the 22 findings discovered during codebase exploration into a valid
`security-findings.json` file. This is the single deliverable of the whole task — no code in
`/legacy-app` should be modified.

**Expected Outcomes**
- `/analysis-output/security-findings.json` exists and is valid JSON
- All 22 findings are present
- Every entry has exactly the five required fields: `file`, `line`, `issue`, `severity`, `relevant_standard`
- `severity` values are all lowercase (`low`, `medium`, `high`); "critical" is mapped to `"high"`
- `file` paths are relative to the workspace root (e.g. `legacy-app/LegacyApp/Web.config`)
- `line` is an integer (use the primary/most representative line number for multi-line spans)

**Todo List**

1. Write the full 22-entry JSON array to `analysis-output/security-findings.json`
2. Verify the JSON is syntactically valid (no trailing commas, balanced brackets)
3. Spot-check that every `severity` value is lowercase and no "critical" strings are present
4. Confirm all five required fields are present on every entry

**Relevant Context**

Files examined during audit:
- [`legacy-app/LegacyApp/Web.config`](legacy-app/LegacyApp/Web.config)
- [`legacy-app/LegacyApp/Controllers/OrdersController.cs`](legacy-app/LegacyApp/Controllers/OrdersController.cs)
- [`legacy-app/LegacyApp/Services/OrderService.cs`](legacy-app/LegacyApp/Services/OrderService.cs)
- [`legacy-app/LegacyApp/Models/AppDbContext.cs`](legacy-app/LegacyApp/Models/AppDbContext.cs)
- [`legacy-app/LegacyApp/LegacyApp.csproj`](legacy-app/LegacyApp/LegacyApp.csproj)

Schema contract: [`AGENTS.md`](AGENTS.md) lines 63–74

**Findings to include** (22 entries):

| # | file | line | issue | severity | relevant_standard |
|---|------|------|-------|----------|-------------------|
| 1 | legacy-app/LegacyApp/Web.config | 22 | Hardcoded database password in connection string | high | PCI-DSS 3.2.1, FedRAMP SC-28, HIPAA §164.312(a)(2)(iv) |
| 2 | legacy-app/LegacyApp/Web.config | 32 | Hardcoded API key in appSettings | high | PCI-DSS 2.2.4, FedRAMP SC-28 |
| 3 | legacy-app/LegacyApp/Web.config | 48 | WCF basicHttpBinding with no transport security — data in cleartext | high | PCI-DSS 4.1, FedRAMP SC-8, HIPAA §164.312(e)(1) |
| 4 | legacy-app/LegacyApp/Web.config | 36 | compilation debug=true exposes detailed error pages in production | high | OWASP A09:2021, FedRAMP SI-11 |
| 5 | legacy-app/LegacyApp/Web.config | 58 | WCF serviceMetadata httpGetEnabled=true exposes WSDL to public | high | OWASP A09:2021, FedRAMP SI-11 |
| 6 | legacy-app/LegacyApp/Web.config | 59 | WCF includeExceptionDetailInFaults=true leaks stack traces to clients | high | OWASP A09:2021, FedRAMP SI-11 |
| 7 | legacy-app/LegacyApp/Web.config | 38 | FormsAuthentication without requireSSL=true on authentication cookie | medium | OWASP A07:2021, PCI-DSS 8.1.4 |
| 8 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 42 | Missing [Authorize] attribute — Details action open to unauthenticated callers | high | OWASP A01:2021, FedRAMP AC-3 |
| 9 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 55 | Missing [Authorize] attribute — Place action open to unauthenticated callers | high | OWASP A01:2021, FedRAMP AC-3 |
| 10 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 58 | No input validation on customerId and total parameters — negative/extreme values accepted | medium | OWASP A01:2021, OWASP A05:2021 |
| 11 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 44 | Cookie value read without validation or Secure/HttpOnly flags enforced | medium | PCI-DSS 6.5.10, OWASP A05:2021 |
| 12 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 61 | REMOTE_ADDR from ServerVariables can be spoofed — no proxy trust validation | medium | OWASP A01:2021 |
| 13 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 37 | ViewBag.Username passed to view without explicit HTML encoding — XSS risk | medium | OWASP A03:2021 |
| 14 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 81 | Raw exception message returned in ModelState — information disclosure to client | high | OWASP A09:2021, FedRAMP AU-12 |
| 15 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 71 | Application-state lock used as shared cache — no expiry, not safe in web farm | low | OWASP A05:2021 |
| 16 | legacy-app/LegacyApp/Controllers/OrdersController.cs | 22 | Direct instantiation of concrete service — prevents testability and mocking | low | OWASP A05:2021 |
| 17 | legacy-app/LegacyApp/Services/OrderService.cs | 19 | WCF InstanceContextMode.Single with ConcurrencyMode.Single — shared mutable state race condition | high | OWASP A01:2021, FedRAMP SC-2 |
| 18 | legacy-app/LegacyApp/Services/OrderService.cs | 47 | Exception swallowed and null returned — caller cannot distinguish not-found from error | medium | OWASP A09:2021, FedRAMP AU-12 |
| 19 | legacy-app/LegacyApp/Services/OrderService.cs | 23 | log4net 1.2.10 is deprecated with no .NET Core support — log injection risk | medium | OWASP A09:2021 |
| 20 | legacy-app/LegacyApp/Services/OrderService.cs | 86 | DateTime.Now used instead of UtcNow — audit timestamps inconsistent across server time zones | low | OWASP A09:2021 |
| 21 | legacy-app/LegacyApp/Models/AppDbContext.cs | 33 | N+1 query pattern with lazy loading — unbounded query count enables resource exhaustion | medium | OWASP A05:2021 |
| 22 | legacy-app/LegacyApp/LegacyApp.csproj | 23 | Full debug symbols compiled into build artifact — sensitive type/method info exposed | medium | OWASP A09:2021 |
