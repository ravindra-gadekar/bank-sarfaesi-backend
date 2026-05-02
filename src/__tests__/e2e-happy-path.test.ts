import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import { runSeedSuperadmin } from '../scripts/seed-superadmin';
import { Office } from '../office/models/office.model';
import { User } from '../user/models/user.model';
import { Invite } from '../user/models/invite.model';
import { jwtService } from '../auth/services/jwt.service';

async function tokenFor(email: string) {
  const u = await User.findOne({ email }).exec();
  if (!u) throw new Error(`User ${email} not found`);
  const office = u.officeId ? await Office.findById(u.officeId).exec() : null;
  return jwtService.signAccessToken({
    email: u.email,
    userId: u._id.toString(),
    branchId: u.officeId?.toString(),
    role: u.bankRole ?? u.appRole,
    userKind: u.userKind,
    officeId: u.officeId?.toString(),
    officeType: office?.officeType,
    officeAncestors: office?.ancestors.map((a) => a.toString()) ?? [],
    bankRootId: office?.bankRootId?.toString(),
  });
}

// Skipped scaffold: full token round-trip would require exposing the plain invite token via
// an email-service mock or a test-only API. Unit + integration coverage already lives in:
//   - src/scripts/__tests__/seed-superadmin.test.ts
//   - src/user/__tests__/invite.service.test.ts (9 cases)
//   - src/user/__tests__/invite.routes.test.ts  (6 cases)
//   - src/bank-oversight/__tests__/bankOversight.routes.test.ts (8 cases incl. cross-bank/cross-zone)
//
// To un-skip: extend inviteService._issue to attach the plain token to a test-mode email
// transport, then read the captured token here and replay it to /api/invites/:token/accept.
describe.skip('E2E happy path — seed → invite chain → first Branch user lands on dashboard', () => {
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
    await Promise.all([Office.deleteMany({}), User.deleteMany({}), Invite.deleteMany({})]);
  });

  it('superadmin invites HO admin → HO admin invites Branch admin → Branch admin can list users', async () => {
    await runSeedSuperadmin({ email: 'super@app.example', name: 'Super' });
    const superToken = await tokenFor('super@app.example');

    const r1 = await request(app)
      .post('/api/invites/bank')
      .set('Cookie', [`accessToken=${superToken}`])
      .send({
        email: 'ho@bank.example',
        bankRole: 'admin',
        newOffice: {
          bankName: 'New Bank',
          officeType: 'HO',
          address: 'HO Addr',
          contact: '+91 0',
          email: 'ho@bank.example',
        },
      });
    expect(r1.status).toBe(201);

    // Token round-trip would happen here. See note above.
  });
});
