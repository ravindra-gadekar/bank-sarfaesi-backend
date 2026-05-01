import mongoose, { Schema, Document, Types } from 'mongoose';
import { USER_ROLES, type UserRole } from './user.model';

export interface IInvite extends Document {
  branchId: Types.ObjectId;
  email: string;
  role: UserRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: USER_ROLES, required: true },
    tokenHash: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
inviteSchema.index({ branchId: 1, email: 1 });

export const Invite = mongoose.model<IInvite>('Invite', inviteSchema);
