import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { winstonLogger } from './utils/logger';
import { SynthesisService } from './services/synthesis';
import { errorHandler } from './utils/error-handler';

const app = express();
const PORT = process.env.PORT || 3004;
const logger = winstonLogger;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Services
const synthesisService = new SynthesisService();

// Routes
app.post('/api/v1/synthesize', async (req, res) => {
  try {
    const { prompt, perceptionResult } = req.body;
    
    logger.info('Starting code synthesis', { 
      prompt: prompt.substring(0, 100),
      hasPerception: !!perceptionResult 
    });
    
    const generatedApp = await synthesisService.generateCode(prompt, perceptionResult);
    
    res.json({
      success: true,
      data: generatedApp
    });
    
  } catch (error) {
    logger.error('Code synthesis failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/api/v1/repair', async (req, res) => {
  try {
    const { app, error, logs } = req.body;
    
    logger.info('Starting code repair', { 
      appId: app.id,
      error: error?.substring(0, 100) 
    });
    
    const repairedApp = await synthesisService.repairCode(app, error, logs);
    
    res.json({
      success: true,
      data: repairedApp
    });
    
  } catch (error) {
    logger.error('Code repair failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'synthesis' });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Synthesis service started on port ${PORT}`);
});

export default app;