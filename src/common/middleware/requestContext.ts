import { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  email?: string;
  userId?: string;
  branchId?: string;
  role?: string;
  userKind?: 'app' | 'bank';
  officeId?: string;
  officeType?: 'HO' | 'Zonal' | 'Regional' | 'Branch';
  officeAncestors?: string[];
  bankRootId?: string;
}

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  req.context = {
    email: undefined,
    userId: undefined,
    branchId: undefined,
    role: undefined,
    userKind: undefined,
    officeId: undefined,
    officeType: undefined,
    officeAncestors: undefined,
    bankRootId: undefined,
  };
  next();
}
