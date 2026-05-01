import { Notice, INotice, NoticeType, IGeneratedDoc } from '../models/notice.model';
import { transitionStatus } from './noticeStateMachine';
import { legalValidationService } from './legalValidation.service';
import { prefillService } from './prefill.service';
import { Case } from '../../case/models/case.model';
import { documentQueueService } from '../../document/services/documentQueue.service';
import { ApiError } from '../../common/utils/apiError';

const noticeService = {
  async createDraft(
    branchId: string,
    caseId: string,
    noticeType: NoticeType,
    makerUserId: string,
  ): Promise<INotice> {
    return Notice.create({ branchId, caseId, noticeType, makerUserId });
  },

  async deleteDraft(branchId: string, noticeId: string, userId: string): Promise<void> {
    const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!notice) throw ApiError.notFound('Notice not found');

    if (notice.status !== 'draft') {
      throw ApiError.badRequest('Only draft notices can be deleted');
    }

    if (notice.makerUserId.toString() !== userId) {
      throw ApiError.forbidden('Only the maker can delete this notice');
    }

    await Notice.deleteOne({ branchId, _id: noticeId }).exec();
  },

  async updateFields(
    branchId: string,
    noticeId: string,
    fields: Record<string, unknown>,
  ): Promise<INotice> {
    const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!notice) throw ApiError.notFound('Notice not found');

    if (notice.status !== 'draft' && notice.status !== 'rejected') {
      throw ApiError.badRequest('Fields can only be updated when notice is in draft or rejected status');
    }

    // Merge new fields into existing fields
    const mergedFields = { ...(notice.fields as Record<string, unknown>), ...fields };

    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      { fields: mergedFields },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');
    return updated;
  },

  async submit(branchId: string, noticeId: string, userId: string): Promise<INotice> {
    const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!notice) throw ApiError.notFound('Notice not found');

    if (notice.makerUserId.toString() !== userId) {
      throw ApiError.forbidden('Only the maker can submit this notice');
    }

    // Run legal validation before allowing submission
    const caseDoc = await Case.findOne({ branchId, _id: notice.caseId }).exec();
    if (!caseDoc) throw ApiError.notFound('Linked case not found');

    const caseData = {
      sanctionAmount: caseDoc.sanctionAmount,
      npaDate: caseDoc.npaDate,
      sanctionDate: caseDoc.sanctionDate,
    };

    if (notice.noticeType === 'demand_13_2') {
      const validationResult = legalValidationService.validateDemandNotice(
        caseData,
        notice.fields as Record<string, unknown>,
      );

      if (!validationResult.valid) {
        throw ApiError.badRequest(
          'Legal validation failed: ' +
            validationResult.errors.map((e) => e.message).join('; '),
        );
      }
    } else if (notice.noticeType === 'possession_13_4') {
      // Find prior finalized 13(2) notice for validation
      const priorDemandNotice = await Notice.findOne({
        branchId,
        caseId: notice.caseId,
        noticeType: 'demand_13_2',
        status: 'final',
      })
        .sort({ approvedAt: -1 })
        .lean();

      const priorData = priorDemandNotice
        ? {
            noticeDate: new Date((priorDemandNotice.fields as Record<string, unknown>).noticeDate as string),
            amountDemanded: (priorDemandNotice.fields as Record<string, unknown>).totalAmountDemanded as number,
            status: priorDemandNotice.status,
          }
        : null;

      const validationResult = legalValidationService.validatePossessionNotice(
        caseData,
        notice.fields as Record<string, unknown>,
        priorData,
      );

      if (!validationResult.valid) {
        throw ApiError.badRequest(
          'Legal validation failed: ' +
            validationResult.errors.map((e) => e.message).join('; '),
        );
      }
    } else if (notice.noticeType === 'sale_auction') {
      // Find prior finalized 13(4) notice for validation
      const priorPossessionNotice = await Notice.findOne({
        branchId,
        caseId: notice.caseId,
        noticeType: 'possession_13_4',
        status: 'final',
      })
        .sort({ approvedAt: -1 })
        .lean();

      const priorData = priorPossessionNotice
        ? {
            possessionDate: new Date((priorPossessionNotice.fields as Record<string, unknown>).dateOfPossession as string),
            status: priorPossessionNotice.status,
          }
        : null;

      const validationResult = legalValidationService.validateSaleAuctionNotice(
        caseData,
        notice.fields as Record<string, unknown>,
        priorData,
      );

      if (!validationResult.valid) {
        throw ApiError.badRequest(
          'Legal validation failed: ' +
            validationResult.errors.map((e) => e.message).join('; '),
        );
      }
    }

    const newStatus = transitionStatus(notice.status, 'submitted');

    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      { status: newStatus, submittedAt: new Date() },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');
    return updated;
  },

  async approve(
    branchId: string,
    noticeId: string,
    checkerUserId: string,
    checkerRole: string,
    comment?: string,
  ): Promise<INotice> {
    const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!notice) throw ApiError.notFound('Notice not found');

    // Admins and Managers may approve their own notices; Checkers cannot
    if (notice.makerUserId.toString() === checkerUserId && checkerRole === 'checker') {
      throw ApiError.forbidden('Checker cannot approve their own notice');
    }

    const newStatus = transitionStatus(notice.status, 'approved');

    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      {
        status: newStatus,
        checkerUserId,
        checkerComment: comment,
        approvedAt: new Date(),
      },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');

    // Trigger async document generation on approval
    documentQueueService.enqueueGeneration(branchId, noticeId);

    return updated;
  },

  async reject(
    branchId: string,
    noticeId: string,
    checkerUserId: string,
    comment: string,
  ): Promise<INotice> {
    const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!notice) throw ApiError.notFound('Notice not found');

    if (notice.makerUserId.toString() === checkerUserId) {
      throw ApiError.forbidden('Checker cannot reject their own notice');
    }

    const newStatus = transitionStatus(notice.status, 'rejected');

    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      {
        status: newStatus,
        checkerUserId,
        checkerComment: comment,
        rejectedAt: new Date(),
      },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');
    return updated;
  },

  async listByCase(branchId: string, caseId: string): Promise<INotice[]> {
    return Notice.find({ branchId, caseId }).sort({ createdAt: -1 }).exec();
  },

  async listAll(
    branchId: string,
    filters?: { status?: string; noticeType?: string; search?: string },
  ): Promise<INotice[]> {
    const query: Record<string, unknown> = { branchId };
    if (filters?.status) query.status = filters.status;
    if (filters?.noticeType) query.noticeType = filters.noticeType;
    // search by caseId or fields if provided
    if (filters?.search) {
      const regex = new RegExp(filters.search, 'i');
      query.$or = [{ caseId: regex }];
    }
    return Notice.find(query).sort({ createdAt: -1 }).limit(200).exec();
  },

  async findById(branchId: string, noticeId: string): Promise<INotice | null> {
    return Notice.findOne({ branchId, _id: noticeId }).exec();
  },

  async listPendingReview(branchId: string): Promise<INotice[]> {
    return Notice.find({ branchId, status: 'submitted' }).sort({ submittedAt: -1 }).exec();
  },

  async updateStatus(branchId: string, noticeId: string, status: string): Promise<INotice> {
    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      { status },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');
    return updated;
  },

  async addGeneratedDoc(branchId: string, noticeId: string, doc: IGeneratedDoc): Promise<INotice> {
    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      { $push: { generatedDocs: doc } },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');
    return updated;
  },

  async clearGeneratedDocs(branchId: string, noticeId: string): Promise<INotice> {
    const updated = await Notice.findOneAndUpdate(
      { branchId, _id: noticeId },
      { $set: { generatedDocs: [] } },
      { returnDocument: 'after' },
    ).exec();
    if (!updated) throw ApiError.notFound('Notice not found');
    return updated;
  },

  // ── Version Management ────────────────────────────────

  /**
   * Supersede a finalized notice: transitions original to `superseded`,
   * creates a new draft (version N+1) copying fields from the original.
   */
  async supersede(
    branchId: string,
    noticeId: string,
    userId: string,
  ): Promise<INotice> {
    const original = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!original) throw ApiError.notFound('Notice not found');

    if (original.status !== 'final') {
      throw ApiError.badRequest('Only finalized notices can be superseded');
    }

    // Transition original to superseded
    const newStatus = transitionStatus(original.status, 'superseded');
    original.status = newStatus;
    await original.save();

    // Create new version as draft
    const newNotice = await Notice.create({
      branchId,
      caseId: original.caseId,
      noticeType: original.noticeType,
      version: original.version + 1,
      status: 'draft',
      fields: { ...(original.fields as Record<string, unknown>) },
      recipients: original.recipients,
      makerUserId: userId,
      supersedes: original._id,
    });

    return newNotice;
  },

  /**
   * Get all versions in a supersede chain for a notice.
   * Follows the supersedes references to build the full chain.
   */
  async getVersionChain(branchId: string, noticeId: string): Promise<INotice[]> {
    // First, find the requested notice
    const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
    if (!notice) throw ApiError.notFound('Notice not found');

    // Find all notices in the same case + type, ordered by version
    const chain = await Notice.find({
      branchId,
      caseId: notice.caseId,
      noticeType: notice.noticeType,
    })
      .sort({ version: 1 })
      .exec();

    return chain;
  },

  /**
   * Compare fields between two notice versions — returns changed, added, and removed keys.
   */
  compareVersions(
    notice1: INotice,
    notice2: INotice,
  ): { changed: string[]; added: string[]; removed: string[]; unchanged: string[] } {
    const fields1 = (notice1.fields as Record<string, unknown>) || {};
    const fields2 = (notice2.fields as Record<string, unknown>) || {};

    const allKeys = Array.from(new Set([...Object.keys(fields1), ...Object.keys(fields2)]));

    const changed: string[] = [];
    const added: string[] = [];
    const removed: string[] = [];
    const unchanged: string[] = [];

    for (const key of allKeys) {
      const has1 = key in fields1;
      const has2 = key in fields2;

      if (has1 && !has2) {
        removed.push(key);
      } else if (!has1 && has2) {
        added.push(key);
      } else if (JSON.stringify(fields1[key]) !== JSON.stringify(fields2[key])) {
        changed.push(key);
      } else {
        unchanged.push(key);
      }
    }

    return { changed, added, removed, unchanged };
  },
};

export { noticeService };
