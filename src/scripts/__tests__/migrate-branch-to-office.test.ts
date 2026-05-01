import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Branch } from '../../branch/models/branch.model';
import { Office } from '../../office/models/office.model';
import { runBranchToOfficeMigration } from '../migrate-branch-to-office';

describe('migrate-branch-to-office', () => {
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
    await Branch.deleteMany({});
    await Office.deleteMany({});
  });

  it('creates one Office row per Branch with the same _id', async () => {
    const b = await Branch.create({
      bankName: 'Test Bank',
      bankType: 'Scheduled Commercial Bank',
      rbiRegNo: 'R1',
      hoAddress: 'HO Addr',
      branchName: 'BR-01',
      branchCode: 'TST0001',
      ifscCode: 'TST0000001',
      branchAddress: 'Branch Addr',
      city: 'Mumbai',
      district: 'Mumbai',
      state: 'MH',
      pinCode: '400001',
      email: 'br@bank.example',
      isActive: true,
      setupCompleted: true,
    });
    const result = await runBranchToOfficeMigration();
    expect(result.migrated).toBe(1);
    const office = await Office.findById(b._id).exec();
    expect(office).not.toBeNull();
    expect(office?.officeType).toBe('Branch');
    expect(office?.parentId).toBeNull();
    expect(office?.ancestors).toEqual([]);
    expect(office?.bankRootId.toString()).toBe(b._id.toString());
    expect(office?.bankName).toBe('Test Bank');
    expect(office?.branchCode).toBe('TST0001');
  });

  it('is idempotent — second run is a no-op', async () => {
    await Branch.create({
      bankName: 'B',
      bankType: 'Scheduled Commercial Bank',
      rbiRegNo: 'R',
      hoAddress: 'a',
      branchName: 'br',
      branchCode: 'BC1',
      ifscCode: 'IFSC1',
      branchAddress: 'a',
      city: 'x',
      district: 'x',
      state: 'x',
      pinCode: '1',
      email: 'a@b.com',
      isActive: true,
      setupCompleted: true,
    });
    const r1 = await runBranchToOfficeMigration();
    const r2 = await runBranchToOfficeMigration();
    expect(r1.migrated).toBe(1);
    expect(r2.migrated).toBe(0);
    expect(r2.skipped).toBe(1);
    expect(await Office.countDocuments({})).toBe(1);
  });

  it('preserves ssoConfigs and letterheadFileKey', async () => {
    const b = await Branch.create({
      bankName: 'B',
      bankType: 'Scheduled Commercial Bank',
      rbiRegNo: 'R',
      hoAddress: 'a',
      branchName: 'br',
      branchCode: 'BC2',
      ifscCode: 'IFSC2',
      branchAddress: 'a',
      city: 'x',
      district: 'x',
      state: 'x',
      pinCode: '1',
      email: 'a@b.com',
      isActive: true,
      setupCompleted: true,
      letterheadFileKey: 'letterheads/abc.pdf',
      ssoConfigs: [{ provider: 'google', clientId: 'cid', clientSecret: 'sec', allowedDomains: ['x.com'] }],
    });
    await runBranchToOfficeMigration();
    const office = await Office.findById(b._id).exec();
    expect(office?.letterheadFileKey).toBe('letterheads/abc.pdf');
    expect(office?.ssoConfigs).toHaveLength(1);
    expect(office?.ssoConfigs[0].provider).toBe('google');
  });
});
