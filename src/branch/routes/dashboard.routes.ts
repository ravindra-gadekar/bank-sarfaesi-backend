import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../common/middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';

const router = Router();

// GET /api/dashboard/stats
router.get(
  '/dashboard/stats',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { branchId } = req.context;
      if (!branchId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
      const stats = await dashboardService.getStats(branchId);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/dashboard/recent-activity
router.get(
  '/dashboard/recent-activity',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { branchId } = req.context;
      if (!branchId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }
      const activity = await dashboardService.getRecentActivity(branchId);
      res.json({ success: true, data: activity });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
