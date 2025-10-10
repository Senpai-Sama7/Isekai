# Security Considerations

## Security Improvements Implemented

This document describes the security measures implemented in the Isekai application.

### Security Headers (Helmet)

All services (backend, planner, sandbox) now use Helmet middleware to set security headers:
- Content Security Policy (CSP)
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security (when HTTPS is enabled)

### Input Validation

All API endpoints now use express-validator to validate incoming requests:
- Request body validation with type checking
- Path parameter validation
- Query parameter validation  
- File size and count limits
- Path traversal prevention
- String length constraints

### CORS Configuration

CORS is now environment-aware:
- **Development**: Allows localhost origins
- **Production**: Only allows configured origins from `ALLOWED_ORIGINS` environment variable

### Rate Limiting

Rate limiting is implemented on write endpoints:
- **Backend**: 100 requests per 15 minutes per IP
- **Sandbox**: 50 execution requests per 15 minutes per IP
- **Planner**: 100 requests per 15 minutes per IP

### SQLite Security

Database is now configured with:
- **WAL mode**: Enabled for better concurrency
- **Busy timeout**: 5 seconds to handle concurrent access
- **Automatic checkpointing**: Every 5 minutes to prevent unbounded WAL growth
- **Prepared statements**: All queries use parameterized queries

## Sandbox Security

The sandbox runtime implements several security measures to isolate and protect the execution environment:

### Process Isolation
- Each generated app runs in its own Node.js process
- Processes are spawned with limited permissions
- Process trees are properly cleaned up on termination

### Resource Limits

The sandbox now enforces configurable resource limits:
- **Memory limit**: Configurable via `MAX_MEMORY_MB` (default: 512MB)
- **CPU limit**: Configurable via `MAX_CPU_PERCENT` (default: 50%)
- **Execution timeout**: Configurable via `EXECUTION_TIMEOUT_MS` (default: 5 minutes)

Environment variables:
```bash
MAX_MEMORY_MB=512
MAX_CPU_PERCENT=50
EXECUTION_TIMEOUT_MS=300000
```

### File System Sandboxing
- Apps are confined to their specific workspace directory
- Each app gets a unique directory: `runtime/apps/{appId}`
- Directories are cleaned up when apps are deleted
- Path traversal attacks are prevented through validation

### Network Security
- Apps run on dynamically assigned ports (9000+)
- No direct external network access by default
- Backend acts as a proxy for external requests

### Security Warnings

⚠️ **Important Security Notes:**

1. **Container Isolation Recommended**: The current implementation uses process isolation. For production, use Docker containers or microVMs (gVisor, Firecracker) for stronger isolation.

2. **Resource Limits**: While timeouts and basic limits are configured, container-based resource limits (cgroups) provide stronger guarantees.

3. **No Seccomp Profile**: The sandbox does not currently use a seccomp profile. Consider adding one to restrict system calls.

4. **Run as Non-Root**: Always run sandbox processes as a non-root user in production.

### Recommended Enhancements for Production

1. **Container-based Isolation**
   - Use Docker containers with `--security-opt=no-new-privileges`
   - Implement resource limits via cgroups (CPU, memory, PIDs)
   - Use read-only root filesystems where possible
   - Add seccomp profile to restrict system calls
   - Consider gVisor or Firecracker for stronger isolation
   - References: 
     - [Docker Security Best Practices](https://docs.docker.com/engine/security/)
     - [gVisor Security](https://gvisor.dev/docs/architecture_guide/security/)

2. **Code Scanning**
   - Scan generated code for security vulnerabilities
   - Implement static analysis before execution
   - Check for known malicious patterns

3. **Additional Rate Limiting**
   - Limit number of apps per user
   - Throttle generation requests per user
   - Implement daily quotas

4. **Secrets Management**
   - Never expose API keys in generated code
   - Use environment variables for sensitive data
   - Implement proper secret rotation

5. **Audit Logging**
   - Log all app generation requests
   - Track execution events
   - Monitor for suspicious activity

## API Security

### Authentication
The current implementation does not include authentication. For production:
- Implement JWT-based authentication
- Add API key validation
- Use OAuth for third-party integrations

### Input Validation

✅ **Implemented**: All API endpoints now validate inputs using express-validator:
- Type checking for all request parameters
- Length constraints on strings
- Format validation (e.g., alphanumeric IDs)
- File size and count limits
- Path traversal prevention

### CORS Configuration

✅ **Implemented**: CORS is now environment-aware:
- Development: Allows localhost origins
- Production: Only allows origins specified in `ALLOWED_ORIGINS` environment variable

Example production configuration:
```bash
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

### Rate Limiting

✅ **Implemented**: Rate limiting is active on all write endpoints:
- Prevents abuse and DoS attacks
- Configurable limits per service
- IP-based tracking

### Request Size Limits

✅ **Implemented**: Body parser limits:
- Backend: 10MB max request size
- Sandbox: 10MB max request size
- Planner: 5MB max request size

### Security Headers

✅ **Implemented**: Helmet middleware adds security headers:
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block

## Data Privacy

### Database Security

✅ **Implemented**: SQLite is configured with security best practices:
- **WAL mode**: Enabled for better concurrency and crash recovery
- **Busy timeout**: 5 seconds to handle concurrent access
- **Prepared statements**: All queries use parameterized queries to prevent SQL injection
- **Automatic checkpointing**: WAL is checkpointed every 5 minutes to prevent unbounded growth

### User Data
- App code and metadata stored in SQLite
- No personal data collected by default
- Clear data retention policies needed

### Generated Code
- User prompts are stored with generated apps
- Consider encryption at rest for sensitive data
- Implement data deletion workflows

## Monitoring and Health Checks

✅ **Implemented**: Enhanced health check endpoints:
- Backend health check includes dependency status (database, planner, sandbox)
- Returns 503 status when dependencies are unhealthy
- Includes timestamp for monitoring
- Suitable for load balancer health checks

Example health check response:
```json
{
  "status": "ok",
  "services": {
    "backend": "ok",
    "database": "ok",
    "planner": "ok",
    "sandbox": "ok"
  },
  "timestamp": "2025-10-10T15:00:00.000Z"
}
```

## Compliance

For production use, consider:
- GDPR compliance for EU users
- Data residency requirements
- Terms of service for generated content
- Intellectual property considerations
