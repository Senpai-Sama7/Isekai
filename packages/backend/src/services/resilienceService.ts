import { logger } from '../observability/logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  
  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  isOpen(): boolean {
    return this.state === 'OPEN';
  }
}

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export class RetryService {
  static async withRetry<T>(
    fn: () => Promise<T>, 
    options: RetryOptions,
    onError?: (error: Error, attempt: number) => void
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (onError) {
          onError(lastError, attempt);
        }
        
        if (attempt === options.maxRetries) {
          break; // Last attempt, throw the error
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
          options.maxDelay
        );
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }
}

export interface ResilienceOptions {
  circuitBreaker?: CircuitBreakerOptions;
  retry?: RetryOptions;
}

export class ResilienceService {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly defaultCircuitOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    timeout: 60000,
    resetTimeout: 30000
  };
  
  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2
  };

  async executeWithResilience<T>(
    key: string,
    fn: () => Promise<T>,
    options?: ResilienceOptions
  ): Promise<T> {
    const circuitOptions = options?.circuitBreaker || this.defaultCircuitOptions;
    const retryOptions = options?.retry || this.defaultRetryOptions;

    // Get or create circuit breaker for this service/key
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker(circuitOptions));
    }
    
    const circuitBreaker = this.circuitBreakers.get(key)!;

    // Execute with circuit breaker
    return await circuitBreaker.execute(async () => {
      return await RetryService.withRetry(
        fn,
        retryOptions,
        (error, attempt) => {
          logger.warn(`Service call failed (attempt ${attempt + 1})`, {
            key,
            attempt,
            error: error.message
          });
        }
      );
    });
  }

  isCircuitOpen(key: string): boolean {
    const cb = this.circuitBreakers.get(key);
    return cb ? cb.isOpen() : false;
  }

  resetCircuit(key: string): void {
    const cb = this.circuitBreakers.get(key);
    if (cb) {
      // This will effectively reset by changing it to CLOSED manually
      // A more proper reset would require adjusting the internal state
      this.circuitBreakers.delete(key);
    }
  }
}