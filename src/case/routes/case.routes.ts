import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { CreateCaseSchema, UpdateCaseSchema } from '../dto/case.dto';
import { CASE_STATUSES, CaseStatus } from '../models/case.model';
import { caseService } from '../services/case.service';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authorize, requireUserKind } from '../../common/middleware/rbac.middleware';
import { ApiError } from '../../common/utils/apiError';

const router = Router();

router.use('/cases', authenticate, requireUserKind('bank'));

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

// POST /cases — Create a new NPA case
router.post(
  '/cases',
  authorize('admin', 'manager', 'maker'),
  validate(CreateCaseSchema),
  async (req: Request, res: Response) => {
    const { branchId, userId } = req.context;
    if (!branchId || !userId) throw ApiError.unauthorized();

    const npaCase = await caseService.create(branchId, userId, req.body);
    res.status(201).json({ success: true, data: npaCase });
  },
);

// GET /cases — List cases with pagination and optional search/status filter
router.get(
  '/cases',
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string) || undefined;
    const statusParam = req.query.status as string | undefined;

    let status: CaseStatus | undefined;
    if (statusParam && CASE_STATUSES.includes(statusParam as CaseStatus)) {
      status = statusParam as CaseStatus;
    }

    const result = await caseService.findAll(branchId, { search, status, page, limit });
    res.status(200).json({ success: true, data: result });
  },
);

// GET /cases/:id — Get a single case by ID
router.get(
  '/cases/:id',
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const npaCase = await caseService.findById(branchId, req.params.id as string);
    res.status(200).json({ success: true, data: npaCase });
  },
);

// PUT /cases/:id — Update a case
router.put(
  '/cases/:id',
  authorize('admin', 'manager', 'maker'),
  validate(UpdateCaseSchema),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const npaCase = await caseService.update(branchId, req.params.id as string, req.body);
    res.status(200).json({ success: true, data: npaCase });
  },
);

export default router;
