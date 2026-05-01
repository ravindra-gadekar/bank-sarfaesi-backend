import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { Office } from '../../office/models/office.model';
import { User } from '../../user/models/user.model';
import { jwtService } from '../services/jwt.service';

describe('POST /api/auth/select-office', () => {
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
    await User.deleteMany({});
  });

  it('issues a token with userKind, officeId, officeAncestors, bankRootId', async () => {
    const ho = new Office({
      bankName: 'B',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'a',
      email: 'ho@x.com',
      isActive: true,
      setupCompleted: true,
    });
    ho.bankRootId = ho._id;
    await ho.save();

    const branch = await Office.create({
      bankName: 'B',
      officeType: 'Branch',
      parentId: ho._id,
      ancestors: [ho._id],
      bankRootId: ho._id,
      address: 'a',
      email: 'br@x.com',
      isActive: true,
      setupCompleted: true,
    });

    await User.create({
      userKind: 'bank',
      officeId: branch._id,
      name: 'U',
      email: 'u@x.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });

    const identityToken = jwtService.signAccessToken({ email: 'u@x.com' });
    const refreshToken = jwtService.signRefreshToken({ email: 'u@x.com' });

    const res = await request(app)
      .post('/api/auth/select-office')
      .set('Cookie', [`accessToken=${identityToken}`, `refreshToken=${refreshToken}`])
      .send({ officeId: branch._id.toString() });

    expect(res.status).toBe(200);

    const setCookieHeader = res.headers['set-cookie'];
    const cookies: string[] = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
      ? [setCookieHeader as unknown as string]
      : [];
    const accessCookie = cookies.find((c) => c.startsWith('accessToken='))!;
    const newToken = accessCookie.split(';')[0].split('=')[1];
    const decoded = jwtService.verifyAccessToken(newToken);
    expect(decoded.userKind).toBe('bank');
    expect(decoded.officeId).toBe(branch._id.toString());
    expect(decoded.officeType).toBe('Branch');
    expect(decoded.officeAncestors).toEqual([ho._id.toString()]);
    expect(decoded.bankRootId).toBe(ho._id.toString());
  });

  it('rejects 403 when user does not belong to the office', async () => {
    const ho = new Office({
      bankName: 'B',
      officeType: 'HO',
      parentId: null,
      ancestors: [],
      address: 'a',
      email: 'ho2@x.com',
      isActive: true,
      setupCompleted: true,
    });
    ho.bankRootId = ho._id;
    await ho.save();

    await User.create({
      userKind: 'bank',
      officeId: ho._id,
      name: 'U',
      email: 'u2@x.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });

    const identityToken = jwtService.signAccessToken({ email: 'u2@x.com' });

    const res = await request(app)
      .post('/api/auth/select-office')
      .set('Cookie', [`accessToken=${identityToken}`])
      .send({ officeId: new mongoose.Types.ObjectId().toString() });

    expect(res.status).toBe(403);
  });
});
