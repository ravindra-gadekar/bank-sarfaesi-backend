import { Types } from 'mongoose';
import { Office, OfficeType } from '../../office/models/office.model';
import { Case } from '../../case/models/case.model';
import { Notice } from '../../notice/models/notice.model';
import { User } from '../../user/models/user.model';

const SCOPE_LABEL: Record<OfficeType, string> = {
  HO: 'Bank',
  Zonal: 'Zone',
  Regional: 'Region',
  Branch: 'Branch',
};

export interface DashboardStats {
  scopeLabel: string;
  officeType: OfficeType;
  totalBranches: number;
  totalOffices: number;
  totalCases: number;
  totalNotices: number;
  totalUsers: number;
}

export interface SubtreeOfficeRow {
  _id: Types.ObjectId;
  bankName: string;
  branchName?: string;
  officeType: OfficeType;
  parentId: Types.ObjectId | null;
  ancestors: Types.ObjectId[];
  address: string;
  city?: string;
}

export const bankOversightService = {
  /**
   * Returns the list of leaf-Branch office ids inside the subtree rooted at
   * `officeId` (inclusive when officeId itself is a Branch). Used to scope
   * Case/Notice/AuditLog reads.
   */
  async getLeafBranchIds(officeId: string): Promise<string[]> {
    const root = await Office.findById(officeId).select('officeType').exec();
    if (!root) return [];
    if (root.officeType === 'Branch') return [officeId];
    const branches = await Office.find({
      ancestors: officeId,
      officeType: 'Branch',
      isActive: true,
    })
      .select('_id')
      .exec();
    return branches.map((b) => b._id.toString());
  },

  async listSubtreeOffices(
    officeId: string,
    filterOfficeType?: OfficeType,
  ): Promise<SubtreeOfficeRow[]> {
    const root = await Office.findById(officeId).exec();
    if (!root) return [];
    const query: Record<string, unknown> = {
      $or: [{ _id: root._id }, { ancestors: root._id }],
    };
    if (filterOfficeType) query.officeType = filterOfficeType;
    return Office.find(query)
      .select('_id bankName branchName officeType parentId ancestors address city')
      .sort({ officeType: 1, branchName: 1 })
      .lean<SubtreeOfficeRow[]>()
      .exec();
  },

  async getDashboardStats(officeId: string): Promise<DashboardStats> {
    const root = await Office.findById(officeId).select('officeType').exec();
    if (!root) {
      return {
        scopeLabel: '—',
        officeType: 'Branch',
        totalBranches: 0,
        totalOffices: 0,
        totalCases: 0,
        totalNotices: 0,
        totalUsers: 0,
      };
    }
    const branchIds = await this.getLeafBranchIds(officeId);
    const subtreeOffices = await this.listSubtreeOffices(officeId);
    const allOfficeIds = subtreeOffices.map((o) => o._id);

    const [totalCases, totalNotices, totalUsers] = await Promise.all([
      Case.countDocuments({ branchId: { $in: branchIds } }).exec(),
      Notice.countDocuments({ branchId: { $in: branchIds } }).exec(),
      User.countDocuments({
        userKind: 'bank',
        officeId: { $in: allOfficeIds },
        isActive: true,
      }).exec(),
    ]);

    return {
      scopeLabel: SCOPE_LABEL[root.officeType],
      officeType: root.officeType,
      totalBranches: branchIds.length,
      totalOffices: allOfficeIds.length,
      totalCases,
      totalNotices,
      totalUsers,
    };
  },

  async isBranchInSubtree(
    callerOfficeId: string,
    targetBranchId: string,
  ): Promise<boolean> {
    if (callerOfficeId === targetBranchId) return true;
    const target = await Office.findById(targetBranchId).select('ancestors').exec();
    if (!target) return false;
    return target.ancestors.some((a) => a.toString() === callerOfficeId);
  },
};
