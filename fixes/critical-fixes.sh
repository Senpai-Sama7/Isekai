#!/bin/bash

# Critical Security Fixes Script
# Run this to apply minimal fixes for P0 issues
# Review each change before committing!

set -e

echo "🔧 Applying Critical Security Fixes..."
echo "======================================="

# Backup current code
echo "📦 Creating backup..."
timestamp=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_${timestamp}.tar.gz" packages/

# Fix 1: Add request size limits (CRITICAL-5)
echo "✅ Fix 1: Adding request size limits..."
cat > packages/backend/src/middleware/requestLimits.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';

export function requestSizeLimits(req: Request, res: Response, next: NextFunction) {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
}
EOF

# Fix 2: Update XSS escaping (CRITICAL-3)
echo "✅ Fix 2: Updating XSS escaping..."
cat > packages/backend/src/utils/security-patch.ts << 'EOF'
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/\u2028/g, '&#x2028;')
    .replace(/\u2029/g, '&#x2029;');
}

export function escapeJs(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');
}
EOF

# Fix 3: Add field whitelist for SQL (CRITICAL-6)
echo "✅ Fix 3: Adding SQL field whitelist..."
cat > packages/backend/src/db/database-patch.ts << 'EOF'
const ALLOWED_UPDATE_FIELDS = new Set([
  'name',
  'prompt',
  'status',
  'previewUrl',
  'code',
  'metadata'
]);

export function validateUpdateFields(updates: Record<string, any>): Record<string, any> {
  const validated: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_UPDATE_FIELDS.has(key) && value !== undefined) {
      validated[key] = value;
    }
  }
  
  return validated;
}
EOF

# Fix 4: Add memory leak fix (CRITICAL-4)
echo "✅ Fix 4: Fixing memory leak..."
cat > packages/backend/src/db/database-checkpoint-fix.ts << 'EOF'
// Add this to setupCheckpointing method:
// this.checkpointInterval.unref();

export function setupCheckpointingFixed(interval: NodeJS.Timeout) {
  interval.unref();
  return interval;
}
EOF

# Fix 5: Create CSRF middleware (CRITICAL-7)
echo "✅ Fix 5: Creating CSRF middleware..."
cat > packages/backend/src/middleware/csrf.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const tokens = new Map<string, number>();
const TOKEN_EXPIRY = 3600000;

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string;
  
  if (!token || !tokens.has(token)) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  const expiry = tokens.get(token)!;
  if (Date.now() > expiry) {
    tokens.delete(token);
    return res.status(403).json({ error: 'CSRF token expired' });
  }

  next();
}

export function generateCsrfToken(req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_EXPIRY);
  
  if (tokens.size > 10000) {
    const now = Date.now();
    for (const [t, exp] of tokens.entries()) {
      if (now > exp) tokens.delete(t);
    }
  }
  
  res.json({ csrfToken: token });
}
EOF

# Fix 6: Create auth middleware (ARCH-1)
echo "✅ Fix 6: Creating auth middleware..."
cat > packages/backend/src/middleware/auth.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface User {
  id: string;
  apiKey: string;
}

const users = new Map<string, User>();

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  const user = Array.from(users.values()).find(u => u.apiKey === apiKey);

  if (!user) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.user = user;
  next();
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
EOF

# Fix 7: Add compression
echo "✅ Fix 7: Adding compression middleware..."
cat > packages/backend/src/middleware/compression-setup.ts << 'EOF'
import compression from 'compression';

export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
});
EOF

# Create integration instructions
cat > fixes/INTEGRATION_INSTRUCTIONS.md << 'EOF'
# Integration Instructions

## Files Created

1. `packages/backend/src/middleware/requestLimits.ts`
2. `packages/backend/src/utils/security-patch.ts`
3. `packages/backend/src/db/database-patch.ts`
4. `packages/backend/src/db/database-checkpoint-fix.ts`
5. `packages/backend/src/middleware/csrf.ts`
6. `packages/backend/src/middleware/auth.ts`
7. `packages/backend/src/middleware/compression-setup.ts`

## Integration Steps

### 1. Update packages/backend/src/index.ts

```typescript
import express from 'express';
import { requestSizeLimits } from './middleware/requestLimits';
import { compressionMiddleware } from './middleware/compression-setup';
import { csrfProtection, generateCsrfToken } from './middleware/csrf';
import { authenticate } from './middleware/auth';

const app = express();

// Add BEFORE other middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(requestSizeLimits);
app.use(compressionMiddleware);

// CSRF token endpoint (public)
app.get('/api/csrf-token', generateCsrfToken);

// Apply CSRF protection to all routes
app.use('/api', csrfProtection);

// Apply authentication to protected routes
app.use('/api/apps', authenticate);
```

### 2. Update packages/backend/src/utils/security.ts

Replace the existing `escapeHtml` and `escapeJs` functions with the ones from `security-patch.ts`.

### 3. Update packages/backend/src/db/database.ts

In the `updateApp` method, add:

```typescript
import { validateUpdateFields } from './database-patch';

updateApp(id: string, updates: Partial<App>): App | undefined {
  const app = this.getApp(id);
  if (!app) return undefined;

  // Validate fields
  const validatedUpdates = validateUpdateFields(updates);

  // ... rest of the method
}
```

In the `setupCheckpointing` method, add:

```typescript
this.checkpointInterval = setInterval(() => {
  // ... checkpoint logic
}, 5 * 60 * 1000);

// Add this line:
this.checkpointInterval.unref();
```

### 4. Remove transactionAsync method

Delete the `transactionAsync` method from `packages/backend/src/db/database.ts` entirely.

Search for all usages and refactor to use synchronous `transaction()` method.

### 5. Install dependencies

```bash
npm install compression
npm install --save-dev @types/compression
```

### 6. Update frontend

Add CSRF token fetching:

```typescript
// Fetch CSRF token on app load
const response = await fetch('/api/csrf-token');
const { csrfToken } = await response.json();

// Include in all non-GET requests
fetch('/api/apps/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  },
  body: JSON.stringify(data)
});
```

### 7. Test

```bash
# Run tests
npm test

# Start services
npm run dev

# Test CSRF protection
curl -X POST http://localhost:8080/api/apps/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test"}'
# Should return 403

# Test with token
TOKEN=$(curl http://localhost:8080/api/csrf-token | jq -r .csrfToken)
curl -X POST http://localhost:8080/api/apps/generate \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"prompt":"test"}'
# Should work
```

## Verification Checklist

- [ ] All new files created
- [ ] Dependencies installed
- [ ] index.ts updated
- [ ] security.ts updated
- [ ] database.ts updated
- [ ] transactionAsync removed
- [ ] Frontend updated
- [ ] Tests pass
- [ ] Manual testing complete
- [ ] Security scan passes

## Rollback

If issues occur:

```bash
tar -xzf backup_TIMESTAMP.tar.gz
npm install
npm test
```
EOF

echo ""
echo "✅ All critical fix files created!"
echo ""
echo "📋 Next steps:"
echo "1. Review the created files in packages/backend/src/"
echo "2. Follow integration instructions in fixes/INTEGRATION_INSTRUCTIONS.md"
echo "3. Test thoroughly before deploying"
echo "4. Backup is available at backup_${timestamp}.tar.gz"
echo ""
echo "⚠️  IMPORTANT: These are minimal fixes. Review AUDIT_CRITICAL.md for complete solutions."
