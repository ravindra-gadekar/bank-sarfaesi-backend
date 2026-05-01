import { Router, Request, Response } from 'express';
import { chatFlowService } from '../services/chatFlow.service';
import { authenticate } from '../../common/middleware/auth.middleware';
import { authorize } from '../../common/middleware/rbac.middleware';
import { ApiError } from '../../common/utils/apiError';

const router = Router();

// ── Admin endpoints (MUST be before :noticeType wildcard) ───

// GET /chat-flow/configs/all — List all configs (branch + global)
router.get(
  '/chat-flow/configs/all',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const configs = await chatFlowService.listConfigs(branchId);
    res.status(200).json({ success: true, data: configs });
  },
);

// GET /chat-flow/configs/history/:noticeType — Version history for a notice type
router.get(
  '/chat-flow/configs/history/:noticeType',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const versions = await chatFlowService.getVersionHistory(branchId, req.params.noticeType as string);
    res.status(200).json({ success: true, data: versions });
  },
);

// GET /chat-flow/configs/:id — Single config detail
router.get(
  '/chat-flow/configs/:id',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const config = await chatFlowService.getConfigById(branchId, req.params.id as string);
    res.status(200).json({ success: true, data: config });
  },
);

// ── Public (authenticated) ──────────────────────────────

// GET /chat-flow/:noticeType — Active config for the user's branch (used by chat engine)
router.get(
  '/chat-flow/:noticeType',
  authenticate,
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const config = await chatFlowService.getActiveConfig(branchId, req.params.noticeType as string);
    res.status(200).json({ success: true, data: config });
  },
);

// POST /chat-flow/configs/clone — Clone global default to branch
router.post(
  '/chat-flow/configs/clone',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const { noticeType } = req.body as { noticeType: string };
    if (!noticeType) throw ApiError.badRequest('noticeType is required.');

    const config = await chatFlowService.cloneFromDefault(branchId, noticeType);
    res.status(201).json({ success: true, data: config });
  },
);

// PUT /chat-flow/configs/:id — Update config (creates new version)
router.put(
  '/chat-flow/configs/:id',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const { questionFlow, keywordAnswerMap } = req.body;
    const config = await chatFlowService.updateConfig(branchId, req.params.id as string, {
      questionFlow,
      keywordAnswerMap,
    });
    res.status(200).json({ success: true, data: config });
  },
);

// POST /chat-flow/configs/:id/activate — Activate a specific version
router.post(
  '/chat-flow/configs/:id/activate',
  authenticate,
  authorize('admin', 'manager'),
  async (req: Request, res: Response) => {
    const { branchId } = req.context;
    if (!branchId) throw ApiError.unauthorized();

    const config = await chatFlowService.activateConfig(branchId, req.params.id as string);
    res.status(200).json({ success: true, data: config });
  },
);

export default router;
