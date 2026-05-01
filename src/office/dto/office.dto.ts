import { z } from 'zod/v4';
import { OFFICE_TYPES } from '../models/office.model';

export const OfficeTypeSchema = z.enum(OFFICE_TYPES);

const baseFields = {
  bankName: z.string().min(1),
  bankLogoKey: z.string().optional(),
  branchName: z.string().optional(),
  branchCode: z.string().optional(),
  ifscCode: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.email(),
  contact: z.string().min(1),
};

export const CreateOfficeSchema = z
  .object({
    ...baseFields,
    officeType: OfficeTypeSchema,
    parentOfficeId: z.string().optional(),
  })
  .refine(
    (data) => data.officeType === 'HO' || !!data.parentOfficeId,
    { message: 'parentOfficeId is required for non-HO offices', path: ['parentOfficeId'] },
  );

export type CreateOfficeInput = z.infer<typeof CreateOfficeSchema>;

export const OfficeResponseSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  bankLogoKey: z.string().nullish(),
  officeType: OfficeTypeSchema,
  parentId: z.string().nullable(),
  ancestors: z.array(z.string()),
  bankRootId: z.string(),
  branchName: z.string().nullish(),
  address: z.string(),
  email: z.string(),
});

export type OfficeResponse = z.infer<typeof OfficeResponseSchema>;
