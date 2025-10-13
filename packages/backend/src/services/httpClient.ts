import axios, { AxiosInstance } from 'axios';
import { CircuitBreaker } from '../utils/circuitBreaker';
import { logger } from '../observability/logger';

interface HttpClientOptions {
  baseURL: string;
  timeout: number;
  serviceName: string;
}

export function createHttpClient({ baseURL, timeout, serviceName }: HttpClientOptions) {
  const instance: AxiosInstance = axios.create({
    baseURL,
    timeout,
  });

  const circuitBreaker = new CircuitBreaker({ serviceName });

  instance.interceptors.request.use((config) => {
    if (config.headers && config.headers['x-correlation-id']) {
      return config;
    }

    return config;
  });

  async function runWithBreaker<T>(fn: () => Promise<T>, fallback?: () => Promise<T>) {
    return circuitBreaker.run(fn, fallback);
  }

  async function runWithRetry<T>(fn: () => Promise<T>, retries = 2) {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      try {
        if (attempt > 0) {
          logger.warn('Retrying HTTP request', {
            serviceName,
            attempt,
          });
        }
        return await fn();
      } catch (error) {
        lastError = error;
        attempt += 1;
        if (attempt > retries) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, Math.min(Math.pow(2, attempt) * 100, 5000)));
      }
    }

    throw lastError;
  }

  return {
    client: instance,
    async execute<T>(fn: (client: AxiosInstance) => Promise<T>, fallback?: () => Promise<T>) {
      return runWithBreaker(() => runWithRetry(() => fn(instance)), fallback).catch((error) => {
        const err = error as Error;
        logger.error('HTTP client call failed', {
          serviceName,
          errorMessage: err.message,
          stack: err.stack,
        });
        throw error;
      });
    },
  };
}
