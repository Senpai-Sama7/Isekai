import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';
import { createHttpClient } from './httpClient';
import { logger } from '../observability/logger';
import {
  validatePathWithinBaseSync,
  validateFileCount,
  validateTotalFilesSize
} from '../utils/security';

const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:8002';
const LOCAL_SANDBOX_ROOT = process.env.SANDBOX_ROOT || join(__dirname, '../../../data/sandbox-apps');

function shouldUseRemoteSandbox(): boolean {
  if (!process.env.SANDBOX_URL) {
    return false;
  }

  const value = process.env.SANDBOX_URL.toLowerCase();
  if (value === 'local' || value === 'builtin') {
    return false;
  }

  return true;
}

export class SandboxService {
  private readonly remoteClient = createHttpClient({
    baseURL: SANDBOX_URL,
    timeout: 60_000,
    serviceName: 'sandbox-service',
  });

  private buildHeaders(correlationId?: string) {
    return correlationId
      ? {
          'x-correlation-id': correlationId,
        }
      : undefined;
  }

  async execute(appId: string, files: any, correlationId = 'unknown'): Promise<any> {
    if (!shouldUseRemoteSandbox()) {
      return this.executeLocally(appId, files);
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .post(
            '/execute',
            {
              appId,
              files,
            },
            { headers: this.buildHeaders(correlationId) }
          )
          .then((response) => response.data),
      async () => {
        logger.warn('Falling back to local sandbox for execute()', { correlationId });
        return this.executeLocally(appId, files);
      }
    );
  }

  async update(appId: string, files: any, correlationId = 'unknown'): Promise<any> {
    if (!shouldUseRemoteSandbox()) {
      return this.updateLocally(appId, files);
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .patch(
            `/apps/${appId}`,
            {
              files,
            },
            { headers: this.buildHeaders(correlationId), timeout: 10_000 }
          )
          .then((response) => response.data),
      async () => {
        logger.warn('Falling back to local sandbox for update()', { correlationId });
        return this.updateLocally(appId, files);
      }
    );
  }

  async stop(appId: string, correlationId = 'unknown'): Promise<void> {
    if (!shouldUseRemoteSandbox()) {
      await this.stopLocally(appId);
      return;
    }

    await this.remoteClient.execute(
      (client) =>
        client.delete(`/apps/${appId}`, {
          headers: this.buildHeaders(correlationId),
          timeout: 10_000,
        }),
      async () => {
        logger.warn('Falling back to local sandbox for stop()', { correlationId });
        await this.stopLocally(appId);
      }
    );
  }

  async getStatus(appId: string, correlationId = 'unknown'): Promise<any> {
    if (!shouldUseRemoteSandbox()) {
      return this.getLocalStatus(appId);
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .get(`/apps/${appId}`, {
            headers: this.buildHeaders(correlationId),
            timeout: 5_000,
          })
          .then((response) => response.data),
      async () => {
        logger.warn('Falling back to local sandbox for getStatus()', { correlationId });
        return this.getLocalStatus(appId);
      }
    );
  }

  async getLogs(appId: string, tail: number = 100, correlationId?: string): Promise<string> {
    if (!shouldUseRemoteSandbox()) {
      return this.getLocalLogs(appId, tail);
    }

    return this.remoteClient.execute(
      (client) =>
        client
          .get(`/apps/${appId}/logs`, {
            params: { tail },
            headers: this.buildHeaders(correlationId),
            timeout: 5_000,
          })
          .then((response) => response.data.logs),
      async () => {
        logger.warn('Falling back to local sandbox for getLogs()', { correlationId });
        return this.getLocalLogs(appId, tail);
      }
    );
  }

  private async ensureLocalRoot(): Promise<void> {
    await fs.mkdir(LOCAL_SANDBOX_ROOT, { recursive: true });
  }

  private async executeLocally(appId: string, files: Record<string, string>): Promise<any> {
    await this.ensureLocalRoot();
    const appDir = join(LOCAL_SANDBOX_ROOT, appId);
    await fs.rm(appDir, { recursive: true, force: true });
    await fs.mkdir(appDir, { recursive: true });

    await this.writeFiles(appDir, files);
    const preview = await this.resolvePreviewUrl(appDir, files);
    await this.appendLog(appDir, `Initialized app with ${Object.keys(files).length} files.`);

    return {
      appId,
      url: preview,
      status: 'running',
      logs: await this.getLocalLogs(appId)
    };
  }

  private async updateLocally(appId: string, files: Record<string, string>): Promise<any> {
    await this.ensureLocalRoot();
    const appDir = join(LOCAL_SANDBOX_ROOT, appId);
    await fs.mkdir(appDir, { recursive: true });

    await this.writeFiles(appDir, files);
    await this.appendLog(appDir, `Updated files at ${new Date().toISOString()}.`);

    return {
      status: 'updated',
      url: await this.resolvePreviewUrl(appDir, files)
    };
  }

  private async stopLocally(appId: string): Promise<void> {
    const appDir = join(LOCAL_SANDBOX_ROOT, appId);
    await fs.rm(appDir, { recursive: true, force: true });
  }

  private async getLocalStatus(appId: string): Promise<any> {
    const appDir = join(LOCAL_SANDBOX_ROOT, appId);
    try {
      await fs.access(appDir);
      return {
        appId,
        status: 'running',
        url: await this.resolvePreviewUrl(appDir, {})
      };
    } catch {
      return { status: 'stopped' };
    }
  }

  private async getLocalLogs(appId: string, tail: number = 100): Promise<string> {
    const logPath = join(LOCAL_SANDBOX_ROOT, appId, 'sandbox.log');
    try {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-tail).join('\n');
    } catch {
      return '';
    }
  }

  private async writeFiles(appDir: string, files: Record<string, string>): Promise<void> {
    // Validate file count and total size limits
    const MAX_FILES = 100;
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024; // 10MB

    validateFileCount(files, MAX_FILES);
    validateTotalFilesSize(files, MAX_TOTAL_SIZE);

    const entries = Object.entries(files || {});

    await Promise.all(
      entries.map(async ([relativePath, contents]) => {
        // Security: Validate path to prevent traversal attacks
        try {
          const absolutePath = validatePathWithinBaseSync(appDir, relativePath);

          await fs.mkdir(dirname(absolutePath), { recursive: true });
          await fs.writeFile(absolutePath, contents ?? '', 'utf8');
        } catch (error) {
          logger.error('Path validation failed', {
            relativePath,
            error: (error as Error).message
          });
          throw new Error(`Invalid or unsafe file path: ${relativePath}`);
        }
      })
    );
  }

  private async resolvePreviewUrl(appDir: string, files: Record<string, string>): Promise<string> {
    const candidate = join(appDir, 'index.html');

    try {
      await fs.access(candidate);
      return `file://${candidate}`;
    } catch {
      const fallback = Object.keys(files || {})
        .filter(path => path.endsWith('.html'))
        .map(path => join(appDir, path))[0];

      if (fallback) {
        return `file://${fallback}`;
      }

      return `file://${appDir}`;
    }
  }

  private async appendLog(appDir: string, message: string): Promise<void> {
    const logPath = join(appDir, 'sandbox.log');
    const line = `[${new Date().toISOString()}] ${message}\n`;
    await fs.appendFile(logPath, line, 'utf8');
  }
}
