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

export const appRouter = Router();
const controller = new AppController();

// Generate new app
appRouter.post('/generate', validateAppGeneration, async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const app = await controller.generateApp(prompt, context);
    res.status(201).json(app);
  } catch (error) {
    console.error('Error generating app:', error);
    res.status(500).json({ error: 'Failed to generate app' });
  }
});

// List apps
appRouter.get('/', validateListApps, (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = controller.listApps(limit, offset);
    res.json(result);
  } catch (error) {
    console.error('Error listing apps:', error);
    res.status(500).json({ error: 'Failed to list apps' });
  }
});

// Get app
appRouter.get('/:appId', validateGetApp, (req: Request, res: Response) => {
  try {
    const app = controller.getApp(req.params.appId);
    
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(app);
  } catch (error) {
    console.error('Error getting app:', error);
    res.status(500).json({ error: 'Failed to get app' });
  }
});

// Update app
appRouter.patch('/:appId', validateAppModification, async (req: Request, res: Response) => {
  try {
    const { prompt, changes } = req.body;
    
    const app = await controller.modifyApp(req.params.appId, prompt, changes);
    
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(app);
  } catch (error) {
    console.error('Error updating app:', error);
    res.status(500).json({ error: 'Failed to update app' });
  }
});

// Delete app
appRouter.delete('/:appId', validateGetApp, async (req: Request, res: Response) => {
  try {
    const success = await controller.deleteApp(req.params.appId);
    
    if (!success) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting app:', error);
    res.status(500).json({ error: 'Failed to delete app' });
  }
});

// Track actions
appRouter.post('/:appId/actions', validateActionTracking, async (req: Request, res: Response) => {
  try {
    const { action, target, data } = req.body;
    
    const suggestions = await controller.trackAction(req.params.appId, action, target, data);
    res.json({ suggestions });
  } catch (error) {
    console.error('Error tracking action:', error);
    res.status(500).json({ error: 'Failed to track action' });
  }
});

// Apply suggestions
appRouter.post('/:appId/apply', validateApplySuggestion, async (req: Request, res: Response) => {
  try {
    const { suggestionId } = req.body;
    
    const app = await controller.applySuggestion(req.params.appId, suggestionId);
    
    if (!app) {
      return res.status(404).json({ error: 'App or suggestion not found' });
    }
    
    res.json(app);
  } catch (error) {
    console.error('Error applying suggestion:', error);
    res.status(500).json({ error: 'Failed to apply suggestion' });
  }
});
