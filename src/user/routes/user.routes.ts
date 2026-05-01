import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import crypto from 'crypto';
import { UpdateRoleSchema } from '../dto/user.dto';
import { CreateInviteSchema, AcceptInviteSchema } from '../dto/invite.dto';
import { userService } from '../services/user.service';
import { Invite } from '../models/invite.model';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authorize } from '../../common/middleware/rbac.middleware';
import { otpService } from '../../auth/services/otp.service';
import { jwtService } from '../../auth/services/jwt.service';
import { ApiError } from '../../common/utils/apiError';

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

// GET /users — List all users in branch (auth + Admin/Manager)
router.get(
  '/users',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

    const result = await userService.findAllByBranch(branchId, page, limit);
    res.status(200).json({ success: true, data: result });
  },
);

// GET /users/me — Get current user profile (auth required)
router.get('/users/me', authenticate, async (req: Request, res: Response) => {
  const { branchId, userId } = req.context;
  if (!branchId || !userId) throw ApiError.unauthorized();

  const user = await userService.findById(branchId, userId);
  if (!user) throw ApiError.notFound('User not found');

  res.status(200).json({ success: true, data: user });
});

// PATCH /users/:id/role — Change user role (auth + Admin only)
router.patch(
  '/users/:id/role',
  authenticate,
  authorize('admin'),
  validate(UpdateRoleSchema),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const user = await userService.updateRole(branchId, req.params.id as string, req.body.role);
    res.status(200).json({ success: true, data: user });
  },
);

// PATCH /users/:id/deactivate — Deactivate user (auth + Admin only)
router.patch(
  '/users/:id/deactivate',
  authenticate,
  authorize('admin'),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    if (req.params.id === userId) {
      throw ApiError.badRequest('Cannot deactivate your own account');
    }

    const user = await userService.deactivate(branchId, req.params.id as string);
    res.status(200).json({ success: true, data: user });
  },
);

// POST /users/invite — Create invite (auth + Admin only)
router.post(
  '/users/invite',
  authenticate,
  authorize('admin'),
  validate(CreateInviteSchema),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const { email, role } = req.body;

    // Check for existing pending invite for this email in this branch
    const existingInvite = await Invite.findOne({
      branchId,
      email: email.toLowerCase(),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).exec();
    if (existingInvite) {
      throw ApiError.conflict('An active invite already exists for this email');
    }

    const token = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await Invite.create({
      branchId,
      email: email.toLowerCase(),
      role,
      tokenHash,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
      invitedBy: req.context.userId,
    });

    res.status(201).json({
      success: true,
      data: { token, email, role },
    });
  },
);

// GET /invite/:token/validate — Validate invite token (no auth)
router.get('/invite/:token/validate', async (req: Request, res: Response) => {
  const tokenHash = crypto.createHash('sha256').update(req.params.token as string).digest('hex');

  const invite = await Invite.findOne({ tokenHash, usedAt: { $exists: false } }).exec();
  if (!invite) {
    throw ApiError.notFound('Invalid or expired invite');
  }

  if (invite.expiresAt < new Date()) {
    throw ApiError.badRequest('Invite has expired');
  }

  res.status(200).json({
    success: true,
    data: {
      email: invite.email,
      role: invite.role,
      branchId: invite.branchId,
    },
  });
});

// POST /invite/:token/accept — Accept invite + create user (no auth)
router.post(
  '/invite/:token/accept',
  validate(AcceptInviteSchema),
  async (req: Request, res: Response) => {
    const tokenHash = crypto.createHash('sha256').update(req.params.token as string).digest('hex');

    const invite = await Invite.findOne({ tokenHash, usedAt: { $exists: false } }).exec();
    if (!invite) {
      throw ApiError.notFound('Invalid or expired invite');
    }

    if (invite.expiresAt < new Date()) {
      throw ApiError.badRequest('Invite has expired');
    }

    const { name, email, otp } = req.body;

    if (email.toLowerCase() !== invite.email) {
      throw ApiError.badRequest('Email does not match invite');
    }

    // Verify OTP before creating user
    await otpService.verifyOtp(email, otp);

    const user = await userService.create({
      branchId: invite.branchId,
      name,
      email: email.toLowerCase(),
      role: invite.role,
      isActive: true,
      authProvider: 'otp',
    });

    // Mark invite as accepted
    invite.usedAt = new Date();
    await invite.save();

    // Issue JWT cookies
    const accessToken = jwtService.signAccessToken({
      email: user.email,
      userId: user._id.toString(),
      branchId: user.branchId!.toString(),
      role: user.role,
    });
    const refreshToken = jwtService.signRefreshToken({
      email: user.email,
    });

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 8 * 60 * 60 * 1000 });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          branchId: user.branchId,
        },
      },
    });
  },
);

export default router;
