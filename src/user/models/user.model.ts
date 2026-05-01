import mongoose, { Schema, Document, Types } from 'mongoose';

export const USER_ROLES = ['admin', 'manager', 'maker', 'checker', 'auditor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AUTH_PROVIDERS = ['otp', 'microsoft', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export interface IUser extends Document {
  branchId: Types.ObjectId;
  name: string;
  email: string;
  designation?: string;
  mobile?: string;
  role: UserRole;
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
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    designation: { type: String, trim: true },
    mobile: { type: String, trim: true },
    role: { type: String, enum: USER_ROLES, required: true },
    authProvider: { type: String, enum: AUTH_PROVIDERS, required: true },
    ssoSubjectId: { type: String },
    lastLogin: { type: Date },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.index({ branchId: 1, email: 1 }, { unique: true });
userSchema.index({ branchId: 1, isActive: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
