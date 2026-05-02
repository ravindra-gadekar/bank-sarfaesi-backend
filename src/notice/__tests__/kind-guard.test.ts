import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import { jwtService } from '../../auth/services/jwt.service';

describe('Notice routes reject app users (userKind guard)', () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it('GET /api/notices returns 403 for app user', async () => {
    const token = jwtService.signAccessToken({
      email: 'super@app.com',
      userId: new mongoose.Types.ObjectId().toString(),
      userKind: 'app',
      role: 'superadmin',
    });
    const res = await request(app).get('/api/notices').set('Cookie', [`accessToken=${token}`]);
    expect(res.status).toBe(403);
  });
});
