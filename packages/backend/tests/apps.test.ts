import request from 'supertest';
import express, { Application } from 'express';

// Mock the AppController before importing the routes
const mockGenerateApp = jest.fn();
const mockListApps = jest.fn();
const mockGetApp = jest.fn();
const mockModifyApp = jest.fn();
const mockDeleteApp = jest.fn();
const mockTrackAction = jest.fn();
const mockApplySuggestion = jest.fn();

jest.mock('../src/controllers/appController', () => {
  return {
    AppController: jest.fn().mockImplementation(() => ({
      generateApp: mockGenerateApp,
      listApps: mockListApps,
      getApp: mockGetApp,
      modifyApp: mockModifyApp,
      deleteApp: mockDeleteApp,
      trackAction: mockTrackAction,
      applySuggestion: mockApplySuggestion
    }))
  };
});

// Now import the router after the mock is set up
import { appRouter } from '../src/routes/apps';
import { correlationIdMiddleware } from '../src/middleware/correlationId';
import { errorHandler } from '../src/middleware/errorHandler';

describe('App Routes', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use(correlationIdMiddleware);
    app.use('/api/apps', appRouter);
    app.use(errorHandler);
  });

  describe('POST /api/apps/generate', () => {
    it('should generate a new app with valid prompt', async () => {
      const mockApp = {
        id: 'test-app-1',
        name: 'Test App',
        prompt: 'Create a CSV viewer',
        status: 'running',
        code: { files: {} },
        previewUrl: 'http://localhost:9000'
      };

      mockGenerateApp.mockResolvedValue(mockApp);

      const response = await request(app)
        .post('/api/apps/generate')
        .send({ prompt: 'Create a CSV viewer' })
        .expect(201);

      expect(response.body).toEqual(mockApp);
      expect(mockGenerateApp).toHaveBeenCalledWith(
        'Create a CSV viewer',
        undefined,
        expect.any(String)
      );
    });

    it('should generate app with context', async () => {
      const mockApp = {
        id: 'test-app-2',
        name: 'Test App',
        status: 'running'
      };

      const context = { theme: 'dark' };
      mockGenerateApp.mockResolvedValue(mockApp);

      await request(app)
        .post('/api/apps/generate')
        .send({ prompt: 'Create a todo app', context })
        .expect(201);

      expect(mockGenerateApp).toHaveBeenCalledWith('Create a todo app', context, expect.any(String));
    });

    it('should return 400 if prompt is missing', async () => {
      const response = await request(app)
        .post('/api/apps/generate')
        .send({})
        .expect(400);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'BadRequest', message: 'Request body validation failed.' })
      );
      expect(response.body).toHaveProperty('correlationId');
      expect(response.body.error).toHaveProperty('details');
    });

    it('should return 500 on controller error', async () => {
      mockGenerateApp.mockRejectedValue(new Error('Generation failed'));

      const response = await request(app)
        .post('/api/apps/generate')
        .send({ prompt: 'Create an app' })
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });

  describe('GET /api/apps', () => {
    it('should list apps with default pagination', async () => {
      const mockResult = {
        apps: [
          { id: 'app-1', name: 'App 1' },
          { id: 'app-2', name: 'App 2' }
        ],
        total: 2
      };

      mockListApps.mockReturnValue(mockResult);

      const response = await request(app)
        .get('/api/apps')
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(mockListApps).toHaveBeenCalledWith(10, 0);
    });

    it('should list apps with custom pagination', async () => {
      const mockResult = {
        apps: [],
        total: 0
      };

      mockListApps.mockReturnValue(mockResult);

      await request(app)
        .get('/api/apps?limit=20&offset=5')
        .expect(200);

      expect(mockListApps).toHaveBeenCalledWith(20, 5);
    });

    it('should handle invalid pagination parameters', async () => {
      // With validation, invalid parameters should return 400
      const response = await request(app)
        .get('/api/apps?limit=invalid&offset=also-invalid')
        .expect(400);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'BadRequest' })
      );
    });

    it('should return 500 on controller error', async () => {
      mockListApps.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/apps')
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });

  describe('GET /api/apps/:appId', () => {
    it('should get app by ID', async () => {
      const mockApp = {
        id: 'app-123',
        name: 'Test App',
        status: 'running'
      };

      mockGetApp.mockReturnValue(mockApp);

      const response = await request(app)
        .get('/api/apps/app-123')
        .expect(200);

      expect(response.body).toEqual(mockApp);
      expect(mockGetApp).toHaveBeenCalledWith('app-123');
    });

    it('should return 404 if app not found', async () => {
      mockGetApp.mockReturnValue(null);

      const response = await request(app)
        .get('/api/apps/non-existent')
        .expect(404);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'NotFound', message: 'App not found.' })
      );
    });

    it('should return 500 on controller error', async () => {
      mockGetApp.mockImplementation(() => {
        throw new Error('Database error');
      });

      const response = await request(app)
        .get('/api/apps/app-123')
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });

  describe('PATCH /api/apps/:appId', () => {
    it('should update app with prompt', async () => {
      const mockApp = {
        id: 'app-123',
        name: 'Updated App',
        status: 'running'
      };

      mockModifyApp.mockResolvedValue(mockApp);

      const response = await request(app)
        .patch('/api/apps/app-123')
        .send({ prompt: 'Add a search feature' })
        .expect(200);

      expect(response.body).toEqual(mockApp);
      expect(mockModifyApp).toHaveBeenCalledWith(
        'app-123',
        'Add a search feature',
        undefined,
        expect.any(String)
      );
    });

    it('should update app with changes', async () => {
      const mockApp = { id: 'app-123', status: 'running' };
      const changes = { files: { 'src/App.js': 'new content' } };

      mockModifyApp.mockResolvedValue(mockApp);

      await request(app)
        .patch('/api/apps/app-123')
        .send({ changes })
        .expect(200);

      expect(mockModifyApp).toHaveBeenCalledWith(
        'app-123',
        undefined,
        changes,
        expect.any(String)
      );
    });

    it('should update app with both prompt and changes', async () => {
      const mockApp = { id: 'app-123', status: 'running' };
      const changes = { theme: 'dark' };

      mockModifyApp.mockResolvedValue(mockApp);

      await request(app)
        .patch('/api/apps/app-123')
        .send({ prompt: 'Make it dark', changes })
        .expect(200);

      expect(mockModifyApp).toHaveBeenCalledWith(
        'app-123',
        'Make it dark',
        changes,
        expect.any(String)
      );
    });

    it('should return 404 if app not found', async () => {
      mockModifyApp.mockResolvedValue(null);

      const response = await request(app)
        .patch('/api/apps/non-existent')
        .send({ prompt: 'Update' })
        .expect(404);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'NotFound', message: 'App not found.' })
      );
    });

    it('should return 500 on controller error', async () => {
      mockModifyApp.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .patch('/api/apps/app-123')
        .send({ prompt: 'Update' })
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });

  describe('DELETE /api/apps/:appId', () => {
    it('should delete app successfully', async () => {
      mockDeleteApp.mockResolvedValue(true);

      await request(app)
        .delete('/api/apps/app-123')
        .expect(204);

      expect(mockDeleteApp).toHaveBeenCalledWith('app-123', expect.any(String));
    });

    it('should return 404 if app not found', async () => {
      mockDeleteApp.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/apps/non-existent')
        .expect(404);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'NotFound', message: 'App not found.' })
      );
    });

    it('should return 500 on controller error', async () => {
      mockDeleteApp.mockRejectedValue(new Error('Delete failed'));

      const response = await request(app)
        .delete('/api/apps/app-123')
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });

  describe('POST /api/apps/:appId/actions', () => {
    it('should track action and return suggestions', async () => {
      const mockSuggestions = [
        { id: 'sug-1', description: 'Add sorting' },
        { id: 'sug-2', description: 'Add filtering' }
      ];

      mockTrackAction.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .post('/api/apps/app-123/actions')
        .send({
          action: 'click',
          target: 'header',
          data: { column: 'name' }
        })
        .expect(200);

      expect(response.body.suggestions).toEqual(mockSuggestions);
      expect(mockTrackAction).toHaveBeenCalledWith(
        'app-123',
        'click',
        'header',
        { column: 'name' },
        expect.any(String)
      );
    });

    it('should handle action tracking with minimal data', async () => {
      mockTrackAction.mockResolvedValue([]);

      await request(app)
        .post('/api/apps/app-123/actions')
        .send({ action: 'scroll', target: 'list', data: {} })
        .expect(200);

      expect(mockTrackAction).toHaveBeenCalled();
    });

    it('should return 500 on controller error', async () => {
      mockTrackAction.mockRejectedValue(new Error('Tracking failed'));

      const response = await request(app)
        .post('/api/apps/app-123/actions')
        .send({ action: 'click', target: 'button', data: {} })
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });

  describe('POST /api/apps/:appId/apply', () => {
    it('should apply suggestion successfully', async () => {
      const mockApp = {
        id: 'app-123',
        status: 'running',
        code: { files: {} }
      };

      mockApplySuggestion.mockResolvedValue(mockApp);

      const response = await request(app)
        .post('/api/apps/app-123/apply')
        .send({ suggestionId: 'sug-1' })
        .expect(200);

      expect(response.body).toEqual(mockApp);
      expect(mockApplySuggestion).toHaveBeenCalledWith('app-123', 'sug-1', expect.any(String));
    });

    it('should return 404 if app or suggestion not found', async () => {
      mockApplySuggestion.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/apps/app-123/apply')
        .send({ suggestionId: 'non-existent' })
        .expect(404);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'NotFound', message: 'App or suggestion not found.' })
      );
    });

    it('should return 500 on controller error', async () => {
      mockApplySuggestion.mockRejectedValue(new Error('Apply failed'));

      const response = await request(app)
        .post('/api/apps/app-123/apply')
        .send({ suggestionId: 'sug-1' })
        .expect(500);

      expect(response.body.error).toEqual(
        expect.objectContaining({ code: 'InternalServerError', message: 'An unexpected error occurred.' })
      );
    });
  });
});
