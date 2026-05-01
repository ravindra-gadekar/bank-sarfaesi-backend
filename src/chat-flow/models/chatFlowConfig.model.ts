import mongoose, { Schema, Document, Types } from 'mongoose';
import { NOTICE_TYPES } from '../../notice/models/notice.model';

export interface IQuestionValidation {
  type: 'required' | 'min' | 'max' | 'regex' | 'minLength' | 'maxLength';
  value?: string | number;
  message: string;
}

export interface IQuestionNode {
  id: string;
  questionText: string;
  fieldKey: string;
  inputType: 'text' | 'currency' | 'date' | 'number' | 'dropdown' | 'textarea';
  options?: string[];
  validation: IQuestionValidation[];
  chatScript: string;
  nextQuestion: string | null;
  conditionalNext?: { value: string; nextId: string }[];
  isLoopStart?: boolean;
  loopBackTo?: string;
  loopPrompt?: string;
  group?: string;
  required?: boolean;
}

export interface IChatFlowConfig extends Document {
  branchId: Types.ObjectId | null;
  noticeType: string;
  version: number;
  questionFlow: IQuestionNode[];
  keywordAnswerMap: Record<string, string>;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  effectiveFrom: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionValidationSchema = new Schema<IQuestionValidation>(
  {
    type: { type: String, enum: ['required', 'min', 'max', 'regex', 'minLength', 'maxLength'], required: true },
    value: { type: Schema.Types.Mixed },
    message: { type: String, required: true },
  },
  { _id: false },
);

const ConditionalNextSchema = new Schema(
  {
    value: { type: String, required: true },
    nextId: { type: String, required: true },
  },
  { _id: false },
);

const QuestionNodeSchema = new Schema<IQuestionNode>(
  {
    id: { type: String, required: true },
    questionText: { type: String, required: true },
    fieldKey: { type: String, default: '' },
    inputType: { type: String, enum: ['text', 'currency', 'date', 'number', 'dropdown', 'textarea'], required: true },
    options: { type: [String], default: undefined },
    validation: { type: [QuestionValidationSchema], default: [] },
    chatScript: { type: String, default: '' },
    nextQuestion: { type: String, default: null },
    conditionalNext: { type: [ConditionalNextSchema], default: undefined },
    isLoopStart: { type: Boolean },
    loopBackTo: { type: String },
    loopPrompt: { type: String },
    group: { type: String },
    required: { type: Boolean },
  },
  { _id: false },
);

const ChatFlowConfigSchema = new Schema<IChatFlowConfig>(
  {
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
    noticeType: { type: String, enum: NOTICE_TYPES, required: true },
    version: { type: Number, default: 1 },
    questionFlow: { type: [QuestionNodeSchema], required: true },
    keywordAnswerMap: { type: Schema.Types.Mixed, default: {} },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    effectiveFrom: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

ChatFlowConfigSchema.index({ branchId: 1, noticeType: 1, isActive: 1 });

const ChatFlowConfig = mongoose.model<IChatFlowConfig>('ChatFlowConfig', ChatFlowConfigSchema);
export default ChatFlowConfig;
