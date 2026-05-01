import { Branch } from '../../branch/models/branch.model';
import { Case } from '../../case/models/case.model';
import { Notice } from '../models/notice.model';
import { ApiError } from '../../common/utils/apiError';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function prefillDemandNotice(
  branchId: string,
  caseId: string,
): Promise<Record<string, unknown>> {
  const branch = await Branch.findById(branchId)
    .select('defaultAOName defaultAODesignation city')
    .lean();

  if (!branch) {
    throw ApiError.notFound('Branch not found');
  }

  const caseDoc = await Case.findOne({ _id: caseId, branchId })
    .select(
      'borrowers securedAssets securityDocuments sanctionAmount sanctionDate npaDate accountNo loanType',
    )
    .lean();

  if (!caseDoc) {
    throw ApiError.notFound('Case not found');
  }

  const noticeDate = new Date();
  const repaymentDeadline = addDays(noticeDate, 60);

  return {
    authorizedOfficerName: branch.defaultAOName || '',
    authorizedOfficerDesignation: branch.defaultAODesignation || '',
    placeOfNotice: branch.city,
    noticeDate,
    borrowers: caseDoc.borrowers,
    securedAssets: caseDoc.securedAssets,
    securityDocuments: caseDoc.securityDocuments,
    sanctionAmount: caseDoc.sanctionAmount,
    sanctionDate: caseDoc.sanctionDate,
    npaDate: caseDoc.npaDate,
    accountNo: caseDoc.accountNo,
    loanType: caseDoc.loanType,
    repaymentDeadline,
  };
}

async function prefillPossessionNotice(
  branchId: string,
  caseId: string,
): Promise<Record<string, unknown>> {
  const branch = await Branch.findById(branchId)
    .select('defaultAOName defaultAODesignation city drtNameLocation')
    .lean();

  if (!branch) {
    throw ApiError.notFound('Branch not found');
  }

  const caseDoc = await Case.findOne({ _id: caseId, branchId })
    .select('borrowers securedAssets sanctionAmount sanctionDate npaDate accountNo loanType')
    .lean();

  if (!caseDoc) {
    throw ApiError.notFound('Case not found');
  }

  // Auto-link: find the latest finalized 13(2) notice for this case
  const priorDemandNotice = await Notice.findOne({
    branchId,
    caseId,
    noticeType: 'demand_13_2',
    status: 'final',
  })
    .sort({ approvedAt: -1 })
    .lean();

  if (!priorDemandNotice) {
    throw ApiError.badRequest(
      'No finalized Demand Notice 13(2) found for this case. A 13(2) notice must be finalized before creating a Possession Notice.',
    );
  }

  const demandFields = priorDemandNotice.fields as Record<string, unknown>;
  const noticeDate = new Date();
  const dateOfPossession = new Date(); // default to today, user can change
  const section17Deadline = addDays(dateOfPossession, 45);

  return {
    // Prior notice reference (read-only on form)
    refDemandNoticeId: priorDemandNotice._id.toString(),
    refDemandNoticeDate: demandFields.noticeDate,
    refDemandAmountDemanded: demandFields.totalAmountDemanded,

    // Possession details
    dateOfPossession,
    section17Deadline,

    // DRT info from branch
    drtNameLocation: branch.drtJurisdiction ? `${branch.drtJurisdiction.name}, ${branch.drtJurisdiction.location}` : '',

    // Authorized officer from branch defaults
    authorizedOfficerName: branch.defaultAOName || '',
    authorizedOfficerDesignation: branch.defaultAODesignation || '',
    placeOfNotice: branch.city,
    noticeDate,

    // Case data for display
    borrowers: caseDoc.borrowers,
    securedAssets: caseDoc.securedAssets,
    sanctionAmount: caseDoc.sanctionAmount,
    accountNo: caseDoc.accountNo,
    loanType: caseDoc.loanType,
  };
}

const DEFAULT_TERMS_TEMPLATE = `1. The sale shall be on "as is where is" and "as is what is" basis.
2. The successful bidder shall deposit 25% of the sale price (less EMD already paid) immediately on the same day of auction.
3. The balance 75% of the sale price shall be deposited within 15 days from the date of confirmation of sale.
4. The purchaser shall bear all statutory dues, taxes, fees, and charges applicable on the property.
5. The Authorised Officer reserves the right to accept or reject any or all bids without assigning any reason.
6. The sale certificate shall be issued only after receipt of the entire sale consideration.
7. The immovable property is being sold free from all encumbrances known to the secured creditor.
8. For detailed terms and conditions of the sale, please contact the branch.`;

const DEFAULT_ENCUMBRANCE_STATUS =
  'As per the records and knowledge of the bank, the property is free from all encumbrances. However, intending bidders are advised to make their own independent enquiries regarding any encumbrance, title of property, liens, or any other claims before submitting their bids.';

async function prefillSaleAuctionNotice(
  branchId: string,
  caseId: string,
): Promise<Record<string, unknown>> {
  const branch = await Branch.findById(branchId)
    .select('defaultAOName defaultAODesignation city')
    .lean();

  if (!branch) {
    throw ApiError.notFound('Branch not found');
  }

  const caseDoc = await Case.findOne({ _id: caseId, branchId })
    .select('borrowers securedAssets sanctionAmount sanctionDate npaDate accountNo loanType')
    .lean();

  if (!caseDoc) {
    throw ApiError.notFound('Case not found');
  }

  // Auto-link: find the latest finalized 13(4) notice for this case
  const priorPossessionNotice = await Notice.findOne({
    branchId,
    caseId,
    noticeType: 'possession_13_4',
    status: 'final',
  })
    .sort({ approvedAt: -1 })
    .lean();

  if (!priorPossessionNotice) {
    throw ApiError.badRequest(
      'No finalized Possession Notice 13(4) found for this case. A 13(4) notice must be finalized before creating a Sale/Auction Notice.',
    );
  }

  const possessionFields = priorPossessionNotice.fields as Record<string, unknown>;
  const noticeDate = new Date();
  const minimumAuctionDate = addDays(noticeDate, 30);

  return {
    // Prior notice reference (read-only on form)
    refPossessionNoticeId: priorPossessionNotice._id.toString(),
    refPossessionDate: possessionFields.dateOfPossession,

    // Defaults
    noticeDate,
    auctionDate: minimumAuctionDate,
    emdPaymentModes: ['DD', 'RTGS'],
    propertyInspectionDates: [],

    // Pre-filled templates
    termsAndConditions: DEFAULT_TERMS_TEMPLATE,
    encumbranceStatus: DEFAULT_ENCUMBRANCE_STATUS,

    // Authorized officer from branch defaults
    authorizedOfficerName: branch.defaultAOName || '',
    authorizedOfficerDesignation: branch.defaultAODesignation || '',
    placeOfNotice: branch.city,

    // Case data for display
    borrowers: caseDoc.borrowers,
    securedAssets: caseDoc.securedAssets,
    sanctionAmount: caseDoc.sanctionAmount,
    accountNo: caseDoc.accountNo,
    loanType: caseDoc.loanType,
  };
}

const prefillService = {
  prefillDemandNotice,
  prefillPossessionNotice,
  prefillSaleAuctionNotice,
};

export { prefillService };
