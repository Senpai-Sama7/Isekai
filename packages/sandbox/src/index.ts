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

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8002;

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
    : ['http://localhost:8000', 'http://localhost:3000'],
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
  try {
    const { appId, files, dependencies, config } = req.body;
    
    const result = await sandboxManager.execute(appId, files, dependencies, config);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error executing in sandbox:', error);
    res.status(500).json({ error: 'Failed to execute in sandbox' });
  }
});

app.get('/apps/:appId', validateAppId, async (req: Request, res: Response) => {
  try {
    const status = await sandboxManager.getStatus(req.params.appId);
    
    if (!status) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error getting app status:', error);
    res.status(500).json({ error: 'Failed to get app status' });
  }
});

app.patch('/apps/:appId', validateUpdate, async (req: Request, res: Response) => {
  try {
    const { files } = req.body;
    
    const result = await sandboxManager.update(req.params.appId, files);
    
    if (!result) {
      return res.status(404).json({ error: 'App not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating app:', error);
    res.status(500).json({ error: 'Failed to update app' });
  }
});

app.delete('/apps/:appId', validateAppId, async (req: Request, res: Response) => {
  try {
    await sandboxManager.stop(req.params.appId);
    res.status(204).send();
  } catch (error) {
    console.error('Error stopping app:', error);
    res.status(500).json({ error: 'Failed to stop app' });
  }
});

app.get('/apps/:appId/logs', validateLogs, async (req: Request, res: Response) => {
  try {
    const tail = parseInt(req.query.tail as string) || 100;
    const logs = await sandboxManager.getLogs(req.params.appId, tail);
    
    res.json({ logs });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Sandbox service running on http://localhost:${PORT}`);
  });
}

export default app;
