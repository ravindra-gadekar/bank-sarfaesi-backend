import mongoose, { Schema, Document, Types } from 'mongoose';

export const OFFICE_TYPES = ['HO', 'Zonal', 'Regional', 'Branch'] as const;
export type OfficeType = (typeof OFFICE_TYPES)[number];

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

export interface IOffice extends Document {
  _id: Types.ObjectId;
  bankName: string;
  bankType?: BankType;
  bankLogoKey?: string;
  rbiRegNo?: string;
  officeType: OfficeType;
  parentId: Types.ObjectId | null;
  ancestors: Types.ObjectId[];
  bankRootId: Types.ObjectId;
  branchName?: string;
  branchCode?: string;
  ifscCode?: string;
  address: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  phone?: string;
  email: string;
  letterheadFileKey?: string;
  drtJurisdiction?: IDrtJurisdiction;
  defaultAOName?: string;
  defaultAODesignation?: string;
  ssoConfigs: ISsoConfig[];
  hoAddress?: string;
  website?: string;
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

const officeSchema = new Schema<IOffice>(
  {
    bankName: { type: String, required: true, trim: true },
    bankType: { type: String, enum: BANK_TYPES },
    bankLogoKey: { type: String },
    rbiRegNo: { type: String },
    officeType: { type: String, enum: OFFICE_TYPES, required: true, index: true },
    parentId: { type: Schema.Types.ObjectId, ref: 'Office', default: null, index: true },
    ancestors: { type: [Schema.Types.ObjectId], ref: 'Office', default: [], index: true },
    bankRootId: { type: Schema.Types.ObjectId, ref: 'Office', required: true, index: true },
    branchName: { type: String, trim: true },
    branchCode: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    address: { type: String, required: true },
    city: { type: String },
    district: { type: String },
    state: { type: String },
    pinCode: { type: String },
    phone: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    letterheadFileKey: { type: String },
    drtJurisdiction: { type: drtJurisdictionSchema },
    defaultAOName: { type: String },
    defaultAODesignation: { type: String },
    ssoConfigs: { type: [ssoConfigSchema], default: [] },
    hoAddress: { type: String },
    website: { type: String },
    isActive: { type: Boolean, default: true },
    setupCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

officeSchema.index(
  { branchCode: 1 },
  { unique: true, partialFilterExpression: { officeType: 'Branch', branchCode: { $type: 'string' } } },
);
officeSchema.index({ bankRootId: 1, officeType: 1 });
officeSchema.index({ bankName: 'text', branchName: 'text' });

export const Office = mongoose.model<IOffice>('Office', officeSchema);
