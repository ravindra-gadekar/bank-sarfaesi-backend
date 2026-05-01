import { User, IUser } from '../models/user.model';
import { ApiError } from '../../common/utils/apiError';

const userService = {
  async create(data: Partial<IUser>): Promise<IUser> {
    const existing = await User.findOne({
      branchId: data.branchId,
      email: data.email,
    }).exec();
    if (existing) {
      throw ApiError.conflict('A user with this email already exists in this branch');
    }
    return User.create(data);
  },

  async findById(branchId: string, userId: string): Promise<IUser | null> {
    return User.findOne({ branchId, _id: userId }).exec();
  },

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email }).exec();
  },

  async findAllByBranch(
    branchId: string,
    page: number,
    limit: number,
  ): Promise<{ users: IUser[]; total: number; page: number; limit: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find({ branchId }).skip(skip).limit(limit).exec(),
      User.countDocuments({ branchId }).exec(),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async updateRole(branchId: string, userId: string, role: string): Promise<IUser | null> {
    const user = await User.findOneAndUpdate(
      { branchId, _id: userId },
      { role },
      { returnDocument: 'after' },
    ).exec();
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async deactivate(branchId: string, userId: string): Promise<IUser | null> {
    const user = await User.findOneAndUpdate(
      { branchId, _id: userId },
      { isActive: false },
      { returnDocument: 'after' },
    ).exec();
    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async updateLastLogin(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { lastLogin: new Date() }).exec();
  },
};

export { userService };
