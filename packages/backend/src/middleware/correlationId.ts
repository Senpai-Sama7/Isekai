import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerId = (req.headers['x-correlation-id'] as string | undefined)?.trim();

  const incomingId =
    headerId && headerId.length <= 100
      ? headerId
      : uuidv4();

  req.correlationId = incomingId;
  res.locals.correlationId = incomingId;
  res.setHeader('x-correlation-id', incomingId);

  next();
}
