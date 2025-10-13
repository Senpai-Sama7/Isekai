import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { appRouter } from './routes/apps';
import { healthRouter } from './routes/health';
import { Database } from './db/database';
import dotenv from 'dotenv';
import { correlationIdMiddleware } from './middleware/correlationId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './observability/logger';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 8000;

// Initialize database
Database.getInstance();

// Correlation IDs
app.use(correlationIdMiddleware);

// Structured request logging
app.use(requestLogger);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration based on environment
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting for write operations
const writeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Body parser with size limits
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/apps', writeRateLimit as any, appRouter);
app.use('/api/health', healthRouter);

// Error handler
app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Backend server running on http://localhost:${PORT}`);
  });
}

export default app;
