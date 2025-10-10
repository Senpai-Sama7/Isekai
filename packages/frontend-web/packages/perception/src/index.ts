import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { winstonLogger } from './utils/logger';
import { PerceptionService } from './services/perception';
import { errorHandler } from './utils/error-handler';

const app = express();
const PORT = process.env.PORT || 3002;
const logger = winstonLogger;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Services
const perceptionService = new PerceptionService();

// Routes
app.post('/api/v1/perceive', async (req, res) => {
  try {
    const { prompt, context } = req.body;
    
    logger.info('Processing perception request', { prompt: prompt.substring(0, 100) });
    
    const result = await perceptionService.analyzePrompt(prompt, context);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Perception processing failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'perception' });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Perception service started on port ${PORT}`);
});

export default app;