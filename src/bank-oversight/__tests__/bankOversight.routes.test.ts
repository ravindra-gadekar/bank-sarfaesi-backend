import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Office } from '../../office/models/office.model';
import { User } from '../../user/models/user.model';
import { Case } from '../../case/models/case.model';
import { Notice } from '../../notice/models/notice.model';
import { jwtService } from '../../auth/services/jwt.service';

async function bankToken(user: any, office: any) {
  return jwtService.signAccessToken({
    email: user.email,
    userId: user._id.toString(),
    branchId: user.officeId?.toString(),
    role: user.bankRole,
    userKind: 'bank',
    officeId: office._id.toString(),
    officeType: office.officeType,
    officeAncestors: office.ancestors.map((a: any) => a.toString()),
    bankRootId: office.bankRootId.toString(),
  });
}

async function appToken() {
  const u = await User.create({
    userKind: 'app',
    appRole: 'superadmin',
    name: 'S',
    email: 's@app.com',
    authProvider: 'otp',
    isActive: true,
  });
  return jwtService.signAccessToken({
    email: u.email,
    userId: u._id.toString(),
    userKind: 'app',
    role: 'superadmin',
  });
}

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

describe('Bank oversight routes', () => {
  let mongo: MongoMemoryServer;
  let ho: any, branch: any, otherHo: any, otherBranch: any;
  let hoUser: any, branchUser: any;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Promise.all([
      Office.deleteMany({}),
      User.deleteMany({}),
      Case.deleteMany({}),
      Notice.deleteMany({}),
    ]);

    ho = new Office({
      bankName: 'A',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'a',
      email: 'ho@a.com',
      isActive: true,
      setupCompleted: true,
    });
    ho.bankRootId = ho._id;
    await ho.save();
    branch = await Office.create({
      bankName: 'A',
      officeType: 'Branch',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'br@a.com',
      isActive: true,
      setupCompleted: true,
    });

    otherHo = new Office({
      bankName: 'B',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'a',
      email: 'ho@b.com',
      isActive: true,
      setupCompleted: true,
    });
    otherHo.bankRootId = otherHo._id;
    await otherHo.save();
    otherBranch = await Office.create({
      bankName: 'B',
      officeType: 'Branch',
      parentId: otherHo._id,
      ancestors: [otherHo._id],
      bankRootId: otherHo._id,
      address: 'a',
      email: 'br@b.com',
      isActive: true,
      setupCompleted: true,
    });

    hoUser = await User.create({
      userKind: 'bank',
      officeId: ho._id,
      name: 'HO',
      email: 'ho@a.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
    branchUser = await User.create({
      userKind: 'bank',
      officeId: branch._id,
      name: 'BR',
      email: 'br@a.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });

    await insertCase(branch._id, 'X-1');
  });

  it('HO user GET /bank/dashboard-stats returns subtree counts', async () => {
    const t = await bankToken(hoUser, ho);
    const res = await request(app)
      .get('/api/bank/dashboard-stats')
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(200);
    expect(res.body.data.scopeLabel).toBe('Bank');
    expect(res.body.data.totalCases).toBe(1);
  });

  it('Branch user GET /bank/dashboard-stats returns Branch scope', async () => {
    const t = await bankToken(branchUser, branch);
    const res = await request(app)
      .get('/api/bank/dashboard-stats')
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(200);
    expect(res.body.data.scopeLabel).toBe('Branch');
  });

  it('App user GET /bank/dashboard-stats returns 403', async () => {
    const t = await appToken();
    const res = await request(app)
      .get('/api/bank/dashboard-stats')
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(403);
  });

  it('HO user GET /bank/branches/:branchId/cases for own bank branch returns 200', async () => {
    const t = await bankToken(hoUser, ho);
    const res = await request(app)
      .get(`/api/bank/branches/${branch._id}/cases`)
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('HO user GET /bank/branches/:otherBranch/cases (different bank) returns 403', async () => {
    const t = await bankToken(hoUser, ho);
    const res = await request(app)
      .get(`/api/bank/branches/${otherBranch._id}/cases`)
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(403);
  });

  it('Branch user GET /bank/branches/:otherBranchSameBank/cases returns 403', async () => {
    const sibling = await Office.create({
      bankName: 'A',
      officeType: 'Branch',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 's@a.com',
      isActive: true,
      setupCompleted: true,
    });
    const t = await bankToken(branchUser, branch);
    const res = await request(app)
      .get(`/api/bank/branches/${sibling._id}/cases`)
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(403);
  });

  it('Zonal user CANNOT GET /bank/branches/:branchInSiblingZone/cases', async () => {
    const zoneA = await Office.create({
      bankName: 'A',
      officeType: 'Zonal',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'zA@a.com',
      isActive: true,
      setupCompleted: true,
    });
    const zoneB = await Office.create({
      bankName: 'A',
      officeType: 'Zonal',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'zB@a.com',
      isActive: true,
      setupCompleted: true,
    });
    const branchUnderZoneB = await Office.create({
      bankName: 'A',
      officeType: 'Branch',
      parentId: zoneB._id,
      ancestors: [ho._id, zoneB._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'brB@a.com',
      isActive: true,
      setupCompleted: true,
    });

    const zoneAUser = await User.create({
      userKind: 'bank',
      officeId: zoneA._id,
      name: 'ZA',
      email: 'za@a.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
    const t = await bankToken(zoneAUser, zoneA);

    const res = await request(app)
      .get(`/api/bank/branches/${branchUnderZoneB._id}/cases`)
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(403);
  });

  it('Zonal user dashboard-stats does NOT include sibling-zone branches', async () => {
    const zoneA = await Office.create({
      bankName: 'A',
      officeType: 'Zonal',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'zA@a.com',
      isActive: true,
      setupCompleted: true,
    });
    const zoneB = await Office.create({
      bankName: 'A',
      officeType: 'Zonal',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'zB@a.com',
      isActive: true,
      setupCompleted: true,
    });
    const branchUnderA = await Office.create({
      bankName: 'A',
      officeType: 'Branch',
      parentId: zoneA._id,
      ancestors: [ho._id, zoneA._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'brA@a.com',
      isActive: true,
      setupCompleted: true,
    });
    const branchUnderB = await Office.create({
      bankName: 'A',
      officeType: 'Branch',
      parentId: zoneB._id,
      ancestors: [ho._id, zoneB._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'brB@a.com',
      isActive: true,
      setupCompleted: true,
    });

    await insertCase(branchUnderA._id, 'A');
    await insertCase(branchUnderB._id, 'B');

    const zoneAUser = await User.create({
      userKind: 'bank',
      officeId: zoneA._id,
      name: 'ZA',
      email: 'za2@a.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
    const t = await bankToken(zoneAUser, zoneA);

    const res = await request(app)
      .get('/api/bank/dashboard-stats')
      .set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(200);
    expect(res.body.data.scopeLabel).toBe('Zone');
    expect(res.body.data.totalBranches).toBe(1);
    expect(res.body.data.totalCases).toBe(1);
  });
});
