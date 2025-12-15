# Isekai AI Agent System - Development Context

## Project Overview

Isekai is a sophisticated monorepo architecture that transforms natural language into live, running applications through an AI-powered system. The platform consists of four main services (frontend, backend, planner, and sandbox) that work together to provide a complete application generation and execution platform.

The system is built with TypeScript, React, Express.js, and SQLite, following modern software engineering practices with comprehensive testing (89% coverage), proper security measures, and well-documented architecture.

## Project Structure

```
isekai/
├── 📦 packages/
│   ├── frontend/          # React UI (Port 3001)
│   ├── backend/           # Express API (Port 8080)
│   ├── planner/           # AI Service (Port 8090)
│   ├── sandbox/           # Runtime (Port 8070)
│   ├── contracts/         # Protocol Buffers & API contracts
│   └── observability/     # Telemetry & monitoring
├── 📚 docs/               # Documentation
├── 🐳 dev/compose/        # Docker Compose configs
├── ☸️ deploy/k8s/         # Kubernetes manifests
├── 🔨 Makefile            # Build automation
└── 📦 package.json        # Monorepo root
```

## Key Services

### 1. Frontend Service (React 18, Port 3001)
- User interface for app generation and interaction
- Real-time code preview and management
- AI-powered suggestions panel

### 2. Backend Service (Express.js, Port 8080) 
- API orchestration and coordination layer
- Database persistence (SQLite)
- Cross-service communication hub

### 3. Planner Service (Express.js, Port 8090)
- AI/NLP intent analysis engine
- Code generation and component inference

### 4. Sandbox Service (Express.js, Port 8070)
- Secure isolated execution environment
- Process management and resource limitation
- Secure npm installation with --ignore-scripts flag
- Dependency validation with allowlist/blocklist
- Enhanced security sandbox with additional environment restrictions

## Building and Running

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Development Commands
```bash
# Install all dependencies
make install
# or
npm install

# Start all services in development mode
make dev
# or
npm run dev

# Build all packages
make build
# or
npm run build

# Run tests
make test
# or
npm run test

# Run linters
npm run lint

# Run smoke test
make smoke-test

# Clean build artifacts
make clean
```

### Service URLs
- Frontend: http://localhost:3001
- Backend API: http://localhost:8080
- Planner Service: http://localhost:8090
- Sandbox Runtime: http://localhost:8070

### Docker Compose Development
```bash
docker compose -f dev/compose/docker-compose.yml up --build
```

## Development Conventions

### Coding Standards
- TypeScript with 2-space indentation
- ESLint with `eslint:recommended` and `@typescript-eslint` presets
- Prefix intentionally unused parameters with `_`
- Use `PascalCase` for React components, `camelCase` for hooks/utilities
- Suffix singleton services with `Service`
- Backend controllers in `packages/backend/src/controllers` export `{resource}Controller`
- Never commit built `dist/` assets or non-templated `.env*` files

### Testing Guidelines
- Backend, planner, and sandbox use Jest
- Frontend uses React Testing Library with `react-scripts test`
- Track coverage against `TEST_COVERAGE_SUMMARY.md`
- Stub external HTTP calls for deterministic CI
- Follow AAA pattern (Arrange, Act, Assert)

### Commit Guidelines
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`
- Maximum 72 characters for commit subjects
- Group changes by package for clarity

### API Design
- Follow RESTful conventions
- Use appropriate HTTP methods and status codes
- Document endpoints with OpenAPI format

## Key Files and Configuration

- `package.json` - Monorepo root with workspace configuration
- `Makefile` - Build automation and common commands
- `README.md` - Comprehensive project documentation with architecture diagrams
- `RUNNING_SYSTEM.md` - Current operational status and service management
- `AGENTS.md` - Development guidelines and repository standards
- `CONTRIBUTING.md` - Contribution guidelines and development workflow
- `TEST_COVERAGE_SUMMARY.md` - Detailed test coverage information
- `.env.example` - Environment variable examples

## System Architecture

### Communication Flow
1. **App Generation**: User prompt → Frontend → Backend → Planner (intent analysis) → Backend → Sandbox (execution) → Frontend (preview)
2. **Modification**: User request → Frontend → Backend → Planner → Sandbox → Frontend
3. **Suggestions**: User interactions → Frontend → Backend → Planner → Suggestions to Frontend

### Security Features
- Helmet.js security headers
- CORS with validated origins
- Rate limiting per IP
- Input validation and path traversal protection
- Sandboxed execution environment with resource limits
- Secure npm install with `--ignore-scripts` flag to prevent malicious postinstall scripts
- Dependency validation with allowlist/blocklist for safe package installation
- Enhanced database input validation to prevent injection attacks

### Data Flow
- SQLite database stores app metadata, generated code, and interaction history
- JSON serialization for code and metadata
- Correlation IDs for request tracing
- Structured logging for observability

## Critical Security Considerations

⚠️ **High Priority Issue**: The npm install process in the sandbox environment currently runs with `--ignore-scripts` flag disabled, which could potentially execute malicious postinstall scripts. This requires immediate security hardening.

## Testing

### Test Statistics
- Backend: 98.52% statement coverage, 28 tests
- Planner: 100% coverage, 21 tests  
- Sandbox: 90.19% statement coverage, 17 tests
- Total: 91 tests across all packages

### Running Tests
```bash
# All tests
npm test

# Specific package
cd packages/backend && npm test

# With coverage
npm test -- --coverage

# Specific test file
npm test -- tests/apps.test.ts
```

## API Endpoints

- `POST /api/apps/generate` - Generate new app from prompt
- `GET /api/apps` - List all apps
- `GET /api/apps/:id` - Get specific app details
- `PATCH /api/apps/:id` - Update app with changes
- `DELETE /api/apps/:id` - Delete app
- `GET /api/health` - System health check
- `POST /api/apps/:id/actions` - Track user interactions
- `POST /api/apps/:id/apply` - Apply suggestions

## Performance and Reliability

- SQLite configured with WAL mode for better concurrency
- Resource limits in sandbox environment (memory, CPU, time)
- Graceful shutdown handling with proper cleanup
- Process management with tree-kill for complete termination
- Database checkpointing to prevent unbounded growth
- Circuit breaker patterns for resilient service communication
- Exponential backoff retry mechanisms with configurable parameters
- Enhanced observability with structured logging and correlation IDs
- Prometheus metrics collection (request duration, active requests)
- OpenTelemetry integration for distributed tracing

## Deployment

- Docker containerization support
- Kubernetes manifests under `deploy/k8s`
- Environment configuration with `.env` files
- Production-ready with circuit breaker patterns and retry logic