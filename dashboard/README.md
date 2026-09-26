# NetMigrate Dashboard

React + Node/Express web dashboard for the NetMigrate analysis output.

## Structure

```
dashboard/
  server/          Node/Express API server
    index.js       Entry point — serves /api routes + React static files
    routes/
      analysis.js  Read-only endpoints for /analysis-output files
  client/          Vite + React frontend
    src/
      pages/       One component per view (6 views)
      components/  Layout shell
      api.js       Thin fetch wrapper
  package.json     Workspace scripts
```

## Running in Development

Two terminals are required in development:

```bash
# Terminal 1 — API server (port 3001)
cd dashboard/server
npm install
npm run dev

# Terminal 2 — React dev server with proxy (port 5173)
cd dashboard/client
npm install
npm run dev
```

Then open http://localhost:5173

## Running in Production

```bash
# 1. Build the React app
cd dashboard/client && npm run build

# 2. Start the Express server (serves the built React app + API)
cd dashboard/server && npm start
```

Then open http://localhost:3001

## API Endpoints

All endpoints are read-only and served from `/analysis-output/`.

| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/health` | `{ status, timestamp }` |
| GET | `/api/analysis/codebase-explanation` | JSON array |
| GET | `/api/analysis/migration-plan` | JSON object |
| GET | `/api/analysis/security-findings` | JSON array |
| GET | `/api/analysis/dependency-graph` | Mermaid `.mmd` text |
| GET | `/api/analysis/modernized-samples` | `["name", ...]` |
| GET | `/api/analysis/modernized-samples/:name` | `{ name, before, after, rationale }` |

> **Note:** Upload endpoints are not yet implemented. The server is structured to accommodate a future `/api/upload` router when that feature is added.

## Dashboard Views

| View | Route | Description |
|------|-------|-------------|
| Overview | `/overview` | Summary stats, risk breakdown, migration order |
| Codebase | `/codebase` | Plain-English module explanations |
| Migration Plan | `/migration` | Sorted migration table with risk/effort badges |
| Security | `/security` | Filterable security findings table |
| Dependency Graph | `/dependency-graph` | Rendered Mermaid flowchart |
| Code Samples | `/samples` | Before/after/rationale tabs for 3 migration patterns |
