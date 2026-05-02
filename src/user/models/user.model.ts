import mongoose, { Schema, Document, Types } from 'mongoose';

export const USER_ROLES = ['admin', 'manager', 'maker', 'checker', 'auditor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const APP_ROLES = ['superadmin', 'admin', 'support'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const USER_KINDS = ['app', 'bank'] as const;
export type UserKind = (typeof USER_KINDS)[number];

export const AUTH_PROVIDERS = ['otp', 'microsoft', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface IUser extends Document {
  userKind: UserKind;
  officeId?: Types.ObjectId;
  branchId?: Types.ObjectId;
  name: string;
  email: string;
  designation?: string;
  mobile?: string;
  appRole?: AppRole;
  bankRole?: UserRole;
  role?: UserRole | AppRole;
  authProvider: AuthProvider;
  ssoSubjectId?: string;
  lastLogin?: Date;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    userKind: { type: String, enum: USER_KINDS, required: true, index: true },
    officeId: { type: Schema.Types.ObjectId, ref: 'Office', index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Office', index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    designation: { type: String, trim: true },
    mobile: { type: String, trim: true },
    appRole: { type: String, enum: APP_ROLES },
    bankRole: { type: String, enum: USER_ROLES },
    role: { type: String },
    authProvider: { type: String, enum: AUTH_PROVIDERS, required: true },
    ssoSubjectId: { type: String },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.pre<IUser>('save', function () {
  if (this.userKind === 'bank') {
    if (!this.officeId) throw new Error('officeId required for bank users');
    if (!this.bankRole) throw new Error('bankRole required for bank users');
    this.role = this.bankRole;
    if (!this.branchId) this.branchId = this.officeId;
  } else if (this.userKind === 'app') {
    if (!this.appRole) throw new Error('appRole required for app users');
    this.role = this.appRole;
  }
});

userSchema.index(
  { officeId: 1, email: 1 },
  { unique: true, partialFilterExpression: { officeId: { $exists: true } } },
);
userSchema.index({ userKind: 1, email: 1 });
userSchema.index({ branchId: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
