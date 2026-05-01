import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { OtpRequestSchema, OtpVerifySchema } from '../dto/auth.dto';
import { otpService } from '../services/otp.service';
import { jwtService } from '../services/jwt.service';
import { ssoResolverService } from '../services/ssoResolver.service';
import { oauthService } from '../services/oauth.service';
import { emailService } from '../../common/services/email.service';
import { RevokedToken } from '../models/revokedToken.model';
import { Invite } from '../../user/models/invite.model';
import { otpRateLimiter } from '../middleware/rateLimiter';
import { ApiError } from '../../common/utils/apiError';
import { User } from '../../user/models/user.model';
import { Branch } from '../../branch/models/branch.model';
import { authenticate } from '../../common/middleware/auth.middleware';
import crypto from 'crypto';

const router = Router();

function validate(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw ApiError.badRequest('Validation failed', result.error.issues);
    }
    req.body = result.data;
    next();
  };
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

const FRONTEND_URL = process.env.NODE_ENV === 'production'
  ? '' // same origin in production
  : 'http://localhost:3000';

function frontendUrl(path: string): string {
  return `${FRONTEND_URL}${path}`;
}

async function issueSsoTokensAndRedirect(res: Response, email: string): Promise<void> {
  const accessToken = jwtService.signAccessToken({ email });
  const refreshToken = jwtService.signRefreshToken({ email });

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });
  res.redirect(frontendUrl('/sso/callback'));
}

// POST /auth/otp/request — validate email, rate limit, generate OTP, send email
router.post(
  '/auth/otp/request',
  otpRateLimiter,
  validate(OtpRequestSchema),
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const otp = await otpService.generateOtp(email);
    await emailService.sendOtpEmail(email, otp);
    res.status(200).json({ success: true, data: { message: 'OTP sent to email' } });
  },
);

// POST /auth/otp/verify — verify OTP, issue identity JWT (email only, no branch yet)
router.post(
  '/auth/otp/verify',
  validate(OtpVerifySchema),
  async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    await otpService.verifyOtp(email, otp);

    // Issue identity-level tokens (email only — branch selected later)
    const accessToken = jwtService.signAccessToken({ email });
    const refreshToken = jwtService.signRefreshToken({ email });

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });

    // Return branches the user belongs to
    const users = await User.find({ email: email.toLowerCase(), isActive: true })
      .populate('branchId', 'bankName branchName')
      .exec();

    const branches = users.map((u) => ({
      branchId: (u.branchId as any)._id.toString(),
      branchName: (u.branchId as any).branchName || (u.branchId as any).bankName || 'Unknown',
      bankName: (u.branchId as any).bankName || '',
      role: u.role,
    }));

    res.status(200).json({
      success: true,
      data: { email, branches },
    });
  },
);

// GET /auth/my-branches — return all branches the authenticated user belongs to
router.get('/auth/my-branches', authenticate, async (req: Request, res: Response) => {
  const { email } = req.context;
  if (!email) throw ApiError.unauthorized('Email not found in session');

  const users = await User.find({ email, isActive: true })
    .populate('branchId', 'bankName branchName')
    .exec();

  const branches = users.map((u) => ({
    branchId: (u.branchId as any)._id.toString(),
    branchName: (u.branchId as any).branchName || (u.branchId as any).bankName || 'Unknown',
    bankName: (u.branchId as any).bankName || '',
    role: u.role,
  }));

  res.status(200).json({ success: true, data: { branches } });
});

// POST /auth/select-branch — select a branch, issue full JWT with userId/branchId/role
router.post('/auth/select-branch', authenticate, async (req: Request, res: Response) => {
  const { email } = req.context;
  const { branchId } = req.body;

  if (!email) throw ApiError.unauthorized('Email not found in session');
  if (!branchId) throw ApiError.badRequest('branchId is required');

  const user = await User.findOne({ email, branchId, isActive: true }).exec();
  if (!user) throw ApiError.forbidden('You do not belong to this branch');

  await User.findByIdAndUpdate(user._id, { lastLogin: new Date() }).exec();

  const tokenPayload = {
    email,
    userId: user._id.toString(),
    branchId: user.branchId.toString(),
    role: user.role,
  };

  const accessToken = jwtService.signAccessToken(tokenPayload);
  const refreshToken = jwtService.signRefreshToken({ email });

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });

  const branch = await Branch.findById(branchId).select('bankName branchName').exec();

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        branchName: branch?.branchName || branch?.bankName || '',
      },
    },
  });
});

// POST /auth/refresh — verify refresh cookie, check not revoked, issue new pair, revoke old
router.post('/auth/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw ApiError.unauthorized('Refresh token missing');
  }

  const payload = jwtService.verifyRefreshToken(token);

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const revoked = await RevokedToken.findOne({ tokenHash }).exec();
  if (revoked) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  // Revoke old refresh token
  await RevokedToken.create({
    tokenHash,
    email: payload.email,
    expiresAt: new Date(payload.exp * 1000),
  });

  // Look up current access token to preserve branch context if it was set
  const currentAccessToken = req.cookies?.accessToken;
  let tokenPayloadData: { email: string; userId?: string; branchId?: string; role?: string } = {
    email: payload.email,
  };

  if (currentAccessToken) {
    try {
      const currentPayload = jwtService.verifyAccessToken(currentAccessToken);
      tokenPayloadData = {
        email: currentPayload.email,
        userId: currentPayload.userId,
        branchId: currentPayload.branchId,
        role: currentPayload.role,
      };
    } catch {
      // Access token expired — try to restore context from DB
      const user = await User.findOne({ email: payload.email, isActive: true }).exec();
      if (user) {
        tokenPayloadData = {
          email: payload.email,
          userId: user._id.toString(),
          branchId: user.branchId.toString(),
          role: user.role,
        };
      }
    }
  } else {
    // No access token at all — try to restore from DB
    const user = await User.findOne({ email: payload.email, isActive: true }).exec();
    if (user) {
      tokenPayloadData = {
        email: payload.email,
        userId: user._id.toString(),
        branchId: user.branchId.toString(),
        role: user.role,
      };
    }
  }

  const accessToken = jwtService.signAccessToken(tokenPayloadData);
  const refreshToken = jwtService.signRefreshToken({ email: payload.email });

  res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });

  res.status(200).json({ success: true, data: { message: 'Tokens refreshed' } });
});

// POST /auth/logout — revoke refresh token, clear cookies
router.post('/auth/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      const payload = jwtService.verifyRefreshToken(token);
      const logoutHash = crypto.createHash('sha256').update(token).digest('hex');
      await RevokedToken.create({
        tokenHash: logoutHash,
        email: payload.email,
        expiresAt: new Date(payload.exp * 1000),
      });
    } catch {
      // Token may already be invalid — still clear cookies
    }
  }

  res.clearCookie('accessToken', cookieOptions);
  res.clearCookie('refreshToken', cookieOptions);
  res.status(200).json({ success: true, data: { message: 'Logged out' } });
});

// POST /auth/sso/init — receive email, resolve domain → return provider + auth URL or 'otp'
router.post('/auth/sso/init', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    throw ApiError.badRequest('Email is required');
  }

  const resolution = await ssoResolverService.resolveProvider(email);
  res.status(200).json({ success: true, data: resolution });
});

// GET /auth/sso/google — redirect to Google OAuth consent screen
router.get('/auth/sso/google', (_req: Request, res: Response) => {
  const state = oauthService.generateState();
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 min
    path: '/',
  });
  res.redirect(oauthService.getGoogleAuthUrl(state));
});

// GET /auth/sso/google/callback — exchange code, issue JWT, redirect to frontend
router.get('/auth/sso/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;

  if (!code || !state || state !== storedState) {
    return res.redirect(frontendUrl('/login?error=invalid_state'));
  }
  res.clearCookie('oauth_state', { path: '/' });

  try {
    const userInfo = await oauthService.exchangeGoogleCode(code as string);
    await issueSsoTokensAndRedirect(res, userInfo.email);
  } catch {
    res.redirect(frontendUrl('/login?error=sso_failed'));
  }
});

// GET /auth/sso/microsoft — redirect to Microsoft OAuth consent screen
router.get('/auth/sso/microsoft', (_req: Request, res: Response) => {
  const state = oauthService.generateState();
  res.cookie('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
  });
  res.redirect(oauthService.getMicrosoftAuthUrl(state));
});

// GET /auth/sso/microsoft/callback — exchange code, issue JWT, redirect to frontend
router.get('/auth/sso/microsoft/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const storedState = req.cookies?.oauth_state;

  if (!code || !state || state !== storedState) {
    return res.redirect(frontendUrl('/login?error=invalid_state'));
  }
  res.clearCookie('oauth_state', { path: '/' });

  try {
    const userInfo = await oauthService.exchangeMicrosoftCode(code as string);
    await issueSsoTokensAndRedirect(res, userInfo.email);
  } catch {
    res.redirect(frontendUrl('/login?error=sso_failed'));
  }
});

// POST /auth/signup/check-email — check if email has pending invite
router.post('/auth/signup/check-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    throw ApiError.badRequest('Email is required');
  }

  const invite = await Invite.findOne({
    email: email.toLowerCase(),
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).exec();

  res.status(200).json({
    success: true,
    data: {
      hasInvite: !!invite,
      branchId: invite?.branchId?.toString() ?? null,
    },
  });
});

export default router;
