export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError('BadRequest', 400, message, details);
}

export function notFound(message: string, details?: unknown) {
  return new AppError('NotFound', 404, message, details);
}

export function serviceUnavailable(message: string, details?: unknown) {
  return new AppError('ServiceUnavailable', 503, message, details);
}
