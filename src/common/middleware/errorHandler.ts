import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  console.error(`[ERROR] ${statusCode} ${code}: ${err.message}`, err.stack);

  const errorBody: Record<string, unknown> = { code, message };
  if (err.details) {
    errorBody.details = err.details;
  }

  res.status(statusCode).json({
    success: false,
    error: errorBody,
  });
}
