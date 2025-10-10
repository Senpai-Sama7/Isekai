import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { IntentAnalyzer } from './services/intentAnalyzer';
import { CodeGenerator } from './services/codeGenerator';
import { validateAnalyze, validateInfer } from './middleware/validation';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8001;

const analyzer = new IntentAnalyzer();
const generator = new CodeGenerator();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
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

// Rate limiting
const plannerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parser with size limits
app.use(express.json({ limit: '5mb' }));

app.post('/analyze', plannerRateLimit as any, validateAnalyze, async (req: Request, res: Response) => {
  try {
    const { prompt, context } = req.body;

    const intent = analyzer.analyze(prompt, context);
    const code = generator.generate(intent);

    res.json({
      intent: intent.type,
      components: intent.components,
      plan: intent.plan,
      code
    });
  } catch (error) {
    console.error('Error analyzing prompt:', error);
    res.status(500).json({ error: 'Failed to analyze prompt' });
  }
});

app.post('/infer', plannerRateLimit, validateInfer, async (req: Request, res: Response) => {
  try {
    const { action, context, history } = req.body;
    
    const suggestions = analyzer.inferFromAction(action, context, history);

    res.json({
      suggestions,
      confidence: suggestions.length > 0 ? suggestions[0].confidence : 0
    });
  } catch (error) {
    console.error('Error inferring from action:', error);
    res.status(500).json({ error: 'Failed to infer from action' });
  }
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Planner service running on http://localhost:${PORT}`);
  });
}

export default app;
