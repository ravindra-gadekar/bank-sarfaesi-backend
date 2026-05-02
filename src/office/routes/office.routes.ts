import { Router, Request, Response, NextFunction } from 'express';
import { officeService } from '../services/office.service';
import { authenticate } from '../../common/middleware/auth.middleware';
import { ApiError } from '../../common/utils/apiError';
import { IOffice } from '../models/office.model';

const router = Router();

function toResponse(office: IOffice) {
  return {
    id: office._id.toString(),
    bankName: office.bankName,
    bankLogoKey: office.bankLogoKey ?? null,
    officeType: office.officeType,
    parentId: office.parentId ? office.parentId.toString() : null,
    ancestors: office.ancestors.map((a) => a.toString()),
    bankRootId: office.bankRootId.toString(),
    branchName: office.branchName ?? null,
    address: office.address,
    email: office.email,
  };
}

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };

router.get(
  '/offices/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const officeId = req.context.officeId ?? req.context.branchId;
    if (!officeId) throw ApiError.unauthorized('No office in session');
    const office = await officeService.findById(officeId);
    if (!office) throw ApiError.notFound('Office not found');
    res.json({ success: true, data: toResponse(office) });
  }),
);

router.get(
  '/offices/subtree/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const branches = await officeService.findLeafBranches(String(req.params.id));
    res.json({ success: true, data: branches.map(toResponse) });
  }),
);

router.get(
  '/offices/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const office = await officeService.findById(String(req.params.id));
    if (!office) throw ApiError.notFound('Office not found');
    res.json({ success: true, data: toResponse(office) });
  }),
);

export default router;
