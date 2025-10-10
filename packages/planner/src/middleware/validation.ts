import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Validation rules for analyze
export const validateAnalyze = [
  body('prompt')
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Prompt must be between 1 and 5000 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  handleValidationErrors
];

// Validation rules for infer
export const validateInfer = [
  body('action')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Action must be between 1 and 500 characters'),
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  body('history')
    .optional()
    .isArray()
    .withMessage('History must be an array'),
  handleValidationErrors
];
