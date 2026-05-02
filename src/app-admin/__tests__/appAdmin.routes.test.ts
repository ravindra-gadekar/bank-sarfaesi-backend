import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Office } from '../../office/models/office.model';
import { User } from '../../user/models/user.model';
import { Invite } from '../../user/models/invite.model';
import { jwtService } from '../../auth/services/jwt.service';

async function appToken(role: 'superadmin' | 'admin' | 'support' = 'superadmin') {
  const u = await User.create({
    userKind: 'app',
    appRole: role,
    name: role,
    email: `${role}@app.com`,
    authProvider: 'otp',
    isActive: true,
  });
  return jwtService.signAccessToken({
    email: u.email,
    userId: u._id.toString(),
    userKind: 'app',
    role,
  });
}

async function bankToken() {
  const office = new Office({
    bankName: 'B',
    officeType: 'HO',
    parentId: null,
    ancestors: [],
    address: 'a',
    email: 'ho@b.com',
    isActive: true,
    setupCompleted: true,
  });
  office.bankRootId = office._id;
  await office.save();
  const u = await User.create({
    userKind: 'bank',
    officeId: office._id,
    name: 'B',
    email: 'b@b.com',
    bankRole: 'admin',
    authProvider: 'otp',
    isActive: true,
  });
  return jwtService.signAccessToken({
    email: u.email,
    userId: u._id.toString(),
    userKind: 'bank',
    officeId: office._id.toString(),
    officeType: 'HO',
    officeAncestors: [],
    bankRootId: office._id.toString(),
    branchId: office._id.toString(),
    role: 'admin',
  });
}

describe('GET /api/app/banks', () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Promise.all([Office.deleteMany({}), User.deleteMany({}), Invite.deleteMany({})]);
  });

  it('returns list of HO offices for app user', async () => {
    const t = await appToken('superadmin');
    const ho = new Office({
      bankName: 'Bank A',
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
    const res = await request(app).get('/api/app/banks').set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].bankName).toBe('Bank A');
  });

  it('returns 403 for bank user', async () => {
    const t = await bankToken();
    const res = await request(app).get('/api/app/banks').set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/app/stats', () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Promise.all([Office.deleteMany({}), User.deleteMany({}), Invite.deleteMany({})]);
  });

  it('returns aggregate counts for app user', async () => {
    const t = await appToken('superadmin');
    const res = await request(app).get('/api/app/stats').set('Cookie', [`accessToken=${t}`]);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        totalBanks: expect.any(Number),
        totalOffices: expect.any(Number),
        totalAppUsers: expect.any(Number),
        totalBankUsers: expect.any(Number),
      }),
    );
  });
});
