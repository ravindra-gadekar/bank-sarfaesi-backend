import { Types } from 'mongoose';
import { Office, IOffice, OfficeType, OFFICE_TYPES } from '../models/office.model';
import { ApiError } from '../../common/utils/apiError';

const LEVEL_INDEX: Record<OfficeType, number> = OFFICE_TYPES.reduce(
  (acc, type, idx) => ({ ...acc, [type]: idx }),
  {} as Record<OfficeType, number>,
);

export interface CreateOfficeArgs {
  bankName: string;
  bankLogoKey?: string;
  bankType?: string;
  officeType: OfficeType;
  parentOfficeId?: string;
  branchName?: string;
  branchCode?: string;
  ifscCode?: string;
  address: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  phone?: string;
  email: string;
  contact: string;
}

export const officeService = {
  async createOffice(args: CreateOfficeArgs): Promise<IOffice> {
    const { officeType, parentOfficeId, contact: _contact, ...rest } = args;

    if (officeType === 'HO') {
      if (parentOfficeId) {
        throw ApiError.badRequest('HO offices cannot have a parent');
      }
      const office = new Office({
        ...rest,
        officeType,
        parentId: null,
        ancestors: [],
      });
      office.bankRootId = office._id;
      await office.save();
      return office;
    }

    if (!parentOfficeId) {
      throw ApiError.badRequest('parentOfficeId is required for non-HO offices');
    }

    const parent = await Office.findById(parentOfficeId).exec();
    if (!parent) throw ApiError.notFound('Parent office not found');

    if (LEVEL_INDEX[officeType] <= LEVEL_INDEX[parent.officeType]) {
      throw ApiError.badRequest(
        `A ${officeType} cannot be a child of a ${parent.officeType}`,
      );
    }

    const office = await Office.create({
      ...rest,
      officeType,
      parentId: parent._id,
      ancestors: [...parent.ancestors, parent._id],
      bankRootId: parent.bankRootId,
    });
    return office;
  },

  async findById(officeId: string): Promise<IOffice | null> {
    return Office.findById(officeId).exec();
  },

  async findByBankRoot(bankRootId: string): Promise<IOffice[]> {
    return Office.find({ bankRootId }).sort({ officeType: 1 }).exec();
  },

  async isAncestorOrSelf(candidateAncestorId: string, targetId: string): Promise<boolean> {
    if (candidateAncestorId === targetId) return true;
    const target = await Office.findById(targetId).select('ancestors').exec();
    if (!target) return false;
    return target.ancestors.some((a: Types.ObjectId) => a.toString() === candidateAncestorId);
  },

  async findLeafBranches(rootOfficeId: string): Promise<IOffice[]> {
    const root = await Office.findById(rootOfficeId).exec();
    if (!root) return [];
    if (root.officeType === 'Branch') return [root];
    return Office.find({
      ancestors: root._id,
      officeType: 'Branch',
      isActive: true,
    }).exec();
  },
};
