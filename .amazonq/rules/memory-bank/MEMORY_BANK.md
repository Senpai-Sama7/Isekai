# Isekai Project Memory Bank

## Project Overview
Isekai is an AI agent system that transforms natural language commands into runnable applications through live iteration with real-time modification and creation based on user actions.

## Core Architecture

### System Components
1. **Frontend** (Port 3000) - React SPA for user interaction
2. **Backend** (Port 8000) - Express.js API server coordinating requests
3. **Planner** (Port 8001) - NLP/AI service for intent analysis and code generation
4. **Sandbox** (Port 8002) - Secure isolated runtime environment

### Technology Stack
- **Runtime**: Node.js >= 18, npm >= 9
- **Language**: TypeScript 5.3.3
- **Backend Framework**: Express.js 5.1.0
- **Frontend Framework**: React 18.2.0
- **Database**: SQLite (better-sqlite3) for development, PostgreSQL for production
- **Containerization**: Docker with docker-compose
- **Orchestration**: Kubernetes manifests available
- **Observability**: OpenTelemetry + Prometheus
- **Contracts**: Protocol Buffers (protobuf)

## Project Structure

```
isekai/
├── packages/
│   ├── backend/          # Express API server (Port 8000)
│   ├── frontend/         # React UI (Port 3000)
│   ├── planner/          # NLP/AI service (Port 8001)
│   ├── sandbox/          # Isolated runtime (Port 8002)
│   ├── contracts/        # Protobuf contracts & generated TS types
│   ├── observability/    # OpenTelemetry & Prometheus helpers
│   └── frontend-web/     # Optional Next.js workspace
├── deploy/k8s/          # Kubernetes manifests
├── dev/compose/         # Docker compose for local dev
├── docs/                # Documentation
├── .github/workflows/   # CI/CD pipelines
└── Makefile            # Build automation
```

## Key Workflows

### App Generation Flow
1. User enters natural language prompt (e.g., "Create CSV viewer app")
2. Frontend → Backend: POST /api/apps/generate
3. Backend → Planner: analyzeIntent(prompt)
4. Planner parses NL, generates plan and code
5. Backend saves app metadata to database
6. Backend → Sandbox: POST /execute {code}
7. Sandbox creates isolated environment, installs dependencies, starts app
8. Backend → Frontend: {appId, previewUrl}
9. Frontend displays running app to user

### Live Iteration Flow
1. User modifies app via natural language (e.g., "Add sorting feature")
2. Frontend → Backend: PATCH /api/apps/:id
3. Backend → Planner: analyzeModification(context, request)
4. Planner returns code changes
5. Backend → Sandbox: PATCH /apps/:id {changes}
6. Sandbox hot reloads changes
7. Frontend shows updated app

### Action Inference Flow
1. User interacts with app (click, type, etc.)
2. Frontend → Backend: POST /api/apps/:id/actions
3. Backend → Planner: inferIntent(action, context)
4. Planner analyzes behavior and returns suggestions/autoFixes
5. Either auto-apply or request user approval
6. Apply changes via Sandbox PATCH

## API Contracts

### Backend API (Port 8000)
- `POST /api/apps/generate` - Generate new app from NL prompt
- `GET /api/apps` - List all applications (with pagination)
- `GET /api/apps/:appId` - Get app details
- `PATCH /api/apps/:appId` - Modify existing app
- `DELETE /api/apps/:appId` - Delete app
- `POST /api/apps/:appId/actions` - Track user actions for inference
- `POST /api/apps/:appId/apply` - Apply suggested changes
- `GET /api/health` - Health check

### Planner API (Port 8001)
- `POST /analyze` - Analyze natural language intent
- `POST /infer` - Infer user intent from actions
- `GET /health` - Health check

### Sandbox API (Port 8002)
- `POST /execute` - Execute code in sandbox
- `GET /apps/:appId` - Get sandbox app status
- `PATCH /apps/:appId` - Hot reload changes
- `DELETE /apps/:appId` - Stop and remove app
- `GET /apps/:appId/logs` - Get application logs (with tail parameter)

## Data Models

### Application
```typescript
{
  id: string;           // UUID
  name: string;
  prompt: string;       // Original NL prompt
  status: 'generating' | 'running' | 'stopped' | 'error';
  previewUrl: string;
  code: {
    files: Record<string, string>;
  };
  metadata: object;
  createdAt: Date;
  updatedAt: Date;
}
```

### Suggestion
```typescript
{
  id: string;
  type: 'improvement' | 'fix' | 'feature';
  description: string;
  confidence: number;   // 0-1
  changes: object;
  autoApply: boolean;
}
```

## Security Features

### Sandbox Security
- Process isolation via containers
- Network restrictions
- File system sandboxing
- Resource limits (CPU, memory, disk)
- Execution timeouts

### API Security
- Helmet.js for security headers
- CORS configuration (environment-based)
- Rate limiting (15min windows):
  - Backend write ops: 100 req/IP
  - Planner: 100 req/IP
  - Sandbox execute: 50 req/IP
- Request body size limits (5-10MB)
- Input validation via express-validator

## Development Commands

### Setup & Installation
```bash
make install          # Install all dependencies
npm install          # Alternative root install
```

### Development
```bash
make dev             # Start all services
npm run dev          # Alternative
npm run dev:frontend # Frontend only
npm run dev:backend  # Backend only
npm run dev:planner  # Planner only
npm run dev:sandbox  # Sandbox only
```

### Testing
```bash
make test            # Run all tests
make smoke-test      # Run smoke test for CSV viewer
npm run test         # Alternative
```

### Building
```bash
make build           # Build all packages
npm run build        # Alternative
```

### Linting
```bash
make lint            # Run all linters
npm run lint         # Alternative
```

### Docker Compose
```bash
docker compose -f dev/compose/docker-compose.yml up --build
```

### Contracts Generation
```bash
make -C packages/contracts gen
```

### Cleanup
```bash
make clean           # Remove node_modules, dist, build, logs
```

## Environment Configuration

### Required Environment Variables
- `PORT` - Service port (default: 8000/8001/8002)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS
- `ALLOWED_ORIGINS` - Comma-separated allowed origins (production)
- `DATABASE_URL` - PostgreSQL connection string (production)

### Development Defaults
- Backend: http://localhost:8000
- Planner: http://localhost:8001
- Sandbox: http://localhost:8002
- Frontend: http://localhost:3000

## Database

### Development
- SQLite via better-sqlite3
- In-memory or file-based
- Initialized via Database.getInstance()

### Production
- PostgreSQL 15+
- Connection via DATABASE_URL
- Managed via docker-compose or K8s

## CI/CD Pipeline

### GitHub Actions Workflow
1. **build-test** job:
   - Checkout code
   - Setup Node.js 20
   - Install dependencies (npm/pnpm)
   - Lint and typecheck
   - Run unit tests
   - Build all packages

2. **compose-integration** job:
   - Setup Docker Buildx
   - Build and start compose stack
   - Health check all services

## Deployment

### Docker Compose (Local/Dev)
- Services: postgres, backend, planner, sandbox, frontend
- Network: isekai-dev
- Volumes: postgres_data
- Health checks on all services

### Kubernetes
- Base manifests in deploy/k8s/base/
- Resources: namespace, deployments, services, network policies
- Kustomization for environment overlays

## Observability

### Metrics
- Each service exposes `/metrics` endpoint
- Prometheus format via prom-client
- Import from `@isekai/observability`

### Tracing
- OpenTelemetry instrumentation
- HTTP and Express auto-instrumentation
- Distributed tracing across services

## Code Conventions

### TypeScript
- Strict mode enabled
- ES2020 target
- CommonJS modules for backend services
- ESM for frontend

### Testing
- Jest for unit tests
- Supertest for API integration tests
- Test files: `*.test.ts` in `tests/` directories

### Linting
- ESLint with TypeScript parser
- Extends recommended configs
- Per-package .eslintrc.json

### File Naming
- camelCase for TypeScript files
- PascalCase for classes/components
- kebab-case for config files

## Communication Protocols

### Backend ↔ Planner
- Protocol: gRPC (HTTP/2 fallback)
- Format: Protocol Buffers
- Timeout: 30s generation, 5s inference
- Contract: packages/contracts/proto/agent_messages.proto

### Backend ↔ Sandbox
- Protocol: REST HTTP
- Format: JSON
- Timeout: 60s execute, 10s updates

### Frontend ↔ Backend
- Protocol: REST HTTP + WebSocket (planned)
- Format: JSON
- Authentication: JWT tokens (planned)

## Key Services & Classes

### Backend
- `Database` - SQLite/PostgreSQL wrapper
- `appRouter` - Application CRUD routes
- `healthRouter` - Health check endpoint
- Controllers: AppController, ExecutionController
- Clients: PlannerClient, SandboxClient

### Planner
- `IntentAnalyzer` - NL prompt analysis
- `CodeGenerator` - Code generation from intent
- Middleware: validation

### Sandbox
- `SandboxManager` - Isolated execution management
- Methods: execute, getStatus, update, stop, getLogs
- Middleware: validation

## Package Dependencies

### Shared Dependencies
- express: ^5.1.0
- cors: ^2.8.5
- helmet: ^8.1.0
- express-rate-limit: ^8.1.0
- express-validator: ^7.2.1
- dotenv: ^16.3.1

### Backend Specific
- axios: ^1.6.2
- better-sqlite3: ^12.4.1
- uuid: ^9.0.0

### Frontend Specific
- react: ^18.2.0
- react-dom: ^18.2.0
- react-scripts: 5.0.1

### Sandbox Specific
- tree-kill: ^1.2.2

### Dev Dependencies
- typescript: ^5.3.3
- ts-node-dev: ^2.0.0
- jest: ^30.2.0
- ts-jest: ^29.1.1
- eslint: ^8.56.0
- @typescript-eslint/*: ^6.17.0

## Important Notes

### Workspace Management
- npm workspaces for monorepo
- Packages linked via `@isekai/*` scope
- Run commands across workspaces: `npm run <cmd> --workspaces`

### Port Allocation
- 3000: Frontend
- 5432: PostgreSQL
- 8000: Backend API
- 8001: Planner Service
- 8002: Sandbox Runtime
- 8070: Sandbox (compose)
- 8080: Backend (compose)
- 8090: Planner (compose)

### Hot Reload
- Development: ts-node-dev with --respawn
- Sandbox: Hot reload via PATCH endpoint
- Frontend: React Fast Refresh

### Error Handling
- Centralized error middleware in Express
- Try-catch in all async routes
- Proper HTTP status codes
- Structured error responses

## Future Enhancements
- WebSocket support for live updates
- JWT authentication
- gRPC implementation for Backend ↔ Planner
- Enhanced observability dashboards
- Multi-language sandbox support
- Collaborative editing features
