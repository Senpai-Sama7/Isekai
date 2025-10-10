.PHONY: help dev build test lint type-check clean security-scan docker-build docker-up docker-down install bootstrap smoke-test

# Default target
help:
	@echo "Imagine Platform - Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  install          Install all dependencies"
	@echo "  bootstrap        Bootstrap the entire platform"
	@echo "  dev              Start all services in development mode"
	@echo "  build            Build all packages"
	@echo ""
	@echo "Testing:"
	@echo "  test             Run all tests"
	@echo "  smoke-test       Run smoke tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint             Run linting on all packages"
	@echo "  type-check       Run TypeScript type checking"
	@echo "  security-scan    Run security vulnerability scan"
	@echo ""
	@echo "Docker:"
	@echo "  docker-build     Build all Docker images"
	@echo "  docker-up        Start services with Docker Compose"
	@echo "  docker-down      Stop Docker Compose services"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean            Clean build artifacts and dependencies"
	@echo "  logs             Show service logs"

# Development commands
install:
	npm install
	npm run build --workspace=@imagine/types
	npm install --workspaces

bootstrap: install
	@echo "🚀 Bootstrapping Imagine Platform..."
	@chmod +x scripts/setup.sh
	./scripts/setup.sh

dev:
	@echo "🔧 Starting development environment..."
	npm run dev

build:
	@echo "🏗️  Building all packages..."
	npm run build

# Testing commands
test:
	@echo "🧪 Running all tests..."
	npm run test

smoke-test:
	@echo "💨 Running smoke tests..."
	node scripts/smoke-test.js

# Code quality commands
lint:
	@echo "🔍 Running linting..."
	npm run lint

type-check:
	@echo "📝 Running type checking..."
	npm run type-check

security-scan:
	@echo "🔒 Running security scan..."
	npm audit --audit-level moderate
	npm run lint
	@echo "✅ Security scan completed"

# Docker commands
docker-build:
	@echo "🐳 Building Docker images..."
	docker-compose build

docker-up:
	@echo "🚀 Starting services with Docker..."
	docker-compose up -d
	@echo "⏳ Waiting for services to be ready..."
	sleep 10
	@echo "✅ Services are running"
	@echo "🌐 UI: http://localhost:3000"
	@echo "🔌 API: http://localhost:3001"

docker-down:
	@echo "🛑 Stopping Docker services..."
	docker-compose down

# Maintenance commands
clean:
	@echo "🧹 Cleaning up..."
	npm run clean
	rm -rf node_modules
	rm -rf packages/*/node_modules
	rm -rf packages/*/dist
	rm -rf packages/*/build
	rm -rf .turbo
	docker system prune -f

logs:
	docker-compose logs -f

# Utility commands
status:
	@echo "📊 Service Status:"
	@echo "=================="
	@curl -s http://localhost:3002/health | jq -c '.service + ": " + .status' || echo "Perception: Offline"
	@curl -s http://localhost:3003/health | jq -c '.service + ": " + .status' || echo "Planner: Offline"
	@curl -s http://localhost:3004/health | jq -c '.service + ": " + .status' || echo "Synthesis: Offline"
	@curl -s http://localhost:3005/health | jq -c '.service + ": " + .status' || echo "Runtime: Offline"
	@curl -s http://localhost:3006/health | jq -c '.service + ": " + .status' || echo "Evaluation: Offline"

# CI/CD commands
ci: lint type-check test security-scan
	@echo "✅ CI pipeline completed successfully"

# Production deployment
deploy-staging: docker-build
	@echo "🚀 Deploying to staging..."
	# Add staging deployment commands here

deploy-production: docker-build
	@echo "🚀 Deploying to production..."
	# Add production deployment commands here

# Development utilities
watch:
	@echo "👀 Watching for changes..."
	npm run dev --watch

db-reset:
	@echo "🗄️  Resetting database..."
	# Add database reset commands here

migrate:
	@echo "🔄 Running migrations..."
	# Add migration commands here

seed:
	@echo "🌱 Seeding database..."
	# Add seeding commands here