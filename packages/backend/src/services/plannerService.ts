import { LocalPlanner } from './localPlanner';
import { createHttpClient } from './httpClient';
import { logger } from '../observability/logger';

const DEFAULT_PLANNER_PORT = process.env.PLANNER_PORT || '8090';
const REMOTE_PLANNER_URL = process.env.PLANNER_URL || `http://localhost:${DEFAULT_PLANNER_PORT}`;

function shouldUseRemotePlanner(): boolean {
  if (!process.env.PLANNER_URL) {
    return false;
  }

  const value = process.env.PLANNER_URL.toLowerCase();
  if (value === 'local' || value === 'builtin') {
    return false;
  }

  return true;
}

export class PlannerService {
  private readonly localPlanner = new LocalPlanner();
  private readonly remoteClient = createHttpClient({
    baseURL: REMOTE_PLANNER_URL,
    timeout: 30_000,
    serviceName: 'planner-service',
  });

  private buildHeaders(correlationId?: string) {
    return correlationId
      ? {
          'x-correlation-id': correlationId,
        }
      : undefined;
  }

  async analyze(prompt: string, context?: any, correlationId = 'unknown'): Promise<any> {
    if (!shouldUseRemotePlanner()) {
      return this.localPlanner.generateApp(prompt, context);
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .post(
            '/analyze',
            {
              prompt,
              context,
            },
            { headers: this.buildHeaders(correlationId) }
          )
          .then((response) => response.data),
      async () => {
        logger.warn('Falling back to local planner for analyze()', { correlationId });
        return this.localPlanner.generateApp(prompt, context);
      }
    );
  }

  async analyzeModification(prompt: string, currentCode: any, metadata: any, correlationId = 'unknown'): Promise<any> {
    if (!shouldUseRemotePlanner()) {
      return this.localPlanner.generateModification(prompt, currentCode?.files || currentCode || {}, metadata);
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .post(
            '/analyze',
            {
              prompt,
              context: { currentCode, metadata, isModification: true },
            },
            { headers: this.buildHeaders(correlationId) }
          )
          .then((response) => response.data),
      async () => {
        logger.warn('Falling back to local planner for analyzeModification()', { correlationId });
        return this.localPlanner.generateModification(prompt, currentCode?.files || currentCode || {}, metadata);
      }
    );
  }

  async infer(data: any, correlationId = 'unknown'): Promise<any> {
    if (!shouldUseRemotePlanner()) {
      return this.localPlanner.infer({
        action: data.action,
        target: data.target,
        data: data.data,
        context: data.context,
        currentCode: data.currentCode
      });
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .post('/infer', data, {
            headers: this.buildHeaders(correlationId),
          })
          .then((response) => response.data),
      async () => {
        logger.warn('Falling back to local planner for infer()', { correlationId });
        return this.localPlanner.infer({
          action: data.action,
          target: data.target,
          data: data.data,
          context: data.context,
          currentCode: data.currentCode,
        });
      }
    );
  }
}
