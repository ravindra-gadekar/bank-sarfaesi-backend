import crypto from 'crypto';
import { Types } from 'mongoose';
import { Invite, IInvite } from '../models/invite.model';
import { User, IUser } from '../models/user.model';
import { Office } from '../../office/models/office.model';
import { officeService } from '../../office/services/office.service';
import { ApiError } from '../../common/utils/apiError';
import {
  CreateAppInviteInput,
  CreateBankInviteInput,
  AcceptBankInviteInput,
} from '../dto/invite.dto';

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const inviteService = {
  async createAppInvite(actor: IUser, payload: CreateAppInviteInput): Promise<IInvite> {
    if (actor.userKind !== 'app') {
      throw ApiError.forbidden('Only app users can create app invites');
    }
    if (actor.appRole !== 'superadmin') {
      throw ApiError.forbidden('Only superadmin can invite app users');
    }
    return this._issue({
      userKind: 'app',
      email: payload.email.toLowerCase(),
      appRole: payload.appRole,
      invitedBy: actor._id as Types.ObjectId,
    });
  },

  async createBankInvite(actor: IUser, payload: CreateBankInviteInput): Promise<IInvite> {
    if (actor.userKind === 'bank') {
      if (payload.targetOfficeId) {
        await this.assertCanInvite(actor, payload.targetOfficeId);
        return this._issue({
          userKind: 'bank',
          email: payload.email.toLowerCase(),
          bankRole: payload.bankRole,
          targetOfficeId: new Types.ObjectId(payload.targetOfficeId),
          invitedBy: actor._id as Types.ObjectId,
        });
      }
      if (payload.newOffice) {
        const parentId = payload.newOffice.parentOfficeId ?? actor.officeId?.toString();
        if (!parentId) {
          throw ApiError.badRequest('parentOfficeId required when bank user invites into a new office');
        }
        await this.assertCanInvite(actor, parentId);
        return this._issue({
          userKind: 'bank',
          email: payload.email.toLowerCase(),
          bankRole: payload.bankRole,
          pendingOfficeSnapshot: {
            ...payload.newOffice,
            parentOfficeId: new Types.ObjectId(parentId),
          },
          invitedBy: actor._id as Types.ObjectId,
        });
      }
      throw ApiError.badRequest('Either targetOfficeId or newOffice is required');
    }

    if (actor.userKind === 'app') {
      if (payload.targetOfficeId) {
        return this._issue({
          userKind: 'bank',
          email: payload.email.toLowerCase(),
          bankRole: payload.bankRole,
          targetOfficeId: new Types.ObjectId(payload.targetOfficeId),
          invitedBy: actor._id as Types.ObjectId,
        });
      }
      if (payload.newOffice) {
        const snapshot = payload.newOffice.parentOfficeId
          ? { ...payload.newOffice, parentOfficeId: new Types.ObjectId(payload.newOffice.parentOfficeId) }
          : (payload.newOffice as Omit<typeof payload.newOffice, 'parentOfficeId'>);
        return this._issue({
          userKind: 'bank',
          email: payload.email.toLowerCase(),
          bankRole: payload.bankRole,
          pendingOfficeSnapshot: snapshot as IInvite['pendingOfficeSnapshot'],
          invitedBy: actor._id as Types.ObjectId,
        });
      }
      throw ApiError.badRequest('Either targetOfficeId or newOffice is required');
    }

    throw ApiError.forbidden('Unknown actor kind');
  },

  async assertCanInvite(actor: IUser, targetOfficeId: string): Promise<void> {
    if (actor.userKind === 'app') return;
    if (!actor.officeId) throw ApiError.unauthorized('No officeId on actor');
    if (actor.officeId.toString() === targetOfficeId) return;
    const ok = await officeService.isAncestorOrSelf(
      actor.officeId.toString(),
      targetOfficeId,
    );
    if (!ok) throw ApiError.forbidden('Target office is outside your subtree');
  },

  async validateToken(token: string): Promise<IInvite> {
    const tokenHash = hashToken(token);
    const inv = await Invite.findOne({ tokenHash, usedAt: { $exists: false } }).exec();
    if (!inv) throw ApiError.notFound('Invite not found or already used');
    if (inv.expiresAt < new Date()) throw ApiError.badRequest('Invite has expired');
    return inv;
  },

  async acceptInvite(
    token: string,
    payload: AcceptBankInviteInput,
  ): Promise<{ user: IUser; office: unknown }> {
    const inv = await this.validateToken(token);

    let officeId: Types.ObjectId | undefined;
    let officeDoc: unknown = null;

    if (inv.userKind === 'bank') {
      if (inv.targetOfficeId) {
        officeId = inv.targetOfficeId;
        officeDoc = await Office.findById(officeId).exec();
        if (!officeDoc) throw ApiError.notFound('Target office no longer exists');
      } else if (inv.pendingOfficeSnapshot) {
        const snap = inv.pendingOfficeSnapshot;
        const created = await officeService.createOffice({
          bankName: snap.bankName,
          bankLogoKey: snap.bankLogoKey,
          officeType: snap.officeType,
          parentOfficeId: snap.parentOfficeId?.toString(),
          address: snap.address,
          contact: snap.contact,
          email: snap.email,
        });
        officeId = created._id;
        officeDoc = created;
      } else {
        throw ApiError.badRequest('Invite has no target office or snapshot');
      }
    }

    const user = await User.create({
      userKind: inv.userKind,
      officeId: inv.userKind === 'bank' ? officeId : undefined,
      branchId: inv.userKind === 'bank' ? officeId : undefined,
      name: payload.name,
      email: inv.email,
      designation: payload.designation,
      mobile: payload.mobile,
      bankRole: inv.bankRole,
      appRole: inv.appRole,
      authProvider: 'otp',
      isActive: true,
      createdBy: inv.invitedBy,
    });

    inv.usedAt = new Date();
    await inv.save();

    return { user, office: officeDoc };
  },

  async _issue(args: Partial<IInvite>): Promise<IInvite> {
    const plainToken = crypto.randomUUID();
    const inv = await Invite.create({
      ...args,
      tokenHash: hashToken(plainToken),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    Object.defineProperty(inv, '_plainToken', { value: plainToken, enumerable: false });
    return inv;
  },
};
