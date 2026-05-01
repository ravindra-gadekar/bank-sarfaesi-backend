import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';

declare global {
  namespace Express {
    interface Request {
      auditInfo?: { action: string; entity: string };
    }
  }
}

export function auditAction(action: string, entity: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.auditInfo = { action, entity };
    next();
  };
}

export async function logAudit(
  req: Request,
  entityId: string,
  diff?: { before?: unknown; after?: unknown },
): Promise<void> {
  const { branchId, userId } = req.context;
  if (!branchId || !userId) return;

  await auditService.logAction({
    branchId,
    userId,
    action: req.auditInfo?.action || 'unknown',
    entity: req.auditInfo?.entity || 'unknown',
    entityId,
    diff: diff as { before?: Record<string, unknown>; after?: Record<string, unknown> },
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });
}
