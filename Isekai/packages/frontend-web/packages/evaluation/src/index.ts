import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { winstonLogger } from './utils/logger';
import { EvaluationService } from './services/evaluation';
import { errorHandler } from './utils/error-handler';

const app = express();
const PORT = process.env.PORT || 3006;
const logger = winstonLogger;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Services
const evaluationService = new EvaluationService();

// Routes
app.post('/api/v1/evaluate', async (req, res) => {
  try {
    const { app } = req.body;
    
    logger.info('Starting application evaluation', { 
      appId: app.id,
      fileCount: app.files.length 
    });
    
    const result = await evaluationService.evaluateApp(app);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('App evaluation failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/v1/evaluate/:evaluationId', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const result = await evaluationService.getEvaluationResult(evaluationId);
    
    if (!result) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Failed to get evaluation result', error);
    res.status(500).json({ error: 'Failed to get evaluation result' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'evaluation' });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Evaluation service started on port ${PORT}`);
});

export default app;