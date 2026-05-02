import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Office, OFFICE_TYPES } from '../models/office.model';

describe('Office model', () => {
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

  it('persists an HO office with self-rooted bankRootId and empty ancestors', async () => {
    const ho = new Office({
      bankName: 'Test Bank',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: '1 Main St, Mumbai',
      email: 'ho@testbank.example',
      isActive: true,
      setupCompleted: true,
    });
    ho.bankRootId = ho._id;
    await ho.save();
    expect(ho.officeType).toBe('HO');
    expect(ho.parentId).toBeNull();
    expect(ho.ancestors).toEqual([]);
    expect(ho.bankRootId.toString()).toBe(ho._id.toString());
  });

  it('rejects an unknown officeType', async () => {
    const office = new Office({
      bankName: 'Bad Bank',
      officeType: 'NotAnOfficeType' as any,
      parentId: null,
      ancestors: [],
      address: 'x',
      email: 'x@y.z',
    });
    office.bankRootId = office._id;
    await expect(office.save()).rejects.toThrow();
  });

  it('exposes OFFICE_TYPES tuple', () => {
    expect(OFFICE_TYPES).toEqual(['HO', 'Zonal', 'Regional', 'Branch']);
  });
});
