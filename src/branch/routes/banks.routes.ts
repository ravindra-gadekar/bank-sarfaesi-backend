import { Router, Request, Response } from 'express';
import banksData from '../data/banks.json';

const router = Router();

router.get('/banks/registry', (_req: Request, res: Response) => {
  res.json({ success: true, data: banksData.banks });
});

export default router;
