import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { winstonLogger } from './utils/logger';
import { RuntimeService } from './services/runtime';
import { errorHandler } from './utils/error-handler';

const app = express();
const PORT = process.env.PORT || 3005;
const logger = winstonLogger;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Services
const runtimeService = new RuntimeService();

// Routes
app.post('/api/v1/execute', async (req, res) => {
  try {
    const { app } = req.body;
    
    logger.info('Executing application in sandbox', { 
      appId: app.id,
      fileCount: app.files.length 
    });
    
    const result = await runtimeService.executeApp(app);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    logger.error('App execution failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/api/v1/sandbox/:sandboxId', async (req, res) => {
  try {
    const { sandboxId } = req.params;
    
    await runtimeService.cleanupSandbox(sandboxId);
    
    res.json({ success: true, message: 'Sandbox cleaned up' });
  } catch (error) {
    logger.error('Sandbox cleanup failed', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'runtime' });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Runtime service started on port ${PORT}`);
});

export default app;