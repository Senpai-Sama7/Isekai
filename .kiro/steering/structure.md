# Project Structure

## Root Level Organization

```
isekai/
├── packages/           # Monorepo packages (npm workspaces)
├── docs/              # Documentation and specifications
├── deploy/            # Kubernetes manifests and deployment configs
├── dev/               # Development tooling and Docker Compose
├── evidence/          # Test evidence and validation artifacts
├── fixes/             # Temporary fixes and patches
├── .kiro/             # Kiro AI assistant configuration
├── .github/           # GitHub Actions CI/CD workflows
├── Makefile           # Build automation and common tasks
└── package.json       # Root workspace configuration
```

## Package Architecture

### Core Services
- `packages/backend/` - Express API server (port 8000/8080)
- `packages/planner/` - AI/NLP service for intent analysis (port 8001/8090)  
- `packages/sandbox/` - Secure code execution environment (port 8002/8070)

### Frontend Applications
- `packages/frontend/` - Legacy React SPA with Create React App
- `packages/frontend-web/` - Modern Next.js application with advanced features

### Shared Libraries
- `packages/contracts/` - Protocol Buffer definitions and generated TypeScript types
- `packages/observability/` - OpenTelemetry and Prometheus instrumentation
- `packages/types/` - Shared TypeScript type definitions

## Package Structure Conventions

Each service package follows this structure:
```
packages/{service}/
├── src/
│   ├── index.ts           # Main entry point
│   ├── controllers/       # Request handlers
│   ├── services/          # Business logic
│   ├── middleware/        # Express middleware
│   ├── routes/           # API route definitions
│   └── db/               # Database layer (backend only)
├── tests/                # Jest test files
├── Dockerfile            # Container definition
├── package.json          # Package dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Test configuration
└── .eslintrc.json        # Linting rules
```

## Frontend-Web Advanced Structure

The Next.js frontend includes additional organization:
```
packages/frontend-web/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   └── ui/          # Reusable UI components (Radix/Tailwind)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and configurations
│   └── types/           # TypeScript type definitions
├── packages/            # Internal workspace packages
│   ├── evaluation/      # Code analysis and testing services
│   ├── perception/      # User interaction analysis
│   ├── planner/         # Planning and orchestration logic
│   ├── runtime/         # Sandbox management
│   ├── synthesis/       # Code generation and templates
│   ├── types/           # Shared type definitions
│   └── ui/              # UI component library
├── prisma/              # Database schema (if using Prisma)
├── public/              # Static assets
└── scripts/             # Build and utility scripts
```

## Configuration Files

- **TypeScript**: Strict mode enabled, ES2020 target, CommonJS modules for services
- **ESLint**: TypeScript rules with service-specific configurations
- **Docker**: Multi-stage builds with health checks, Alpine base images
- **Environment**: `.env.dev` for development, `.env.example` as template

## Naming Conventions

- **Packages**: Scoped with `@isekai/` prefix (e.g., `@isekai/backend`)
- **Files**: kebab-case for directories, camelCase for TypeScript files
- **Components**: PascalCase for React components
- **Services**: camelCase with descriptive suffixes (e.g., `plannerService.ts`)
- **Tests**: Match source file names with `.test.ts` suffix

## Import/Export Patterns

- Use barrel exports (`index.ts`) for package entry points
- Relative imports within packages, absolute imports across packages
- Prefer named exports over default exports for better tree-shaking
- Group imports: external libraries, internal packages, relative imports