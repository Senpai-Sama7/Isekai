import { NextFunction, Request, Response } from 'express';
import { logger } from '../observability/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const correlationId = req.correlationId;

  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    logger.info('Completed request', {
      correlationId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
