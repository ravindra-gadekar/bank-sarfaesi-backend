import { DemandNoticeFields } from '../schemas/demandNotice.schema';
import { PossessionNoticeFields } from '../schemas/possessionNotice.schema';
import { SaleAuctionNoticeFields } from '../schemas/saleAuctionNotice.schema';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

const DEMAND_DEADLINE_DAYS = 60;
const SECTION_17_DAYS = 45;

/**
 * Auto-compute derived fields for Demand Notice 13(2).
 */
function computeDemandNotice(
  fields: Partial<DemandNoticeFields>,
): { totalAmountDemanded?: number; repaymentDeadline?: Date } {
  const result: { totalAmountDemanded?: number; repaymentDeadline?: Date } = {};

  if (
    fields.outstandingPrincipal != null &&
    fields.outstandingInterest != null &&
    fields.otherCharges != null
  ) {
    result.totalAmountDemanded =
      fields.outstandingPrincipal + fields.outstandingInterest + fields.otherCharges;
  }

  if (fields.noticeDate != null) {
    result.repaymentDeadline = addDays(new Date(fields.noticeDate), DEMAND_DEADLINE_DAYS);
  }

  return result;
}

/**
 * Auto-compute derived fields for Possession Notice 13(4).
 * - section17Deadline = dateOfPossession + 45 days
 */
function computePossessionNotice(
  fields: Partial<PossessionNoticeFields>,
): { section17Deadline?: Date } {
  const result: { section17Deadline?: Date } = {};

  if (fields.dateOfPossession != null) {
    result.section17Deadline = addDays(new Date(fields.dateOfPossession), SECTION_17_DAYS);
  }

  return result;
}

const AUCTION_GAP_DAYS = 30;

/**
 * Auto-compute derived fields for Sale/Auction Notice.
 * - minimumAuctionDate = noticeDate + 30 days (Rule 8(6))
 * - emdPercentage = (emdAmount / reservePrice) * 100
 */
function computeSaleAuctionNotice(
  fields: Partial<SaleAuctionNoticeFields>,
): { minimumAuctionDate?: Date; emdPercentage?: number } {
  const result: { minimumAuctionDate?: Date; emdPercentage?: number } = {};

  if (fields.noticeDate != null) {
    result.minimumAuctionDate = addDays(new Date(fields.noticeDate), AUCTION_GAP_DAYS);
  }

  if (fields.emdAmount != null && fields.reservePrice != null && fields.reservePrice > 0) {
    result.emdPercentage = Math.round((fields.emdAmount / fields.reservePrice) * 10000) / 100;
  }

  return result;
}

const autoComputeService = {
  computeDemandNotice,
  computePossessionNotice,
  computeSaleAuctionNotice,
};

export { autoComputeService };
