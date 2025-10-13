import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId =
    (req.headers['x-correlation-id'] as string | undefined)?.trim() ||
    uuidv4();

  req.correlationId = incomingId;
  res.locals.correlationId = incomingId;
  res.setHeader('x-correlation-id', incomingId);

  next();
}
