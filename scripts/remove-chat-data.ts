import mongoose from 'mongoose';
import { env } from '../src/config/env';

async function main(): Promise<void> {
  console.log('Connecting to', env.MONGODB_URI.replace(/\/\/[^@]+@/, '//<creds>@'));
  await mongoose.connect(env.MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) throw new Error('Mongo connection has no db handle');

  // 1) Drop chatflowconfigs collection (idempotent)
  try {
    await db.dropCollection('chatflowconfigs');
    console.log('✅ Dropped collection: chatflowconfigs');
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('ns not found')) {
      console.log('ℹ️  Collection chatflowconfigs not present — nothing to drop');
    } else {
      throw err;
    }
  }

  // 2) $unset chatSessionLog from every notice
  const result = await db
    .collection('notices')
    .updateMany({}, { $unset: { chatSessionLog: '' } });
  console.log(
    `✅ notices.chatSessionLog unset — matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
