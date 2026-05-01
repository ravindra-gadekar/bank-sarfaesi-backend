import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authorize } from '../../common/middleware/rbac.middleware';
import { auditService } from '../services/audit.service';
import { ApiError } from '../../common/utils/apiError';

const router = Router();

// GET /audit-logs — list audit logs (paginated, filtered)
router.get(
  '/audit-logs',
  authenticate,
  authorize('admin', 'manager', 'auditor'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await auditService.findAll(branchId, {
      entity: req.query.entity as string | undefined,
      entityId: req.query.entityId as string | undefined,
      action: req.query.action as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page,
      limit,
    });

    res.status(200).json({ success: true, data: result });
  },
);

// GET /audit-logs/entity/:entity/:entityId — logs for a specific entity
router.get(
  '/audit-logs/entity/:entity/:entityId',
  authenticate,
  authorize('admin', 'manager', 'auditor'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const logs = await auditService.findByEntity(branchId, req.params.entity as string, req.params.entityId as string);
    res.status(200).json({ success: true, data: logs });
  },
);

export default router;
