import mongoose, { Schema, Document, Types } from 'mongoose';
import { USER_ROLES, type UserRole, APP_ROLES, type AppRole, USER_KINDS, type UserKind } from './user.model';

export interface IPendingOfficeSnapshot {
  bankName: string;
  bankLogoKey?: string;
  officeType: 'HO' | 'Zonal' | 'Regional' | 'Branch';
  parentOfficeId?: Types.ObjectId;
  address: string;
  contact: string;
  email: string;
}

export interface IInvite extends Document {
  userKind: UserKind;
  email: string;
  targetOfficeId?: Types.ObjectId;
  pendingOfficeSnapshot?: IPendingOfficeSnapshot;
  appRole?: AppRole;
  bankRole?: UserRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  expiresAt: Date;
  usedAt?: Date;
  branchId?: Types.ObjectId;
  role?: UserRole;
  createdAt: Date;
}

const pendingOfficeSnapshotSchema = new Schema<IPendingOfficeSnapshot>(
  {
    bankName: { type: String, required: true },
    bankLogoKey: { type: String },
    officeType: { type: String, enum: ['HO', 'Zonal', 'Regional', 'Branch'], required: true },
    parentOfficeId: { type: Schema.Types.ObjectId, ref: 'Office' },
    address: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false },
);

const inviteSchema = new Schema<IInvite>(
  {
    userKind: { type: String, enum: USER_KINDS, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    targetOfficeId: { type: Schema.Types.ObjectId, ref: 'Office' },
    pendingOfficeSnapshot: { type: pendingOfficeSnapshotSchema },
    appRole: { type: String, enum: APP_ROLES },
    bankRole: { type: String, enum: USER_ROLES },
    tokenHash: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    branchId: { type: Schema.Types.ObjectId, ref: 'Office' },
    role: { type: String, enum: USER_ROLES },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

inviteSchema.pre<IInvite>('validate', function () {
  if (this.userKind === 'bank') {
    if (!this.bankRole) throw new Error('bankRole required on bank invite');
    if (!this.targetOfficeId && !this.pendingOfficeSnapshot) {
      throw new Error('Bank invite must specify targetOfficeId or pendingOfficeSnapshot');
    }
    if (!this.role) this.role = this.bankRole;
    if (!this.branchId && this.targetOfficeId) this.branchId = this.targetOfficeId;
  } else if (this.userKind === 'app') {
    if (!this.appRole) throw new Error('appRole required on app invite');
  }
});

inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
inviteSchema.index({ targetOfficeId: 1, email: 1 });
inviteSchema.index({ userKind: 1, email: 1 });

export const Invite = mongoose.model<IInvite>('Invite', inviteSchema);
