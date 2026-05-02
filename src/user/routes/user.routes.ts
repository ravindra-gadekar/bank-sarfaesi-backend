import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import crypto from 'crypto';
import { UpdateRoleSchema } from '../dto/user.dto';
import { CreateInviteSchema, AcceptInviteSchema } from '../dto/invite.dto';
import { userService } from '../services/user.service';
import { inviteService } from '../services/invite.service';
import { User } from '../models/user.model';
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

// POST /users/invite — DEPRECATED. Delegates to inviteService.createBankInvite for the actor's own office.
// Prefer POST /api/invites/bank with explicit targetOfficeId.
router.post(
  '/users/invite',
  authenticate,
  authorize('admin'),
  validate(CreateInviteSchema),
  async (req: Request, res: Response) => {
    const { userId } = req.context;
    if (!userId) throw ApiError.unauthorized();

    const actor = await User.findById(userId).exec();
    if (!actor) throw ApiError.unauthorized('Actor not found');
    if (!actor.officeId) throw ApiError.badRequest('Actor has no officeId');

    const { email, role } = req.body;
    const inv = await inviteService.createBankInvite(actor, {
      email,
      bankRole: role,
      targetOfficeId: actor.officeId.toString(),
    });
    const token = (inv as unknown as { _plainToken: string })._plainToken;
    res.status(201).json({ success: true, data: { token, email, role } });
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
