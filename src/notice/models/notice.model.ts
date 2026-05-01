import mongoose, { Schema, Document, Types } from 'mongoose';

export const NOTICE_TYPES = ['demand_13_2', 'possession_13_4', 'sale_auction'] as const;
export type NoticeType = (typeof NOTICE_TYPES)[number];

export const NOTICE_STATUSES = ['draft', 'submitted', 'rejected', 'approved', 'final', 'superseded'] as const;
export type NoticeStatus = (typeof NOTICE_STATUSES)[number];

export interface IChatMessage {
  role: 'bot' | 'user';
  message: string;
  fieldKey?: string;
  timestamp: Date;
}

export interface IRecipient {
  name: string;
  address: string;
  type: string;
}

export interface IGeneratedDoc {
  format: 'docx' | 'pdf' | 'zip';
  fileKey: string;
  sha256: string;
  recipientName?: string;
  generatedAt: Date;
}

export interface INotice extends Document {
  branchId: Types.ObjectId;
  caseId: Types.ObjectId;
  noticeType: NoticeType;
  version: number;
  status: NoticeStatus;
  fields: Record<string, unknown>;
  chatSessionLog: IChatMessage[];
  recipients: IRecipient[];
  generatedDocs: IGeneratedDoc[];
  makerUserId: Types.ObjectId;
  checkerUserId?: Types.ObjectId;
  checkerComment?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  finalizedAt?: Date;
  supersedes?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['bot', 'user'], required: true },
    message: { type: String, required: true },
    fieldKey: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recipientSchema = new Schema<IRecipient>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    type: { type: String, required: true },
  },
  { _id: false },
);

const generatedDocSchema = new Schema<IGeneratedDoc>(
  {
    format: { type: String, enum: ['docx', 'pdf', 'zip'], required: true },
    fileKey: { type: String, required: true },
    sha256: { type: String, required: true },
    recipientName: { type: String },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const noticeSchema = new Schema<INotice>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    noticeType: { type: String, enum: NOTICE_TYPES, required: true },
    version: { type: Number, default: 1 },
    status: { type: String, enum: NOTICE_STATUSES, default: 'draft' },
    fields: { type: Schema.Types.Mixed, default: {} },
    chatSessionLog: { type: [chatMessageSchema], default: [] },
    recipients: { type: [recipientSchema], default: [] },
    generatedDocs: { type: [generatedDocSchema], default: [] },
    makerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    checkerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    checkerComment: { type: String },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    finalizedAt: { type: Date },
    supersedes: { type: Schema.Types.ObjectId, ref: 'Notice' },
  },
  { timestamps: true },
);

noticeSchema.index({ branchId: 1, caseId: 1, noticeType: 1, status: 1 });
noticeSchema.index({ branchId: 1, status: 1 });
noticeSchema.index({ branchId: 1, makerUserId: 1 });

export const Notice = mongoose.model<INotice>('Notice', noticeSchema);
