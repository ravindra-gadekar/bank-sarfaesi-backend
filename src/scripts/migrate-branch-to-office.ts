import 'dotenv/config';
import mongoose from 'mongoose';
import { Branch, IBranch } from '../branch/models/branch.model';
import { Office } from '../office/models/office.model';
import { env } from '../config/env';

export interface MigrationResult {
  migrated: number;
  skipped: number;
}

export async function runBranchToOfficeMigration(): Promise<MigrationResult> {
  let migrated = 0;
  let skipped = 0;

  const branches = await Branch.find({}).lean<IBranch[]>().exec();
  for (const b of branches) {
    const existing = await Office.findById(b._id).exec();
    if (existing) {
      skipped++;
      continue;
    }
    await Office.create({
      _id: b._id,
      bankName: b.bankName,
      bankType: b.bankType,
      rbiRegNo: b.rbiRegNo,
      officeType: 'Branch',
      parentId: null,
      ancestors: [],
      bankRootId: b._id,
      branchName: b.branchName,
      branchCode: b.branchCode,
      ifscCode: b.ifscCode,
      address: b.branchAddress,
      city: b.city,
      district: b.district,
      state: b.state,
      pinCode: b.pinCode,
      phone: b.phone,
      email: b.email,
      letterheadFileKey: b.letterheadFileKey,
      drtJurisdiction: b.drtJurisdiction,
      defaultAOName: b.defaultAOName,
      defaultAODesignation: b.defaultAODesignation,
      ssoConfigs: b.ssoConfigs ?? [],
      hoAddress: b.hoAddress,
      website: b.website,
      isActive: b.isActive,
      setupCompleted: b.setupCompleted,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    });
    migrated++;
  }
  return { migrated, skipped };
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(env.MONGODB_URI);
    const result = await runBranchToOfficeMigration();
    console.log(`[migrate-branch-to-office] migrated=${result.migrated} skipped=${result.skipped}`);
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
