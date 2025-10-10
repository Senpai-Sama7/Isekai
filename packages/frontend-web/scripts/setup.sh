#!/bin/bash

# Imagine Platform Setup Script
set -e

echo "🚀 Setting up Imagine Platform..."

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is required but not installed. Please install Node.js 18+"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm is required but not installed."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is required but not installed."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo "❌ Docker Compose is required but not installed."
        exit 1
    fi
    
    echo "✅ All prerequisites satisfied"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Build types package first
    npm run build --workspace=@imagine/types
    
    # Install workspace dependencies
    npm install --workspaces
    
    echo "✅ Dependencies installed"
}

# Setup environment files
setup_environment() {
    echo "🔧 Setting up environment..."
    
    # Create .env files for each service
    for service in perception planner synthesis runtime evaluation ui gateway; do
        if [ ! -f "packages/$service/.env" ]; then
            cat > "packages/$service/.env" << EOF
NODE_ENV=development
LOG_LEVEL=info
PORT=$(get_port $service)
EOF
        fi
    done
    
    # Create root .env
    if [ ! -f ".env" ]; then
        cat > ".env" << EOF
NODE_ENV=development
LOG_LEVEL=info
ZAI_API_KEY=your_api_key_here
EOF
    fi
    
    echo "✅ Environment files created"
}

# Get port for service
get_port() {
    case $1 in
        perception) echo "3002" ;;
        planner) echo "3003" ;;
        synthesis) echo "3004" ;;
        runtime) echo "3005" ;;
        evaluation) echo "3006" ;;
        ui) echo "3000" ;;
        gateway) echo "3001" ;;
        *) echo "3000" ;;
    esac
}

# Build all packages
build_packages() {
    echo "🏗️  Building packages..."
    npm run build
    echo "✅ Packages built"
}

# Setup Docker
setup_docker() {
    echo "🐳 Setting up Docker..."
    
    # Create Docker network if it doesn't exist
    if ! docker network ls | grep -q "imagine-network"; then
        docker network create imagine-network
    fi
    
    echo "✅ Docker setup complete"
}

# Main setup flow
main() {
    echo "🎯 Imagine Platform Setup"
    echo "========================="
    
    check_prerequisites
    install_dependencies
    setup_environment
    build_packages
    setup_docker
    
    echo ""
    echo "🎉 Setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  make dev          # Start development environment"
    echo "  make docker-up    # Start with Docker"
    echo "  make smoke-test   # Run smoke tests"
    echo ""
    echo "Services will be available at:"
    echo "  UI: http://localhost:3000"
    echo "  API: http://localhost:3001"
    echo ""
}

# Run main function
main "$@"