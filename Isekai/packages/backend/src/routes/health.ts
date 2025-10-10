import { Router, Request, Response } from 'express';
import axios from 'axios';
import { Database } from '../db/database';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  const services: any = {
    backend: 'ok',
    database: 'unknown',
    planner: 'unknown',
    sandbox: 'unknown'
  };

  // Check database connection
  try {
    const db = Database.getInstance();
    db.getDb().prepare('SELECT 1').get();
    services.database = 'ok';
  } catch (error) {
    services.database = 'error';
  }

  // Check planner service
  const plannerUrl = process.env.PLANNER_URL || 'http://localhost:8001';
  try {
    await axios.get(`${plannerUrl}/health`, { timeout: 2000 });
    services.planner = 'ok';
  } catch (error) {
    services.planner = 'error';
  }

  // Check sandbox service
  const sandboxUrl = process.env.SANDBOX_URL || 'http://localhost:8002';
  try {
    await axios.get(`${sandboxUrl}/health`, { timeout: 2000 });
    services.sandbox = 'ok';
  } catch (error) {
    services.sandbox = 'error';
  }

  // Determine overall health
  const hasErrors = Object.values(services).some(status => status === 'error');
  const overallStatus = hasErrors ? 'degraded' : 'ok';

  res.status(hasErrors ? 503 : 200).json({ 
    status: overallStatus, 
    services,
    timestamp: new Date().toISOString()
  });
});
