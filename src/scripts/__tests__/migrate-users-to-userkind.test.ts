import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../../user/models/user.model';
import { runUserMigration } from '../migrate-users-to-userkind';

describe('migrate-users-to-userkind', () => {
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

  it('back-fills userKind=bank and bankRole on legacy users', async () => {
    const officeId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      branchId: officeId,
      name: 'Legacy',
      email: 'legacy@b.com',
      role: 'admin',
      authProvider: 'otp',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await runUserMigration();
    expect(result.migrated).toBe(1);
    const u = await User.findOne({ email: 'legacy@b.com' }).exec();
    expect(u?.userKind).toBe('bank');
    expect(u?.bankRole).toBe('admin');
    expect(u?.officeId?.toString()).toBe(officeId.toString());
  });

  it('is idempotent — second run is a no-op', async () => {
    const officeId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      branchId: officeId,
      name: 'L',
      email: 'l@b.com',
      role: 'maker',
      authProvider: 'otp',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const r1 = await runUserMigration();
    const r2 = await runUserMigration();
    expect(r1.migrated).toBe(1);
    expect(r2.migrated).toBe(0);
    expect(r2.skipped).toBe(1);
  });

  it('clamps unknown legacy roles to maker', async () => {
    const officeId = new mongoose.Types.ObjectId();
    await User.collection.insertOne({
      branchId: officeId,
      name: 'Weird',
      email: 'weird@b.com',
      role: 'somethingelse',
      authProvider: 'otp',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await runUserMigration();
    const u = await User.findOne({ email: 'weird@b.com' }).exec();
    expect(u?.bankRole).toBe('maker');
  });
});
