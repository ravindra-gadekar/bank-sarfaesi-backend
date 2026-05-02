import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Office } from '../models/office.model';
import { jwtService } from '../../auth/services/jwt.service';

describe('GET /api/offices/:id', () => {
  let mongo: MongoMemoryServer;
  let token: string;
  let officeId: string;

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
    const ho = new Office({
      bankName: 'Test Bank',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'HO',
      email: 'ho@x.com',
      isActive: true,
      setupCompleted: true,
    });
    ho.bankRootId = ho._id;
    await ho.save();
    officeId = ho._id.toString();

    token = jwtService.signAccessToken({
      email: 'admin@x.com',
      userId: new mongoose.Types.ObjectId().toString(),
      branchId: officeId,
      role: 'admin',
      userKind: 'bank',
      officeId,
      officeType: 'HO',
      officeAncestors: [],
      bankRootId: officeId,
    });
  });

  it('returns the office when authenticated', async () => {
    const res = await request(app)
      .get(`/api/offices/${officeId}`)
      .set('Cookie', [`accessToken=${token}`]);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(officeId);
    expect(res.body.data.officeType).toBe('HO');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await request(app).get(`/api/offices/${officeId}`);
    expect(res.status).toBe(401);
  });
});
