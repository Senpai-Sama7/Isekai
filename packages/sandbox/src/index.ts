import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { SandboxManager } from './services/sandboxManager';
import {
  validateExecute,
  validateUpdate,
  validateAppId,
  validateLogs
} from './middleware/validation';
import dotenv from 'dotenv';
import { startTelemetry, logger } from '@isekai/observability';

dotenv.config();

// Initialize telemetry
process.env.SERVICE_NAME = 'sandbox';
startTelemetry('sandbox');

const app: Application = express();
const PORT = Number(process.env.PORT || process.env.SANDBOX_PORT || 8070);

const sandboxManager = new SandboxManager();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Sandbox doesn't serve HTML
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    : ['http://localhost:8080', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting for execute operations
const executeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 executions per windowMs
  message: 'Too many execution requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));

app.post('/execute', executeRateLimit as any, validateExecute, async (req: Request, res: Response) => {
  const requestTracker = logger.startRequest('POST', '/execute');
  try {
    const { appId, files, dependencies, config } = req.body;
    
    const result = await sandboxManager.execute(appId, files, dependencies, config);
    res.status(201).json(result);
    requestTracker.end('201');
  } catch (error) {
    logger.error('Error executing in sandbox:', { 
      error: (error as Error).message, 
      stack: (error as Error).stack,
      appId: req.body.appId
    });
    requestTracker.end('500');
    res.status(500).json({ error: 'Failed to execute in sandbox' });
  }
});

app.get('/apps/:appId', validateAppId, async (req: Request, res: Response) => {
  const requestTracker = logger.startRequest('GET', '/apps/:appId');
  try {
    const status = await sandboxManager.getStatus(req.params.appId);
    
    if (!status) {
      logger.warn('App not found', { appId: req.params.appId });
      requestTracker.end('404');
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(status);
    requestTracker.end('200');
  } catch (error) {
    logger.error('Error getting app status:', { 
      error: (error as Error).message, 
      stack: (error as Error).stack,
      appId: req.params.appId
    });
    requestTracker.end('500');
    res.status(500).json({ error: 'Failed to get app status' });
  }
});

app.patch('/apps/:appId', validateUpdate, async (req: Request, res: Response) => {
  const requestTracker = logger.startRequest('PATCH', '/apps/:appId');
  try {
    const { files } = req.body;
    
    const result = await sandboxManager.update(req.params.appId, files);
    
    if (!result) {
      logger.warn('App not found for update', { appId: req.params.appId });
      requestTracker.end('404');
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(result);
    requestTracker.end('200');
  } catch (error) {
    logger.error('Error updating app:', { 
      error: (error as Error).message, 
      stack: (error as Error).stack,
      appId: req.params.appId
    });
    requestTracker.end('500');
    res.status(500).json({ error: 'Failed to update app' });
  }
});

app.delete('/apps/:appId', validateAppId, async (req: Request, res: Response) => {
  const requestTracker = logger.startRequest('DELETE', '/apps/:appId');
  try {
    await sandboxManager.stop(req.params.appId);
    logger.info('App stopped successfully', { appId: req.params.appId });
    res.status(204).send();
    requestTracker.end('204');
  } catch (error) {
    logger.error('Error stopping app:', { 
      error: (error as Error).message, 
      stack: (error as Error).stack,
      appId: req.params.appId
    });
    requestTracker.end('500');
    res.status(500).json({ error: 'Failed to stop app' });
  }
});

app.get('/apps/:appId/logs', validateLogs, async (req: Request, res: Response) => {
  const requestTracker = logger.startRequest('GET', '/apps/:appId/logs');
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const logs = await sandboxManager.getLogs(req.params.appId, tail);
    
    res.json({ logs });
    requestTracker.end('200');
  } catch (error) {
    logger.error('Error getting logs:', { 
      error: (error as Error).message, 
      stack: (error as Error).stack,
      appId: req.params.appId,
      tail: parseInt(req.query.tail as string) || 100
    });
    requestTracker.end('500');
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Sandbox service running on http://localhost:${PORT}`, { port: PORT });
  });
}

export default app;
