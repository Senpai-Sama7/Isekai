import { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const headerId = (req.headers['x-correlation-id'] as string | undefined)?.trim();
  let incomingId = headerId;

  if (headerId && headerId.length > 100) {
    // Truncate to prevent log bloating or generate a new one.
    // Generating a new one is safer.
    incomingId = uuidv4();
  } else if (!headerId) {
    incomingId = uuidv4();
  }

  req.correlationId = incomingId!;
  res.locals.correlationId = incomingId!;
  res.setHeader('x-correlation-id', incomingId!);

  next();
}
