import { z } from 'zod/v4';

export const OtpRequestSchema = z.object({
  email: z.email(),
});

export const OtpVerifySchema = z.object({
  email: z.email(),
  otp: z.string().length(6).regex(/^\d{6}$/),
});

export const RefreshSchema = z.object({});

export type OtpRequestInput = z.infer<typeof OtpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
