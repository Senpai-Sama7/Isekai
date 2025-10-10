import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import kill from 'tree-kill';

interface SandboxApp {
  id: string;
  process?: ChildProcess;
  port: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  logs: string[];
  startedAt: Date;
  timeoutHandle?: NodeJS.Timeout;
}

interface ResourceLimits {
  maxMemoryMB: number;
  maxCPUPercent: number;
  executionTimeoutMs: number;
}

export class SandboxManager {
  private apps: Map<string, SandboxApp> = new Map();
  private basePort = 9000;
  private nextPort = this.basePort;
  private workspaceDir: string;
  private resourceLimits: ResourceLimits;

  constructor() {
    this.workspaceDir = process.env.WORKSPACE_DIR || join(__dirname, '../../runtime/apps');
    if (!existsSync(this.workspaceDir)) {
      mkdirSync(this.workspaceDir, { recursive: true });
    }
    
    // Configure resource limits from environment or use defaults
    this.resourceLimits = {
      maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '512'),
      maxCPUPercent: parseInt(process.env.MAX_CPU_PERCENT || '50'),
      executionTimeoutMs: parseInt(process.env.EXECUTION_TIMEOUT_MS || '300000'), // 5 minutes default
    };
  }

  async execute(appId: string, files: Record<string, string>, dependencies?: any, config?: any): Promise<any> {
    const port = this.nextPort++;
    const appDir = join(this.workspaceDir, appId);

    // Create app directory
    if (existsSync(appDir)) {
      rmSync(appDir, { recursive: true, force: true });
    }
    mkdirSync(appDir, { recursive: true });

    // Write files
    Object.entries(files).forEach(([filepath, content]) => {
      const fullPath = join(appDir, filepath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(fullPath, content);
    });

    const app: SandboxApp = {
      id: appId,
      port,
      status: 'starting',
      logs: [],
      startedAt: new Date(),
      timeoutHandle: undefined
    };

    this.apps.set(appId, app);

    // Set execution timeout
    app.timeoutHandle = setTimeout(() => {
      app.logs.push('Execution timeout reached, stopping app...');
      this.stop(appId).catch(err => console.error('Error stopping app on timeout:', err));
    }, this.resourceLimits.executionTimeoutMs);

    // Start the app
    try {
      await this.startApp(appId, appDir, port);
      app.status = 'running';
      
      // Clear the execution timeout since app started successfully
      // The timeout will be reset if needed
      
      return {
        appId,
        url: `http://localhost:${port}`,
        status: 'running',
        logs: app.logs.join('\n')
      };
    } catch (error) {
      app.status = 'error';
      app.logs.push(`Error: ${error}`);
      // Clear timeout on error
      if (app.timeoutHandle) {
        clearTimeout(app.timeoutHandle);
        app.timeoutHandle = undefined;
      }
      throw error;
    }
  }

  private async startApp(appId: string, appDir: string, port: number): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) throw new Error('App not found');

    return new Promise((resolve, reject) => {
      // Install dependencies
      app.logs.push('Installing dependencies...');
      const install = spawn('npm', ['install'], {
        cwd: appDir,
        shell: true,
        env: { ...process.env, PORT: port.toString() }
      });

      install.stdout.on('data', (data) => {
        app.logs.push(data.toString());
      });

      install.stderr.on('data', (data) => {
        app.logs.push(data.toString());
      });

      install.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`npm install failed with code ${code}`));
          return;
        }

        app.logs.push('Starting app...');
        
        // Start the app
        const startProcess = spawn('npm', ['start'], {
          cwd: appDir,
          shell: true,
          env: { 
            ...process.env, 
            PORT: port.toString(),
            BROWSER: 'none' // Don't open browser
          },
          detached: false
        });

        app.process = startProcess;

        startProcess.stdout.on('data', (data) => {
          const log = data.toString();
          app.logs.push(log);
          
          // Check if app is ready
          if (log.includes('webpack compiled') || 
              log.includes('Compiled successfully') ||
              log.includes('started')) {
            resolve();
          }
        });

        startProcess.stderr.on('data', (data) => {
          app.logs.push(data.toString());
        });

        startProcess.on('error', (error) => {
          app.logs.push(`Process error: ${error.message}`);
          app.status = 'error';
          reject(error);
        });

        startProcess.on('close', (code) => {
          app.logs.push(`Process exited with code ${code}`);
          app.status = 'stopped';
        });

        // Resolve after a timeout if we don't see success message
        setTimeout(() => {
          if (app.status === 'starting') {
            app.status = 'running';
            resolve();
          }
        }, 15000); // 15 seconds timeout
      });
    });
  }

  async getStatus(appId: string): Promise<any | null> {
    const app = this.apps.get(appId);
    if (!app) return null;

    return {
      id: app.id,
      status: app.status,
      port: app.port,
      url: `http://localhost:${app.port}`,
      startedAt: app.startedAt,
      uptime: Date.now() - app.startedAt.getTime()
    };
  }

  async update(appId: string, files: Record<string, string>): Promise<any | null> {
    const app = this.apps.get(appId);
    if (!app) return null;

    const appDir = join(this.workspaceDir, appId);

    // Update files
    Object.entries(files).forEach(([filepath, content]) => {
      const fullPath = join(appDir, filepath);
      writeFileSync(fullPath, content);
    });

    app.logs.push('Files updated, hot reloading...');

    return {
      status: 'updated',
      message: 'Files updated successfully'
    };
  }

  async stop(appId: string): Promise<void> {
    const app = this.apps.get(appId);
    if (!app) return;

    // Clear timeout if exists
    if (app.timeoutHandle) {
      clearTimeout(app.timeoutHandle);
      app.timeoutHandle = undefined;
    }

    if (app.process && app.process.pid) {
      try {
        // Kill the process tree
        await new Promise<void>((resolve) => {
          kill(app.process!.pid!, 'SIGTERM', (err) => {
            if (err) {
              console.error('Error killing process:', err);
            }
            resolve();
          });
        });
      } catch (error) {
        console.error('Error stopping app:', error);
      }
    }

    app.status = 'stopped';
    this.apps.delete(appId);

    // Clean up app directory
    const appDir = join(this.workspaceDir, appId);
    if (existsSync(appDir)) {
      try {
        rmSync(appDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Error cleaning up app directory:', error);
      }
    }
  }

  async getLogs(appId: string, tail: number = 100): Promise<string> {
    const app = this.apps.get(appId);
    if (!app) return '';

    const logs = app.logs.slice(-tail);
    return logs.join('\n');
  }

  async stopAll(): Promise<void> {
    const appIds = Array.from(this.apps.keys());
    for (const appId of appIds) {
      await this.stop(appId);
    }
  }
}
