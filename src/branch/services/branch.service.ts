import { Branch, IBranch, ISsoConfig } from '../models/branch.model';
import { encrypt } from '../../common/utils/encryption';
import { ApiError } from '../../common/utils/apiError';

const branchService = {
  async create(data: Partial<IBranch>): Promise<IBranch> {
    return Branch.create(data);
  },

  async findById(branchId: string): Promise<IBranch | null> {
    const branch = await Branch.findById(branchId).exec();
    if (!branch) return null;

    // Exclude ssoConfigs clientSecret from response
    const branchObj = branch.toObject();
    if (branchObj.ssoConfigs) {
      branchObj.ssoConfigs = branchObj.ssoConfigs.map((config) => {
        const { clientSecret: _secret, ...rest } = config;
        return rest as ISsoConfig;
      });
    }
    return branchObj as IBranch;
  },

  async update(branchId: string, data: Partial<IBranch>): Promise<IBranch | null> {
    const branch = await Branch.findByIdAndUpdate(branchId, data, { new: true }).exec();
    if (!branch) throw ApiError.notFound('Branch not found');
    return branch;
  },

  async updateSsoConfig(branchId: string, configs: ISsoConfig[]): Promise<IBranch | null> {
    const encryptedConfigs = configs.map((config) => ({
      ...config,
      clientSecret: config.clientSecret ? encrypt(config.clientSecret) : config.clientSecret,
    }));

    const branch = await Branch.findByIdAndUpdate(
      branchId,
      { ssoConfigs: encryptedConfigs },
      { new: true },
    ).exec();
    if (!branch) throw ApiError.notFound('Branch not found');
    return branch;
  },

  async updateLetterhead(branchId: string, fileKey: string): Promise<IBranch | null> {
    const branch = await Branch.findByIdAndUpdate(
      branchId,
      { letterheadFileKey: fileKey },
      { new: true },
    ).exec();
    if (!branch) throw ApiError.notFound('Branch not found');
    return branch;
  },
};

export { branchService };
