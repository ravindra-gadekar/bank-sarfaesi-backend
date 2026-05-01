import { z } from 'zod/v4';
import { LOAN_TYPES, BORROWER_TYPES, ASSET_TYPES } from '../models/case.model';

const BorrowerSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format')
    .optional(),
  type: z.enum(BORROWER_TYPES),
});

const SecuredAssetSchema = z.object({
  assetType: z.enum(ASSET_TYPES),
  description: z.string().min(1),
  surveyNo: z.string().optional(),
  area: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
});

const SecurityDocumentSchema = z.object({
  documentType: z.string().min(1),
  date: z.coerce.date(),
});

export const CreateCaseSchema = z
  .object({
    accountNo: z.string().min(1),
    loanType: z.enum(LOAN_TYPES),
    sanctionDate: z.coerce.date(),
    sanctionAmount: z.number().min(100000, 'Sanction amount must be at least ₹1,00,000 (SARFAESI threshold)'),
    npaDate: z.coerce.date(),
    borrowers: z.array(BorrowerSchema).min(1, 'At least one borrower is required'),
    securedAssets: z.array(SecuredAssetSchema).min(1, 'At least one secured asset is required'),
    securityDocuments: z.array(SecurityDocumentSchema).optional().default([]),
  })
  .refine((data) => data.sanctionDate < data.npaDate, {
    message: 'Sanction date must be before NPA date',
    path: ['sanctionDate'],
  })
  .refine((data) => data.npaDate <= new Date(), {
    message: 'NPA date must not be in the future',
    path: ['npaDate'],
  });

export const UpdateCaseSchema = z
  .object({
    accountNo: z.string().min(1).optional(),
    loanType: z.enum(LOAN_TYPES).optional(),
    sanctionDate: z.coerce.date().optional(),
    sanctionAmount: z.number().min(100000, 'Sanction amount must be at least ₹1,00,000 (SARFAESI threshold)').optional(),
    npaDate: z.coerce.date().optional(),
    borrowers: z.array(BorrowerSchema).min(1, 'At least one borrower is required').optional(),
    securedAssets: z.array(SecuredAssetSchema).min(1, 'At least one secured asset is required').optional(),
    securityDocuments: z.array(SecurityDocumentSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.sanctionDate && data.npaDate) {
        return data.sanctionDate < data.npaDate;
      }
      return true;
    },
    {
      message: 'Sanction date must be before NPA date',
      path: ['sanctionDate'],
    },
  )
  .refine(
    (data) => {
      if (data.npaDate) {
        return data.npaDate <= new Date();
      }
      return true;
    },
    {
      message: 'NPA date must not be in the future',
      path: ['npaDate'],
    },
  );

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type UpdateCaseInput = z.infer<typeof UpdateCaseSchema>;
