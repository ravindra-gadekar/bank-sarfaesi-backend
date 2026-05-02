import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Office } from '../../office/models/office.model';
import { User } from '../models/user.model';
import { Invite } from '../models/invite.model';
import { inviteService } from '../services/invite.service';

describe('inviteService', () => {
  let mongo: MongoMemoryServer;
  let ho: any, branch: any, hoUser: any, branchUser: any, superadmin: any;

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
    branch = await Office.create({
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
    superadmin = await User.create({
      userKind: 'app',
      name: 'Super',
      email: 'super@app.com',
      appRole: 'superadmin',
      authProvider: 'otp',
      isActive: true,
    });
    hoUser = await User.create({
      userKind: 'bank',
      officeId: ho._id,
      branchId: ho._id,
      name: 'HO',
      email: 'ho@x.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
    branchUser = await User.create({
      userKind: 'bank',
      officeId: branch._id,
      branchId: branch._id,
      name: 'BR',
      email: 'br@x.com',
      bankRole: 'admin',
      authProvider: 'otp',
      isActive: true,
    });
  });

  describe('createAppInvite', () => {
    it('superadmin creates an app invite', async () => {
      const inv = await inviteService.createAppInvite(superadmin, {
        email: 'new@app.com',
        appRole: 'admin',
      });
      expect(inv.userKind).toBe('app');
      expect(inv.appRole).toBe('admin');
    });
    it('non-superadmin app user is rejected', async () => {
      const support = await User.create({
        userKind: 'app',
        name: 'S',
        email: 's@app.com',
        appRole: 'support',
        authProvider: 'otp',
        isActive: true,
      });
      await expect(
        inviteService.createAppInvite(support, { email: 'x@app.com', appRole: 'admin' }),
      ).rejects.toThrow(/superadmin/i);
    });
    it('bank user is rejected', async () => {
      await expect(
        inviteService.createAppInvite(hoUser, { email: 'x@app.com', appRole: 'admin' }),
      ).rejects.toThrow(/app users/i);
    });
  });

  describe('createBankInvite', () => {
    it('HO user invites Branch user — allowed', async () => {
      const inv = await inviteService.createBankInvite(hoUser, {
        email: 'newbr@x.com',
        bankRole: 'admin',
        targetOfficeId: branch._id.toString(),
      });
      expect(inv.userKind).toBe('bank');
      expect(inv.targetOfficeId?.toString()).toBe(branch._id.toString());
    });
    it('Branch user invites HO user — 403', async () => {
      await expect(
        inviteService.createBankInvite(branchUser, {
          email: 'newho@x.com',
          bankRole: 'admin',
          targetOfficeId: ho._id.toString(),
        }),
      ).rejects.toThrow(/subtree/i);
    });
    it('superadmin invites into any subtree', async () => {
      const inv = await inviteService.createBankInvite(superadmin, {
        email: 'any@x.com',
        bankRole: 'admin',
        targetOfficeId: branch._id.toString(),
      });
      expect(inv.userKind).toBe('bank');
    });
    it('superadmin creates a new HO via newOffice payload', async () => {
      const inv = await inviteService.createBankInvite(superadmin, {
        email: 'newho@y.com',
        bankRole: 'admin',
        newOffice: {
          bankName: 'New Bank',
          officeType: 'HO',
          address: 'a',
          contact: 'c',
          email: 'ho@y.com',
        },
      });
      expect(inv.pendingOfficeSnapshot?.bankName).toBe('New Bank');
      expect(inv.targetOfficeId).toBeUndefined();
    });
  });

  describe('acceptInvite', () => {
    it('creates user against existing office', async () => {
      const inv = await inviteService.createBankInvite(hoUser, {
        email: 'newbr@x.com',
        bankRole: 'maker',
        targetOfficeId: branch._id.toString(),
      });
      const token = (inv as any)._plainToken as string;
      const accepted = await inviteService.acceptInvite(token, {
        name: 'New User',
        designation: 'Officer',
        mobile: '+91',
      });
      expect(accepted.user.userKind).toBe('bank');
      expect(accepted.user.officeId!.toString()).toBe(branch._id.toString());
      expect(accepted.user.bankRole).toBe('maker');
    });

    it('creates new Office on accept when invite carries pendingOfficeSnapshot', async () => {
      const inv = await inviteService.createBankInvite(superadmin, {
        email: 'newho@y.com',
        bankRole: 'admin',
        newOffice: {
          bankName: 'New Bank',
          officeType: 'HO',
          address: 'a',
          contact: 'c',
          email: 'ho@y.com',
        },
      });
      const token = (inv as any)._plainToken as string;
      const accepted = await inviteService.acceptInvite(token, { name: 'HO Admin' });
      expect(accepted.user.userKind).toBe('bank');
      const newOffice = await Office.findById(accepted.user.officeId).exec();
      expect(newOffice?.bankName).toBe('New Bank');
      expect(newOffice?.officeType).toBe('HO');
    });
  });
});
