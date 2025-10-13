import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { badRequest } from '../errors/appError';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(badRequest('Validation failed', errors.array()));
  }
  next();
};

// Validation rules for app generation
export const validateAppGeneration = [
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

// Validation rules for app modification
export const validateAppModification = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid appId'),
  body('prompt')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Prompt must be between 1 and 5000 characters'),
  body('changes')
    .optional()
    .isObject()
    .withMessage('Changes must be an object'),
  handleValidationErrors
];

// Validation rules for action tracking
export const validateActionTracking = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid appId'),
  body('action')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Action must be between 1 and 100 characters'),
  body('target')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Target must be less than 1000 characters'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
  handleValidationErrors
];

// Validation rules for applying suggestions
export const validateApplySuggestion = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid appId'),
  body('suggestionId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid suggestionId'),
  handleValidationErrors
];

// Validation rules for listing apps
export const validateListApps = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
  handleValidationErrors
];

// Validation rules for getting an app
export const validateGetApp = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Invalid appId'),
  handleValidationErrors
];
