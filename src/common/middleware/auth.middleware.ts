import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../../auth/services/jwt.service';
import { ApiError } from '../utils/apiError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.accessToken as string | undefined;

  if (!token) {
    throw ApiError.unauthorized('Access token required');
  }

  const decoded = verifyAccessToken(token);

  req.context = {
    email: decoded.email,
    userId: decoded.userId,
    branchId: decoded.branchId,
    role: decoded.role,
  };

  next();
}
