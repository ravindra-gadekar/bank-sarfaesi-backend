import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { requireUserKind } from '../../common/middleware/rbac.middleware';
import { ApiError } from '../../common/utils/apiError';
import { bankOversightService } from '../services/bankOversight.service';
import { Case } from '../../case/models/case.model';
import { Notice } from '../../notice/models/notice.model';
import { OFFICE_TYPES, OfficeType } from '../../office/models/office.model';

const router = Router();

router.use('/bank', authenticate, requireUserKind('bank'));

router.get('/bank/dashboard-stats', async (req: Request, res: Response) => {
  const officeId = req.context.officeId;
  if (!officeId) throw ApiError.unauthorized('No officeId in session');
  const stats = await bankOversightService.getDashboardStats(officeId);
  res.json({ success: true, data: stats });
});

router.get('/bank/subtree-offices', async (req: Request, res: Response) => {
  const officeId = req.context.officeId;
  if (!officeId) throw ApiError.unauthorized('No officeId in session');
  const raw = req.query.officeType;
  const filterType =
    typeof raw === 'string' && (OFFICE_TYPES as readonly string[]).includes(raw)
      ? (raw as OfficeType)
      : undefined;
  const offices = await bankOversightService.listSubtreeOffices(officeId, filterType);
  res.json({ success: true, data: offices });
});

router.get('/bank/branches/:branchId/cases', async (req: Request, res: Response) => {
  const callerId = req.context.officeId;
  if (!callerId) throw ApiError.unauthorized('No officeId in session');
  const branchId = String(req.params.branchId);
  const ok = await bankOversightService.isBranchInSubtree(callerId, branchId);
  if (!ok) throw ApiError.forbidden('Target branch is outside your subtree');
  const cases = await Case.find({ branchId }).sort({ updatedAt: -1 }).limit(200).lean().exec();
  res.json({ success: true, data: cases });
});

router.get('/bank/branches/:branchId/notices', async (req: Request, res: Response) => {
  const callerId = req.context.officeId;
  if (!callerId) throw ApiError.unauthorized('No officeId in session');
  const branchId = String(req.params.branchId);
  const ok = await bankOversightService.isBranchInSubtree(callerId, branchId);
  if (!ok) throw ApiError.forbidden('Target branch is outside your subtree');
  const notices = await Notice.find({ branchId })
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean()
    .exec();
  res.json({ success: true, data: notices });
});

export default router;
