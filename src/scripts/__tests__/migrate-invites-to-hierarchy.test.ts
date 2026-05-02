import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Invite } from '../../user/models/invite.model';
import { runInviteMigration } from '../migrate-invites-to-hierarchy';

describe('migrate-invites-to-hierarchy', () => {
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
    await Invite.deleteMany({});
  });

  it('back-fills userKind=bank, bankRole, targetOfficeId on legacy invites', async () => {
    const branchId = new mongoose.Types.ObjectId();
    const invitedBy = new mongoose.Types.ObjectId();
    await Invite.collection.insertOne({
      branchId,
      email: 'i@x.com',
      role: 'maker',
      tokenHash: 'h',
      invitedBy,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });
    const r = await runInviteMigration();
    expect(r.migrated).toBe(1);
    const i = await Invite.findOne({ email: 'i@x.com' }).exec();
    expect(i?.userKind).toBe('bank');
    expect(i?.bankRole).toBe('maker');
    expect(i?.targetOfficeId?.toString()).toBe(branchId.toString());
  });

  it('idempotent', async () => {
    const branchId = new mongoose.Types.ObjectId();
    await Invite.collection.insertOne({
      branchId,
      email: 'a@b.com',
      role: 'admin',
      tokenHash: 'h',
      invitedBy: new mongoose.Types.ObjectId(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    });
    const r1 = await runInviteMigration();
    const r2 = await runInviteMigration();
    expect(r1.migrated).toBe(1);
    expect(r2.migrated).toBe(0);
  });
});
