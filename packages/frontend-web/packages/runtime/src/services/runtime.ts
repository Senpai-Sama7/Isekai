import Docker from 'dockerode';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as tmp from 'tmp';
import * as archiver from 'archiver';
import { GeneratedApp, ExecutionResult, ExecutionContext } from '@isekai/types';
import { winstonLogger } from '../utils/logger';
import { SecurityManager } from './security-manager';
import { SandboxManager } from './sandbox-manager';

export class RuntimeService {
  private docker: Docker;
  private securityManager: SecurityManager;
  private sandboxManager: SandboxManager;
  private activeSandboxes: Map<string, any> = new Map();

  constructor() {
    this.docker = new Docker();
    this.securityManager = new SecurityManager();
    this.sandboxManager = new SandboxManager();
  }

  async executeApp(app: GeneratedApp): Promise<ExecutionResult> {
    const sandboxId = uuidv4();
    const startTime = Date.now();

    try {
      // Security validation
      await this.securityManager.validateApp(app);

      // Create sandbox environment
      const sandbox = await this.sandboxManager.createSandbox(sandboxId, app);
      this.activeSandboxes.set(sandboxId, sandbox);

      // Prepare execution context
      const context: ExecutionContext = {
        appId: app.id,
        sandboxId,
        environment: {
          NODE_ENV: 'production',
          PORT: '3000',
          SANDBOX_ID: sandboxId
        },
        resources: {
          memory: 512, // MB
          cpu: 0.5, // cores
          timeout: 30000 // 30 seconds
        }
      };

      // Execute application
      const result = await this.executeInSandbox(sandbox, context);

      // Cleanup
      await this.cleanupSandbox(sandboxId);

      const executionTime = Date.now() - startTime;

      return {
        success: result.success,
        output: result.output,
        error: result.error,
        logs: result.logs,
        metrics: {
          executionTime,
          memoryUsage: result.memoryUsage || 0,
          cpuUsage: result.cpuUsage || 0
        },
        artifacts: result.artifacts
      };

    } catch (error) {
      await this.cleanupSandbox(sandboxId);
      
      return {
        success: false,
        error: error.message,
        logs: [error.stack],
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsage: 0,
          cpuUsage: 0
        }
      };
    }
  }

  private async executeInSandbox(sandbox: any, context: ExecutionContext): Promise<any> {
    const container = sandbox.container;
    const logs: string[] = [];
    let output = '';
    let error = '';

    try {
      // Start container
      await container.start();

      // Stream logs
      const logStream = await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: true
      });

      logStream.on('data', (chunk) => {
        const log = chunk.toString();
        logs.push(log);
        winstonLogger.info('Sandbox log', { sandboxId: context.sandboxId, log });
      });

      // Wait for execution or timeout
      const execResult = await this.waitForExecution(container, context.resources.timeout);

      if (execResult.exitCode === 0) {
        output = execResult.output;
      } else {
        error = execResult.error;
      }

      // Get resource usage
      const stats = await container.stats({ stream: false });
      const memoryUsage = stats.memory_stats.usage / (1024 * 1024); // MB
      const cpuUsage = this.calculateCpuUsage(stats);

      return {
        success: execResult.exitCode === 0,
        output,
        error,
        logs,
        memoryUsage,
        cpuUsage,
        artifacts: execResult.artifacts
      };

    } catch (executionError) {
      logs.push(`Execution error: ${executionError.message}`);
      
      return {
        success: false,
        error: executionError.message,
        logs,
        memoryUsage: 0,
        cpuUsage: 0
      };
    }
  }

  private async waitForExecution(container: any, timeout: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          await container.kill();
          reject(new Error('Execution timeout'));
        } catch (error) {
          reject(error);
        }
      }, timeout);

      container.wait().then(async (data: any) => {
        clearTimeout(timer);
        
        try {
          // Get execution output
          const exec = await container.exec({
            Cmd: ['cat', '/app/output.json'],
            AttachStdout: true,
            AttachStderr: true
          });

          const stream = await exec.start({ hijack: true, stdin: false });
          let output = '';
          let errorOutput = '';

          stream.on('data', (chunk: any) => {
            if (chunk.slice(0, 8).toString() === '\x01\x00\x00\x00\x00\x00\x00\x00') {
              // stdout
              output += chunk.slice(8).toString();
            } else if (chunk.slice(0, 8).toString() === '\x02\x00\x00\x00\x00\x00\x00\x00') {
              // stderr
              errorOutput += chunk.slice(8).toString();
            }
          });

          stream.on('end', () => {
            resolve({
              exitCode: data.StatusCode,
              output: output.trim(),
              error: errorOutput.trim(),
              artifacts: []
            });
          });

        } catch (error) {
          resolve({
            exitCode: data.StatusCode,
            output: '',
            error: error.message,
            artifacts: []
          });
        }
      }).catch(reject);
    });
  }

  private calculateCpuUsage(stats: any): number {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.online_cpus;

    if (systemDelta > 0) {
      return (cpuDelta / systemDelta) * cpuCount * 100;
    }
    return 0;
  }

  async cleanupSandbox(sandboxId: string): Promise<void> {
    try {
      const sandbox = this.activeSandboxes.get(sandboxId);
      if (sandbox) {
        await this.sandboxManager.destroySandbox(sandbox);
        this.activeSandboxes.delete(sandboxId);
        winstonLogger.info('Sandbox cleaned up', { sandboxId });
      }
    } catch (error) {
      winstonLogger.error('Failed to cleanup sandbox', { sandboxId, error: error.message });
    }
  }

  async getActiveSandboxes(): Promise<string[]> {
    return Array.from(this.activeSandboxes.keys());
  }
}