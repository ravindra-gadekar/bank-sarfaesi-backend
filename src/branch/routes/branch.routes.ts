import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import multer from 'multer';
import { FullOnboardingSchema, UpdateBranchSchema, SsoConfigSchema } from '../dto/branch.dto';
import { branchService } from '../services/branch.service';
import { userService } from '../../user/services/user.service';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authorize, requireUserKind } from '../../common/middleware/rbac.middleware';
import { storageService } from '../../config/storage';
import { ApiError } from '../../common/utils/apiError';
import path from 'path';

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only PNG, JPEG, and PDF files are allowed', 'INVALID_FILE_TYPE'));
    }
  },
});

// POST /onboarding/branch — Full onboarding (create branch + assign user as admin). Requires auth.
router.post(
  '/onboarding/branch',
  authenticate,
  validate(FullOnboardingSchema),
  async (req: Request, res: Response) => {
    const email = req.context.email;
    if (!email) throw ApiError.unauthorized('Email not found in session');

    const { branch: branchInput, admin: adminInput } = req.body;

    const branch = await branchService.create({
      bankName: branchInput.bank.name,
      bankType: branchInput.bank.type,
      rbiRegNo: branchInput.bank.rbiRegNo,
      hoAddress: branchInput.bank.hoAddress,
      website: branchInput.bank.website,
      branchName: branchInput.name,
      branchCode: branchInput.code,
      ifscCode: branchInput.ifscCode,
      branchAddress: branchInput.address,
      city: branchInput.city,
      district: branchInput.district,
      state: branchInput.state,
      pinCode: branchInput.pinCode,
      phone: branchInput.phone,
      email: branchInput.email,
      drtJurisdiction: branchInput.drt,
    });

    const adminUser = await userService.create({
      ...adminInput,
      email,
      branchId: branch._id,
      role: 'admin',
      isActive: true,
      authProvider: 'otp',
    });

    res.status(201).json({
      success: true,
      data: {
        branch: { id: branch._id, name: branch.bankName },
        admin: { id: adminUser._id, email: adminUser.email },
      },
    });
  },
);

// POST /onboarding/letterhead — Upload letterhead during onboarding. Requires auth.
router.post(
  '/onboarding/letterhead',
  authenticate,
  upload.single('letterhead'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw ApiError.badRequest('Letterhead file is required');
    }

    const { branchId } = req.body;
    if (!branchId) {
      throw ApiError.badRequest('branchId is required');
    }

    const fileKey = `letterheads/${branchId}/${Date.now()}${path.extname(req.file.originalname)}`;
    await storageService.upload(fileKey, req.file.buffer, req.file.mimetype);
    await branchService.updateLetterhead(branchId, fileKey);

    res.status(201).json({ success: true, data: { fileKey } });
  },
);

// GET /branch — Get current branch profile (auth required, bank user only)
router.get('/branch', authenticate, requireUserKind('bank'), async (req: Request, res: Response) => {
  const { branchId } = req.context;
  if (!branchId) throw ApiError.unauthorized();

  const branch = await branchService.findById(branchId);
  if (!branch) throw ApiError.notFound('Branch not found');

  res.status(200).json({ success: true, data: branch });
});

// PUT /branch — Update branch profile (auth + Admin only, bank user only)
router.put(
  '/branch',
  authenticate,
  requireUserKind('bank'),
  authorize('admin'),
  validate(UpdateBranchSchema),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const branch = await branchService.update(branchId, req.body);
    res.status(200).json({ success: true, data: branch });
  },
);

// PUT /branch/sso — Update SSO config (auth + Admin only, bank user only)
router.put(
  '/branch/sso',
  authenticate,
  requireUserKind('bank'),
  authorize('admin'),
  validate(SsoConfigSchema),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const branch = await branchService.updateSsoConfig(branchId, req.body.ssoConfigs);
    res.status(200).json({ success: true, data: branch });
  },
);

// POST /branch/letterhead — Upload/replace letterhead (auth + Admin only, bank user only)
router.post(
  '/branch/letterhead',
  authenticate,
  requireUserKind('bank'),
  authorize('admin'),
  upload.single('letterhead'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    if (!req.file) {
      throw ApiError.badRequest('Letterhead file is required');
    }

    const fileKey = `letterheads/${branchId}/${Date.now()}${path.extname(req.file.originalname)}`;
    await storageService.upload(fileKey, req.file.buffer, req.file.mimetype);
    await branchService.updateLetterhead(branchId, fileKey);

    res.status(200).json({ success: true, data: { fileKey } });
  },
);

export default router;
