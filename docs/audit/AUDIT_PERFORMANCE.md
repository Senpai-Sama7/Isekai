# PERFORMANCE & SCALABILITY AUDIT

**Priority: P1-P2 - Fix Before Production Scale**

---

## ⚡ PERF-1: No Database Connection Pooling

**File:** `packages/backend/src/db/database.ts`

**Issue:** Single SQLite connection with no pooling. While WAL mode helps, concurrent writes will still block.

**Impact:**
- Request queuing under load
- Slow response times
- Poor horizontal scalability

**Current:** Singleton pattern with single connection

**Fix:**
```typescript
// For production, migrate to PostgreSQL with connection pooling
// Minimal fix for SQLite:

export class Database {
  private static instances: Database[] = [];
  private static currentIndex = 0;
  private static readonly POOL_SIZE = 4;

  static getInstance(): Database {
    if (Database.instances.length === 0) {
      for (let i = 0; i < Database.POOL_SIZE; i++) {
        Database.instances.push(new Database());
      }
    }
    
    // Round-robin distribution
    const instance = Database.instances[Database.currentIndex];
    Database.currentIndex = (Database.currentIndex + 1) % Database.POOL_SIZE;
    return instance;
  }
}
```

**Better Solution:**
```typescript
// packages/backend/src/db/postgres.ts
import { Pool } from 'pg';

export class PostgresDatabase {
  private static pool: Pool;

  static getPool(): Pool {
    if (!PostgresDatabase.pool) {
      PostgresDatabase.pool = new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return PostgresDatabase.pool;
  }
}
```

---

## ⚡ PERF-2: Missing Database Indexes

**File:** `packages/backend/src/db/database.ts:52-82`

**Issue:** Only basic indexes exist. Missing composite indexes for common query patterns.

**Impact:**
- Slow queries
- Full table scans
- Poor performance at scale

**Current Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_createdAt ON apps(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_appId ON suggestions(appId);
```

**Fix:**
```typescript
private initTables() {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
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

    -- Existing indexes
    CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
    CREATE INDEX IF NOT EXISTS idx_apps_createdAt ON apps(createdAt DESC);
    
    -- NEW: Composite indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_apps_status_created 
      ON apps(status, createdAt DESC);
    
    CREATE INDEX IF NOT EXISTS idx_apps_updated 
      ON apps(updatedAt DESC) WHERE status = 'running';
    
    -- Full-text search on name and prompt
    CREATE VIRTUAL TABLE IF NOT EXISTS apps_fts USING fts5(
      id UNINDEXED,
      name,
      prompt,
      content=apps,
      content_rowid=rowid
    );
    
    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS apps_fts_insert AFTER INSERT ON apps BEGIN
      INSERT INTO apps_fts(rowid, id, name, prompt)
      VALUES (new.rowid, new.id, new.name, new.prompt);
    END;
    
    CREATE TRIGGER IF NOT EXISTS apps_fts_delete AFTER DELETE ON apps BEGIN
      DELETE FROM apps_fts WHERE rowid = old.rowid;
    END;
    
    CREATE TRIGGER IF NOT EXISTS apps_fts_update AFTER UPDATE ON apps BEGIN
      UPDATE apps_fts SET name = new.name, prompt = new.prompt
      WHERE rowid = new.rowid;
    END;

    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      appId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      changes TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY(appId) REFERENCES apps(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_suggestions_appId ON suggestions(appId);
    CREATE INDEX IF NOT EXISTS idx_suggestions_created 
      ON suggestions(appId, createdAt DESC);
  `);
}

// Add search method
searchApps(query: string, limit: number = 10): App[] {
  const stmt = this.db.prepare(`
    SELECT apps.* FROM apps
    JOIN apps_fts ON apps.rowid = apps_fts.rowid
    WHERE apps_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
  return stmt.all(query, limit) as App[];
}
```

---

## ⚡ PERF-3: No Response Caching

**File:** All API routes

**Issue:** No caching layer for frequently accessed data. Every request hits the database.

**Impact:**
- High database load
- Slow response times
- Poor scalability

**Fix:**
```typescript
// packages/backend/src/middleware/cache.ts
import { Request, Response, NextFunction } from 'express';

const cache = new Map<string, { data: any; expiry: number }>();

export function cacheMiddleware(ttlSeconds: number = 60) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = `${req.method}:${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached && Date.now() < cached.expiry) {
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      cache.set(key, {
        data,
        expiry: Date.now() + ttlSeconds * 1000
      });
      
      // Cleanup old entries
      if (cache.size > 1000) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
          if (now > v.expiry) cache.delete(k);
        }
      }
      
      return originalJson(data);
    };

    next();
  };
}

// Usage in routes
app.get('/api/apps', cacheMiddleware(30), async (req, res) => {
  // ...
});
```

**Better Solution with Redis:**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export function redisCache(ttlSeconds: number = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const key = `cache:${req.originalUrl}`;
    const cached = await redis.get(key);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      redis.setex(key, ttlSeconds, JSON.stringify(data));
      return originalJson(data);
    };

    next();
  };
}
```

---

## ⚡ PERF-4: Inefficient Circuit Breaker

**File:** `packages/backend/src/utils/circuitBreaker.ts`

**Issue:** No exponential backoff, fixed reset timeout, no metrics.

**Impact:**
- Slow recovery from failures
- No observability
- Cascading failures

**Fix:**
```typescript
export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  resetTimeoutMs?: number;
  maxResetTimeoutMs?: number;
  serviceName: string;
  onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: CircuitState = 'CLOSED';
  private nextAttempt = Date.now();
  private consecutiveFailures = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly maxResetTimeoutMs: number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.maxResetTimeoutMs = options.maxResetTimeoutMs ?? 300_000; // 5 min max
  }

  async run<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.transitionTo('HALF_OPEN');
      } else {
        if (fallback) return fallback();
        throw this.createOpenError();
      }
    }

    const startTime = Date.now();
    try {
      const result = await action();
      this.recordSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.recordFailure(Date.now() - startTime);
      if (fallback) return fallback();
      throw error;
    }
  }

  private recordSuccess(durationMs: number) {
    this.consecutiveFailures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.reset();
      }
      return;
    }

    this.failures = 0;
    this.emitMetric('success', durationMs);
  }

  private recordFailure(durationMs: number) {
    this.failures += 1;
    this.consecutiveFailures += 1;

    this.emitMetric('failure', durationMs);

    if (this.failures >= this.failureThreshold) {
      this.trip();
    }
  }

  private trip() {
    // Exponential backoff with jitter
    const backoff = Math.min(
      this.resetTimeoutMs * Math.pow(2, this.consecutiveFailures - 1),
      this.maxResetTimeoutMs
    );
    const jitter = Math.random() * 0.1 * backoff;
    
    this.nextAttempt = Date.now() + backoff + jitter;
    this.transitionTo('OPEN');
  }

  private reset() {
    this.failures = 0;
    this.successes = 0;
    this.consecutiveFailures = 0;
    this.transitionTo('CLOSED');
  }

  private transitionTo(newState: CircuitState) {
    const oldState = this.state;
    this.state = newState;
    
    if (oldState !== newState) {
      this.options.onStateChange?.(newState);
      this.emitMetric('state_change', 0, { from: oldState, to: newState });
    }
  }

  private emitMetric(event: string, durationMs: number, extra?: any) {
    // Integrate with observability package
    console.log(JSON.stringify({
      service: this.options.serviceName,
      event,
      state: this.state,
      failures: this.failures,
      durationMs,
      ...extra
    }));
  }

  private createOpenError(): AppError {
    return serviceUnavailable(
      `${this.options.serviceName} circuit is open. Retry after ${
        Math.ceil((this.nextAttempt - Date.now()) / 1000)
      }s`
    );
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt
    };
  }
}
```

---

## ⚡ PERF-5: No Compression

**File:** `packages/backend/src/index.ts`

**Issue:** No response compression configured, wasting bandwidth.

**Impact:**
- Slow response times
- High bandwidth costs
- Poor mobile performance

**Fix:**
```typescript
import compression from 'compression';

const app = express();

// Add compression middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Balance between speed and compression
  threshold: 1024 // Only compress responses > 1KB
}));
```

---

## ⚡ PERF-6: Synchronous File Operations

**File:** `packages/sandbox/src/services/sandboxManager.ts` (inferred)

**Issue:** Likely using synchronous fs operations which block the event loop.

**Impact:**
- Blocked event loop
- Slow request processing
- Poor concurrency

**Fix:**
```typescript
import { promises as fs } from 'fs';

// Replace all fs.readFileSync with:
const content = await fs.readFile(path, 'utf8');

// Replace all fs.writeFileSync with:
await fs.writeFile(path, content, 'utf8');

// Replace all fs.existsSync with:
try {
  await fs.access(path);
  // exists
} catch {
  // doesn't exist
}
```

---

## ⚡ PERF-7: No Query Result Pagination

**File:** `packages/backend/src/db/database.ts:127-135`

**Issue:** `listApps` has pagination but no cursor-based pagination for large datasets.

**Impact:**
- Slow queries on large datasets
- High memory usage
- Poor UX for large lists

**Fix:**
```typescript
listApps(
  limit: number = 10, 
  cursor?: string
): { apps: App[]; total: number; nextCursor?: string } {
  let stmt: BetterSqlite3.Statement;
  let apps: App[];

  if (cursor) {
    // Cursor-based pagination (more efficient)
    stmt = this.db.prepare(`
      SELECT * FROM apps 
      WHERE createdAt < ? 
      ORDER BY createdAt DESC 
      LIMIT ?
    `);
    apps = stmt.all(cursor, limit) as App[];
  } else {
    // First page
    stmt = this.db.prepare(`
      SELECT * FROM apps 
      ORDER BY createdAt DESC 
      LIMIT ?
    `);
    apps = stmt.all(limit) as App[];
  }

  const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM apps');
  const result = countStmt.get() as { count: number };

  const nextCursor = apps.length === limit 
    ? apps[apps.length - 1].createdAt 
    : undefined;

  return { apps, total: result.count, nextCursor };
}
```

---

## Performance Testing

```typescript
// packages/backend/tests/performance.test.ts
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  it('should handle 100 concurrent requests', async () => {
    const start = performance.now();
    const promises = Array(100).fill(0).map(() => 
      axios.get('http://localhost:8080/api/apps')
    );
    await Promise.all(promises);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(5000); // 5 seconds
  });

  it('should cache GET requests', async () => {
    const first = performance.now();
    await axios.get('http://localhost:8080/api/apps');
    const firstDuration = performance.now() - first;

    const second = performance.now();
    await axios.get('http://localhost:8080/api/apps');
    const secondDuration = performance.now() - second;

    expect(secondDuration).toBeLessThan(firstDuration * 0.5);
  });
});
```

---

## Deployment Checklist

- [ ] Implement database connection pooling
- [ ] Add composite indexes
- [ ] Enable full-text search
- [ ] Add response caching middleware
- [ ] Implement Redis caching (optional)
- [ ] Update circuit breaker with exponential backoff
- [ ] Add compression middleware
- [ ] Replace synchronous file operations
- [ ] Implement cursor-based pagination
- [ ] Run load tests with k6 or Artillery
- [ ] Profile with clinic.js
- [ ] Monitor with New Relic/DataDog
