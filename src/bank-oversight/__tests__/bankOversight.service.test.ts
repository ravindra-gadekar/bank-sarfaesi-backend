import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Office } from '../../office/models/office.model';
import { Case } from '../../case/models/case.model';
import { Notice } from '../../notice/models/notice.model';
import { bankOversightService } from '../services/bankOversight.service';

async function insertCase(branchId: mongoose.Types.ObjectId, accountNo: string) {
  await Case.collection.insertOne({
    branchId,
    accountNo,
    loanType: 'home',
    sanctionDate: new Date(),
    sanctionAmount: 1,
    npaDate: new Date(),
    status: 'active',
    borrowers: [],
    securedAssets: [],
    securityDocuments: [],
    createdBy: new mongoose.Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('bankOversightService', () => {
  let mongo: MongoMemoryServer;
  let ho: any, zonal: any, regional: any, branchA: any, branchB: any;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all([Office.deleteMany({}), Case.deleteMany({}), Notice.deleteMany({})]);

    ho = new Office({
      bankName: 'B',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'a',
      email: 'ho@b.com',
      isActive: true,
      setupCompleted: true,
    });
    ho.bankRootId = ho._id;
    await ho.save();

    zonal = await Office.create({
      bankName: 'B',
      officeType: 'Zonal',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'z@b.com',
      isActive: true,
      setupCompleted: true,
    });
    regional = await Office.create({
      bankName: 'B',
      officeType: 'Regional',
      parentId: zonal._id,
      ancestors: [ho._id, zonal._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'r@b.com',
      isActive: true,
      setupCompleted: true,
    });
    branchA = await Office.create({
      bankName: 'B',
      officeType: 'Branch',
      parentId: regional._id,
      ancestors: [ho._id, zonal._id, regional._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'a@b.com',
      isActive: true,
      setupCompleted: true,
    });
    branchB = await Office.create({
      bankName: 'B',
      officeType: 'Branch',
      parentId: regional._id,
      ancestors: [ho._id, zonal._id, regional._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'b@b.com',
      isActive: true,
      setupCompleted: true,
    });

    await insertCase(branchA._id, 'A-1');
    await insertCase(branchA._id, 'A-2');
    await insertCase(branchB._id, 'B-1');
  });

  it('getDashboardStats from HO sees all 3 cases (whole bank subtree)', async () => {
    const s = await bankOversightService.getDashboardStats(ho._id.toString());
    expect(s.totalBranches).toBe(2);
    expect(s.totalCases).toBe(3);
    expect(s.scopeLabel).toBe('Bank');
  });

  it('getDashboardStats from Regional sees same 3 (regional has both branches)', async () => {
    const s = await bankOversightService.getDashboardStats(regional._id.toString());
    expect(s.totalBranches).toBe(2);
    expect(s.totalCases).toBe(3);
    expect(s.scopeLabel).toBe('Region');
  });

  it('getDashboardStats from Branch sees own branch only', async () => {
    const s = await bankOversightService.getDashboardStats(branchA._id.toString());
    expect(s.totalBranches).toBe(1);
    expect(s.totalCases).toBe(2);
    expect(s.scopeLabel).toBe('Branch');
  });

  it('listSubtreeOffices from HO returns all 5 offices including self', async () => {
    const offices = await bankOversightService.listSubtreeOffices(ho._id.toString());
    expect(offices).toHaveLength(5);
  });

  it('listSubtreeOffices from Zonal filtered to officeType=Branch returns 2', async () => {
    const offices = await bankOversightService.listSubtreeOffices(
      zonal._id.toString(),
      'Branch',
    );
    expect(offices).toHaveLength(2);
    expect(offices.every((o) => o.officeType === 'Branch')).toBe(true);
  });

  it('isBranchInSubtree returns true for descendant branch, false for sibling-bank branch', async () => {
    const otherBank = new Office({
      bankName: 'X',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'a',
      email: 'x@x.com',
      isActive: true,
      setupCompleted: true,
    });
    otherBank.bankRootId = otherBank._id;
    await otherBank.save();
    const otherBranch = await Office.create({
      bankName: 'X',
      officeType: 'Branch',
      parentId: otherBank._id,
      ancestors: [otherBank._id],
      bankRootId: otherBank._id,
      address: 'a',
      email: 'xb@x.com',
      isActive: true,
      setupCompleted: true,
    });

    expect(
      await bankOversightService.isBranchInSubtree(ho._id.toString(), branchA._id.toString()),
    ).toBe(true);
    expect(
      await bankOversightService.isBranchInSubtree(
        ho._id.toString(),
        otherBranch._id.toString(),
      ),
    ).toBe(false);
  });

  describe('SIBLING ISOLATION — same bank, different sub-tree', () => {
    let zoneB: any, regionalB: any, branchInZoneB: any;

    beforeEach(async () => {
      zoneB = await Office.create({
        bankName: 'B',
        officeType: 'Zonal',
        parentId: ho._id,
        ancestors: [ho._id],
        bankRootId: ho._id,
        address: 'a',
        email: 'zB@b.com',
        isActive: true,
        setupCompleted: true,
      });
      regionalB = await Office.create({
        bankName: 'B',
        officeType: 'Regional',
        parentId: zoneB._id,
        ancestors: [ho._id, zoneB._id],
        bankRootId: ho._id,
        address: 'a',
        email: 'rB@b.com',
        isActive: true,
        setupCompleted: true,
      });
      branchInZoneB = await Office.create({
        bankName: 'B',
        officeType: 'Branch',
        parentId: regionalB._id,
        ancestors: [ho._id, zoneB._id, regionalB._id],
        bankRootId: ho._id,
        address: 'a',
        email: 'brB@b.com',
        isActive: true,
        setupCompleted: true,
      });
      await insertCase(branchInZoneB._id, 'B-zoneB');
    });

    it('Zonal at zone-A getDashboardStats does NOT count cases from zone-B', async () => {
      const s = await bankOversightService.getDashboardStats(zonal._id.toString());
      expect(s.totalCases).toBe(3);
      expect(s.totalCases).not.toBe(4);
      expect(s.totalBranches).toBe(2);
    });

    it('Zonal at zone-A listSubtreeOffices does NOT include zone-B or its descendants', async () => {
      const offices = await bankOversightService.listSubtreeOffices(zonal._id.toString());
      const ids = offices.map((o) => o._id.toString());
      expect(ids).not.toContain(zoneB._id.toString());
      expect(ids).not.toContain(regionalB._id.toString());
      expect(ids).not.toContain(branchInZoneB._id.toString());
    });

    it('Zonal at zone-A isBranchInSubtree(branchInZoneB) returns false (sibling-zone branch)', async () => {
      expect(
        await bankOversightService.isBranchInSubtree(
          zonal._id.toString(),
          branchInZoneB._id.toString(),
        ),
      ).toBe(false);
    });

    it('Regional at zone-A.regional isBranchInSubtree(sibling-zone branch) returns false', async () => {
      expect(
        await bankOversightService.isBranchInSubtree(
          regional._id.toString(),
          branchInZoneB._id.toString(),
        ),
      ).toBe(false);
    });

    it('HO sees ALL branches across zones (zone-A + zone-B) — only HO has bank-wide visibility', async () => {
      const s = await bankOversightService.getDashboardStats(ho._id.toString());
      expect(s.totalCases).toBe(4);
      expect(s.totalBranches).toBe(3);
    });
  });
});
