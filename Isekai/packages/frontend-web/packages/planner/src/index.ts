import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { winstonLogger } from './utils/logger';
import { PlannerService } from './services/planner';
import { WebSocketServer } from './services/websocket';
import { errorHandler } from './utils/error-handler';

const app = express();
const PORT = process.env.PORT || 3003;
const logger = winstonLogger;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Services
const plannerService = new PlannerService();
const wsServer = new WebSocketServer();

// Routes
app.post('/api/v1/prompts', async (req, res) => {
  try {
    const promptRequest = req.body;
    
    logger.info('Creating plan for prompt', { 
      promptId: promptRequest.id,
      prompt: promptRequest.prompt?.substring(0, 100) 
    });
    
    const plan = await plannerService.createPlan(promptRequest);
    
    res.status(201).json({
      id: promptRequest.id,
      status: 'planning',
      planId: plan.id,
      message: 'Plan created successfully'
    });
    
    // Start execution asynchronously
    plannerService.executePlan(plan.id, wsServer);
    
  } catch (error) {
    logger.error('Plan creation failed', error);
    res.status(500).json({
      error: 'Plan creation failed',
      message: error.message
    });
  }
});

app.get('/api/v1/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const plan = await plannerService.getPlan(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json(plan);
  } catch (error) {
    logger.error('Failed to get plan', error);
    res.status(500).json({ error: 'Failed to get plan' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'planner' });
});

// Error handling
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Planner service started on port ${PORT}`);
});

// Start WebSocket server
wsServer.start(server);

export default app;