# Isekai Platform

An Isekai-class system that transforms natural language into runnable applications with live iteration capabilities.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose
- Make (optional, for convenience commands)

### Installation

```bash
# Clone and setup
git clone <repository-url>
cd isekai-platform
make bootstrap

# Or manually:
npm install
npm run build
```

### Development

```bash
# Start all services
make dev

# Or with Docker
make docker-up

# Access the platform
# UI: http://localhost:3000
# API: http://localhost:3001
```

## 🏗️ Architecture

### System Overview

Isekai Platform is a microservices-based system with the following core components:

- **Perception Service** (Port 3002) - UI understanding and grounding
- **Planner Service** (Port 3003) - Task planning and orchestration  
- **Synthesis Service** (Port 3004) - AI-powered code generation
- **Runtime Service** (Port 3005) - Secure sandbox execution
- **Evaluation Service** (Port 3006) - Testing and validation
- **UI Dashboard** (Port 3000) - React-based interface
- **API Gateway** (Port 3001) - Request routing and coordination

### Inner Loop Flow

1. **Prompt Submission** - User submits natural language description
2. **Perception** - Analyze prompt to understand UI requirements
3. **Synthesis** - Generate application code using AI
4. **Execution** - Run application in secure sandbox
5. **Validation** - Test and evaluate the generated app
6. **Results** - Present working application to user

## 🔧 Development

### Project Structure

```
isekai-platform/
├── packages/
│   ├── types/          # Shared TypeScript types
│   ├── perception/     # UI understanding service
│   ├── planner/        # Task orchestration service
│   ├── synthesis/      # Code generation service
│   ├── runtime/        # Sandbox execution service
│   ├── evaluation/     # Testing service
│   └── ui/            # React dashboard
├── config/            # Configuration files
├── scripts/           # Utility scripts
├── apps/             # Sample applications
└── docs/             # Documentation
```

### Available Commands

```bash
# Development
make dev              # Start all services
make build            # Build all packages
make test             # Run tests
make lint             # Run linting
make type-check       # Type checking

# Docker
make docker-build     # Build Docker images
make docker-up        # Start with Docker Compose
make docker-down      # Stop Docker services

# Testing
make smoke-test       # Run smoke tests
make security-scan    # Security vulnerability scan

# Maintenance
make clean            # Clean build artifacts
make status           # Check service status
```

## 🎯 Usage Example

### CSV Viewer Generation

1. Navigate to http://localhost:3000
2. Enter prompt: "CSV viewer with filter and export"
3. Watch the real-time execution plan
4. Get a working CSV viewer application

The generated application includes:
- File upload functionality
- Data filtering and search
- Export to CSV
- Responsive design
- Error handling

## 🔒 Security

### Security Features

- **Sandboxed Execution** - Docker-based isolation
- **Package Allow-list** - Only approved dependencies
- **Code Scanning** - Automated vulnerability detection
- **Network Restrictions** - Limited egress access
- **Resource Limits** - CPU, memory, and time constraints
- **Secret Isolation** - No access to sensitive data

### Security Configuration

Security settings are defined in `config/security.yaml`:
- Allowed network hosts
- Package allow-list
- Blocked code patterns
- Resource limits
- Sandbox configuration

## 📊 Performance

### Target Metrics

- **Cold Start**: ≤ 4 seconds
- **Interactive Loop**: ≤ 1.5 seconds p95
- **Memory Usage**: ≤ 1.2 GB
- **Cost per Loop**: ≤ $0.01

### Optimization

- Parallel execution where possible
- Intelligent caching
- Resource pooling
- Lazy loading of components

## 🧪 Testing

### Test Types

- **Unit Tests** - Individual component testing
- **Integration Tests** - Service interaction testing
- **E2E Tests** - Full workflow testing
- **Security Tests** - Vulnerability scanning
- **Performance Tests** - Load and timing validation

### Running Tests

```bash
# All tests
make test

# Smoke tests
make smoke-test

# Security scan
make security-scan
```

## 🚀 Deployment

### Development

```bash
make dev
# or
make docker-up
```

### Production

```bash
# Build and deploy
make docker-build
make deploy-production
```

### Environment Variables

Key environment variables:
- `NODE_ENV` - Environment mode
- `LOG_LEVEL` - Logging verbosity
- `ZAI_API_KEY` - AI service API key
- `PORT` - Service port

## 📈 Monitoring

### Health Checks

All services expose `/health` endpoints:
```bash
curl http://localhost:3003/health
```

### Logs

Services use structured JSON logging:
```bash
make logs  # Docker logs
# or check individual service logs
```

### Metrics

- Request latency
- Success rates
- Resource usage
- Error tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `make test`
5. Submit a pull request

### Code Standards

- TypeScript for all new code
- ESLint for code quality
- Prettier for formatting
- Conventional commits

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and `/docs`
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions

## 🗺️ Roadmap

- [ ] Additional UI component types
- [ ] Multi-language support
- [ ] Advanced debugging tools
- [ ] Performance analytics
- [ ] Custom template system
- [ ] Team collaboration features

---

Built with ❤️ by the Isekai Platform team