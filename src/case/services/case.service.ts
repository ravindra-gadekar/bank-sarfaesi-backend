import { Case, ICase, CaseStatus } from '../models/case.model';
import { ApiError } from '../../common/utils/apiError';
import { CreateCaseInput, UpdateCaseInput } from '../dto/case.dto';

interface FindAllOptions {
  search?: string;
  status?: CaseStatus;
  page: number;
  limit: number;
}

const caseService = {
  async create(branchId: string, userId: string, data: CreateCaseInput): Promise<ICase> {
    const existing = await Case.findOne({ branchId, accountNo: data.accountNo }).exec();
    if (existing) {
      throw ApiError.conflict('A case with this account number already exists in this branch');
    }
    return Case.create({ ...data, branchId, createdBy: userId });
  },

  async findAll(
    branchId: string,
    options: FindAllOptions,
  ): Promise<{ cases: ICase[]; total: number; page: number; limit: number; totalPages: number }> {
    const { search, status, page, limit } = options;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { branchId };

    if (status) {
      filter.status = status;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ accountNo: regex }, { 'borrowers.name': regex }];
    }

    const [cases, total] = await Promise.all([
      Case.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      Case.countDocuments(filter).exec(),
    ]);

    return { cases, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(branchId: string, caseId: string): Promise<ICase> {
    const npaCase = await Case.findOne({ branchId, _id: caseId }).exec();
    if (!npaCase) {
      throw ApiError.notFound('Case not found');
    }
    return npaCase;
  },

  async update(branchId: string, caseId: string, data: UpdateCaseInput): Promise<ICase> {
    const npaCase = await Case.findOneAndUpdate(
      { branchId, _id: caseId },
      data,
      { new: true, runValidators: true },
    ).exec();
    if (!npaCase) {
      throw ApiError.notFound('Case not found');
    }
    return npaCase;
  },

  async count(branchId: string, filters?: { status?: CaseStatus }): Promise<number> {
    const filter: Record<string, unknown> = { branchId };
    if (filters?.status) {
      filter.status = filters.status;
    }
    return Case.countDocuments(filter).exec();
  },
};

export { caseService };
