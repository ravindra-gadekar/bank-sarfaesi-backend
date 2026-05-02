import { z } from 'zod/v4';
import { USER_ROLES, APP_ROLES } from '../models/user.model';
import { OFFICE_TYPES } from '../../office/models/office.model';

export const CreateAppInviteSchema = z.object({
  email: z.email(),
  appRole: z.enum(APP_ROLES),
});
export type CreateAppInviteInput = z.infer<typeof CreateAppInviteSchema>;

const newOfficeSchema = z.object({
  bankName: z.string().min(1),
  bankLogoKey: z.string().optional(),
  officeType: z.enum(OFFICE_TYPES),
  parentOfficeId: z.string().optional(),
  address: z.string().min(1),
  contact: z.string().min(1),
  email: z.email(),
});

export const CreateBankInviteSchema = z
  .object({
    email: z.email(),
    bankRole: z.enum(USER_ROLES),
    targetOfficeId: z.string().optional(),
    newOffice: newOfficeSchema.optional(),
  })
  .refine(
    (d) => !!d.targetOfficeId || !!d.newOffice,
    { message: 'Either targetOfficeId or newOffice is required', path: ['targetOfficeId'] },
  );
export type CreateBankInviteInput = z.infer<typeof CreateBankInviteSchema>;

export const AcceptBankInviteSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  mobile: z.string().optional(),
});
export type AcceptBankInviteInput = z.infer<typeof AcceptBankInviteSchema>;

// Legacy — kept to avoid breaking existing imports until PHASE-3
export const CreateInviteSchema = z.object({
  email: z.email(),
  role: z.enum(USER_ROLES),
});
export const AcceptInviteSchema = AcceptBankInviteSchema;
export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
