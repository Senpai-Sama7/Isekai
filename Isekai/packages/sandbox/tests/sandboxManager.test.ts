import { SandboxManager } from '../src/services/sandboxManager';
import { spawn } from 'child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { EventEmitter } from 'events';
import kill from 'tree-kill';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('tree-kill');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;
const mockRmSync = rmSync as jest.MockedFunction<typeof rmSync>;
const mockKill = kill as jest.MockedFunction<typeof kill>;

class MockProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  pid = 12345;
}

describe('SandboxManager', () => {
  let sandboxManager: SandboxManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockExistsSync.mockReturnValue(false);
    sandboxManager = new SandboxManager();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('constructor', () => {
    it('should create workspace directory if it does not exist', () => {
      expect(mockExistsSync).toHaveBeenCalled();
      expect(mockMkdirSync).toHaveBeenCalled();
    });

    it('should not create workspace directory if it already exists', () => {
      jest.clearAllMocks();
      mockExistsSync.mockReturnValue(true);
      new SandboxManager();
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('execute', () => {
    const mockAppId = 'test-app-123';
    const mockFiles = {
      'package.json': '{"name":"test-app"}',
      'src/App.js': 'console.log("test");'
    };

    it('should create app directory and write files', async () => {
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      // Simulate npm install completion
      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      // Simulate app start
      setTimeout(() => {
        startProcess.stdout.emit('data', 'Compiled successfully');
      }, 20);

      const result = await executePromise;

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        mockFiles['package.json']
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('src/App.js'),
        mockFiles['src/App.js']
      );
      expect(result).toMatchObject({
        appId: mockAppId,
        status: 'running',
        url: expect.stringContaining('http://localhost:')
      });
    });

    it('should clean up existing app directory before creating new one', async () => {
      mockExistsSync.mockReturnValue(true);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'webpack compiled');
      }, 20);

      await executePromise;

      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining(mockAppId),
        { recursive: true, force: true }
      );
    });

    it('should handle npm install failure', async () => {
      const installProcess = new MockProcess();
      mockSpawn.mockReturnValueOnce(installProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 1);
      }, 10);

      await expect(executePromise).rejects.toThrow('npm install failed with code 1');
    });

    it('should handle app start with timeout', async () => {
      jest.useFakeTimers();
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      // Don't emit success message, rely on timeout
      jest.advanceTimersByTime(15100);

      const result = await executePromise;

      expect(result.status).toBe('running');
      jest.useRealTimers();
    });

    it('should detect app ready from different success messages', async () => {
      const testCases = [
        'webpack compiled successfully',
        'Compiled successfully!',
        'Server started on port 9000'
      ];

      for (const successMessage of testCases) {
        jest.clearAllMocks();
        mockExistsSync.mockReturnValue(false);
        
        const installProcess = new MockProcess();
        const startProcess = new MockProcess();
        
        mockSpawn
          .mockReturnValueOnce(installProcess as any)
          .mockReturnValueOnce(startProcess as any);

        const executePromise = sandboxManager.execute(mockAppId + successMessage, mockFiles);

        setTimeout(() => {
          installProcess.emit('close', 0);
        }, 10);

        setTimeout(() => {
          startProcess.stdout.emit('data', successMessage);
        }, 20);

        const result = await executePromise;
        expect(result.status).toBe('running');
      }
    });
  });

  describe('getStatus', () => {
    it('should return null for non-existent app', async () => {
      const status = await sandboxManager.getStatus('non-existent-id');
      expect(status).toBeNull();
    });

    it('should return app status', async () => {
      const mockAppId = 'test-app-456';
      const mockFiles = { 'package.json': '{}' };
      
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'Compiled successfully');
      }, 20);

      await executePromise;

      const status = await sandboxManager.getStatus(mockAppId);
      expect(status).toMatchObject({
        id: mockAppId,
        status: 'running',
        port: expect.any(Number),
        url: expect.stringContaining('http://localhost:'),
        startedAt: expect.any(Date),
        uptime: expect.any(Number)
      });
    });
  });

  describe('update', () => {
    it('should return null for non-existent app', async () => {
      const result = await sandboxManager.update('non-existent-id', {});
      expect(result).toBeNull();
    });

    it('should update files for existing app', async () => {
      const mockAppId = 'test-app-789';
      const mockFiles = { 'package.json': '{}' };
      
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'Compiled successfully');
      }, 20);

      await executePromise;

      const updatedFiles = { 'src/App.js': 'updated content' };
      const result = await sandboxManager.update(mockAppId, updatedFiles);

      expect(result).toMatchObject({
        status: 'updated',
        message: 'Files updated successfully'
      });
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('src/App.js'),
        'updated content'
      );
    });
  });

  describe('stop', () => {
    it('should handle stopping non-existent app gracefully', async () => {
      await expect(sandboxManager.stop('non-existent-id')).resolves.not.toThrow();
    });

    it('should kill process and clean up directory', async () => {
      const mockAppId = 'test-app-kill';
      const mockFiles = { 'package.json': '{}' };
      
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'Compiled successfully');
      }, 20);

      await executePromise;

      mockExistsSync.mockReturnValue(true);
      mockKill.mockImplementation((pid, signal, callback: any) => {
        callback(null);
      });

      await sandboxManager.stop(mockAppId);

      expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM', expect.any(Function));
      expect(mockRmSync).toHaveBeenCalledWith(
        expect.stringContaining(mockAppId),
        { recursive: true, force: true }
      );
    });

    it('should handle kill errors gracefully', async () => {
      const mockAppId = 'test-app-kill-error';
      const mockFiles = { 'package.json': '{}' };
      
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'started');
      }, 20);

      await executePromise;

      mockKill.mockImplementation((pid, signal, callback: any) => {
        callback(new Error('Kill failed'));
      });

      await expect(sandboxManager.stop(mockAppId)).resolves.not.toThrow();
    });
  });

  describe('getLogs', () => {
    it('should return empty string for non-existent app', async () => {
      const logs = await sandboxManager.getLogs('non-existent-id');
      expect(logs).toBe('');
    });

    it('should return recent logs', async () => {
      const mockAppId = 'test-app-logs';
      const mockFiles = { 'package.json': '{}' };
      
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.stdout.emit('data', 'Installing dependencies...');
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'Starting app...');
        startProcess.stdout.emit('data', 'Compiled successfully');
      }, 20);

      await executePromise;

      const logs = await sandboxManager.getLogs(mockAppId);
      expect(logs).toContain('Installing');
      expect(logs).toContain('Starting');
    });

    it('should limit logs to tail parameter', async () => {
      const mockAppId = 'test-app-logs-tail';
      const mockFiles = { 'package.json': '{}' };
      
      mockExistsSync.mockReturnValue(false);
      const installProcess = new MockProcess();
      const startProcess = new MockProcess();
      
      mockSpawn
        .mockReturnValueOnce(installProcess as any)
        .mockReturnValueOnce(startProcess as any);

      const executePromise = sandboxManager.execute(mockAppId, mockFiles);

      setTimeout(() => {
        installProcess.emit('close', 0);
      }, 10);

      setTimeout(() => {
        startProcess.stdout.emit('data', 'Compiled successfully');
      }, 20);

      await executePromise;

      const logs = await sandboxManager.getLogs(mockAppId, 2);
      const logLines = logs.split('\n').filter(line => line.length > 0);
      expect(logLines.length).toBeLessThanOrEqual(2);
    });
  });
});
