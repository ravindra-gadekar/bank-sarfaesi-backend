import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuditLogDiff {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface IAuditLog extends Document {
  branchId: Types.ObjectId;
  userId: Types.ObjectId;
  action: string;
  entity: string;
  entityId: Types.ObjectId;
  diff?: IAuditLogDiff;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    diff: {
      before: { type: Schema.Types.Mixed },
      after: { type: Schema.Types.Mixed },
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

auditLogSchema.index({ branchId: 1, timestamp: -1 });
auditLogSchema.index({ branchId: 1, entity: 1, entityId: 1 });
auditLogSchema.index({ branchId: 1, action: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
