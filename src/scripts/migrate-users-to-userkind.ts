import 'dotenv/config';
import mongoose from 'mongoose';
import { User, USER_ROLES, UserRole } from '../user/models/user.model';
import { env } from '../config/env';

export interface UserMigrationResult {
  migrated: number;
  skipped: number;
}

export async function runUserMigration(): Promise<UserMigrationResult> {
  let migrated = 0;
  let skipped = 0;

  const cursor = User.collection.find({});
  for await (const doc of cursor) {
    if (doc.userKind) {
      skipped++;
      continue;
    }
    const role = (doc.role as string) ?? 'maker';
    const bankRole = (USER_ROLES as readonly string[]).includes(role) ? (role as UserRole) : 'maker';
    await User.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          userKind: 'bank',
          bankRole,
          officeId: doc.branchId,
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
    const result = await runUserMigration();
    console.log(`[migrate-users-to-userkind] migrated=${result.migrated} skipped=${result.skipped}`);
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
