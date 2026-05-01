import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { officeService } from '../../office/services/office.service';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { role } = req.context;

    if (!role || !allowedRoles.includes(role)) {
      throw ApiError.forbidden('Insufficient permissions');
    }

    next();
  };
}

export function requireUserKind(kind: 'app' | 'bank') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.context?.userKind !== kind) {
      return next(ApiError.forbidden(`Requires ${kind} user`));
    }
    next();
  };
}

export interface SubtreeScopeOptions {
  ancestorsResolver?: (targetOfficeId: string) => Promise<string[]>;
}

export function requireSubtreeScope(bodyField: string, options: SubtreeScopeOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (req.context?.userKind === 'app') return next();

    const userOfficeId = req.context?.officeId;
    const targetOfficeId = req.body?.[bodyField];

    if (!userOfficeId) return next(ApiError.unauthorized('No officeId in session'));
    if (!targetOfficeId) return next(ApiError.badRequest(`Missing ${bodyField} in request body`));
    if (userOfficeId === targetOfficeId) return next();

    try {
      const ancestors =
        options.ancestorsResolver != null
          ? await options.ancestorsResolver(targetOfficeId)
          : await resolveAncestors(targetOfficeId);
      if (ancestors.includes(userOfficeId)) return next();
      return next(ApiError.forbidden('Target office is outside your subtree'));
    } catch (err) {
      return next(err);
    }
  };
}

async function resolveAncestors(targetOfficeId: string): Promise<string[]> {
  const office = await officeService.findById(targetOfficeId);
  if (!office) throw ApiError.notFound('Target office not found');
  return office.ancestors.map((a) => a.toString());
}
