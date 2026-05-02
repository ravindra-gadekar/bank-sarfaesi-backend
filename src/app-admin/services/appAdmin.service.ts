import { Office } from '../../office/models/office.model';
import { User } from '../../user/models/user.model';
import { Invite } from '../../user/models/invite.model';
import { AuditLog } from '../../audit/models/auditLog.model';

export const appAdminService = {
  async listBanks() {
    const banks = await Office.find({ officeType: 'HO', isActive: true })
      .select('_id bankName bankLogoKey city state setupCompleted createdAt')
      .sort({ bankName: 1 })
      .lean()
      .exec();
    const enriched = await Promise.all(
      banks.map(async (b) => {
        const officeIds = await Office.find({ bankRootId: b._id }).distinct('_id').exec();
        const [officeCount, userCount] = await Promise.all([
          Office.countDocuments({ bankRootId: b._id }).exec(),
          User.countDocuments({ userKind: 'bank', branchId: { $in: officeIds } }).exec(),
        ]);
        return { ...b, officeCount, userCount };
      }),
    );
    return enriched;
  },

  async getBankTree(bankRootId: string) {
    const offices = await Office.find({ bankRootId })
      .select('_id bankName branchName officeType parentId ancestors address city')
      .sort({ officeType: 1, branchName: 1 })
      .lean()
      .exec();
    return offices;
  },

  async listAppUsers() {
    return User.find({ userKind: 'app' })
      .select('_id name email appRole isActive lastLogin createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  },

  async listAuditFeed(limit = 100) {
    return AuditLog.find({})
      .select('_id branchId userId action entity entityId timestamp ipAddress')
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean()
      .exec();
  },

  async getStats() {
    const [totalBanks, totalOffices, totalAppUsers, totalBankUsers, pendingInvites] = await Promise.all([
      Office.countDocuments({ officeType: 'HO' }).exec(),
      Office.countDocuments({}).exec(),
      User.countDocuments({ userKind: 'app', isActive: true }).exec(),
      User.countDocuments({ userKind: 'bank', isActive: true }).exec(),
      Invite.countDocuments({ usedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).exec(),
    ]);
    return { totalBanks, totalOffices, totalAppUsers, totalBankUsers, pendingInvites };
  },
};
