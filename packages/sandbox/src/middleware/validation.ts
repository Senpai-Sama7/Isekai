import { body, param, query, validationResult } from 'express-validator';
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

// Validation rules for execute
export const validateExecute = [
  body('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Invalid appId format'),
  body('files')
    .isObject()
    .withMessage('Files must be an object')
    .custom((files) => {
      // Check file count
      const fileCount = Object.keys(files).length;
      if (fileCount === 0 || fileCount > 100) {
        throw new Error('Files must contain between 1 and 100 files');
      }
      
      // Validate each file
      for (const [path, content] of Object.entries(files)) {
        if (typeof path !== 'string' || typeof content !== 'string') {
          throw new Error('File paths and contents must be strings');
        }
        if (path.length > 500) {
          throw new Error('File path too long');
        }
        if (content.length > 1024 * 1024) { // 1MB limit per file
          throw new Error('File content too large (max 1MB per file)');
        }
        // Prevent path traversal
        if (path.includes('..') || path.startsWith('/')) {
          throw new Error('Invalid file path');
        }
      }
      return true;
    }),
  body('dependencies')
    .optional()
    .isObject()
    .withMessage('Dependencies must be an object'),
  body('config')
    .optional()
    .isObject()
    .withMessage('Config must be an object'),
  handleValidationErrors
];

// Validation rules for update
export const validateUpdate = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Invalid appId format'),
  body('files')
    .isObject()
    .withMessage('Files must be an object')
    .custom((files) => {
      const fileCount = Object.keys(files).length;
      if (fileCount === 0 || fileCount > 100) {
        throw new Error('Files must contain between 1 and 100 files');
      }
      
      for (const [path, content] of Object.entries(files)) {
        if (typeof path !== 'string' || typeof content !== 'string') {
          throw new Error('File paths and contents must be strings');
        }
        if (path.length > 500) {
          throw new Error('File path too long');
        }
        if (content.length > 1024 * 1024) {
          throw new Error('File content too large (max 1MB per file)');
        }
        if (path.includes('..') || path.startsWith('/')) {
          throw new Error('Invalid file path');
        }
      }
      return true;
    }),
  handleValidationErrors
];

// Validation rules for getting app status/logs
export const validateAppId = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Invalid appId format'),
  handleValidationErrors
];

// Validation rules for logs query
export const validateLogs = [
  param('appId')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('Invalid appId format'),
  query('tail')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Tail must be between 1 and 1000'),
  handleValidationErrors
];
