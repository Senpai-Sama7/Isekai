# Technology Stack

## Core Technologies

- **Runtime**: Node.js >= 18.0.0, npm >= 9.0.0
- **Language**: TypeScript with strict mode enabled
- **Build System**: npm workspaces with Makefile automation
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Kubernetes with Kustomize, Docker Compose for local dev

## Frontend Stack

- **React**: v18+ with TypeScript
- **Next.js**: v15+ for the web frontend (`packages/frontend-web`)
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: React hooks and context
- **Build Tool**: Create React App (legacy frontend), Next.js (modern frontend)

## Backend Stack

- **Framework**: Express.js v5+ with TypeScript
- **Database**: SQLite with better-sqlite3
- **Security**: Helmet, CORS, rate limiting, CSP headers
- **Validation**: express-validator
- **HTTP Client**: Axios for service communication
- **Process Management**: ts-node-dev for development

## Development Tools

- **Testing**: Jest with ts-jest, Supertest for API testing
- **Linting**: ESLint with TypeScript rules
- **Type Checking**: TypeScript with strict configuration
- **Contracts**: Protocol Buffers with buf for code generation
- **Observability**: OpenTelemetry and Prometheus (via @isekai/observability)

## Common Commands

```bash
# Setup and Installation
make install              # Install all dependencies
npm install              # Install root dependencies only

# Development
make dev                 # Start all services concurrently
npm run dev              # Alternative to make dev
docker compose -f dev/compose/docker-compose.yml up --build  # Docker development

# Building
make build               # Build all packages
npm run build            # Alternative to make build

# Testing
make test                # Run all tests
make smoke-test          # Run smoke tests
npm run test             # Alternative to make test

# Code Quality
make lint                # Run linters
npm run lint             # Alternative to make lint

# Contracts (Protocol Buffers)
make -C packages/contracts gen    # Generate TypeScript from protobuf

# Cleanup
make clean               # Remove build artifacts and dependencies
```

## Port Configuration

- Frontend (React): 3000
- Frontend (Next.js): 3001  
- Backend API: 8000 (dev) / 8080 (container)
- Planner Service: 8001 (dev) / 8090 (container)
- Sandbox Runtime: 8002 (dev) / 8070 (container)

## Environment Configuration

- Use `.env.dev` for development environment variables
- `.env.example` provides template for required variables
- Production uses environment-specific configuration
- CORS origins configured per environment