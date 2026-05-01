import { Agenda, Job } from 'agenda';
import archiver from 'archiver';
import { Writable } from 'stream';
import { Notice } from '../../notice/models/notice.model';
import { Case } from '../../case/models/case.model';
import { Branch } from '../../branch/models/branch.model';
import { noticeService } from '../../notice/services/notice.service';
import { storageUploadService } from './storageUpload.service';
import { documentGeneratorService, GenerationContext } from './documentGenerator.service';
import { ApiError } from '../../common/utils/apiError';
import { getAgenda } from '../../config/agenda';

const GENERATE_DOCUMENTS_JOB = 'generate-notice-documents';

interface GenerateDocsData {
  branchId: string;
  noticeId: string;
}

function buildContext(
  notice: { noticeType: string; fields: Record<string, unknown>; recipients: Array<{ name: string; address: string; type: string }> },
  branch: { bankName: string; branchName: string; branchAddress: string; city: string; state: string; letterheadFileKey?: string; ifscCode: string; phone?: string; email: string },
  caseDoc: { accountNo: string; loanType: string; sanctionDate: Date; sanctionAmount: number; npaDate: Date; securedAssets: Array<{ assetType: string; description: string; surveyNo?: string; area?: string; district?: string; state?: string }>; securityDocuments: Array<{ documentType: string; date: Date }> },
): GenerationContext {
  return {
    notice: {
      noticeType: notice.noticeType,
      fields: notice.fields,
      recipients: notice.recipients,
    },
    branch: {
      bankName: branch.bankName,
      branchName: branch.branchName,
      branchAddress: branch.branchAddress,
      city: branch.city,
      state: branch.state,
      letterheadFileKey: branch.letterheadFileKey,
      ifscCode: branch.ifscCode,
      phone: branch.phone,
      email: branch.email,
    },
    caseData: {
      accountNo: caseDoc.accountNo,
      loanType: caseDoc.loanType,
      sanctionDate: caseDoc.sanctionDate,
      sanctionAmount: caseDoc.sanctionAmount,
      npaDate: caseDoc.npaDate,
      securedAssets: caseDoc.securedAssets,
      securityDocuments: caseDoc.securityDocuments,
    },
  };
}

function createZipBuffer(files: Array<{ name: string; buffer: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const converter = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', reject);
    converter.on('finish', () => resolve(Buffer.concat(chunks)));

    archive.pipe(converter);
    for (const file of files) {
      archive.append(file.buffer, { name: file.name });
    }
    void archive.finalize();
  });
}

async function processGeneration(branchId: string, noticeId: string): Promise<void> {
  const notice = await Notice.findOne({ branchId, _id: noticeId }).exec();
  if (!notice) throw ApiError.notFound('Notice not found');

  const caseDoc = await Case.findOne({ branchId, _id: notice.caseId }).exec();
  if (!caseDoc) throw ApiError.notFound('Case not found');

  const branch = await Branch.findById(notice.branchId).exec();
  if (!branch) throw ApiError.notFound('Branch not found');

  const context = buildContext(
    { noticeType: notice.noticeType, fields: notice.fields as Record<string, unknown>, recipients: notice.recipients },
    branch,
    caseDoc,
  );

  // Use case borrowers as recipients
  const recipients = caseDoc.borrowers.map((b) => ({
    name: b.name,
    address: b.address,
    type: b.type,
  }));

  const timestamp = Date.now();
  const zipFiles: Array<{ name: string; buffer: Buffer }> = [];

  for (const recipient of recipients) {
    const sanitizedName = recipient.name.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Generate HTML based on notice type
    let html: string;
    let docxBuffer: Buffer;

    switch (notice.noticeType) {
      case 'possession_13_4':
        html = documentGeneratorService.generatePossessionNoticeHtml(context, recipient.name, recipient.address);
        docxBuffer = await documentGeneratorService.generatePossessionNoticeDocx(context, recipient.name, recipient.address);
        break;
      case 'sale_auction':
        html = documentGeneratorService.generateSaleAuctionNoticeHtml(context, recipient.name, recipient.address);
        docxBuffer = await documentGeneratorService.generateSaleAuctionNoticeDocx(context, recipient.name, recipient.address);
        break;
      default: // demand_13_2
        html = documentGeneratorService.generateDemandNoticeHtml(context, recipient.name, recipient.address);
        docxBuffer = await documentGeneratorService.generateDemandNoticeDocx(context, recipient.name, recipient.address);
        break;
    }

    const docxKey = `notices/${noticeId}/${sanitizedName}_${timestamp}.docx`;
    const { sha256: docxSha } = await storageUploadService.uploadWithHash(
      docxKey,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    await noticeService.addGeneratedDoc(branchId, noticeId, {
      format: 'docx',
      fileKey: docxKey,
      sha256: docxSha,
      recipientName: recipient.name,
      generatedAt: new Date(),
    });
    zipFiles.push({ name: `${sanitizedName}.docx`, buffer: docxBuffer });

    // Generate PDF from HTML
    const pdfBuffer = await documentGeneratorService.generatePdfFromHtml(html);
    const pdfKey = `notices/${noticeId}/${sanitizedName}_${timestamp}.pdf`;
    const { sha256: pdfSha } = await storageUploadService.uploadWithHash(
      pdfKey,
      pdfBuffer,
      'application/pdf',
    );
    await noticeService.addGeneratedDoc(branchId, noticeId, {
      format: 'pdf',
      fileKey: pdfKey,
      sha256: pdfSha,
      recipientName: recipient.name,
      generatedAt: new Date(),
    });
    zipFiles.push({ name: `${sanitizedName}.pdf`, buffer: pdfBuffer });
  }

  // Bundle all documents into a ZIP if there are multiple recipients or just for convenience
  if (zipFiles.length > 0) {
    const zipBuffer = await createZipBuffer(zipFiles);
    const zipKey = `notices/${noticeId}/all_documents_${timestamp}.zip`;
    const { sha256: zipSha } = await storageUploadService.uploadWithHash(
      zipKey,
      zipBuffer,
      'application/zip',
    );
    await noticeService.addGeneratedDoc(branchId, noticeId, {
      format: 'zip',
      fileKey: zipKey,
      sha256: zipSha,
      generatedAt: new Date(),
    });
  }

  // Transition notice to final status
  await noticeService.updateStatus(branchId, noticeId, 'final');
}

/**
 * Register the document generation job handler with Agenda.
 * Called once during server bootstrap.
 */
export function registerDocumentJobs(agenda: Agenda): void {
  agenda.define<GenerateDocsData>(
    GENERATE_DOCUMENTS_JOB,
    async (job: Job<GenerateDocsData>) => {
      const { branchId, noticeId } = job.attrs.data;
      await processGeneration(branchId, noticeId);
    },
  );
}

const documentQueueService = {
  enqueueGeneration(branchId: string, noticeId: string): void {
    const agenda = getAgenda();
    void agenda.now<GenerateDocsData>(GENERATE_DOCUMENTS_JOB, { branchId, noticeId });
  },

  async getJobStatus(noticeId: string): Promise<{ status: string; failReason?: string }> {
    const agenda = getAgenda();
    const jobs = await agenda.jobs(
      { name: GENERATE_DOCUMENTS_JOB, 'data.noticeId': noticeId },
      { _id: -1 } as Record<string, unknown>,
      1,
    );

    if (jobs.length === 0) return { status: 'unknown' };

    const job = jobs[0];
    if (job.attrs.failedAt) return { status: 'failed', failReason: job.attrs.failReason };
    if (job.attrs.lastFinishedAt) return { status: 'completed' };
    if (job.attrs.lockedAt) return { status: 'processing' };
    return { status: 'queued' };
  },
};

export { documentQueueService };
