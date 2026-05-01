import rateLimit from 'express-rate-limit';
import { Request } from 'express';

export const otpRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 3,
  keyGenerator: (req: Request) => (req.body as { email?: string })?.email || req.ip || 'unknown',
  validate: { ip: false, keyGeneratorIpFallback: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many OTP requests. Please try again after 30 minutes.',
    },
  },
});
