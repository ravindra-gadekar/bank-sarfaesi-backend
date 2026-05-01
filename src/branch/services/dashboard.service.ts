import { Types } from 'mongoose';
import { Case } from '../../case/models/case.model';
import { Notice, NOTICE_TYPES, NOTICE_STATUSES } from '../../notice/models/notice.model';
import { AuditLog } from '../../audit/models/auditLog.model';

export interface DashboardStats {
  totalCases: number;
  noticesByType: Record<string, number>;
  noticesByStatus: Record<string, number>;
  pendingReviewCount: number;
  noticesThisMonth: number;
  avgApprovalTimeHours: number | null;
  monthlyTrend: Array<{ month: string; count: number }>;
}

export interface RecentActivityItem {
  _id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  timestamp: Date;
}

const dashboardService = {
  async getStats(branchId: string): Promise<DashboardStats> {
    const branchOid = new Types.ObjectId(branchId);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Run all aggregations in parallel
    const [
      totalCases,
      noticesByTypePipeline,
      noticesByStatusPipeline,
      pendingReviewCount,
      noticesThisMonth,
      avgApprovalPipeline,
      monthlyTrendPipeline,
    ] = await Promise.all([
      // Total cases
      Case.countDocuments({ branchId: branchOid }),

      // Notices grouped by type
      Notice.aggregate([
        { $match: { branchId: branchOid } },
        { $group: { _id: '$noticeType', count: { $sum: 1 } } },
      ]),

      // Notices grouped by status
      Notice.aggregate([
        { $match: { branchId: branchOid } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Pending review count
      Notice.countDocuments({ branchId: branchOid, status: 'submitted' }),

      // Notices created this month
      Notice.countDocuments({ branchId: branchOid, createdAt: { $gte: startOfMonth } }),

      // Average approval time (submitted → approved)
      Notice.aggregate([
        {
          $match: {
            branchId: branchOid,
            submittedAt: { $exists: true },
            approvedAt: { $exists: true },
          },
        },
        {
          $project: {
            approvalTime: { $subtract: ['$approvedAt', '$submittedAt'] },
          },
        },
        {
          $group: {
            _id: null,
            avgMs: { $avg: '$approvalTime' },
          },
        },
      ]),

      // Monthly trend — last 6 months
      Notice.aggregate([
        {
          $match: {
            branchId: branchOid,
            createdAt: {
              $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1),
            },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

    // Transform aggregation results
    const noticesByType: Record<string, number> = {};
    for (const t of NOTICE_TYPES) {
      noticesByType[t] = 0;
    }
    for (const row of noticesByTypePipeline) {
      noticesByType[row._id as string] = row.count;
    }

    const noticesByStatus: Record<string, number> = {};
    for (const s of NOTICE_STATUSES) {
      noticesByStatus[s] = 0;
    }
    for (const row of noticesByStatusPipeline) {
      noticesByStatus[row._id as string] = row.count;
    }

    const avgMs = avgApprovalPipeline[0]?.avgMs ?? null;
    const avgApprovalTimeHours = avgMs !== null ? Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10 : null;

    // Build monthly trend with labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend: Array<{ month: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const found = monthlyTrendPipeline.find(
        (r: { _id: { year: number; month: number }; count: number }) =>
          r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1,
      );
      monthlyTrend.push({ month: label, count: found?.count ?? 0 });
    }

    return {
      totalCases,
      noticesByType,
      noticesByStatus,
      pendingReviewCount,
      noticesThisMonth,
      avgApprovalTimeHours,
      monthlyTrend,
    };
  },

  async getRecentActivity(branchId: string, limit = 20): Promise<RecentActivityItem[]> {
    const logs = await AuditLog.find({ branchId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('action entity entityId userId timestamp')
      .lean();

    return logs.map((l) => ({
      _id: String(l._id),
      action: l.action,
      entity: l.entity,
      entityId: String(l.entityId),
      userId: String(l.userId),
      timestamp: l.timestamp,
    }));
  },
};

export { dashboardService };
