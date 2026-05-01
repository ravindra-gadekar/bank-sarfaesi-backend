import fs from 'fs/promises';
import path from 'path';
import { env } from './env';

export interface StorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

class LocalStorageService implements StorageService {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(env.UPLOADS_DIR);
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const filePath = path.join(this.baseDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async getUrl(key: string): Promise<string> {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.baseDir, key);
    await fs.unlink(filePath);
  }
}

class S3StorageService implements StorageService {
  async upload(_key: string, _buffer: Buffer, _contentType: string): Promise<string> {
    throw new Error('S3 not configured for local development');
  }

  async getUrl(_key: string): Promise<string> {
    throw new Error('S3 not configured for local development');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('S3 not configured for local development');
  }
}

export function createStorageService(): StorageService {
  if (env.STORAGE_MODE === 'local') {
    return new LocalStorageService();
  }
  return new S3StorageService();
}

export const storageService = createStorageService();
