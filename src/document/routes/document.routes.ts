import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authenticate } from '../../common/middleware/auth.middleware';
import { noticeService } from '../../notice/services/notice.service';
import { documentQueueService } from '../services/documentQueue.service';
import { ApiError } from '../../common/utils/apiError';
import { env } from '../../config/env';

const router = Router();

/**
 * GET /notices/:id/download/:docIndex
 * Download a specific generated document by index.
 */
router.get(
  '/notices/:id/download/:docIndex',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const branchId = req.context.branchId as string;
    const noticeId = req.params.id as string;
    const docIndex = req.params.docIndex as string;

    const idx = parseInt(docIndex, 10);
    if (isNaN(idx) || idx < 0) {
      throw ApiError.badRequest('Invalid document index');
    }

    const notice = await noticeService.findById(branchId, noticeId);
    if (!notice) {
      throw ApiError.notFound('Notice not found');
    }

    if (idx >= notice.generatedDocs.length) {
      throw ApiError.notFound('Document not found at the given index');
    }

    const doc = notice.generatedDocs[idx];

    // For local storage, read file and send it directly
    const filePath = path.join(path.resolve(env.UPLOADS_DIR), doc.fileKey);

    try {
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(doc.fileKey).toLowerCase();

      const contentTypeMap: Record<string, string> = {
        '.html': 'text/html',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };

      const contentType = contentTypeMap[ext] ?? 'application/octet-stream';
      const filename = path.basename(doc.fileKey);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileBuffer);
    } catch {
      throw ApiError.notFound('File not found on disk');
    }
  },
);

/**
 * GET /notices/:id/generation-status
 * Returns the document generation job status.
 */
router.get(
  '/notices/:id/generation-status',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const branchId = req.context.branchId as string;
    const noticeId = req.params.id as string;

    // Verify the notice belongs to this branch
    const notice = await noticeService.findById(branchId, noticeId);
    if (!notice) {
      throw ApiError.notFound('Notice not found');
    }

    const jobStatus = await documentQueueService.getJobStatus(noticeId);

    res.json({
      noticeId,
      status: jobStatus.status,
      failReason: jobStatus.failReason,
    });
  },
);

/**
 * GET /notices/:id/download-all
 * Download the ZIP bundle of all generated documents.
 */
router.get(
  '/notices/:id/download-all',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const branchId = req.context.branchId as string;
    const noticeId = req.params.id as string;

    const notice = await noticeService.findById(branchId, noticeId);
    if (!notice) {
      throw ApiError.notFound('Notice not found');
    }

    const zipDoc = notice.generatedDocs.find((d) => d.format === 'zip');
    if (!zipDoc) {
      throw ApiError.notFound('ZIP bundle not yet generated');
    }

    const filePath = path.join(path.resolve(env.UPLOADS_DIR), zipDoc.fileKey);

    try {
      const fileBuffer = await fs.readFile(filePath);
      const filename = path.basename(zipDoc.fileKey);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileBuffer);
    } catch {
      throw ApiError.notFound('ZIP file not found on disk');
    }
  },
);

/**
 * POST /notices/:id/regenerate-documents
 * Clear old generated docs and re-trigger document generation.
 */
router.post(
  '/notices/:id/regenerate-documents',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const branchId = req.context.branchId as string;
    const noticeId = req.params.id as string;

    const notice = await noticeService.findById(branchId, noticeId);
    if (!notice) {
      throw ApiError.notFound('Notice not found');
    }

    if (notice.status !== 'approved' && notice.status !== 'final') {
      throw ApiError.badRequest('Documents can only be regenerated for approved or final notices');
    }

    // Delete entire notice folder from disk (removes all old files including orphans)
    const noticeDir = path.join(path.resolve(env.UPLOADS_DIR), 'notices', noticeId);
    await fs.rm(noticeDir, { recursive: true, force: true }).catch(() => {});

    // Clear old generated docs and re-queue
    await noticeService.clearGeneratedDocs(branchId, noticeId);
    await noticeService.updateStatus(branchId, noticeId, 'approved');
    documentQueueService.enqueueGeneration(branchId, noticeId);

    res.json({ success: true, message: 'Document regeneration queued' });
  },
);

export default router;
