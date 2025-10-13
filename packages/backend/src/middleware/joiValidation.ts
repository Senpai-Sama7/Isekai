import { NextFunction, Request, Response } from 'express';
import Joi from '../lib/miniJoi';
import { badRequest } from '../errors/appError';

export function validateBody(schema: ReturnType<typeof Joi.object>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(badRequest('Request body validation failed.', error.details));
    }

    req.body = value;
    next();
  };
}
