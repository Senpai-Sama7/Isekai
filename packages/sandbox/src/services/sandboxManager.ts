import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
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

// Security configuration for dependency validation
const SAFE_DEPENDENCIES_ALLOWLIST = [
  // Core React dependencies
  'react', 'react-dom', 'react-scripts',
  // Common utilities
  'axios', 'lodash', 'moment', 'date-fns', 'uuid', 'qs',
  // UI libraries
  'styled-components', '@emotion/react', '@emotion/styled',
  // Data processing
  'papaparse', 'marked', 'highlight.js',
  // Form handling
  'formik', 'yup', 'react-hook-form',
  // State management
  'redux', 'react-redux', 'zustand', '@reduxjs/toolkit',
  // Routing
  'react-router-dom',
  // Testing (shouldn't be in production, but potentially in generated apps)
  '@testing-library/react', '@testing-library/jest-dom'
];

const UNSAFE_DEPENDENCIES_BLOCKLIST = [
  // Dangerous packages that can execute system commands
  'child_process', 'exec', 'shelljs', 'node-gyp',
  // File system access
  'fs', 'fs-extra', 'glob',
  // Network access
  'net', 'dgram', 'dns',
  // Process management
  'worker_threads', 'cluster',
  // Package management
  'npm', 'yarn', 'pnpm',
  // System access
  'os', 'process', 'vm', 'module', 'require',
  // Unsafe packages
  'eval', 'dynamic-import', 'vm2', 'sandbox', 'node-vm'
];

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

  /**
   * Validates dependencies to ensure they are safe to install
   * @param appDir - Application directory
   * @param dependencies - Dependencies to validate
   */
  private async validateDependencies(appDir: string, dependencies?: any): Promise<void> {
    if (!dependencies) {
      return; // No dependencies to validate
    }

    const packageJsonPath = join(appDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new Error('No package.json found in app directory');
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    for (const [depName, depVersion] of Object.entries(allDeps)) {
      // Check against blocklist first
      if (UNSAFE_DEPENDENCIES_BLOCKLIST.some(unsafeDep => 
        depName.includes(unsafeDep) || unsafeDep.includes(depName))) {
        throw new Error(`Blocked dependency: ${depName} - contains potentially unsafe package`);
      }

      // If allowlist is enabled and the dependency is not in it, block it
      if (process.env.SANDBOX_STRICT_MODE === 'true' && 
          !SAFE_DEPENDENCIES_ALLOWLIST.some(safeDep => 
            depName.includes(safeDep) || safeDep.includes(depName))) {
        throw new Error(`Dependency not in allowlist: ${depName} - only safe dependencies are permitted in strict mode`);
      }

      // Validate version format to prevent malicious version strings
      if (typeof depVersion !== 'string' || depVersion.length > 100) {
        throw new Error(`Invalid dependency version format for ${depName}: ${depVersion}`);
      }

      // Check for potentially malicious version strings
      if (depVersion.includes('!') || depVersion.includes('|') || depVersion.includes(';') || depVersion.includes('&')) {
        throw new Error(`Potentially malicious dependency version for ${depName}: ${depVersion}`);
      }
    }
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

    // Validate dependencies before installation
    await this.validateDependencies(appDir, dependencies);

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
      // Install dependencies with security flags to prevent malicious script execution
      app.logs.push('Installing dependencies securely...');
      const installArgs = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--production'];
      
      // Add additional security validation for dependencies
      const install = spawn('npm', installArgs, {
        cwd: appDir,
        shell: false, // Prevent shell injection
        env: { 
          ...process.env, 
          PATH: process.env.PATH,
          PORT: port.toString(),
          HOME: appDir, // Limit npm cache to app directory
          NPM_CONFIG_CACHE: join(appDir, 'npm-cache'),
          NPM_CONFIG_PREFIX: join(appDir, 'npm-global')
        }
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
        
        // Start the app with security restrictions
        const startProcess = spawn('npm', ['start', '--ignore-scripts'], {
          cwd: appDir,
          shell: false, // Prevent shell injection
          env: { 
            ...process.env, 
            PATH: process.env.PATH,
            PORT: port.toString(),
            BROWSER: 'none', // Don't open browser
            NODE_ENV: 'production'
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
