.PHONY: help install dev build test clean smoke-test

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-15s %s\n", $$1, $$2}'

install: ## Install all dependencies
	@echo "Installing dependencies..."
	npm install
	cd packages/frontend && npm install
	cd packages/backend && npm install
	cd packages/sandbox && npm install
	cd packages/planner && npm install

dev: ## Start all services in development mode
	@echo "Starting all services..."
	npm run dev

build: ## Build all packages
	@echo "Building all packages..."
	npm run build

test: ## Run all tests
	@echo "Running tests..."
	npm run test

lint: ## Run linters
	@echo "Running linters..."
	npm run lint

clean: ## Clean build artifacts and dependencies
	@echo "Cleaning..."
	rm -rf node_modules packages/*/node_modules
	rm -rf packages/*/dist packages/*/build
	find . -name "*.log" -delete

smoke-test: ## Run smoke test for CSV viewer
	@echo "Running smoke test for CSV viewer..."
	cd packages/backend && npm run test:smoke
