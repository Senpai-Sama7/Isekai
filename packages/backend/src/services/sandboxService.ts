import axios from 'axios';
import { promises as fs } from 'fs';
import { dirname, join, resolve } from 'path';

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
  async execute(appId: string, files: any): Promise<any> {
    if (!shouldUseRemoteSandbox()) {
      return this.executeLocally(appId, files);
    }

    try {
      const response = await axios.post(`${SANDBOX_URL}/execute`, {
        appId,
        files
      }, { timeout: 60000 });

      return response.data;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return this.executeLocally(appId, files);
    }
  }

  async update(appId: string, files: any): Promise<any> {
    if (!shouldUseRemoteSandbox()) {
      return this.updateLocally(appId, files);
    }

    try {
      const response = await axios.patch(`${SANDBOX_URL}/apps/${appId}`, {
        files
      }, { timeout: 10000 });

      return response.data;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return this.updateLocally(appId, files);
    }
  }

  async stop(appId: string): Promise<void> {
    if (!shouldUseRemoteSandbox()) {
      await this.stopLocally(appId);
      return;
    }

    try {
      await axios.delete(`${SANDBOX_URL}/apps/${appId}`, { timeout: 10000 });
    } catch (error) {
      console.error('Sandbox service error:', error);
      await this.stopLocally(appId);
    }
  }

  async getStatus(appId: string): Promise<any> {
    if (!shouldUseRemoteSandbox()) {
      return this.getLocalStatus(appId);
    }

    try {
      const response = await axios.get(`${SANDBOX_URL}/apps/${appId}`, { timeout: 5000 });
      return response.data;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return this.getLocalStatus(appId);
    }
  }

  async getLogs(appId: string, tail: number = 100): Promise<string> {
    if (!shouldUseRemoteSandbox()) {
      return this.getLocalLogs(appId, tail);
    }

    try {
      const response = await axios.get(`${SANDBOX_URL}/apps/${appId}/logs`, {
        params: { tail },
        timeout: 5000
      });
      return response.data.logs;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return this.getLocalLogs(appId, tail);
    }
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
    const entries = Object.entries(files || {});

    await Promise.all(
      entries.map(async ([relativePath, contents]) => {
        const absolutePath = resolve(appDir, relativePath);
        if (!absolutePath.startsWith(appDir)) {
          throw new Error(`Invalid file path: ${relativePath}`);
        }

        await fs.mkdir(dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, contents ?? '', 'utf8');
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
