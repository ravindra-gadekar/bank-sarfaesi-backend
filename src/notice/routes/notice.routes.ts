import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { CreateNoticeSchema, UpdateNoticeFieldsSchema, ApproveRejectSchema } from '../dto/notice.dto';
import { noticeService } from '../services/notice.service';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authorize, requireUserKind } from '../../common/middleware/rbac.middleware';
import { ApiError } from '../../common/utils/apiError';

const router = Router();

router.use('/notices', authenticate, requireUserKind('bank'));

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

// POST /notices — Create draft notice
router.post(
  '/notices',
  authorize('admin', 'manager', 'maker'),
  validate(CreateNoticeSchema),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId || !userId) throw ApiError.unauthorized();

    const { caseId, noticeType } = req.body;
    const notice = await noticeService.createDraft(branchId, caseId, noticeType, userId);
    res.status(201).json({ success: true, data: notice });
  },
);

// PUT /notices/:id/fields — Update notice fields (draft/rejected only)
router.put(
  '/notices/:id/fields',
  authorize('admin', 'manager', 'maker'),
  validate(UpdateNoticeFieldsSchema),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const notice = await noticeService.updateFields(branchId, req.params.id as string, req.body.fields);
    res.status(200).json({ success: true, data: notice });
  },
);

// POST /notices/:id/submit — Submit for review (maker only)
router.post(
  '/notices/:id/submit',
  authorize('admin', 'manager', 'maker'),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId || !userId) throw ApiError.unauthorized();

    const notice = await noticeService.submit(branchId, req.params.id as string, userId);
    res.status(200).json({ success: true, data: notice });
  },
);

// POST /notices/:id/approve — Approve notice (checker, not same as maker)
router.post(
  '/notices/:id/approve',
  authorize('admin', 'manager', 'checker'),
  validate(ApproveRejectSchema),
  async (req: Request, res: Response) => {
    const { branchId, userId, role } = req.context;
    if (!branchId || !userId || !role) throw ApiError.unauthorized();

    const notice = await noticeService.approve(branchId, req.params.id as string, userId, role, req.body.comment);
    res.status(200).json({ success: true, data: notice });
  },
);

// POST /notices/:id/reject — Reject notice with mandatory comment
router.post(
  '/notices/:id/reject',
  authorize('admin', 'manager', 'checker'),
  validate(ApproveRejectSchema),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId || !userId) throw ApiError.unauthorized();

    const { comment } = req.body;
    if (!comment || comment.trim().length === 0) {
      throw ApiError.badRequest('Comment is required when rejecting a notice');
    }

    const notice = await noticeService.reject(branchId, req.params.id as string, userId, comment);
    res.status(200).json({ success: true, data: notice });
  },
);

// GET /notices/pending-review — List submitted notices (MUST be before /:id)
router.get(
  '/notices/pending-review',
  authorize('admin', 'manager', 'checker'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const notices = await noticeService.listPendingReview(branchId);
    res.status(200).json({ success: true, data: notices });
  },
);

// DELETE /notices/:id — Delete a draft notice (maker only)
router.delete(
  '/notices/:id',
  authorize('admin', 'manager', 'maker'),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId || !userId) throw ApiError.unauthorized();

    await noticeService.deleteDraft(branchId, req.params.id as string, userId);
    res.status(200).json({ success: true, message: 'Draft notice deleted' });
  },
);

// GET /notices — List notices (optionally filtered by caseId)
router.get(
  '/notices',
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const caseId = req.query.caseId as string;
    if (caseId) {
      const notices = await noticeService.listByCase(branchId, caseId);
      return res.status(200).json({ success: true, data: notices });
    }

    // No caseId — list all branch notices with optional filters
    const notices = await noticeService.listAll(branchId, {
      status: req.query.status as string | undefined,
      noticeType: req.query.noticeType as string | undefined,
      search: req.query.search as string | undefined,
    });
    res.status(200).json({ success: true, data: notices });
  },
);

// ── Version Management ──────────────────────────────────

// GET /notices/:id/versions — Get all versions in the supersede chain
router.get(
  '/notices/:id/versions',
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const chain = await noticeService.getVersionChain(branchId, req.params.id as string);
    res.status(200).json({ success: true, data: chain });
  },
);

// POST /notices/:id/supersede — Supersede a finalized notice (creates new draft version)
router.post(
  '/notices/:id/supersede',
  authorize('admin', 'manager', 'maker'),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId || !userId) throw ApiError.unauthorized();

    const newNotice = await noticeService.supersede(branchId, req.params.id as string, userId);
    res.status(201).json({ success: true, data: newNotice });
  },
);

// GET /notices/:id/compare/:otherId — Compare fields between two notice versions
router.get(
  '/notices/:id/compare/:otherId',
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const [notice1, notice2] = await Promise.all([
      noticeService.findById(branchId, req.params.id as string),
      noticeService.findById(branchId, req.params.otherId as string),
    ]);

    if (!notice1 || !notice2) throw ApiError.notFound('One or both notices not found');

    const diff = noticeService.compareVersions(notice1, notice2);
    res.status(200).json({
      success: true,
      data: {
        diff,
        left: { _id: notice1._id, version: notice1.version, status: notice1.status, fields: notice1.fields },
        right: { _id: notice2._id, version: notice2.version, status: notice2.status, fields: notice2.fields },
      },
    });
  },
);

// GET /notices/:id — Get notice detail
router.get(
  '/notices/:id',
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const notice = await noticeService.findById(branchId, req.params.id as string);
    if (!notice) throw ApiError.notFound('Notice not found');

    res.status(200).json({ success: true, data: notice });
  },
);

export default router;
