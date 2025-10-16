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
import { validateOrigins } from './utils/security';

dotenv.config();

const app: Application = express();
const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 8080);

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
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3001", "http://localhost:3000"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration based on environment
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? validateOrigins(process.env.ALLOWED_ORIGINS || '')
  : ['http://localhost:3000', 'http://localhost:3001'];

const corsOptions = {
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
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

// Graceful shutdown handler
let server: ReturnType<typeof app.listen> | null = null;

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');

      try {
        Database.getInstance().close();
        logger.info('Database closed');
      } catch (error) {
        logger.error('Error closing database', { error });
      }

      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  server = app.listen(PORT, () => {
    logger.info(`Backend server running on http://localhost:${PORT}`);
  });

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
    gracefulShutdown('unhandledRejection');
  });
}

export default app;
