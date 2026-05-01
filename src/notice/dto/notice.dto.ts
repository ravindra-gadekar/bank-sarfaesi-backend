import { z } from 'zod/v4';
import { NOTICE_TYPES } from '../models/notice.model';

export const CreateNoticeSchema = z.object({
  caseId: z.string().min(1),
  noticeType: z.enum(NOTICE_TYPES),
});

export type CreateNoticeInput = z.infer<typeof CreateNoticeSchema>;

export const UpdateNoticeFieldsSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
});

export type UpdateNoticeFieldsInput = z.infer<typeof UpdateNoticeFieldsSchema>;

export const ApproveRejectSchema = z.object({
  comment: z.string().optional(),
});

export type ApproveRejectInput = z.infer<typeof ApproveRejectSchema>;
