# Deployment Guide

## Prerequisites

- Node.js 18+ and npm 9+
- Docker (optional, for containerized deployment)
- 4GB+ RAM recommended
- Linux/macOS (Windows via WSL2)

## Development Deployment

### Quick Start

```bash
# Clone the repository
git clone https://github.com/Senpai-Sama7/Isekai.git
cd Isekai

# Install dependencies
make install

# Start all services
make dev
```

Services will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- Planner Service: http://localhost:8090
- Sandbox Runtime: http://localhost:8070

## Production Deployment

### Building for Production

```bash
# Build all packages
make build

# Run tests
make test

# Run smoke test
make smoke-test
```

### Environment Variables

#### Backend (.env)
```
PORT=8080
PLANNER_URL=http://planner:8090
SANDBOX_URL=http://sandbox:8070
DB_PATH=/data/isekai.db
NODE_ENV=production
```

#### Frontend (.env)
```
REACT_APP_API_URL=https://api.yourdomain.com
```

#### Planner (.env)
```
PORT=8090
NODE_ENV=production
```

#### Sandbox (.env)
```
PORT=8070
WORKSPACE_DIR=/var/lib/isekai/apps
NODE_ENV=production
```

### Docker Deployment

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    ports:
      - "8080:8080"
    environment:
      - PLANNER_URL=http://planner:8090
      - SANDBOX_URL=http://sandbox:8070
    volumes:
      - ./data:/data
    depends_on:
      - planner
      - sandbox

  planner:
    build:
      context: .
      dockerfile: packages/planner/Dockerfile
    ports:
      - "8090:8090"

  sandbox:
    build:
      context: .
      dockerfile: packages/sandbox/Dockerfile
    ports:
      - "8070:8070"
      - "9000-9100:9000-9100"
    volumes:
      - ./runtime:/var/lib/isekai/apps
    privileged: true

  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
    ports:
      - "3000:80"
    environment:
      - REACT_APP_API_URL=http://localhost:8080
    depends_on:
      - backend
```

### Kubernetes Deployment

Example Kubernetes manifests in `k8s/`:

```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: isekai-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: isekai-backend
  template:
    metadata:
      labels:
        app: isekai-backend
    spec:
      containers:
      - name: backend
        image: isekai/backend:latest
        ports:
        - containerPort: 8080
        env:
        - name: PLANNER_URL
          value: "http://isekai-planner:8090"
        - name: SANDBOX_URL
          value: "http://isekai-sandbox:8070"
```

### Cloud Deployment Options

#### AWS
- Use ECS/EKS for container orchestration
- RDS for database (if migrating from SQLite)
- S3 for generated app artifacts
- CloudWatch for logging

#### Google Cloud
- Use GKE for Kubernetes
- Cloud SQL for database
- Cloud Storage for artifacts
- Cloud Logging for monitoring

#### Azure
- Use AKS for Kubernetes
- Azure SQL Database
- Blob Storage for artifacts
- Application Insights for monitoring

### Scaling Considerations

#### Horizontal Scaling
- Backend and Planner can scale horizontally
- Use a load balancer (nginx, HAProxy, or cloud LB)
- Sandbox instances should be monitored for resource usage

#### Database
- SQLite is suitable for development and small deployments
- For production, consider PostgreSQL or MySQL
- Implement connection pooling
- Set up read replicas for scaling reads

#### Caching
- Implement Redis for session storage
- Cache frequently accessed apps
- Use CDN for frontend assets

### Monitoring

#### Health Checks
All services expose `/health` endpoints:
```bash
curl http://localhost:8080/api/health
curl http://localhost:8090/health
curl http://localhost:8070/health
```

#### Metrics
Implement Prometheus metrics:
- Request rate and latency
- App generation success/failure rates
- Resource usage per sandbox
- Database query performance

#### Logging
- Centralized logging with ELK stack or similar
- Structured JSON logs
- Log rotation and retention policies

### Backup and Recovery

#### Database Backup
```bash
# Backup SQLite database
sqlite3 /data/isekai.db ".backup /backups/isekai-$(date +%Y%m%d).db"
```

#### App Artifacts
- Regular backups of runtime/apps directory
- Consider versioning for generated code
- Implement point-in-time recovery

### Security Hardening

1. Use HTTPS in production
2. Implement rate limiting
3. Enable CORS restrictions
4. Use secrets management (Vault, AWS Secrets Manager)
5. Regular security updates
6. Container vulnerability scanning

### Troubleshooting

#### Services won't start
- Check port availability: `lsof -i :8080`
- Verify environment variables
- Check logs: `npm run dev` in each package

#### Apps fail to generate
- Check planner service is running
- Verify sandbox has write permissions
- Review sandbox logs for npm errors

#### High resource usage
- Monitor sandbox instances
- Implement cleanup jobs for old apps
- Set resource limits in production
