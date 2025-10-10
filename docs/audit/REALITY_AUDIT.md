# Reality Audit Report

## Prerequisites

| Requirement | Status | Notes |
|-------------|--------|-------|
| Node.js >= 18 | Available | `node -v` reports v22.19.0 (system default). |
| npm >= 9 | Available | `npm -v` reports 11.4.2. |
| Planner service running on `http://localhost:8001` | Missing | Smoke test logs and health probe show `ECONNREFUSED`. |
| Sandbox service running on `http://localhost:8002` | Missing | Smoke test logs and health probe show `ECONNREFUSED`. |
| SQLite write permissions | Available | Backend initializes local DB without error during tests. |

## How to Run

1. **Bootstrap**
   ```bash
   make install
   ```
2. **Start services**
   ```bash
   # In separate terminals if planner/sandbox are implemented
   npm run dev:backend
   npm run dev:planner
   npm run dev:sandbox
   npm run dev:frontend
   ```
3. **Smoke test**
   ```bash
   make smoke-test
   ```
4. **Stop services**
   - Use `Ctrl+C` in each terminal.

Environment variables of interest:
- `PLANNER_URL` (defaults to `http://localhost:8001`).
- `SANDBOX_URL` (defaults to `http://localhost:8002`).
- `FRONTEND_URL` for backend CORS policy.

## Artifacts Written
- `REALITY_CHECKLIST.txt`
- `features.json`
- `evidence/`
  - `make_smoke-test.txt`
  - `curl_planner_health.txt`
  - `curl_sandbox_health.txt`
- `sha256sums.txt`
- `docs/audit/REALITY_AUDIT.md`
- `fixes/` (empty placeholder for reversible patches)

## Feature Inventory & Verification Matrix

| ID | Feature | Command | Expected Signal | Status | Evidence |
|----|---------|---------|-----------------|--------|----------|
| F1 | Backend CSV app generation flow | `make smoke-test` | Jest suite passes, CSV viewer assets persisted | VERIFIED | [`evidence/make_smoke-test.txt`](../../evidence/make_smoke-test.txt) |
| F2 | Planner service health endpoint responds | `curl -s -o "%{http_code}" http://localhost:8001/health` | HTTP 200 JSON payload | UNVERIFIED | [`evidence/curl_planner_health.txt`](../../evidence/curl_planner_health.txt) |
| F3 | Sandbox service health endpoint responds | `curl -s -o "%{http_code}" http://localhost:8002/health` | HTTP 200 JSON payload | UNVERIFIED | [`evidence/curl_sandbox_health.txt`](../../evidence/curl_sandbox_health.txt) |

## Observations

- The backend smoke suite passes due to mocked fallbacks in planner and sandbox services when upstream endpoints refuse connections.【F:packages/backend/src/services/plannerService.ts†L7-L38】【F:packages/backend/src/services/sandboxService.ts†L5-L47】
- Planner fallback only returns CSV viewer scaffolding; other prompts throw `Failed to analyze prompt`, so current end-to-end capability is limited without a live planner implementation.【F:packages/backend/src/services/plannerService.ts†L15-L22】
- Sandbox fallback returns a fabricated runtime URL and status, so no real execution occurs without the sandbox service running.【F:packages/backend/src/services/sandboxService.ts†L13-L24】
- Helmet CSP limits external connections to self and configured frontend origin; adjust `FRONTEND_URL` to match deployment target.【F:packages/backend/src/index.ts†L12-L45】

## Fix Log

_No fixes were attempted; investigation only._

## Stuck Items

| ID | Hypotheses | Actionable Solutions | Verification Steps |
|----|------------|----------------------|--------------------|
| F2 | Planner service is not running; no process bound to port 8001. | Implement or start planner server (`packages/planner`) and expose `/analyze` and `/health` endpoints. | 1. `npm run dev:planner`.<br>2. `curl http://localhost:8001/health` should return HTTP 200 with status payload.<br>3. Re-run `make smoke-test` to confirm planner calls succeed without fallback logs. |
| F3 | Sandbox service is not running; no process bound to port 8002. | Launch sandbox runtime (`packages/sandbox`) exposing `/health`, `/execute`, `/apps/:id`. Ensure network access between backend and sandbox. | 1. `npm run dev:sandbox`.<br>2. `curl http://localhost:8002/health` should return HTTP 200 JSON.<br>3. Re-run `make smoke-test` and confirm sandbox logs show real execution instead of fallback. |

## Readiness Verdict

**Not Ready** — Missing planner and sandbox services block real app generation and execution. Restore those services and rerun the verification steps above to transition to Ready status.
