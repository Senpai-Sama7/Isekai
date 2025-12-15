# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start all services (backend:8080, planner:8090, sandbox:8070, frontend:3001)
npm run dev

# Start individual services
npm run dev:backend   # Port 8080
npm run dev:planner   # Port 8090
npm run dev:sandbox   # Port 8070
npm run dev:frontend  # Port 3001

# Alternative: use Make commands
make dev              # Start all services
make install          # Install all workspace dependencies
```

### Building
```bash
# Build all workspaces
npm run build

# Build specific workspace
npm run build --workspace=@isekai/backend
npm run build --workspace=@isekai/planner
npm run build --workspace=@isekai/sandbox
npm run build --workspace=@isekai/frontend
```

### Testing
```bash
# Run all tests across workspaces
npm run test

# Run tests for specific workspace
npm run test --workspace=@isekai/backend
npm run test --workspace=@isekai/planner
npm run test --workspace=@isekai/sandbox
npm run test --workspace=@isekai/frontend

# Run backend smoke tests (CSV viewer generation)
npm run test --workspace=@isekai/backend -- test:smoke

# Run specific test file
npm run test --workspace=@isekai/backend -- tests/apps.test.ts

# Run with coverage
npm run test -- --coverage
```

### Linting
```bash
# Lint all workspaces
npm run lint

# Lint specific workspace
npm run lint --workspace=@isekai/backend
```

### Docker Compose
```bash
# Start full stack with Docker
docker compose -f dev/compose/docker-compose.yml up --build

# Stop and clean up
docker compose -f dev/compose/docker-compose.yml down
```

### Contracts (Protocol Buffers)
```bash
# Generate TypeScript types from .proto files
make -C packages/contracts gen
```

### Database Operations
```bash
# Access SQLite database directly
sqlite3 packages/data/isekai.db

# Quick queries
sqlite3 packages/data/isekai.db "SELECT COUNT(*) FROM apps;"
sqlite3 packages/data/isekai.db "SELECT id, name, status FROM apps LIMIT 10;"

# Reset database (caution: deletes all data)
rm packages/data/isekai.db
```

## High-Level Architecture

Isekai is an **npm workspace monorepo** with a microservices architecture that transforms natural language prompts into live, runnable applications.

### Core Services

1. **Frontend** (`packages/frontend`, React 18)
   - Port: **3001** (dev), 3000 (prod)
   - User interface for app generation and management
   - Communicates with Backend API via REST

2. **Backend** (`packages/backend`, Express 5 + TypeScript)
   - Port: **8080**
   - API orchestration and coordination layer
   - Controllers: `appController.ts` handles app generation, modification, deletion
   - Services: `plannerService.ts`, `sandboxService.ts` for inter-service communication
   - Database: SQLite via `better-sqlite3` (singleton pattern in `db/database.ts`)
   - Middleware: CORS, Helmet, rate limiting, validation, error handling, correlation IDs

3. **Planner** (`packages/planner`, Express 5 + TypeScript)
   - Port: **8090**
   - NLP/AI service for intent analysis and code generation
   - Services:
     - `intentAnalyzer.ts` - parses prompts to determine app type
     - `codeGenerator.ts` - generates React/HTML/JS code
     - `codeGenerationStrategy.ts` - strategy pattern for different app types
   - Supports: CSV viewer, Todo app, Markdown editor, generic apps

4. **Sandbox** (`packages/sandbox`, Express 5 + TypeScript)
   - Port: **8070**
   - Isolated runtime environment for secure code execution
   - `sandboxManager.ts` - manages app lifecycles via child processes
   - Security: `--ignore-scripts` flag, path validation, resource limits

### Supporting Packages

- **`packages/contracts`**: Protocol Buffer definitions and generated TypeScript types for service contracts
- **`packages/observability`**: OpenTelemetry instrumentation and Prometheus metrics (exposes `/metrics` endpoint)
- **`packages/data`**: SQLite database (`isekai.db`) and sandbox app storage (`sandbox-apps/`)
- **`packages/frontend-web`**: Optional Next.js variant (if present)

### Request Flow

```
User Input → Frontend:3001
  ↓ POST /api/apps/generate
Backend:8080 (AppController)
  ↓ analyzeIntent(prompt)
Planner:8090 (IntentAnalyzer + CodeGenerator)
  ↓ returns { intent, code.files }
Backend:8080
  ↓ execute(appId, files)
Sandbox:8070 (SandboxManager)
  ↓ spawns isolated process
Backend:8080
  ↓ saves to SQLite, returns response
Frontend:3001 (displays running app)
```

### Cross-Cutting Concerns

- **Resilience**: Circuit breakers, retries with exponential backoff (`resilienceService.ts`)
- **Observability**: Correlation IDs, structured logging (`observability/logger.ts`), Prometheus metrics
- **Security**: Input validation (Joi schemas), XSS prevention, CORS, rate limiting, path traversal protection
- **Database Schema**:
  - `apps` table: `id`, `name`, `prompt`, `status`, `code` (JSON), `metadata` (JSON), `previewUrl`, `createdAt`, `updatedAt`
  - `suggestions` table: action tracking and AI-generated suggestions

## Testing Strategy

- **Backend**: Jest with `supertest` for HTTP endpoint testing, mocked services (`tests/apps.test.ts`, `tests/appController.test.ts`)
- **Planner**: Jest for code generation validation (`tests/codeGenerator.test.ts`)
- **Sandbox**: Jest with mocked `child_process.spawn` and filesystem operations (`tests/sandboxManager.test.ts`)
- **Frontend**: React Testing Library with `react-scripts test`
- **Coverage Thresholds**: 80% statements, 70% branches, 80% functions, 80% lines (enforced via `jest.config.js`)

## Deployment

- **Docker**: Each service has a `Dockerfile` in its package directory
- **Kubernetes**: Base manifests in `deploy/k8s/` (deployment, service, configmap resources)
- **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) runs lint, test, build, and Docker Compose integration tests
- **Environment**: Requires Node.js 18+, npm 9+; seed environment from `.env.example` files

## Code Style & Conventions

- **Language**: TypeScript with 2-space indentation
- **Linting**: ESLint (`eslint:recommended`, `@typescript-eslint`) across all workspaces
- **Controllers**: Suffixed with `Controller` (e.g., `appController.ts`), located in `packages/backend/src/controllers/`
- **Services**: Suffixed with `Service` for singletons (e.g., `plannerService.ts`), located in `packages/{backend,planner,sandbox}/src/services/`
- **Unused Parameters**: Prefix with `_` (e.g., `_req`, `_unusedParam`)
- **Naming**: `PascalCase` for classes/React components, `camelCase` for functions/hooks/utilities
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, max 72 chars)
- **Never Commit**: Built `dist/` directories, `.env*` files (except `.env.example`), or `node_modules/`

## Service Ports Reference

| Service | Dev Port | Prod Port | Docker Compose |
|---------|----------|-----------|----------------|
| Frontend | 3001 | 3000 | 3000 |
| Backend | 8080 | 8080 | 8080 |
| Planner | 8090 | 8090 | 8090 |
| Sandbox | 8070 | 8070 | 8070 |

## Key Files to Understand

- `packages/backend/src/controllers/appController.ts` - Main orchestration logic for app generation
- `packages/backend/src/db/database.ts` - SQLite singleton with schema and queries
- `packages/planner/src/services/codeGenerationStrategy.ts` - Strategy pattern for different app types
- `packages/sandbox/src/services/sandboxManager.ts` - Isolated app execution and process management
- `packages/backend/src/services/resilienceService.ts` - Circuit breaker and retry logic

## Troubleshooting

### Port Already in Use
```bash
# Find process using port (e.g., 8080)
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Service Not Responding
```bash
# Check process status
ps aux | grep -E "node.*isekai"

# Check Docker health (if using compose)
docker compose -f dev/compose/docker-compose.yml ps
docker compose -f dev/compose/docker-compose.yml logs backend
```

### Database Issues
```bash
# Verify database exists and is readable
ls -lh packages/data/isekai.db
sqlite3 packages/data/isekai.db ".tables"

# Reset database (caution: deletes all apps)
rm packages/data/isekai.db
npm run dev:backend  # Will recreate schema
```

### Test Failures
```bash
# Run tests with verbose output
npm run test --workspace=@isekai/backend -- --verbose

# Clear Jest cache
npm run test --workspace=@isekai/backend -- --clearCache
```
