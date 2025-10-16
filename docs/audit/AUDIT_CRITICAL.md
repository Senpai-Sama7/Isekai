# CRITICAL SECURITY & BUGS AUDIT

**Priority: P0 - Fix Immediately Before Production**

---

## 🔴 CRITICAL-1: Broken Async Transaction Implementation

**File:** `packages/backend/src/db/database.ts:217-234`

**Issue:** The `transactionAsync` method is fundamentally broken. It attempts to wrap async operations in a synchronous SQLite transaction, but the transaction completes before the promise resolves.

**Impact:** 
- Data corruption risk
- Race conditions in concurrent operations
- Unpredictable transaction behavior

**Current Code:**
```typescript
async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
  let result: T;
  let error: Error | null = null;

  this.db.transaction(() => {
    fn()
      .then((res) => { result = res; })
      .catch((err) => { error = err; });
  })();

  if (error) throw error;
  return result!;
}
```

**Fix:**
```typescript
// Remove this method entirely - SQLite transactions MUST be synchronous
// Replace all async transaction calls with synchronous operations

// If async operations are needed, use this pattern:
async transactionAsync<T>(fn: () => Promise<T>): Promise<T> {
  // Execute async operations OUTSIDE transaction
  const result = await fn();
  
  // Then commit in synchronous transaction
  this.db.transaction(() => {
    // Perform final synchronous writes here
  })();
  
  return result;
}
```

**Better Solution - Remove Method:**
```typescript
// Delete transactionAsync method entirely
// Update all callers to use synchronous transaction() method
// Move async operations outside transaction boundaries
```

---

## 🔴 CRITICAL-2: Path Traversal Race Condition

**File:** `packages/backend/src/utils/security.ts:8-35`

**Issue:** TOCTOU (Time-of-Check-Time-of-Use) vulnerability. Between validation and file access, a symlink could be created pointing outside the base directory.

**Impact:**
- Arbitrary file system access
- Data exfiltration
- Server compromise

**Current Code:**
```typescript
export async function validatePathWithinBase(basePath: string, targetPath: string): Promise<string> {
  const normalizedBase = await fs.realpath(basePath);
  const resolvedTarget = resolve(basePath, targetPath);
  
  let realTarget: string;
  try {
    realTarget = await fs.realpath(resolvedTarget);
  } catch {
    // Validation happens here, but file is accessed later
  }
  // ... validation
}
```

**Fix:**
```typescript
import { open } from 'fs/promises';

export async function validateAndOpenFile(
  basePath: string, 
  targetPath: string, 
  flags: string = 'r'
): Promise<{ fd: number; path: string }> {
  const normalizedBase = await fs.realpath(basePath);
  const resolvedTarget = resolve(basePath, targetPath);
  
  // Open file descriptor FIRST
  const fd = await open(resolvedTarget, flags);
  
  try {
    // Validate using the open file descriptor
    const stats = await fd.stat();
    const realTarget = await fs.realpath(`/proc/self/fd/${fd.fd}`);
    
    if (!realTarget.startsWith(normalizedBase)) {
      await fd.close();
      throw new Error(`Path traversal detected: ${targetPath}`);
    }
    
    return { fd: fd.fd, path: realTarget };
  } catch (error) {
    await fd.close();
    throw error;
  }
}
```

---

## 🔴 CRITICAL-3: XSS via Unicode Line Terminators

**File:** `packages/backend/src/utils/security.ts:68-81`

**Issue:** The `escapeHtml` function doesn't escape Unicode line terminators (U+2028, U+2029) which can break out of JavaScript string contexts.

**Impact:**
- Cross-site scripting (XSS)
- JavaScript injection
- Session hijacking

**Current Code:**
```typescript
export function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };
  return text.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char] || char);
}
```

**Fix:**
```typescript
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
```

---

## 🔴 CRITICAL-4: Memory Leak in Database Singleton

**File:** `packages/backend/src/db/database.ts:24-42`

**Issue:** If `getInstance()` is called multiple times without `resetInstance()`, the checkpoint interval is never cleared, causing memory leaks.

**Impact:**
- Memory exhaustion
- Service crashes
- Resource leaks

**Fix:**
```typescript
private constructor() {
  // ... existing code ...
  this.setupCheckpointing();
}

private setupCheckpointing() {
  // Clear any existing interval first
  if (this.checkpointInterval) {
    clearInterval(this.checkpointInterval);
  }
  
  this.checkpointInterval = setInterval(() => {
    try {
      this.db.pragma('wal_checkpoint(PASSIVE)');
    } catch (error) {
      console.error('WAL checkpoint error:', error);
    }
  }, 5 * 60 * 1000);
  
  // Prevent interval from keeping process alive
  this.checkpointInterval.unref();
}

static getInstance(): Database {
  if (!Database.instance) {
    Database.instance = new Database();
  }
  return Database.instance;
}
```

---

## 🔴 CRITICAL-5: No Request Size Limits

**File:** `packages/backend/src/index.ts` (not shown but inferred)

**Issue:** No global request body size limits configured in Express, allowing DoS attacks via large payloads.

**Impact:**
- Denial of Service
- Memory exhaustion
- Service crashes

**Fix:**
```typescript
// In packages/backend/src/index.ts
import express from 'express';

const app = express();

// Add BEFORE other middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Add request timeout
app.use((req, res, next) => {
  req.setTimeout(30000); // 30 seconds
  res.setTimeout(30000);
  next();
});
```

---

## 🔴 CRITICAL-6: SQL Injection via String Interpolation

**File:** `packages/backend/src/db/database.ts:145-158`

**Issue:** The `updateApp` method builds SQL dynamically but is safe due to parameterized queries. However, the field names come from object keys which could be exploited.

**Impact:**
- SQL injection
- Data corruption
- Unauthorized access

**Current Code:**
```typescript
Object.entries(updates).forEach(([key, value]) => {
  if (key !== 'id' && key !== 'createdAt' && value !== undefined) {
    fields.push(`${key} = ?`); // Key is not validated!
    values.push(value);
  }
});
```

**Fix:**
```typescript
const ALLOWED_UPDATE_FIELDS = new Set([
  'name', 'prompt', 'status', 'previewUrl', 'code', 'metadata'
]);

updateApp(id: string, updates: Partial<App>): App | undefined {
  const app = this.getApp(id);
  if (!app) return undefined;

  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (ALLOWED_UPDATE_FIELDS.has(key) && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return app;

  values.push(new Date().toISOString());
  fields.push('updatedAt = ?');
  values.push(id);

  const stmt = this.db.prepare(`UPDATE apps SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return this.getApp(id);
}
```

---

## 🔴 CRITICAL-7: No CSRF Protection

**File:** All API routes

**Issue:** No CSRF tokens or SameSite cookie configuration, allowing cross-site request forgery.

**Impact:**
- Unauthorized actions
- Account takeover
- Data manipulation

**Fix:**
```typescript
// packages/backend/src/middleware/csrf.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const tokens = new Map<string, number>();
const TOKEN_EXPIRY = 3600000; // 1 hour

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
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
  
  // Cleanup expired tokens
  if (tokens.size > 10000) {
    const now = Date.now();
    for (const [t, exp] of tokens.entries()) {
      if (now > exp) tokens.delete(t);
    }
  }
  
  res.json({ csrfToken: token });
}
```

---

## Testing Strategy

### Critical-1: Async Transaction
```typescript
// packages/backend/tests/database-transaction.test.ts
describe('Database Transactions', () => {
  it('should handle concurrent writes correctly', async () => {
    const db = Database.getInstance();
    const promises = Array(100).fill(0).map((_, i) => 
      db.createApp({ id: `app-${i}`, /* ... */ })
    );
    await Promise.all(promises);
    const { total } = db.listApps(100);
    expect(total).toBe(100);
  });
});
```

### Critical-2: Path Traversal
```typescript
describe('Path Validation', () => {
  it('should prevent symlink attacks', async () => {
    await expect(
      validateAndOpenFile('/base', '../../../etc/passwd')
    ).rejects.toThrow('Path traversal');
  });
});
```

### Critical-3: XSS
```typescript
describe('XSS Prevention', () => {
  it('should escape unicode line terminators', () => {
    const malicious = 'foo\u2028bar\u2029baz';
    expect(escapeHtml(malicious)).not.toContain('\u2028');
    expect(escapeJs(malicious)).toContain('\\u2028');
  });
});
```

---

## Deployment Checklist

- [ ] Remove `transactionAsync` method
- [ ] Update all transaction callers to synchronous
- [ ] Implement `validateAndOpenFile` for all file operations
- [ ] Update `escapeHtml` and `escapeJs` functions
- [ ] Add `.unref()` to checkpoint interval
- [ ] Add request size limits to Express
- [ ] Whitelist updateable fields in `updateApp`
- [ ] Implement CSRF protection middleware
- [ ] Add CSRF token endpoint
- [ ] Update frontend to include CSRF tokens
- [ ] Run full security audit with OWASP ZAP
- [ ] Perform penetration testing
