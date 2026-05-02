import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Case } from '../../case/models/case.model';
import { caseService } from '../../case/services/case.service';

async function insertCase(branchId: mongoose.Types.ObjectId, accountNo: string) {
  await Case.collection.insertOne({
    branchId,
    accountNo,
    loanType: 'home',
    sanctionDate: new Date(),
    sanctionAmount: 1,
    npaDate: new Date(),
    status: 'active',
    borrowers: [],
    securedAssets: [],
    securityDocuments: [],
    createdBy: new mongoose.Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('Tenancy leak guard — caseService is branchId-scoped', () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Case.deleteMany({});
  });

  it('caseService.findAll only returns cases for the requested branchId', async () => {
    const branchA = new mongoose.Types.ObjectId();
    const branchB = new mongoose.Types.ObjectId();
    await insertCase(branchA, 'A-1');
    await insertCase(branchA, 'A-2');
    await insertCase(branchB, 'B-1');

    const aResult = await caseService.findAll(branchA.toString(), { page: 1, limit: 10 });
    expect(aResult.total).toBe(2);
    expect(aResult.cases).toHaveLength(2);
    expect(
      aResult.cases.every((c) => c.branchId.toString() === branchA.toString()),
    ).toBe(true);

    const bResult = await caseService.findAll(branchB.toString(), { page: 1, limit: 10 });
    expect(bResult.total).toBe(1);
    expect(bResult.cases[0].accountNo).toBe('B-1');
  });

  it('caseService.findById refuses to return a case from a sibling branchId', async () => {
    const branchA = new mongoose.Types.ObjectId();
    const branchB = new mongoose.Types.ObjectId();
    await insertCase(branchA, 'A-1');
    const aCase = await Case.findOne({ branchId: branchA }).exec();
    expect(aCase).not.toBeNull();

    // Branch A's case ID, but caller is asking on Branch B's behalf — must not leak
    await expect(
      caseService.findById(branchB.toString(), aCase!._id.toString()),
    ).rejects.toThrow(/not found/i);
  });
});
