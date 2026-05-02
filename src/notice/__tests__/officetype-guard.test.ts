import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Office } from '../../office/models/office.model';
import { jwtService } from '../../auth/services/jwt.service';

async function tokenAtOfficeType(officeType: 'HO' | 'Branch') {
  const office = new Office({
    bankName: 'B',
    officeType,
    parentId: null,
    ancestors: [],
    address: 'a',
    email: `${officeType}@b.com`,
    isActive: true,
    setupCompleted: true,
  });
  office.bankRootId = office._id;
  await office.save();
  return jwtService.signAccessToken({
    email: `${officeType}@b.com`,
    userId: new mongoose.Types.ObjectId().toString(),
    branchId: office._id.toString(),
    role: 'admin',
    userKind: 'bank',
    officeId: office._id.toString(),
    officeType,
    officeAncestors: [],
    bankRootId: office._id.toString(),
  });
}

describe('Notice mutation routes — officeType guard', () => {
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
    await Office.deleteMany({});
  });

  it('HO user POST /api/notices returns 403', async () => {
    const t = await tokenAtOfficeType('HO');
    const res = await request(app)
      .post('/api/notices')
      .set('Cookie', [`accessToken=${t}`])
      .send({});
    expect(res.status).toBe(403);
  });

  it('Branch user POST /api/notices does NOT 403 on officeType (may 400 on body validation)', async () => {
    const t = await tokenAtOfficeType('Branch');
    const res = await request(app)
      .post('/api/notices')
      .set('Cookie', [`accessToken=${t}`])
      .send({});
    expect(res.status).not.toBe(403);
  });
});
