# ARCHITECTURE & CODE QUALITY AUDIT

**Priority: P2-P3 - Improve Maintainability & Scalability**

---

## 🏗️ ARCH-1: No Authentication/Authorization

**Files:** All API routes

**Issue:** No authentication or authorization implemented despite being mentioned in README.

**Impact:**
- Anyone can create/modify/delete apps
- No user isolation
- No rate limiting per user
- Security compliance issues

**Fix:**
```typescript
// packages/backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface User {
  id: string;
  apiKey: string;
  rateLimit: number;
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

export function authorize(requiredRole?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Add role-based access control here
    next();
  };
}

// Generate API key
export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

**Usage:**
```typescript
// packages/backend/src/routes/apps.ts
import { authenticate, authorize } from '../middleware/auth';

router.post('/api/apps/generate', authenticate, async (req, res) => {
  // req.user is now available
});
```

---

## 🏗️ ARCH-2: No Rate Limiting Per User

**File:** `packages/backend/src/index.ts`

**Issue:** Global rate limiting only, no per-user limits.

**Impact:**
- Single user can exhaust resources
- No fair usage enforcement
- DoS vulnerability

**Fix:**
```typescript
// packages/backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';
import { Request } from 'express';

const userLimits = new Map<string, { count: number; resetAt: number }>();

export const perUserRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per user
  keyGenerator: (req: Request) => {
    return req.user?.id || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: 60
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // 100 requests per minute globally
  message: 'Too many requests from this IP'
});
```

---

## 🏗️ ARCH-3: No Observability Integration

**File:** `packages/backend/src/observability/logger.ts`

**Issue:** Basic console logging only, no structured logging or metrics.

**Impact:**
- Difficult debugging
- No performance insights
- No alerting capability

**Fix:**
```typescript
// packages/backend/src/observability/logger.ts
import { createLogger, format, transports } from 'winston';

export const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'isekai-backend' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Metrics
export class Metrics {
  private static counters = new Map<string, number>();
  private static gauges = new Map<string, number>();
  private static histograms = new Map<string, number[]>();

  static increment(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  static gauge(name: string, value: number) {
    this.gauges.set(name, value);
  }

  static histogram(name: string, value: number) {
    const values = this.histograms.get(name) || [];
    values.push(value);
    if (values.length > 1000) values.shift();
    this.histograms.set(name, values);
  }

  static getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          {
            count: v.length,
            min: Math.min(...v),
            max: Math.max(...v),
            avg: v.reduce((a, b) => a + b, 0) / v.length
          }
        ])
      )
    };
  }
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId
    });

    Metrics.increment(`http_requests_total`);
    Metrics.increment(`http_requests_${res.statusCode}`);
    Metrics.histogram('http_request_duration_ms', duration);
  });

  next();
}
```

---

## 🏗️ ARCH-4: No Health Check Endpoints

**File:** `packages/backend/src/routes/health.ts`

**Issue:** Basic health check only, no readiness/liveness probes.

**Impact:**
- Poor Kubernetes integration
- No dependency health checks
- Difficult troubleshooting

**Fix:**
```typescript
// packages/backend/src/routes/health.ts
import { Router } from 'express';
import { Database } from '../db/database';

const router = Router();

// Liveness probe - is the service alive?
router.get('/health/live', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe - is the service ready to accept traffic?
router.get('/health/ready', async (req, res) => {
  const checks: Record<string, boolean> = {};

  // Check database
  try {
    const db = Database.getInstance();
    db.getDb().prepare('SELECT 1').get();
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check planner service
  try {
    const response = await axios.get(
      `${process.env.PLANNER_URL}/health`,
      { timeout: 2000 }
    );
    checks.planner = response.status === 200;
  } catch {
    checks.planner = false;
  }

  // Check sandbox service
  try {
    const response = await axios.get(
      `${process.env.SANDBOX_URL}/health`,
      { timeout: 2000 }
    );
    checks.sandbox = response.status === 200;
  } catch {
    checks.sandbox = false;
  }

  const allHealthy = Object.values(checks).every(v => v);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});

// Startup probe - has the service finished starting?
router.get('/health/startup', (req, res) => {
  // Check if initialization is complete
  const initialized = Database.getInstance() !== null;

  res.status(initialized ? 200 : 503).json({
    status: initialized ? 'started' : 'starting',
    timestamp: new Date().toISOString()
  });
});

export default router;
```

---

## 🏗️ ARCH-5: No Graceful Shutdown

**File:** `packages/backend/src/index.ts`

**Issue:** No graceful shutdown handling for database connections and in-flight requests.

**Impact:**
- Data corruption on shutdown
- Lost requests
- Poor deployment experience

**Fix:**
```typescript
// packages/backend/src/index.ts
import { Server } from 'http';

let server: Server;
let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });

  // Set a timeout for forceful shutdown
  const forceShutdownTimeout = setTimeout(() => {
    console.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 30000); // 30 seconds

  try {
    // Close database connections
    Database.getInstance().close();
    console.log('Database connections closed');

    // Wait for in-flight requests to complete
    await new Promise(resolve => setTimeout(resolve, 5000));

    clearTimeout(forceShutdownTimeout);
    console.log('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 8080;
server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Prevent new connections during shutdown
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close');
    return res.status(503).json({ error: 'Server is shutting down' });
  }
  next();
});
```

---

## 🏗️ ARCH-6: No Database Migrations

**File:** `packages/backend/src/db/database.ts`

**Issue:** Schema changes are done via `CREATE TABLE IF NOT EXISTS`, no migration tracking.

**Impact:**
- Difficult schema evolution
- No rollback capability
- Production deployment risks

**Fix:**
```typescript
// packages/backend/src/db/migrations.ts
import { Database as BetterSqlite3 } from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  up: (db: BetterSqlite3) => void;
  down: (db: BetterSqlite3) => void;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE apps (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          prompt TEXT NOT NULL,
          status TEXT NOT NULL,
          previewUrl TEXT,
          code TEXT NOT NULL,
          metadata TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        );
        CREATE INDEX idx_apps_status ON apps(status);
        CREATE INDEX idx_apps_createdAt ON apps(createdAt DESC);
      `);
    },
    down: (db) => {
      db.exec('DROP TABLE apps');
    }
  },
  {
    version: 2,
    name: 'add_suggestions_table',
    up: (db) => {
      db.exec(`
        CREATE TABLE suggestions (
          id TEXT PRIMARY KEY,
          appId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          changes TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          FOREIGN KEY(appId) REFERENCES apps(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_suggestions_appId ON suggestions(appId);
      `);
    },
    down: (db) => {
      db.exec('DROP TABLE suggestions');
    }
  }
];

export class MigrationRunner {
  constructor(private db: BetterSqlite3) {
    this.initMigrationsTable();
  }

  private initMigrationsTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        appliedAt TEXT NOT NULL
      )
    `);
  }

  getCurrentVersion(): number {
    const result = this.db
      .prepare('SELECT MAX(version) as version FROM migrations')
      .get() as { version: number | null };
    return result.version || 0;
  }

  migrate() {
    const currentVersion = this.getCurrentVersion();
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);

    if (pendingMigrations.length === 0) {
      console.log('No pending migrations');
      return;
    }

    this.db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(`Applying migration ${migration.version}: ${migration.name}`);
        migration.up(this.db);
        
        this.db
          .prepare('INSERT INTO migrations (version, name, appliedAt) VALUES (?, ?, ?)')
          .run(migration.version, migration.name, new Date().toISOString());
      }
    })();

    console.log(`Applied ${pendingMigrations.length} migrations`);
  }

  rollback(targetVersion: number) {
    const currentVersion = this.getCurrentVersion();
    const migrationsToRollback = migrations
      .filter(m => m.version > targetVersion && m.version <= currentVersion)
      .reverse();

    this.db.transaction(() => {
      for (const migration of migrationsToRollback) {
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        migration.down(this.db);
        
        this.db
          .prepare('DELETE FROM migrations WHERE version = ?')
          .run(migration.version);
      }
    })();

    console.log(`Rolled back ${migrationsToRollback.length} migrations`);
  }
}
```

---

## 🏗️ ARCH-7: No API Versioning

**Files:** All API routes

**Issue:** No API versioning strategy, breaking changes will affect all clients.

**Impact:**
- Difficult to evolve API
- Breaking changes affect all users
- Poor backward compatibility

**Fix:**
```typescript
// packages/backend/src/routes/index.ts
import { Router } from 'express';
import appsV1 from './v1/apps';
import appsV2 from './v2/apps';

const router = Router();

// Version 1 (current)
router.use('/api/v1', appsV1);

// Version 2 (future)
router.use('/api/v2', appsV2);

// Default to latest version
router.use('/api', appsV2);

export default router;
```

---

## 🏗️ ARCH-8: No Input Validation Schema

**File:** `packages/backend/src/middleware/validation.ts`

**Issue:** Validation logic scattered across routes, no centralized schema.

**Impact:**
- Inconsistent validation
- Difficult to maintain
- Security vulnerabilities

**Fix:**
```typescript
// packages/backend/src/schemas/app.schema.ts
import Joi from 'joi';

export const createAppSchema = Joi.object({
  prompt: Joi.string().min(10).max(5000).required(),
  name: Joi.string().min(1).max(100).optional()
});

export const updateAppSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  status: Joi.string().valid('generating', 'running', 'stopped', 'error').optional(),
  code: Joi.string().optional(),
  metadata: Joi.object().optional()
}).min(1);

export const listAppsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0),
  status: Joi.string().valid('generating', 'running', 'stopped', 'error').optional()
});

// Usage
import { validate } from '../middleware/validation';

router.post('/api/apps/generate', 
  validate(createAppSchema), 
  async (req, res) => {
    // req.body is now validated
  }
);
```

---

## Code Quality Improvements

### CQ-1: TypeScript Strict Mode

**File:** All `tsconfig.json` files

**Fix:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### CQ-2: ESLint Configuration

**File:** `.eslintrc.json`

**Fix:**
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

---

## Deployment Checklist

- [ ] Implement authentication middleware
- [ ] Add per-user rate limiting
- [ ] Integrate structured logging
- [ ] Add metrics collection
- [ ] Implement health check endpoints
- [ ] Add graceful shutdown handling
- [ ] Create database migration system
- [ ] Implement API versioning
- [ ] Centralize validation schemas
- [ ] Enable TypeScript strict mode
- [ ] Update ESLint configuration
- [ ] Add API documentation (OpenAPI/Swagger)
- [ ] Implement request tracing
- [ ] Add error tracking (Sentry)
