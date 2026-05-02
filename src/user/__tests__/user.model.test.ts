import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../models/user.model';

describe('User model — userKind discriminator', () => {
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

  it('persists a bank user with bankRole and officeId', async () => {
    const officeId = new mongoose.Types.ObjectId();
    const u = await User.create({
      userKind: 'bank',
      officeId,
      name: 'Bank Admin',
      email: 'admin@bank.example',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
    expect(u.userKind).toBe('bank');
    expect(u.bankRole).toBe('admin');
    expect(u.role).toBe('admin');
    expect(u.branchId?.toString()).toBe(officeId.toString());
  });

  it('persists an app user with appRole and no officeId', async () => {
    const u = await User.create({
      userKind: 'app',
      name: 'Super',
      email: 'super@app.example',
      appRole: 'superadmin',
      authProvider: 'otp',
      isActive: true,
    });
    expect(u.userKind).toBe('app');
    expect(u.appRole).toBe('superadmin');
    expect(u.officeId).toBeUndefined();
    expect(u.role).toBe('superadmin');
  });

  it('rejects bank user without bankRole', async () => {
    await expect(
      User.create({
        userKind: 'bank',
        officeId: new mongoose.Types.ObjectId(),
        name: 'x',
        email: 'x@b.com',
        authProvider: 'otp',
      }),
    ).rejects.toThrow(/bankRole/i);
  });

  it('rejects bank user without officeId', async () => {
    await expect(
      User.create({
        userKind: 'bank',
        name: 'x',
        email: 'x2@b.com',
        bankRole: 'admin',
        authProvider: 'otp',
      }),
    ).rejects.toThrow(/officeId/i);
  });

  it('rejects app user without appRole', async () => {
    await expect(
      User.create({
        userKind: 'app',
        name: 'x',
        email: 'x@app.com',
        authProvider: 'otp',
      }),
    ).rejects.toThrow(/appRole/i);
  });
});
