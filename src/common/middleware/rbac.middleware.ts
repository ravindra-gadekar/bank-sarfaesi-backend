import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { role } = req.context;

    if (!role || !allowedRoles.includes(role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }

    next();
  };
}
