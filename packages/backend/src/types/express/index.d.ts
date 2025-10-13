import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }

  interface Response {
    locals: {
      correlationId: string;
      [key: string]: unknown;
    };
  }
}
