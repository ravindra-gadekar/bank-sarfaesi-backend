import { z } from 'zod/v4';
import { BANK_TYPES, SSO_PROVIDERS } from '../models/branch.model';

export const BankInfoSchema = z.object({
  bankName: z.string().min(1),
  bankType: z.enum(BANK_TYPES),
  rbiRegNo: z.string().min(1),
  hoAddress: z.string().min(1),
  state: z.string().min(1),
  website: z.string().url().optional(),
});

export const BranchInfoSchema = z.object({
  branchName: z.string().min(1),
  branchCode: z.string().min(1),
  ifscCode: z.string().min(1),
  branchAddress: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  state: z.string().min(1),
  pinCode: z.string().regex(/^\d{6}$/),
  phone: z.string().optional(),
  email: z.email(),
});

export const PersonalDetailsSchema = z.object({
  name: z.string().min(1),
  designation: z.string().min(1),
  mobile: z.string().optional(),
});

export const SsoConfigSchema = z.object({
  provider: z.enum(SSO_PROVIDERS),
  clientId: z.string().min(1),
  tenantId: z.string().optional(),
  clientSecret: z.string().min(1),
  allowedDomains: z.array(z.string().min(1)).min(1),
});

export const DrtJurisdictionSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
});

export const FullOnboardingSchema = z.object({
  branch: z.object({
    bank: z.object({
      name: z.string().min(1),
      type: z.enum(BANK_TYPES),
      rbiRegNo: z.string().min(1),
      hoAddress: z.string().min(1),
      state: z.string().min(1),
      website: z.string().url().optional(),
    }),
    name: z.string().min(1),
    code: z.string().min(1),
    ifscCode: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    district: z.string().min(1),
    state: z.string().min(1),
    pinCode: z.string().regex(/^\d{6}$/),
    phone: z.string().optional(),
    email: z.email(),
    drt: DrtJurisdictionSchema,
  }),
  admin: PersonalDetailsSchema,
});

export const UpdateBranchSchema = BankInfoSchema.merge(BranchInfoSchema).partial();

export type BankInfoInput = z.infer<typeof BankInfoSchema>;
export type BranchInfoInput = z.infer<typeof BranchInfoSchema>;
export type PersonalDetailsInput = z.infer<typeof PersonalDetailsSchema>;
export type SsoConfigInput = z.infer<typeof SsoConfigSchema>;
export type DrtJurisdictionInput = z.infer<typeof DrtJurisdictionSchema>;
export type FullOnboardingInput = z.infer<typeof FullOnboardingSchema>;
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;
