import { z } from 'zod/v4';
import { USER_ROLES } from '../models/user.model';

export const CreateInviteSchema = z.object({
  email: z.email(),
  role: z.enum(USER_ROLES),
});

export const AcceptInviteSchema = z.object({
  name: z.string().min(1),
  designation: z.string().optional(),
  mobile: z.string().optional(),
});

export type CreateInviteInput = z.infer<typeof CreateInviteSchema>;
export type AcceptInviteInput = z.infer<typeof AcceptInviteSchema>;
