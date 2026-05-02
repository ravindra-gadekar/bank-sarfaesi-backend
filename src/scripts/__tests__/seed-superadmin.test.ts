import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../user/models/user.model';
import { runSeedSuperadmin } from '../seed-superadmin';

describe('seed-superadmin', () => {
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
    await User.deleteMany({});
  });

  it('creates one App Superadmin when none exists', async () => {
    const r = await runSeedSuperadmin({ email: 'super@app.example', name: 'The Super' });
    expect(r.created).toBe(true);
    const u = await User.findOne({ email: 'super@app.example' }).exec();
    expect(u?.userKind).toBe('app');
    expect(u?.appRole).toBe('superadmin');
  });

  it('is a no-op when an app user already exists', async () => {
    await User.create({
      userKind: 'app',
      appRole: 'superadmin',
      name: 'Existing',
      email: 'super@app.example',
      authProvider: 'otp',
      isActive: true,
    });
    const r = await runSeedSuperadmin({ email: 'super@app.example', name: 'The Super' });
    expect(r.created).toBe(false);
    expect(await User.countDocuments({ userKind: 'app' })).toBe(1);
  });

  it('refuses to run in production without SEED_TOKEN', async () => {
    const oldEnv = process.env.NODE_ENV;
    const oldToken = process.env.SEED_TOKEN;
    process.env.NODE_ENV = 'production';
    delete process.env.SEED_TOKEN;
    try {
      await expect(
        runSeedSuperadmin({ email: 's@x.com', name: 'S', allowProduction: false }),
      ).rejects.toThrow(/production/i);
    } finally {
      process.env.NODE_ENV = oldEnv;
      if (oldToken !== undefined) process.env.SEED_TOKEN = oldToken;
    }
  });
});
