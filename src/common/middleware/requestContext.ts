import { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  email?: string;
  userId?: string;
  branchId?: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  // Initialize empty context — will be populated by auth middleware in Phase 1
  req.context = {
    email: undefined,
    userId: undefined,
    branchId: undefined,
    role: undefined,
  };
  next();
}
