# Isekai - AI Agent System

An AI agent that turns natural language into runnable apps via live iteration with real-time modification and creation based on user actions.

## Architecture

### System Overview

The system consists of four main components:
1. **Frontend**: React-based UI for user interaction
2. **Backend**: API server coordinating requests
3. **Planner**: AI-powered natural language processor
4. **Sandbox**: Secure isolated runtime environment

### Quick Start

```bash
# Install dependencies
make install

# Start all services
make dev

# Run smoke test
make smoke-test
```

## Architecture Diagrams

### C4 Context Diagram

```mermaid
graph TB
    User[User]
    Isekai[Isekai AI Agent System]
    AI[AI/LLM Service]
    
    User -->|Natural Language Commands| Isekai
    Isekai -->|Generated Apps| User
    Isekai -->|AI Queries| AI
    AI -->|Code Generation| Isekai
    
    style Isekai fill:#4a90e2,stroke:#2e5c8a,stroke-width:2px,color:#fff
    style User fill:#95de64,stroke:#52c41a,stroke-width:2px
    style AI fill:#ffc069,stroke:#fa8c16,stroke-width:2px
```

### C4 Container Diagram

```mermaid
graph TB
    User[User<br/>Web Browser]
    
    subgraph Isekai System
        Frontend[Frontend<br/>React SPA<br/>Port 3000]
        Backend[Backend API<br/>Express.js<br/>Port 8000]
        Planner[Planner Service<br/>NLP/AI<br/>Port 8001]
        Sandbox[Sandbox Runtime<br/>Docker/VM<br/>Port 8002]
    end
    
    DB[(SQLite DB)]
    FileStore[(File Storage)]
    AI[External AI/LLM]
    
    User -->|HTTPS| Frontend
    Frontend -->|REST API| Backend
    Backend -->|gRPC| Planner
    Backend -->|REST| Sandbox
    Planner -->|API| AI
    Backend --> DB
    Sandbox --> FileStore
    
    style Frontend fill:#61dafb,stroke:#20232a,stroke-width:2px
    style Backend fill:#68a063,stroke:#404d3f,stroke-width:2px
    style Planner fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px
    style Sandbox fill:#ffd93d,stroke:#f39c12,stroke-width:2px
```

### C4 Component Diagram - Backend

```mermaid
graph TB
    subgraph Backend API
        Router[API Router]
        AppCtrl[App Controller]
        ExecCtrl[Execution Controller]
        PlannerClient[Planner Client]
        SandboxClient[Sandbox Client]
        DB[Database Layer]
        Auth[Auth Middleware]
    end
    
    Frontend[Frontend] -->|HTTP| Router
    Router --> Auth
    Auth --> AppCtrl
    Auth --> ExecCtrl
    AppCtrl --> PlannerClient
    AppCtrl --> DB
    ExecCtrl --> SandboxClient
    ExecCtrl --> DB
    PlannerClient -->|gRPC| Planner[Planner Service]
    SandboxClient -->|REST| Sandbox[Sandbox Runtime]
    
    style Router fill:#4ecdc4,stroke:#2d7a74,stroke-width:2px
    style Auth fill:#ffe66d,stroke:#f7b731,stroke-width:2px
```

### Sequence Diagram - App Generation Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Planner
    participant Sandbox
    
    User->>Frontend: Enter "Create CSV viewer app"
    Frontend->>Backend: POST /api/apps/generate
    Backend->>Planner: analyzeIntent(prompt)
    Planner->>Planner: Parse NL, generate plan
    Planner-->>Backend: {intent, components, code}
    Backend->>Backend: Save app metadata
    Backend->>Sandbox: POST /execute {code}
    Sandbox->>Sandbox: Create isolated env
    Sandbox->>Sandbox: Install dependencies
    Sandbox->>Sandbox: Start app
    Sandbox-->>Backend: {status, url, logs}
    Backend-->>Frontend: {appId, previewUrl}
    Frontend-->>User: Show running app
    
    Note over User,Sandbox: User modifies app
    User->>Frontend: "Add sorting feature"
    Frontend->>Backend: PATCH /api/apps/:id
    Backend->>Planner: analyzeModification(context, request)
    Planner-->>Backend: {changes}
    Backend->>Sandbox: PATCH /apps/:id {changes}
    Sandbox->>Sandbox: Hot reload changes
    Sandbox-->>Backend: {status, updated}
    Backend-->>Frontend: {success}
    Frontend-->>User: Show updated app
```

### Sequence Diagram - Live Iteration Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Planner
    participant Sandbox
    
    User->>Frontend: Interact with app (click, type)
    Frontend->>Backend: POST /api/apps/:id/actions
    Backend->>Planner: inferIntent(action, context)
    Planner->>Planner: Analyze user behavior
    Planner-->>Backend: {suggestions, autoFixes}
    
    alt Auto-apply inference
        Backend->>Sandbox: PATCH /apps/:id {autoFixes}
        Sandbox-->>Backend: {applied}
        Backend-->>Frontend: {changes, notification}
        Frontend-->>User: Show improvements
    else Manual approval
        Backend-->>Frontend: {suggestions}
        Frontend-->>User: Show suggestions
        User->>Frontend: Approve changes
        Frontend->>Backend: POST /api/apps/:id/apply
        Backend->>Sandbox: PATCH /apps/:id
        Sandbox-->>Backend: {applied}
        Backend-->>Frontend: {success}
    end
```

## API Contracts

See [API Documentation](./docs/api-contracts.md) for detailed API specifications.

## Security

The sandbox runtime provides:
- Process isolation via containers
- Network restrictions
- File system sandboxing
- Resource limits (CPU, memory, disk)
- Execution timeouts

## Development

### Prerequisites
- Node.js >= 18
- Docker (for sandbox)
- npm >= 9

### Project Structure
```
isekai/
├── packages/
│   ├── frontend/      # React UI
│   ├── backend/       # Express API server
│   ├── planner/       # NLP/AI service
│   └── sandbox/       # Isolated runtime
├── docs/              # Documentation
├── Makefile           # Build automation
└── package.json       # Root package
```

### Running Tests
```bash
make test
```

### Building for Production
```bash
make build
```

## License

MIT
## Production Upgrade Additions

This repository has been upgraded with:
- `packages/contracts` for protobuf contracts and pre-generated TS types
- `packages/observability` with OpenTelemetry and Prometheus helpers
- Per-service Dockerfiles and a local compose stack in `dev/compose`
- GitHub Actions CI with lint, test, build, and compose smoke
- Kubernetes base manifests under `deploy/k8s`
- Optional Next.js workspace at `packages/frontend-web` (imported from workspace tar if available)

### Local Dev
```
docker compose -f dev/compose/docker-compose.yml up --build
```

### Contracts
```
make -C packages/contracts gen
```

### Metrics
Each service should expose `/metrics` on its HTTP port after importing `@isekai/observability`.
