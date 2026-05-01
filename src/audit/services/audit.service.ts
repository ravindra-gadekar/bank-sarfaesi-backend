import { AuditLog, IAuditLog, IAuditLogDiff } from '../models/auditLog.model';

interface LogActionParams {
  branchId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  diff?: IAuditLogDiff;
  ipAddress?: string;
  userAgent?: string;
}

interface FindAllFilters {
  entity?: string;
  entityId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

const auditService = {
  async logAction(params: LogActionParams): Promise<void> {
    try {
      await AuditLog.create({
        branchId: params.branchId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        diff: params.diff,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      });
    } catch (error) {
      console.error('Audit log write failed:', error);
    }
  },

  async findAll(
    branchId: string,
    filters: FindAllFilters,
  ): Promise<{ logs: IAuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const query: Record<string, unknown> = { branchId };

    if (filters.entity) query.entity = filters.entity;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.action) query.action = filters.action;

    if (filters.startDate || filters.endDate) {
      const timestampFilter: Record<string, Date> = {};
      if (filters.startDate) timestampFilter.$gte = new Date(filters.startDate);
      if (filters.endDate) timestampFilter.$lte = new Date(filters.endDate);
      query.timestamp = timestampFilter;
    }

    const skip = (filters.page - 1) * filters.limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(filters.limit).exec(),
      AuditLog.countDocuments(query).exec(),
    ]);

    return {
      logs,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  },

  async findByEntity(branchId: string, entity: string, entityId: string): Promise<IAuditLog[]> {
    return AuditLog.find({ branchId, entity, entityId }).sort({ timestamp: -1 }).exec();
  },
};

export { auditService };
