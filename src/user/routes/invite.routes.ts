import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { authenticate } from '../../common/middleware/auth.middleware';
import { requireUserKind } from '../../common/middleware/rbac.middleware';
import { ApiError } from '../../common/utils/apiError';
import { User } from '../models/user.model';
import {
  CreateAppInviteSchema,
  CreateBankInviteSchema,
  AcceptBankInviteSchema,
} from '../dto/invite.dto';
import { inviteService } from '../services/invite.service';
import { emailService } from '../../common/services/email.service';

const router = Router();

function validate(schema: z.ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) throw ApiError.badRequest('Validation failed', result.error.issues);
    req.body = result.data;
    next();
  };
}

async function loadActor(req: Request) {
  if (!req.context.userId) throw ApiError.unauthorized('Missing userId');
  const actor = await User.findById(req.context.userId).exec();
  if (!actor) throw ApiError.unauthorized('Actor not found');
  return actor;
}

// POST /api/invites/app — Superadmin only (gated by service)
router.post(
  '/invites/app',
  authenticate,
  requireUserKind('app'),
  validate(CreateAppInviteSchema),
  async (req: Request, res: Response) => {
    const actor = await loadActor(req);
    const inv = await inviteService.createAppInvite(actor, req.body);
    const plainToken = (inv as unknown as { _plainToken: string })._plainToken;
    await emailService.sendInviteEmail(inv.email, plainToken);
    res.status(201).json({
      success: true,
      data: { id: inv._id, email: inv.email, expiresAt: inv.expiresAt },
    });
  },
);

// POST /api/invites/bank — App users (any) and Bank users (subtree-scoped)
router.post(
  '/invites/bank',
  authenticate,
  validate(CreateBankInviteSchema),
  async (req: Request, res: Response) => {
    const actor = await loadActor(req);
    const inv = await inviteService.createBankInvite(actor, req.body);
    const plainToken = (inv as unknown as { _plainToken: string })._plainToken;
    await emailService.sendInviteEmail(inv.email, plainToken);
    res.status(201).json({
      success: true,
      data: { id: inv._id, email: inv.email, expiresAt: inv.expiresAt },
    });
  },
);

// GET /api/invites/:token/validate — public
router.get('/invites/:token/validate', async (req: Request, res: Response) => {
  const inv = await inviteService.validateToken(String(req.params.token));
  res.json({
    success: true,
    data: {
      email: inv.email,
      userKind: inv.userKind,
      bankRole: inv.bankRole ?? null,
      appRole: inv.appRole ?? null,
      bankName: inv.pendingOfficeSnapshot?.bankName ?? null,
      officeType: inv.pendingOfficeSnapshot?.officeType ?? null,
    },
  });
});

// POST /api/invites/:token/accept — public
router.post(
  '/invites/:token/accept',
  validate(AcceptBankInviteSchema),
  async (req: Request, res: Response) => {
    const { user, office } = await inviteService.acceptInvite(
      String(req.params.token),
      req.body,
    );
    const officeData = office as { _id?: unknown; bankName?: string; officeType?: string } | null;
    res.status(201).json({
      success: true,
      data: {
        userId: user._id,
        officeId: user.officeId,
        office: officeData
          ? {
              id: officeData._id,
              bankName: officeData.bankName,
              officeType: officeData.officeType,
            }
          : null,
      },
    });
  },
);

export default router;
