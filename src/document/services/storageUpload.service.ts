import crypto from 'crypto';
import { storageService } from '../../config/storage';

const storageUploadService = {
  async uploadWithHash(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ fileKey: string; sha256: string }> {
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileKey = await storageService.upload(key, buffer, contentType);
    return { fileKey, sha256 };
  },
};

export { storageUploadService };
