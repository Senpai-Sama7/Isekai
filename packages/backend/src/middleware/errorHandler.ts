import { NextFunction, Request, Response } from 'express';
import { logger } from '../observability/logger';
import { AppError } from '../errors/appError';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const correlationId = req.correlationId;

  if (err instanceof AppError) {
    logger.warn('Handled application error', {
      correlationId,
      code: err.code,
      errorMessage: err.message,
      details: err.details,
    });

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      correlationId,
    });
    return;
  }

  logger.error('Unhandled error', {
    correlationId,
    errorMessage: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: {
      code: 'InternalServerError',
      message: 'An unexpected error occurred.',
    },
    correlationId,
  });
}
