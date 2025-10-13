import { Router, Request, Response } from 'express';
import { AppController } from '../controllers/appController';
import {
  validateAppGeneration,
  validateAppModification,
  validateActionTracking,
  validateApplySuggestion,
  validateListApps,
  validateGetApp
} from '../middleware/validation';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/joiValidation';
import Joi from '../lib/miniJoi';
import { badRequest, notFound } from '../errors/appError';

const generateSchema = Joi.object({
  prompt: Joi.string().min(1).max(5000).required(),
  context: Joi.object().optional(),
});

export const appRouter = Router();
const controller = new AppController();

// Generate new app
appRouter.post(
  '/generate',
  validateBody(generateSchema),
  validateAppGeneration,
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, context } = req.body;
    const correlationId = req.correlationId || 'unknown';

    if (!prompt) {
      throw badRequest('Prompt is required.');
    }

    const app = await controller.generateApp(prompt, context, correlationId);
    res.status(201).json(app);
  })
);

// List apps
appRouter.get(
  '/',
  validateListApps,
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = controller.listApps(limit, offset);
    res.json(result);
  })
);

// Get app
appRouter.get(
  '/:appId',
  validateGetApp,
  asyncHandler(async (req: Request, res: Response) => {
    const app = controller.getApp(req.params.appId);

    if (!app) {
      throw notFound('App not found.');
    }

    res.json(app);
  })
);

// Update app
appRouter.patch(
  '/:appId',
  validateAppModification,
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, changes } = req.body;
    const correlationId = req.correlationId || 'unknown';

    const app = await controller.modifyApp(req.params.appId, prompt, changes, correlationId);

    if (!app) {
      throw notFound('App not found.');
    }

    res.json(app);
  })
);

// Delete app
appRouter.delete(
  '/:appId',
  validateGetApp,
  asyncHandler(async (req: Request, res: Response) => {
    const correlationId = req.correlationId || 'unknown';
    const success = await controller.deleteApp(req.params.appId, correlationId);

    if (!success) {
      throw notFound('App not found.');
    }

    res.status(204).send();
  })
);

// Track actions
appRouter.post(
  '/:appId/actions',
  validateActionTracking,
  asyncHandler(async (req: Request, res: Response) => {
    const { action, target, data } = req.body;
    const correlationId = req.correlationId || 'unknown';

    const suggestions = await controller.trackAction(req.params.appId, action, target, data, correlationId);
    res.json({ suggestions });
  })
);

// Apply suggestions
appRouter.post(
  '/:appId/apply',
  validateApplySuggestion,
  asyncHandler(async (req: Request, res: Response) => {
    const { suggestionId } = req.body;
    const correlationId = req.correlationId || 'unknown';

    const app = await controller.applySuggestion(req.params.appId, suggestionId, correlationId);

    if (!app) {
      throw notFound('App or suggestion not found.');
    }

    res.json(app);
  })
);

// Track interactions (batch)
appRouter.post(
  '/interactions',
  asyncHandler(async (req: Request, res: Response) => {
    const { interactions } = req.body;
    const correlationId = req.correlationId || 'unknown';

    if (!Array.isArray(interactions)) {
      throw badRequest('Interactions must be an array.');
    }

    const suggestions = await controller.analyzeInteractions(interactions, correlationId);
    res.json({ suggestions });
  })
);

// Get AI suggestions for app based on interactions
appRouter.post(
  '/:appId/suggest',
  asyncHandler(async (req: Request, res: Response) => {
    const { interactions } = req.body;
    const correlationId = req.correlationId || 'unknown';

    if (!Array.isArray(interactions)) {
      throw badRequest('Interactions must be an array.');
    }

    const suggestions = await controller.getSuggestions(req.params.appId, interactions, correlationId);
    res.json({ suggestions });
  })
);

// Modify app with prompt or changes
appRouter.post(
  '/:appId/modify',
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, changes } = req.body;
    const correlationId = req.correlationId || 'unknown';

    const app = await controller.modifyApp(req.params.appId, prompt, changes, correlationId);

    if (!app) {
      throw notFound('App not found.');
    }

    res.json(app);
  })
);
