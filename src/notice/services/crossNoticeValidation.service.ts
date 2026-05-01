import { Notice } from '../models/notice.model';

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

const DEMAND_TO_POSSESSION_DAYS = 60;
const POSSESSION_TO_AUCTION_DAYS = 30;

interface DateChainLink {
  noticeType: string;
  label: string;
  date: Date | null;
  status: string;
}

interface DateChainValidation {
  valid: boolean;
  chain: DateChainLink[];
  errors: Array<{ from: string; to: string; requiredDays: number; actualDays: number; message: string }>;
}

/**
 * Validate the date chain for a Possession Notice 13(4).
 * Chain: 13(2) noticeDate → +60 days → 13(4) dateOfPossession
 */
async function validatePossessionDateChain(
  branchId: string,
  caseId: string,
  possessionDate: Date,
): Promise<DateChainValidation> {
  const chain: DateChainLink[] = [];
  const errors: DateChainValidation['errors'] = [];

  // Find the prior finalized 13(2) notice
  const demandNotice = await Notice.findOne({
    branchId,
    caseId,
    noticeType: 'demand_13_2',
    status: 'final',
  })
    .sort({ approvedAt: -1 })
    .lean();

  const demandDate = demandNotice
    ? new Date((demandNotice.fields as Record<string, unknown>).noticeDate as string)
    : null;

  chain.push({
    noticeType: 'demand_13_2',
    label: 'Demand Notice 13(2)',
    date: demandDate,
    status: demandNotice ? 'final' : 'missing',
  });

  chain.push({
    noticeType: 'possession_13_4',
    label: 'Possession Notice 13(4)',
    date: possessionDate,
    status: 'current',
  });

  if (!demandDate) {
    errors.push({
      from: 'demand_13_2',
      to: 'possession_13_4',
      requiredDays: DEMAND_TO_POSSESSION_DAYS,
      actualDays: 0,
      message: 'No finalized Demand Notice 13(2) found for this case',
    });
  } else {
    const gap = daysBetween(demandDate, possessionDate);
    if (gap < DEMAND_TO_POSSESSION_DAYS) {
      errors.push({
        from: 'demand_13_2',
        to: 'possession_13_4',
        requiredDays: DEMAND_TO_POSSESSION_DAYS,
        actualDays: gap,
        message: `Possession date must be at least ${DEMAND_TO_POSSESSION_DAYS} days after Demand Notice date (currently ${gap} days)`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    chain,
    errors,
  };
}

/**
 * Validate the full 3-notice date chain for a Sale/Auction Notice.
 * Chain: 13(2) noticeDate → +60 days → 13(4) possessionDate → +30 days → Sale/Auction date
 */
async function validateSaleAuctionDateChain(
  branchId: string,
  caseId: string,
  saleNoticeDate: Date,
  auctionDate: Date,
): Promise<DateChainValidation> {
  const chain: DateChainLink[] = [];
  const errors: DateChainValidation['errors'] = [];

  // Find prior finalized 13(2) notice
  const demandNotice = await Notice.findOne({
    branchId,
    caseId,
    noticeType: 'demand_13_2',
    status: 'final',
  })
    .sort({ approvedAt: -1 })
    .lean();

  const demandDate = demandNotice
    ? new Date((demandNotice.fields as Record<string, unknown>).noticeDate as string)
    : null;

  chain.push({
    noticeType: 'demand_13_2',
    label: 'Demand Notice 13(2)',
    date: demandDate,
    status: demandNotice ? 'final' : 'missing',
  });

  // Find prior finalized 13(4) notice
  const possessionNotice = await Notice.findOne({
    branchId,
    caseId,
    noticeType: 'possession_13_4',
    status: 'final',
  })
    .sort({ approvedAt: -1 })
    .lean();

  const possessionDate = possessionNotice
    ? new Date((possessionNotice.fields as Record<string, unknown>).dateOfPossession as string)
    : null;

  chain.push({
    noticeType: 'possession_13_4',
    label: 'Possession Notice 13(4)',
    date: possessionDate,
    status: possessionNotice ? 'final' : 'missing',
  });

  chain.push({
    noticeType: 'sale_auction',
    label: 'Sale / Auction Notice',
    date: auctionDate,
    status: 'current',
  });

  // Validate 13(2) → 13(4) gap
  if (!demandDate) {
    errors.push({
      from: 'demand_13_2',
      to: 'possession_13_4',
      requiredDays: DEMAND_TO_POSSESSION_DAYS,
      actualDays: 0,
      message: 'No finalized Demand Notice 13(2) found for this case',
    });
  } else if (possessionDate) {
    const gap1 = daysBetween(demandDate, possessionDate);
    if (gap1 < DEMAND_TO_POSSESSION_DAYS) {
      errors.push({
        from: 'demand_13_2',
        to: 'possession_13_4',
        requiredDays: DEMAND_TO_POSSESSION_DAYS,
        actualDays: gap1,
        message: `Possession date must be at least ${DEMAND_TO_POSSESSION_DAYS} days after Demand Notice date (currently ${gap1} days)`,
      });
    }
  }

  // Validate 13(4) → Sale/Auction gap
  if (!possessionDate) {
    errors.push({
      from: 'possession_13_4',
      to: 'sale_auction',
      requiredDays: POSSESSION_TO_AUCTION_DAYS,
      actualDays: 0,
      message: 'No finalized Possession Notice 13(4) found for this case',
    });
  } else {
    const gap2 = daysBetween(saleNoticeDate, auctionDate);
    if (gap2 < POSSESSION_TO_AUCTION_DAYS) {
      errors.push({
        from: 'possession_13_4',
        to: 'sale_auction',
        requiredDays: POSSESSION_TO_AUCTION_DAYS,
        actualDays: gap2,
        message: `Auction date must be at least ${POSSESSION_TO_AUCTION_DAYS} days after Sale Notice date (currently ${gap2} days) — Rule 8(6)`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    chain,
    errors,
  };
}

const crossNoticeValidationService = {
  validatePossessionDateChain,
  validateSaleAuctionDateChain,
};

export { crossNoticeValidationService };
