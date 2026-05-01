import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { officeService } from '../services/office.service';
import { Office } from '../models/office.model';

describe('officeService', () => {
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  afterEach(async () => {
    await Office.deleteMany({});
  });

  describe('createOffice', () => {
    it('creates a self-rooted HO with ancestors=[]', async () => {
      const ho = await officeService.createOffice({
        bankName: 'Test Bank',
        officeType: 'HO',
        address: 'HO Address',
        contact: '+91 0000',
        email: 'ho@x.com',
      });
      expect(ho.officeType).toBe('HO');
      expect(ho.parentId).toBeNull();
      expect(ho.ancestors).toEqual([]);
      expect(ho.bankRootId.toString()).toBe(ho._id.toString());
    });

    it('creates a Zonal under an HO with ancestors=[HO]', async () => {
      const ho = await officeService.createOffice({
        bankName: 'Test Bank',
        officeType: 'HO',
        address: 'HO',
        contact: 'x',
        email: 'ho@x.com',
      });
      const zonal = await officeService.createOffice({
        bankName: 'Test Bank',
        officeType: 'Zonal',
        address: 'Zonal',
        contact: 'x',
        email: 'z@x.com',
        parentOfficeId: ho._id.toString(),
      });
      expect(zonal.parentId?.toString()).toBe(ho._id.toString());
      expect(zonal.ancestors.map((a: any) => a.toString())).toEqual([ho._id.toString()]);
      expect(zonal.bankRootId.toString()).toBe(ho._id.toString());
    });

    it('creates a Branch under HO->Zonal->Regional with 3 ancestors in order', async () => {
      const ho = await officeService.createOffice({ bankName: 'B', officeType: 'HO', address: 'a', contact: 'c', email: 'e@x.com' });
      const z = await officeService.createOffice({ bankName: 'B', officeType: 'Zonal', address: 'a', contact: 'c', email: 'z@x.com', parentOfficeId: ho._id.toString() });
      const r = await officeService.createOffice({ bankName: 'B', officeType: 'Regional', address: 'a', contact: 'c', email: 'r@x.com', parentOfficeId: z._id.toString() });
      const br = await officeService.createOffice({ bankName: 'B', officeType: 'Branch', address: 'a', contact: 'c', email: 'br@x.com', parentOfficeId: r._id.toString() });
      expect(br.ancestors.map((a: any) => a.toString())).toEqual([ho._id.toString(), z._id.toString(), r._id.toString()]);
      expect(br.bankRootId.toString()).toBe(ho._id.toString());
    });

    it('rejects parent of equal or deeper level', async () => {
      const ho = await officeService.createOffice({ bankName: 'B', officeType: 'HO', address: 'a', contact: 'c', email: 'e@x.com' });
      await expect(
        officeService.createOffice({ bankName: 'B', officeType: 'HO', address: 'a', contact: 'c', email: 'e2@x.com', parentOfficeId: ho._id.toString() }),
      ).rejects.toThrow(/cannot have a parent|cannot be a child/i);
    });
  });

  describe('isAncestorOrSelf', () => {
    it('returns true when targetId equals candidateAncestorId', async () => {
      const ho = await officeService.createOffice({ bankName: 'B', officeType: 'HO', address: 'a', contact: 'c', email: 'e@x.com' });
      expect(await officeService.isAncestorOrSelf(ho._id.toString(), ho._id.toString())).toBe(true);
    });

    it('returns true for an ancestor in the chain', async () => {
      const ho = await officeService.createOffice({ bankName: 'B', officeType: 'HO', address: 'a', contact: 'c', email: 'e@x.com' });
      const z = await officeService.createOffice({ bankName: 'B', officeType: 'Zonal', address: 'a', contact: 'c', email: 'z@x.com', parentOfficeId: ho._id.toString() });
      expect(await officeService.isAncestorOrSelf(ho._id.toString(), z._id.toString())).toBe(true);
    });

    it('returns false for a sibling', async () => {
      const ho = await officeService.createOffice({ bankName: 'B', officeType: 'HO', address: 'a', contact: 'c', email: 'e@x.com' });
      const z1 = await officeService.createOffice({ bankName: 'B', officeType: 'Zonal', address: 'a', contact: 'c', email: 'z1@x.com', parentOfficeId: ho._id.toString() });
      const z2 = await officeService.createOffice({ bankName: 'B', officeType: 'Zonal', address: 'a', contact: 'c', email: 'z2@x.com', parentOfficeId: ho._id.toString() });
      expect(await officeService.isAncestorOrSelf(z1._id.toString(), z2._id.toString())).toBe(false);
    });
  });
});
