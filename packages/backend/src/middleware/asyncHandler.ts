import { NextFunction, Request, Response } from 'express';

export type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler) {
  return function wrapped(req: Request, res: Response, next: NextFunction) {
    handler(req, res, next).catch(next);
  };
}
