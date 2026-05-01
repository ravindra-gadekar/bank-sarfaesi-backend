import mongoose, { Schema, Document, Types } from 'mongoose';

export const LOAN_TYPES = [
  'Term Loan',
  'Cash Credit',
  'Overdraft',
  'Housing Loan',
  'Vehicle Loan',
  'Education Loan',
  'Personal Loan',
  'Agricultural Loan',
  'MSME Loan',
  'Other',
] as const;
export type LoanType = (typeof LOAN_TYPES)[number];

export const CASE_STATUSES = ['active', 'closed', 'archived'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const BORROWER_TYPES = ['primary', 'co-borrower', 'guarantor'] as const;
export type BorrowerType = (typeof BORROWER_TYPES)[number];

export const ASSET_TYPES = [
  'Immovable Property',
  'Plant & Machinery',
  'Movable Asset',
  'Intangible Asset',
  'Other',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export interface IBorrower {
  name: string;
  address: string;
  pan?: string;
  type: BorrowerType;
}

export interface ISecuredAsset {
  assetType: AssetType;
  description: string;
  surveyNo?: string;
  area?: string;
  district?: string;
  state?: string;
}

export interface ISecurityDocument {
  documentType: string;
  date: Date;
}

export interface ICase extends Document {
  branchId: Types.ObjectId;
  accountNo: string;
  loanType: LoanType;
  sanctionDate: Date;
  sanctionAmount: number;
  npaDate: Date;
  status: CaseStatus;
  borrowers: IBorrower[];
  securedAssets: ISecuredAsset[];
  securityDocuments: ISecurityDocument[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const borrowerSchema = new Schema<IBorrower>(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    pan: { type: String, trim: true },
    type: { type: String, enum: BORROWER_TYPES, required: true },
  },
  { _id: false },
);

const securedAssetSchema = new Schema<ISecuredAsset>(
  {
    assetType: { type: String, enum: ASSET_TYPES, required: true },
    description: { type: String, required: true, trim: true },
    surveyNo: { type: String, trim: true },
    area: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  { _id: false },
);

const securityDocumentSchema = new Schema<ISecurityDocument>(
  {
    documentType: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
  },
  { _id: false },
);

const caseSchema = new Schema<ICase>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    accountNo: { type: String, required: true, trim: true },
    loanType: { type: String, enum: LOAN_TYPES, required: true },
    sanctionDate: { type: Date, required: true },
    sanctionAmount: { type: Number, required: true },
    npaDate: { type: Date, required: true },
    status: { type: String, enum: CASE_STATUSES, default: 'active' },
    borrowers: { type: [borrowerSchema], required: true },
    securedAssets: { type: [securedAssetSchema], required: true },
    securityDocuments: { type: [securityDocumentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

caseSchema.index({ branchId: 1, accountNo: 1 }, { unique: true });
caseSchema.index({ branchId: 1, status: 1 });
caseSchema.index({ accountNo: 'text', 'borrowers.name': 'text' });

export const Case = mongoose.model<ICase>('Case', caseSchema);
