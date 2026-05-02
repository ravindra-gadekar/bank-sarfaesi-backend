import 'dotenv/config';
import mongoose from 'mongoose';
import { Invite } from '../user/models/invite.model';
import { USER_ROLES, UserRole } from '../user/models/user.model';
import { env } from '../config/env';

export async function runInviteMigration(): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0;
  let skipped = 0;
  const cursor = Invite.collection.find({});
  for await (const doc of cursor) {
    if (doc.userKind) {
      skipped++;
      continue;
    }
    const role = doc.role as string | undefined;
    const bankRole: UserRole = (USER_ROLES as readonly string[]).includes(role ?? '')
      ? (role as UserRole)
      : 'maker';
    await Invite.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          userKind: 'bank',
          bankRole,
          targetOfficeId: doc.branchId,
        },
      },
    );
    migrated++;
  }
  return { migrated, skipped };
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(env.MONGODB_URI);
    const r = await runInviteMigration();
    console.log(`[migrate-invites-to-hierarchy] migrated=${r.migrated} skipped=${r.skipped}`);
    await mongoose.disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
