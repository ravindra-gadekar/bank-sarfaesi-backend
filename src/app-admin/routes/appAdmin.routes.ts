import { Router, Request, Response } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { requireUserKind } from '../../common/middleware/rbac.middleware';
import { appAdminService } from '../services/appAdmin.service';
import { ApiError } from '../../common/utils/apiError';

const router = Router();

router.use('/app', authenticate, requireUserKind('app'));

router.get('/app/banks', async (_req: Request, res: Response) => {
  const banks = await appAdminService.listBanks();
  res.json({ success: true, data: banks });
});

router.get('/app/banks/:bankRootId/tree', async (req: Request, res: Response) => {
  const tree = await appAdminService.getBankTree(String(req.params.bankRootId));
  if (tree.length === 0) throw ApiError.notFound('Bank not found');
  res.json({ success: true, data: tree });
});

router.get('/app/users', async (_req: Request, res: Response) => {
  const users = await appAdminService.listAppUsers();
  res.json({ success: true, data: users });
});

router.get('/app/audit', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? '100', 10) || 100, 500);
  const feed = await appAdminService.listAuditFeed(limit);
  res.json({ success: true, data: feed });
});

router.get('/app/stats', async (_req: Request, res: Response) => {
  const stats = await appAdminService.getStats();
  res.json({ success: true, data: stats });
});

export default router;
