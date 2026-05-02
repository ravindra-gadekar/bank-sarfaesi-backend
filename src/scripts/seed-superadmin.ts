import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../user/models/user.model';
import { env } from '../config/env';

export interface SeedSuperadminArgs {
  email: string;
  name: string;
  /** When true, runs in NODE_ENV=production without requiring SEED_TOKEN. Default false. */
  allowProduction?: boolean;
}

export interface SeedResult {
  created: boolean;
}

export async function runSeedSuperadmin(args: SeedSuperadminArgs): Promise<SeedResult> {
  if (
    process.env.NODE_ENV === 'production' &&
    !args.allowProduction &&
    !process.env.SEED_TOKEN
  ) {
    throw new Error(
      'Refusing to seed in production without SEED_TOKEN. Set SEED_TOKEN env or pass allowProduction.',
    );
  }
  const existing = await User.findOne({ userKind: 'app' }).exec();
  if (existing) return { created: false };

  await User.create({
    userKind: 'app',
    appRole: 'superadmin',
    name: args.name,
    email: args.email.toLowerCase(),
    authProvider: 'otp',
    isActive: true,
  });
  return { created: true };
}

if (require.main === module) {
  (async () => {
    const email = process.env.SEED_SUPERADMIN_EMAIL;
    const name = process.env.SEED_SUPERADMIN_NAME ?? 'Superadmin';
    if (!email) {
      console.error('SEED_SUPERADMIN_EMAIL env var is required');
      process.exit(1);
    }
    await mongoose.connect(env.MONGODB_URI);
    const r = await runSeedSuperadmin({ email, name });
    console.log(
      r.created
        ? `[seed-superadmin] created ${email}`
        : '[seed-superadmin] already exists; no-op',
    );
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
