import { AppController } from '../src/controllers/appController';
import { Database } from '../src/db/database';
import { PlannerService } from '../src/services/plannerService';
import { SandboxService } from '../src/services/sandboxService';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123')
}));
jest.mock('../src/db/database');
jest.mock('../src/services/plannerService');
jest.mock('../src/services/sandboxService');

const MockedPlannerService = PlannerService as jest.MockedClass<typeof PlannerService>;
const MockedSandboxService = SandboxService as jest.MockedClass<typeof SandboxService>;

describe('AppController', () => {
  let controller: AppController;
  let mockDb: jest.Mocked<Database>;
  let mockPlannerService: jest.Mocked<PlannerService>;
  let mockSandboxService: jest.Mocked<SandboxService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDb = {
      createApp: jest.fn(),
      getApp: jest.fn(),
      updateApp: jest.fn(),
      deleteApp: jest.fn(),
      listApps: jest.fn()
    } as any;

    mockPlannerService = {
      analyze: jest.fn(),
      analyzeModification: jest.fn(),
      infer: jest.fn()
    } as any;

    mockSandboxService = {
      execute: jest.fn(),
      update: jest.fn(),
      stop: jest.fn()
    } as any;

    (Database.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockDb);
    MockedPlannerService.mockImplementation(() => mockPlannerService);
    MockedSandboxService.mockImplementation(() => mockSandboxService);

    controller = new AppController();
  });

  describe('generateApp', () => {
    const mockPrompt = 'Create a CSV viewer app';
    const mockContext = { theme: 'light' };

    it('should create app and return success result', async () => {
      const mockPlannerResult = {
        intent: { type: 'csv_viewer' },
        components: ['table', 'upload'],
        code: {
          files: {
            'package.json': '{"name":"csv-viewer"}',
            'src/App.js': 'console.log("CSV Viewer");'
          }
        }
      };

      const mockSandboxResult = {
        appId: 'mock-uuid-123',
        url: 'http://localhost:9000',
        status: 'running'
      };

      const mockStoredApp = {
        id: 'mock-uuid-123',
        name: 'Create A Csv',
        prompt: mockPrompt,
        status: 'running' as const,
        code: JSON.stringify({ files: mockPlannerResult.code.files }),
        metadata: JSON.stringify({
          context: mockContext,
          intent: mockPlannerResult.intent,
          components: mockPlannerResult.components
        }),
        previewUrl: mockSandboxResult.url,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      };

      mockPlannerService.analyze.mockResolvedValue(mockPlannerResult);
      mockSandboxService.execute.mockResolvedValue(mockSandboxResult);
      mockDb.getApp.mockReturnValue(mockStoredApp);

      const result = await controller.generateApp(mockPrompt, mockContext);

      expect(mockDb.createApp).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid-123',
          name: 'Create A Csv',
          prompt: mockPrompt,
          status: 'generating',
          code: JSON.stringify({ files: {} })
        })
      );

      expect(mockPlannerService.analyze).toHaveBeenCalledWith(mockPrompt, mockContext);
      expect(mockSandboxService.execute).toHaveBeenCalledWith(
        'mock-uuid-123',
        mockPlannerResult.code.files
      );

      expect(mockDb.updateApp).toHaveBeenCalledWith('mock-uuid-123', {
        status: 'running' as const,
        code: JSON.stringify({ files: mockPlannerResult.code.files }),
        previewUrl: mockSandboxResult.url,
        metadata: expect.any(String)
      });

      expect(result).toEqual(expect.objectContaining({
        id: 'mock-uuid-123',
        status: 'running' as const,
        previewUrl: mockSandboxResult.url
      }));
    });

    it('should handle generation without context', async () => {
      const mockPlannerResult = {
        intent: { type: 'todo_app' },
        components: ['input', 'list'],
        code: { files: { 'package.json': '{}' } }
      };

      mockPlannerService.analyze.mockResolvedValue(mockPlannerResult);
      mockSandboxService.execute.mockResolvedValue({ url: 'http://localhost:9000' });
      mockDb.getApp.mockReturnValue({
        id: 'mock-uuid-123',
        name: 'Create A Csv',
        prompt: mockPrompt,
        status: 'running' as const,
        code: '{"files":{}}',
        metadata: '{}',
        previewUrl: 'http://localhost:9000',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });

      await controller.generateApp(mockPrompt);

      expect(mockPlannerService.analyze).toHaveBeenCalledWith(mockPrompt, undefined);
    });

    it('should update status to error on planner failure', async () => {
      mockPlannerService.analyze.mockRejectedValue(new Error('Planner failed'));

      await expect(controller.generateApp(mockPrompt)).rejects.toThrow('Planner failed');

      expect(mockDb.updateApp).toHaveBeenCalledWith('mock-uuid-123', {
        status: 'error'
      });
    });

    it('should update status to error on sandbox failure', async () => {
      mockPlannerService.analyze.mockResolvedValue({
        intent: {},
        components: [],
        code: { files: {} }
      });
      mockSandboxService.execute.mockRejectedValue(new Error('Sandbox failed'));

      await expect(controller.generateApp(mockPrompt)).rejects.toThrow('Sandbox failed');

      expect(mockDb.updateApp).toHaveBeenCalledWith('mock-uuid-123', {
        status: 'error'
      });
    });
  });

  describe('getApp', () => {
    it('should return formatted app data', () => {
      const mockApp = {
        id: 'app-123',
        name: 'Test App',
        prompt: 'Create a test app',
        status: 'running' as const,
        code: '{"files":{"package.json":"{}"}}',
        metadata: '{"context":{"theme":"dark"}}',
        previewUrl: 'http://localhost:9000',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      };

      mockDb.getApp.mockReturnValue(mockApp);

      const result = controller.getApp('app-123');

      expect(result).toEqual({
        id: 'app-123',
        name: 'Test App',
        prompt: 'Create a test app',
        status: 'running' as const,
        code: { files: { 'package.json': '{}' } },
        metadata: { context: { theme: 'dark' } },
        previewUrl: 'http://localhost:9000',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });

      expect(mockDb.getApp).toHaveBeenCalledWith('app-123');
    });

    it('should return null for non-existent app', () => {
      mockDb.getApp.mockReturnValue(undefined);

      const result = controller.getApp('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listApps', () => {
    it('should return formatted list of apps', () => {
      const mockApps = [
        {
          id: 'app-1',
          name: 'App 1',
          prompt: 'Test 1',
          status: 'running' as const,
          code: '{"files":{}}',
          metadata: '{"context":{}}',
          previewUrl: 'http://localhost:9000',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01'
        },
        {
          id: 'app-2',
          name: 'App 2',
          prompt: 'Test 2',
          status: 'stopped' as const,
          code: '{"files":{}}',
          metadata: '{"context":{}}',
          previewUrl: 'http://localhost:9001',
          createdAt: '2023-01-02',
          updatedAt: '2023-01-02'
        }
      ];

      mockDb.listApps.mockReturnValue({
        apps: mockApps,
        total: 2
      });

      const result = controller.listApps(10, 0);

      expect(result).toEqual({
        apps: [
          expect.objectContaining({ id: 'app-1', name: 'App 1' }),
          expect.objectContaining({ id: 'app-2', name: 'App 2' })
        ],
        total: 2
      });

      expect(mockDb.listApps).toHaveBeenCalledWith(10, 0);
    });

    it('should handle empty list', () => {
      mockDb.listApps.mockReturnValue({ apps: [], total: 0 });

      const result = controller.listApps(10, 0);

      expect(result).toEqual({ apps: [], total: 0 });
    });

    it('should handle pagination parameters', () => {
      mockDb.listApps.mockReturnValue({ apps: [], total: 100 });

      controller.listApps(20, 40);

      expect(mockDb.listApps).toHaveBeenCalledWith(20, 40);
    });
  });

  describe('modifyApp', () => {
    const mockAppId = 'app-123';

    beforeEach(() => {
      mockDb.getApp.mockReturnValue({
        id: mockAppId,
        name: 'Test App',
        prompt: 'Test',
        status: 'running' as const,
        code: '{"files":{"package.json":"{}"}}',
        metadata: '{"context":{}}',
        previewUrl: 'http://localhost:9000',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });
    });

    it('should return null for non-existent app', async () => {
      mockDb.getApp.mockReturnValue(undefined);

      const result = await controller.modifyApp('non-existent');

      expect(result).toBeNull();
    });

    it('should modify app with prompt', async () => {
      const mockModificationResult = {
        code: {
          files: {
            'package.json': '{"name":"updated"}',
            'src/App.js': 'updated code'
          }
        }
      };

      mockPlannerService.analyzeModification.mockResolvedValue(mockModificationResult);
      mockSandboxService.update.mockResolvedValue({ status: 'updated' });

      await controller.modifyApp(mockAppId, 'Add a search feature');

      expect(mockPlannerService.analyzeModification).toHaveBeenCalledWith(
        'Add a search feature',
        { files: { 'package.json': '{}' } },
        { context: {} }
      );

      expect(mockSandboxService.update).toHaveBeenCalledWith(
        mockAppId,
        mockModificationResult.code.files
      );

      expect(mockDb.updateApp).toHaveBeenCalledWith(mockAppId, {
        code: JSON.stringify({ files: mockModificationResult.code.files })
      });
    });

    it('should modify app with direct changes', async () => {
      const changes = {
        'src/App.js': 'new content'
      };

      mockSandboxService.update.mockResolvedValue({ status: 'updated' });

      await controller.modifyApp(mockAppId, undefined, changes);

      expect(mockPlannerService.analyzeModification).not.toHaveBeenCalled();
      expect(mockSandboxService.update).toHaveBeenCalledWith(mockAppId, changes);
      expect(mockDb.updateApp).toHaveBeenCalledWith(mockAppId, {
        code: JSON.stringify({ files: changes })
      });
    });

    it('should return app unchanged if no prompt or changes provided', async () => {
      const result = await controller.modifyApp(mockAppId);

      expect(mockPlannerService.analyzeModification).not.toHaveBeenCalled();
      expect(mockSandboxService.update).not.toHaveBeenCalled();
      expect(mockDb.updateApp).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ id: mockAppId }));
    });

    it('should handle modification errors', async () => {
      mockPlannerService.analyzeModification.mockRejectedValue(
        new Error('Modification failed')
      );

      await expect(
        controller.modifyApp(mockAppId, 'Invalid modification')
      ).rejects.toThrow('Modification failed');
    });
  });

  describe('deleteApp', () => {
    it('should delete app successfully', async () => {
      mockDb.getApp.mockReturnValue({
        id: 'app-123',
        name: 'Test',
        prompt: 'Test',
        status: 'running' as const,
        code: '{}',
        metadata: '{}',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });
      mockDb.deleteApp.mockReturnValue(true);
      mockSandboxService.stop.mockResolvedValue(undefined);

      const result = await controller.deleteApp('app-123');

      expect(mockSandboxService.stop).toHaveBeenCalledWith('app-123');
      expect(mockDb.deleteApp).toHaveBeenCalledWith('app-123');
      expect(result).toBe(true);
    });

    it('should return false for non-existent app', async () => {
      mockDb.getApp.mockReturnValue(undefined);

      const result = await controller.deleteApp('non-existent');

      expect(result).toBe(false);
      expect(mockSandboxService.stop).not.toHaveBeenCalled();
      expect(mockDb.deleteApp).not.toHaveBeenCalled();
    });

    it('should continue deletion even if sandbox stop fails', async () => {
      mockDb.getApp.mockReturnValue({
        id: 'app-123',
        name: 'Test',
        prompt: 'Test',
        status: 'running' as const,
        code: '{}',
        metadata: '{}',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });
      mockSandboxService.stop.mockRejectedValue(new Error('Stop failed'));
      mockDb.deleteApp.mockReturnValue(true);

      const result = await controller.deleteApp('app-123');

      expect(mockDb.deleteApp).toHaveBeenCalledWith('app-123');
      expect(result).toBe(true);
    });
  });

  describe('trackAction', () => {
    it('should return suggestions from planner service', async () => {
      const mockApp = {
        id: 'app-123',
        name: 'Test',
        prompt: 'Test',
        status: 'running' as const,
        code: '{"files":{}}',
        metadata: '{"context":{}}',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      };

      const mockSuggestions = [
        { id: 'sug-1', description: 'Add sorting' },
        { id: 'sug-2', description: 'Add filtering' }
      ];

      mockDb.getApp.mockReturnValue(mockApp);
      mockPlannerService.infer.mockResolvedValue({ suggestions: mockSuggestions });

      const result = await controller.trackAction(
        'app-123',
        'click',
        'header',
        { column: 'name' }
      );

      expect(mockPlannerService.infer).toHaveBeenCalledWith({
        action: 'click',
        target: 'header',
        data: { column: 'name' },
        context: { context: {} },
        currentCode: { files: {} }
      });

      expect(result).toEqual(mockSuggestions);
    });

    it('should return empty array for non-existent app', async () => {
      mockDb.getApp.mockReturnValue(undefined);

      const result = await controller.trackAction('non-existent', 'click', 'button', {});

      expect(result).toEqual([]);
      expect(mockPlannerService.infer).not.toHaveBeenCalled();
    });

    it('should return empty array on inference error', async () => {
      mockDb.getApp.mockReturnValue({
        id: 'app-123',
        name: 'Test',
        prompt: 'Test',
        status: 'running' as const,
        code: '{}',
        metadata: '{}',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });
      mockPlannerService.infer.mockRejectedValue(new Error('Inference failed'));

      const result = await controller.trackAction('app-123', 'click', 'button', {});

      expect(result).toEqual([]);
    });

    it('should handle missing suggestions in response', async () => {
      mockDb.getApp.mockReturnValue({
        id: 'app-123',
        name: 'Test',
        prompt: 'Test',
        status: 'running' as const,
        code: '{}',
        metadata: '{}',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      });
      mockPlannerService.infer.mockResolvedValue({});

      const result = await controller.trackAction('app-123', 'click', 'button', {});

      expect(result).toEqual([]);
    });
  });

  describe('applySuggestion', () => {
    it('should return app for valid suggestion', async () => {
      const mockApp = {
        id: 'app-123',
        name: 'Test',
        prompt: 'Test',
        status: 'running' as const,
        code: '{"files":{}}',
        metadata: '{"context":{}}',
        previewUrl: 'http://localhost:9000',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-01'
      };

      mockDb.getApp.mockReturnValue(mockApp);

      const result = await controller.applySuggestion('app-123', 'sug-1');

      expect(result).toEqual(expect.objectContaining({ id: 'app-123' }));
    });
  });

  describe('generateAppName', () => {
    it('should generate proper case name from prompt', () => {
      const testCases = [
        { input: 'create a csv viewer', expected: 'Create A Csv' },
        { input: 'BUILD TODO APP', expected: 'Build Todo App' },
        { input: 'Make markdown editor with preview', expected: 'Make Markdown Editor' }
      ];

      testCases.forEach(({ input, expected }) => {
        mockDb.getApp.mockReturnValue({
          id: 'test',
          name: expected,
          prompt: input,
          status: 'running' as const,
          code: '{}',
          metadata: '{}',
          createdAt: '2023-01-01',
          updatedAt: '2023-01-01'
        });

        mockPlannerService.analyze.mockResolvedValue({
          intent: {},
          components: [],
          code: { files: {} }
        });
        mockSandboxService.execute.mockResolvedValue({ url: 'http://localhost:9000' });

        controller.generateApp(input);

        expect(mockDb.createApp).toHaveBeenCalledWith(
          expect.objectContaining({ name: expected })
        );
      });
    });
  });
});
