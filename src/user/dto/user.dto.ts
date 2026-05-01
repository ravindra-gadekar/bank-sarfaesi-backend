import { z } from 'zod/v4';
import { USER_ROLES } from '../models/user.model';

export const UpdateRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});

export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
