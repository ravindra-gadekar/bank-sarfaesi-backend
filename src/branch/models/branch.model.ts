import mongoose, { Schema, Document } from 'mongoose';

export const BANK_TYPES = [
  'Scheduled Commercial Bank',
  'Regional Rural Bank',
  'Cooperative Bank',
  'Small Finance Bank',
  'NBFC',
] as const;

export type BankType = (typeof BANK_TYPES)[number];

export const SSO_PROVIDERS = ['microsoft', 'google'] as const;
export type SsoProvider = (typeof SSO_PROVIDERS)[number];

export interface ISsoConfig {
  provider: SsoProvider;
  clientId: string;
  tenantId?: string;
  clientSecret: string;
  allowedDomains: string[];
}

export interface IDrtJurisdiction {
  name: string;
  location: string;
}

export interface IBranch extends Document {
  bankName: string;
  bankType: BankType;
  rbiRegNo: string;
  hoAddress: string;
  website?: string;
  branchName: string;
  branchCode: string;
  ifscCode: string;
  branchAddress: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
  phone?: string;
  email: string;
  letterheadFileKey?: string;
  drtJurisdiction?: IDrtJurisdiction;
  ssoConfigs: ISsoConfig[];
  defaultAOName?: string;
  defaultAODesignation?: string;
  isActive: boolean;
  setupCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ssoConfigSchema = new Schema<ISsoConfig>(
  {
    provider: { type: String, enum: SSO_PROVIDERS, required: true },
    clientId: { type: String, required: true },
    tenantId: { type: String },
    clientSecret: { type: String, required: true },
    allowedDomains: { type: [String], required: true },
  },
  { _id: false },
);

const drtJurisdictionSchema = new Schema<IDrtJurisdiction>(
  {
    name: { type: String, required: true },
    location: { type: String, required: true },
  },
  { _id: false },
);

const branchSchema = new Schema<IBranch>(
  {
    bankName: { type: String, required: true },
    bankType: { type: String, enum: BANK_TYPES, required: true },
    rbiRegNo: { type: String, required: true },
    hoAddress: { type: String, required: true },
    website: { type: String },
    branchName: { type: String, required: true },
    branchCode: { type: String, required: true },
    ifscCode: { type: String, required: true },
    branchAddress: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String, required: true },
    state: { type: String, required: true },
    pinCode: { type: String, required: true },
    phone: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    letterheadFileKey: { type: String },
    drtJurisdiction: { type: drtJurisdictionSchema },
    ssoConfigs: { type: [ssoConfigSchema], default: [] },
    defaultAOName: { type: String },
    defaultAODesignation: { type: String },
    isActive: { type: Boolean, default: true },
    setupCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

branchSchema.index({ branchCode: 1 }, { unique: true });
branchSchema.index({ bankName: 'text', branchName: 'text' });

export const Branch = mongoose.model<IBranch>('Branch', branchSchema);
