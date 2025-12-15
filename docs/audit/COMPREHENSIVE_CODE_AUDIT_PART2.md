# COMPREHENSIVE CODE AUDIT - PART 2

## 4. ERROR HANDLING & RESILIENCE

### 4.1 Error Handling Patterns

#### HIGH: Inconsistent Error Handling

**Issue:** Error handling varies across services with inconsistent patterns.

**Evidence:**
```typescript
// packages/backend/src/routes/apps.ts
appRouter.post('/generate', validateAppGeneration, async (req, res) => {
  try {
    const app = await controller.generateApp(prompt, context);
    res.status(201).json(app);
  } catch (error) {
    console.error('Error generating app:', error); // Only console log
    res.status(500).json({ error: 'Failed to generate app' }); // Generic message
  }
});
```

**Issues:**
- No structured logging
- Generic error messages leak no details
- No error classification (retryable vs non-retryable)
- No correlation IDs for debugging

**Recommendation:**
```typescript
// Implement structured error handling
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
    public isOperational: boolean = true,
    public details?: any
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types
class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, true, details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is unavailable`, 'SERVICE_UNAVAILABLE', 503, true);
  }
}

// Centralized error handler
const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  
  if (err instanceof AppError) {
    logger.error({
      correlationId,
      code: err.code,
      message: err.message,
      details: err.details,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      correlationId,
      ...(process.env.NODE_ENV === 'development' && { details: err.details })
    });
  }
  
  // Unexpected errors
  logger.error({
    correlationId,
    error: err,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    correlationId
  });
};

app.use(errorHandler);
```

### 4.2 Timeout Management

#### MEDIUM: Inconsistent Timeout Configuration

**Issue:** Timeouts are hardcoded and vary across services.

**Evidence:**
```typescript
// packages/backend/src/services/plannerService.ts
const response = await axios.post(`${REMOTE_PLANNER_URL}/analyze`, {
  prompt, context
}, { timeout: 30000 }); // 30 seconds

// packages/backend/src/services/sandboxService.ts
const response = await axios.post(`${SANDBOX_URL}/execute`, {
  appId, files
}, { timeout: 60000 }); // 60 seconds

// packages/sandbox/src/services/sandboxManager.ts
setTimeout(() => {
  app.logs.push('Execution timeout reached...');
  this.stop(appId);
}, this.resourceLimits.executionTimeoutMs); // 5 minutes
```

**Recommendation:**
```typescript
// Centralized timeout configuration
const TIMEOUTS = {
  HTTP_REQUEST: parseInt(process.env.HTTP_TIMEOUT || '10000'),
  PLANNER_ANALYZE: parseInt(process.env.PLANNER_TIMEOUT || '30000'),
  SANDBOX_EXECUTE: parseInt(process.env.SANDBOX_EXECUTE_TIMEOUT || '60000'),
  SANDBOX_UPDATE: parseInt(process.env.SANDBOX_UPDATE_TIMEOUT || '10000'),
  DATABASE_QUERY: parseInt(process.env.DB_QUERY_TIMEOUT || '5000'),
  APP_EXECUTION: parseInt(process.env.APP_EXECUTION_TIMEOUT || '300000')
};

// Implement timeout wrapper
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

// Usage
const result = await withTimeout(
  this.plannerService.analyze(prompt, context),
  TIMEOUTS.PLANNER_ANALYZE,
  'Planner service timeout'
);
```

### 4.3 Graceful Degradation

#### MEDIUM: Limited Fallback Mechanisms

**Issue:** Only planner service has fallback, others fail completely.

**Evidence:**
```typescript
// packages/backend/src/services/plannerService.ts
async analyze(prompt: string, context?: any): Promise<any> {
  if (!shouldUseRemotePlanner()) {
    return this.localPlanner.generateApp(prompt, context);
  }
  
  try {
    const response = await axios.post(`${REMOTE_PLANNER_URL}/analyze`, ...);
    return response.data;
  } catch (error) {
    console.error('Planner service error:', error);
    return this.localPlanner.generateApp(prompt, context); // Good fallback
  }
}

// packages/backend/src/services/sandboxService.ts
async execute(appId: string, files: any): Promise<any> {
  try {
    const response = await axios.post(`${SANDBOX_URL}/execute`, ...);
    return response.data;
  } catch (error) {
    console.error('Sandbox service error:', error);
    return this.executeLocally(appId, files); // Good fallback
  }
}
```

**Recommendation:**
```typescript
// Implement feature flags for graceful degradation
class FeatureFlags {
  private flags = new Map<string, boolean>();
  
  async isEnabled(feature: string): Promise<boolean> {
    // Check Redis or config service
    return this.flags.get(feature) ?? true;
  }
  
  async disable(feature: string, reason: string) {
    this.flags.set(feature, false);
    logger.warn(`Feature ${feature} disabled: ${reason}`);
  }
}

// Use in services
class AppController {
  async generateApp(prompt: string, context?: any) {
    const features = new FeatureFlags();
    
    // Try full generation
    if (await features.isEnabled('full_generation')) {
      try {
        return await this.fullGeneration(prompt, context);
      } catch (error) {
        await features.disable('full_generation', error.message);
      }
    }
    
    // Fallback to basic generation
    if (await features.isEnabled('basic_generation')) {
      return await this.basicGeneration(prompt);
    }
    
    // Last resort: static template
    return this.staticTemplate(prompt);
  }
}
```

---

## 5. PERFORMANCE ANALYSIS

### 5.1 Database Performance

#### HIGH: N+1 Query Problem

**Issue:** Listing apps with suggestions requires multiple queries.

**Evidence:**
```typescript
// packages/backend/src/controllers/appController.ts
listApps(limit: number, offset: number) {
  const result = this.db.listApps(limit, offset);
  
  return {
    apps: result.apps.map(app => ({
      id: app.id,
      // ... parse JSON for each app
      code: JSON.parse(app.code),
      metadata: JSON.parse(app.metadata),
    })),
    total: result.total
  };
}
```

**Recommendation:**
```typescript
// Optimize with projection and lazy loading
listApps(limit: number, offset: number, includeCode: boolean = false) {
  const fields = includeCode 
    ? '*' 
    : 'id, name, prompt, status, preview_url, created_at, updated_at';
  
  const stmt = this.db.prepare(`
    SELECT ${fields} FROM apps 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `);
  
  const apps = stmt.all(limit, offset);
  
  return {
    apps: apps.map(app => ({
      ...app,
      ...(includeCode && {
        code: JSON.parse(app.code),
        metadata: JSON.parse(app.metadata)
      })
    })),
    total: this.getAppCount()
  };
}
```

#### MEDIUM: Missing Database Indexes

**Issue:** Only basic indexes exist, missing composite indexes for common queries.

**Evidence:**
```typescript
// packages/backend/src/db/database.ts
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_createdAt ON apps(createdAt DESC);
// Missing: user_id + status, user_id + created_at
```

**Recommendation:**
```sql
-- Add composite indexes for common query patterns
CREATE INDEX idx_apps_user_status ON apps(user_id, status);
CREATE INDEX idx_apps_user_created ON apps(user_id, created_at DESC);
CREATE INDEX idx_suggestions_app_created ON suggestions(app_id, created_at DESC);

-- Add covering index for list queries
CREATE INDEX idx_apps_list_covering ON apps(
  created_at DESC, 
  id, name, status, preview_url
) WHERE status != 'deleted';
```

### 5.2 Memory Management

#### HIGH: Unbounded Memory Growth in Sandbox

**Issue:** Sandbox stores all logs in memory without limits.

**Evidence:**
```typescript
// packages/sandbox/src/services/sandboxManager.ts
interface SandboxApp {
  id: string;
  logs: string[]; // Unbounded array
  // ...
}

startProcess.stdout.on('data', (data) => {
  app.logs.push(data.toString()); // Grows indefinitely
});
```

**Recommendation:**
```typescript
// Implement circular buffer for logs
class CircularBuffer<T> {
  private buffer: T[];
  private pointer = 0;
  private size: number;
  
  constructor(size: number) {
    this.size = size;
    this.buffer = new Array(size);
  }
  
  push(item: T) {
    this.buffer[this.pointer] = item;
    this.pointer = (this.pointer + 1) % this.size;
  }
  
  getAll(): T[] {
    return [
      ...this.buffer.slice(this.pointer),
      ...this.buffer.slice(0, this.pointer)
    ].filter(Boolean);
  }
}

interface SandboxApp {
  id: string;
  logs: CircularBuffer<string>; // Fixed size
  // ...
}

// Initialize with limit
const app: SandboxApp = {
  id: appId,
  logs: new CircularBuffer<string>(1000), // Max 1000 log entries
  // ...
};
```

#### MEDIUM: JSON Parsing Performance

**Issue:** JSON parsing happens on every database read without caching.

**Evidence:**
```typescript
// packages/backend/src/controllers/appController.ts
getApp(appId: string): any | null {
  const app = this.db.getApp(appId);
  if (!app) return null;
  
  return {
    id: app.id,
    code: JSON.parse(app.code), // Parse every time
    metadata: JSON.parse(app.metadata), // Parse every time
    // ...
  };
}
```

**Recommendation:**
```typescript
// Implement caching layer
import NodeCache from 'node-cache';

class AppController {
  private cache = new NodeCache({ 
    stdTTL: 300, // 5 minutes
    checkperiod: 60,
    useClones: false
  });
  
  getApp(appId: string): any | null {
    const cacheKey = `app:${appId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const app = this.db.getApp(appId);
    if (!app) return null;
    
    const parsed = {
      id: app.id,
      code: JSON.parse(app.code),
      metadata: JSON.parse(app.metadata),
      // ...
    };
    
    this.cache.set(cacheKey, parsed);
    return parsed;
  }
  
  // Invalidate cache on updates
  async modifyApp(appId: string, ...) {
    const result = await this.updateApp(appId, ...);
    this.cache.del(`app:${appId}`);
    return result;
  }
}
```

### 5.3 Concurrency Issues

#### HIGH: Sandbox Port Allocation Race Condition

**Issue:** Port allocation is not thread-safe.

**Evidence:**
```typescript
// packages/sandbox/src/services/sandboxManager.ts
export class SandboxManager {
  private nextPort = this.basePort;
  
  async execute(appId: string, files: Record<string, string>) {
    const port = this.nextPort++; // Race condition
    // ...
  }
}
```

**Recommendation:**
```typescript
// Implement atomic port allocation
class PortAllocator {
  private usedPorts = new Set<number>();
  private basePort = 9000;
  private maxPort = 9999;
  private lock = new AsyncLock();
  
  async allocate(): Promise<number> {
    return this.lock.acquire('port', async () => {
      for (let port = this.basePort; port <= this.maxPort; port++) {
        if (!this.usedPorts.has(port)) {
          this.usedPorts.add(port);
          return port;
        }
      }
      throw new Error('No available ports');
    });
  }
  
  release(port: number) {
    this.usedPorts.delete(port);
  }
}

class SandboxManager {
  private portAllocator = new PortAllocator();
  
  async execute(appId: string, files: Record<string, string>) {
    const port = await this.portAllocator.allocate();
    try {
      // ... execute app
    } catch (error) {
      this.portAllocator.release(port);
      throw error;
    }
  }
}
```

---

## 6. CODE QUALITY ANALYSIS

### 6.1 TypeScript Usage

#### MEDIUM: Weak Type Safety

**Issue:** Extensive use of `any` types reduces type safety benefits.

**Evidence:**
```typescript
// packages/backend/src/controllers/appController.ts
async generateApp(prompt: string, context?: any): Promise<any> {
  // ... returns any
}

getApp(appId: string): any | null {
  // ... returns any
}

// packages/planner/src/services/intentAnalyzer.ts
inferFromAction(action: any, context: any, history?: any[]): any[] {
  // All parameters are any
}
```

**Recommendation:**
```typescript
// Define proper interfaces
interface AppContext {
  title?: string;
  framework?: string;
  features?: string[];
}

interface GeneratedApp {
  id: string;
  name: string;
  prompt: string;
  status: AppStatus;
  previewUrl?: string;
  code: AppCode;
  metadata: AppMetadata;
  createdAt: string;
  updatedAt: string;
}

interface AppCode {
  files: Record<string, string>;
}

interface AppMetadata {
  context?: AppContext;
  intent?: string;
  components?: string[];
}

// Use in methods
async generateApp(
  prompt: string, 
  context?: AppContext
): Promise<GeneratedApp> {
  // ...
}

getApp(appId: string): GeneratedApp | null {
  // ...
}
```

### 6.2 Code Duplication

#### MEDIUM: Repeated Validation Logic

**Issue:** Similar validation patterns repeated across services.

**Evidence:**
```typescript
// packages/backend/src/middleware/validation.ts
export const validateAppGeneration = [
  body('prompt')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 }),
  // ...
];

// packages/planner/src/middleware/validation.ts
export const validateAnalyze = [
  body('prompt')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 }),
  // ... exact same validation
];
```

**Recommendation:**
```typescript
// Create shared validation library
// packages/shared/src/validation/common.ts
export const promptValidation = () => 
  body('prompt')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Prompt must be between 1 and 5000 characters');

export const contextValidation = () =>
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object');

// Use in services
import { promptValidation, contextValidation } from '@isekai/shared/validation';

export const validateAppGeneration = [
  promptValidation(),
  contextValidation(),
  handleValidationErrors
];
```

### 6.3 Testing Coverage

#### HIGH: Insufficient Test Coverage

**Issue:** Only smoke tests exist, missing unit and integration tests.

**Evidence:**
```
packages/backend/tests/
  ├── smoke.test.ts          # Only smoke test
  ├── appController.test.ts  # Empty or minimal
  ├── apps.test.ts           # Empty or minimal
  └── localIntegration.test.ts # Basic integration

packages/planner/tests/
  └── codeGenerator.test.ts  # Minimal

packages/sandbox/tests/
  └── sandboxManager.test.ts # Minimal
```

**Recommendation:**
```typescript
// Comprehensive test structure
packages/backend/tests/
  ├── unit/
  │   ├── controllers/
  │   │   ├── appController.test.ts
  │   │   └── appController.spec.ts
  │   ├── services/
  │   │   ├── plannerService.test.ts
  │   │   └── sandboxService.test.ts
  │   ├── db/
  │   │   └── database.test.ts
  │   └── middleware/
  │       └── validation.test.ts
  ├── integration/
  │   ├── api/
  │   │   ├── apps.integration.test.ts
  │   │   └── health.integration.test.ts
  │   └── services/
  │       └── endToEnd.integration.test.ts
  ├── e2e/
  │   └── userFlows.e2e.test.ts
  └── smoke/
      └── smoke.test.ts

// Example comprehensive test
describe('AppController', () => {
  let controller: AppController;
  let mockDb: jest.Mocked<Database>;
  let mockPlanner: jest.Mocked<PlannerService>;
  let mockSandbox: jest.Mocked<SandboxService>;
  
  beforeEach(() => {
    mockDb = createMockDatabase();
    mockPlanner = createMockPlanner();
    mockSandbox = createMockSandbox();
    controller = new AppController(mockDb, mockPlanner, mockSandbox);
  });
  
  describe('generateApp', () => {
    it('should create app with generating status', async () => {
      const prompt = 'Create CSV viewer';
      await controller.generateApp(prompt);
      
      expect(mockDb.createApp).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'generating' })
      );
    });
    
    it('should update status to running on success', async () => {
      const prompt = 'Create CSV viewer';
      mockPlanner.analyze.mockResolvedValue({ code: { files: {} } });
      mockSandbox.execute.mockResolvedValue({ url: 'http://localhost:9000' });
      
      await controller.generateApp(prompt);
      
      expect(mockDb.updateApp).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'running' })
      );
    });
    
    it('should update status to error on failure', async () => {
      const prompt = 'Create CSV viewer';
      mockPlanner.analyze.mockRejectedValue(new Error('Planner failed'));
      
      await expect(controller.generateApp(prompt)).rejects.toThrow();
      
      expect(mockDb.updateApp).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: 'error' })
      );
    });
    
    it('should handle timeout gracefully', async () => {
      const prompt = 'Create CSV viewer';
      mockPlanner.analyze.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 60000))
      );
      
      await expect(controller.generateApp(prompt)).rejects.toThrow('timeout');
    });
  });
});
```

