import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Office } from '../../office/models/office.model';
import { User } from '../models/user.model';
import { Invite } from '../models/invite.model';
import { jwtService } from '../../auth/services/jwt.service';

async function tokenFor(user: any) {
  const office = user.officeId ? await Office.findById(user.officeId).exec() : null;
  return jwtService.signAccessToken({
    email: user.email,
    userId: user._id.toString(),
    branchId: user.officeId?.toString(),
    role: user.bankRole ?? user.appRole,
    userKind: user.userKind,
    officeId: user.officeId?.toString(),
    officeType: office?.officeType,
    officeAncestors: office?.ancestors.map((a: any) => a.toString()) ?? [],
    bankRootId: office?.bankRootId?.toString(),
  });
}

describe('Invite routes — permission matrix', () => {
  let mongo: MongoMemoryServer;
  let ho: any, branch: any, otherHo: any;
  let superadmin: any, hoUser: any, branchUser: any;

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

    superadmin = await User.create({
      userKind: 'app',
      name: 'S',
      email: 'super@app.com',
      appRole: 'superadmin',
      authProvider: 'otp',
      isActive: true,
    });
    hoUser = await User.create({
      userKind: 'bank',
      officeId: ho._id,
      name: 'HO',
      email: 'hou@a.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
    branchUser = await User.create({
      userKind: 'bank',
      officeId: branch._id,
      name: 'BR',
      email: 'bru@a.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
  });

  it('superadmin → POST /invites/app: 201', async () => {
    const t = await tokenFor(superadmin);
    const r = await request(app)
      .post('/api/invites/app')
      .set('Cookie', [`accessToken=${t}`])
      .send({ email: 'x@app.com', appRole: 'admin' });
    expect(r.status).toBe(201);
  });

  it('hoUser → POST /invites/app: 403', async () => {
    const t = await tokenFor(hoUser);
    const r = await request(app)
      .post('/api/invites/app')
      .set('Cookie', [`accessToken=${t}`])
      .send({ email: 'x@app.com', appRole: 'admin' });
    expect(r.status).toBe(403);
  });

  it('hoUser → POST /invites/bank for branch in same bank: 201', async () => {
    const t = await tokenFor(hoUser);
    const r = await request(app)
      .post('/api/invites/bank')
      .set('Cookie', [`accessToken=${t}`])
      .send({ email: 'new@a.com', bankRole: 'maker', targetOfficeId: branch._id.toString() });
    expect(r.status).toBe(201);
  });

  it('branchUser → POST /invites/bank for HO: 403', async () => {
    const t = await tokenFor(branchUser);
    const r = await request(app)
      .post('/api/invites/bank')
      .set('Cookie', [`accessToken=${t}`])
      .send({ email: 'x@a.com', bankRole: 'admin', targetOfficeId: ho._id.toString() });
    expect(r.status).toBe(403);
  });

  it('hoUser → POST /invites/bank for other-bank office: 403', async () => {
    const t = await tokenFor(hoUser);
    const r = await request(app)
      .post('/api/invites/bank')
      .set('Cookie', [`accessToken=${t}`])
      .send({ email: 'x@b.com', bankRole: 'admin', targetOfficeId: otherHo._id.toString() });
    expect(r.status).toBe(403);
  });

  it('superadmin → POST /invites/bank for any office: 201', async () => {
    const t = await tokenFor(superadmin);
    const r = await request(app)
      .post('/api/invites/bank')
      .set('Cookie', [`accessToken=${t}`])
      .send({ email: 'x@b.com', bankRole: 'admin', targetOfficeId: otherHo._id.toString() });
    expect(r.status).toBe(201);
  });
});
