import { AppError, serviceUnavailable } from '../errors/appError';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  resetTimeoutMs?: number;
  serviceName: string;
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private state: CircuitState = 'CLOSED';
  private nextAttempt = Date.now();

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
  }

  async run<T>(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        if (fallback) {
          return fallback();
        }

        throw this.createOpenError();
      }
    }

    try {
      const result = await action();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      if (fallback) {
        return fallback();
      }
      throw error;
    }
  }

  private recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successes += 1;
      if (this.successes >= this.successThreshold) {
        this.reset();
      }
      return;
    }

    this.failures = 0;
  }

  private recordFailure() {
    this.failures += 1;

    if (this.failures >= this.failureThreshold) {
      this.trip();
    }
  }

  private trip() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeoutMs;
  }

  private reset() {
    this.failures = 0;
    this.successes = 0;
    this.state = 'CLOSED';
  }

  private createOpenError(): AppError {
    return serviceUnavailable(`${this.options.serviceName} circuit is open.`);
  }
}
