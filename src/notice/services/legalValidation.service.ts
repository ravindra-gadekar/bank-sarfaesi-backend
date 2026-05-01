import { DemandNoticeFieldsSchema, DemandNoticeFields } from '../schemas/demandNotice.schema';
import {
  PossessionNoticeFieldsSchema,
  PossessionNoticeFields,
} from '../schemas/possessionNotice.schema';
import {
  SaleAuctionNoticeFieldsSchema,
  SaleAuctionNoticeFields,
} from '../schemas/saleAuctionNotice.schema';

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

interface CaseData {
  sanctionAmount: number;
  npaDate: Date;
  sanctionDate: Date;
}

interface PriorNoticeData {
  noticeDate: Date;
  amountDemanded: number;
  status: string;
}

const SARFAESI_THRESHOLD = 100000; // ₹1 Lakh
const NPA_MIN_DAYS = 90;
const DEMAND_DEADLINE_DAYS = 60;
const POSSESSION_GAP_DAYS = 60; // 13(4) must be ≥ 60 days after 13(2)
const AUCTION_GAP_DAYS = 30; // Sale notice → auction ≥ 30 days (Rule 8(6))
const SECTION_17_DAYS = 45; // DRT deadline = possession + 45 days
const NEWSPAPER_MAX_DAYS = 7; // Newspaper publication within 7 days of possession
const AMOUNT_TOLERANCE = 1;
const MIN_INSPECTION_DATES = 2;

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function validateDemandNotice(
  caseData: CaseData,
  fields: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Zod schema validation
  const parseResult = DemandNoticeFieldsSchema.safeParse(fields);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        field: issue.path.map(String).join('.') || 'unknown',
        message: issue.message,
        severity: 'error',
      });
    }
    return { valid: false, errors, warnings };
  }

  const parsed: DemandNoticeFields = parseResult.data;

  // 2. NPA date must be >= 90 days before notice date
  const daysFromNpa = daysBetween(new Date(caseData.npaDate), parsed.noticeDate);
  if (daysFromNpa < NPA_MIN_DAYS) {
    warnings.push({
      field: 'noticeDate',
      message: `NPA date should be at least ${NPA_MIN_DAYS} days before the notice date (currently ${daysFromNpa} days)`,
      severity: 'warning',
    });
  }

  // 3. Sanction amount must exceed SARFAESI threshold (₹1L)
  if (caseData.sanctionAmount <= SARFAESI_THRESHOLD) {
    errors.push({
      field: 'sanctionAmount',
      message: `Sanction amount must exceed ₹${SARFAESI_THRESHOLD.toLocaleString('en-IN')} for SARFAESI applicability`,
      severity: 'error',
    });
  }

  // 4. Total amount demanded must equal sum of components (±1 tolerance)
  const expectedTotal =
    parsed.outstandingPrincipal + parsed.outstandingInterest + parsed.otherCharges;
  if (Math.abs(parsed.totalAmountDemanded - expectedTotal) > AMOUNT_TOLERANCE) {
    warnings.push({
      field: 'totalAmountDemanded',
      message: `Total amount demanded (${parsed.totalAmountDemanded}) does not match sum of principal + interest + charges (${expectedTotal})`,
      severity: 'warning',
    });
  }

  // 5. Repayment deadline should be exactly 60 days after notice date
  const expectedDeadline = addDays(parsed.noticeDate, DEMAND_DEADLINE_DAYS);
  if (daysBetween(expectedDeadline, parsed.repaymentDeadline) !== 0) {
    warnings.push({
      field: 'repaymentDeadline',
      message: `Repayment deadline should be exactly ${DEMAND_DEADLINE_DAYS} days after notice date`,
      severity: 'warning',
    });
  }

  // 6. Check all mandatory fields are filled (already covered by Zod, but explicit check for clarity)
  const mandatoryFields: (keyof DemandNoticeFields)[] = [
    'noticeDate',
    'outstandingPrincipal',
    'outstandingInterest',
    'otherCharges',
    'totalAmountDemanded',
    'repaymentDeadline',
    'authorizedOfficerName',
    'authorizedOfficerDesignation',
    'placeOfNotice',
  ];
  for (const key of mandatoryFields) {
    const value = fields[key];
    if (value === undefined || value === null || value === '') {
      errors.push({
        field: key,
        message: `${key} is required`,
        severity: 'error',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function computeDemandNoticeFields(
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

function validatePossessionNotice(
  caseData: CaseData,
  fields: Record<string, unknown>,
  priorDemandNotice: PriorNoticeData | null,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Zod schema validation
  const parseResult = PossessionNoticeFieldsSchema.safeParse(fields);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        field: issue.path.map(String).join('.') || 'unknown',
        message: issue.message,
        severity: 'error',
      });
    }
    return { valid: false, errors, warnings };
  }

  const parsed: PossessionNoticeFields = parseResult.data;

  // 2. Prior 13(2) demand notice must exist in final status
  if (!priorDemandNotice) {
    errors.push({
      field: 'refDemandNoticeId',
      message: 'A finalized Demand Notice 13(2) must exist for this case before creating a Possession Notice',
      severity: 'error',
    });
    return { valid: false, errors, warnings };
  }

  if (priorDemandNotice.status !== 'final') {
    errors.push({
      field: 'refDemandNoticeId',
      message: `Prior Demand Notice must be in "final" status (currently "${priorDemandNotice.status}")`,
      severity: 'error',
    });
  }

  // 3. Possession date must be ≥ 13(2) notice date + 60 days
  const demandDate = new Date(priorDemandNotice.noticeDate);
  const gapDays = daysBetween(demandDate, parsed.dateOfPossession);
  if (gapDays < POSSESSION_GAP_DAYS) {
    errors.push({
      field: 'dateOfPossession',
      message: `Possession date must be at least ${POSSESSION_GAP_DAYS} days after the Demand Notice date (currently ${gapDays} days)`,
      severity: 'error',
    });
  }

  // 4. Newspaper publication dates must be within 7 days of possession date
  const np1Gap = Math.abs(daysBetween(parsed.dateOfPossession, parsed.newspaper1Date));
  if (np1Gap > NEWSPAPER_MAX_DAYS) {
    errors.push({
      field: 'newspaper1Date',
      message: `English newspaper publication must be within ${NEWSPAPER_MAX_DAYS} days of possession date (currently ${np1Gap} days)`,
      severity: 'error',
    });
  }

  const np2Gap = Math.abs(daysBetween(parsed.dateOfPossession, parsed.newspaper2Date));
  if (np2Gap > NEWSPAPER_MAX_DAYS) {
    errors.push({
      field: 'newspaper2Date',
      message: `Vernacular newspaper publication must be within ${NEWSPAPER_MAX_DAYS} days of possession date (currently ${np2Gap} days)`,
      severity: 'error',
    });
  }

  // 5. Witness 2 — warn if not provided
  if (!parsed.witness2Name || !parsed.witness2Designation) {
    warnings.push({
      field: 'witness2Name',
      message: 'Second witness is recommended but not mandatory. Having two witnesses strengthens legal standing.',
      severity: 'warning',
    });
  }

  // 6. Section 17 deadline should be exactly 45 days after possession
  const expectedSection17 = addDays(parsed.dateOfPossession, SECTION_17_DAYS);
  if (daysBetween(expectedSection17, parsed.section17Deadline) !== 0) {
    warnings.push({
      field: 'section17Deadline',
      message: `Section 17 deadline should be exactly ${SECTION_17_DAYS} days after possession date`,
      severity: 'warning',
    });
  }

  // 7. Sanction amount must exceed SARFAESI threshold
  if (caseData.sanctionAmount <= SARFAESI_THRESHOLD) {
    errors.push({
      field: 'sanctionAmount',
      message: `Sanction amount must exceed ₹${SARFAESI_THRESHOLD.toLocaleString('en-IN')} for SARFAESI applicability`,
      severity: 'error',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function computePossessionNoticeFields(
  fields: Partial<PossessionNoticeFields>,
): { section17Deadline?: Date } {
  const result: { section17Deadline?: Date } = {};

  if (fields.dateOfPossession != null) {
    result.section17Deadline = addDays(new Date(fields.dateOfPossession), SECTION_17_DAYS);
  }

  return result;
}

interface PriorPossessionData {
  possessionDate: Date;
  status: string;
}

function validateSaleAuctionNotice(
  caseData: CaseData,
  fields: Record<string, unknown>,
  priorPossessionNotice: PriorPossessionData | null,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Zod schema validation
  const parseResult = SaleAuctionNoticeFieldsSchema.safeParse(fields);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        field: issue.path.map(String).join('.') || 'unknown',
        message: issue.message,
        severity: 'error',
      });
    }
    return { valid: false, errors, warnings };
  }

  const parsed: SaleAuctionNoticeFields = parseResult.data;

  // 2. Prior 13(4) possession notice must exist in final status
  if (!priorPossessionNotice) {
    errors.push({
      field: 'refPossessionNoticeId',
      message: 'A finalized Possession Notice 13(4) must exist for this case before creating a Sale/Auction Notice',
      severity: 'error',
    });
    return { valid: false, errors, warnings };
  }

  if (priorPossessionNotice.status !== 'final') {
    errors.push({
      field: 'refPossessionNoticeId',
      message: `Prior Possession Notice must be in "final" status (currently "${priorPossessionNotice.status}")`,
      severity: 'error',
    });
  }

  // 3. Auction date must be ≥ sale notice date + 30 days (Rule 8(6))
  const gapDays = daysBetween(parsed.noticeDate, parsed.auctionDate);
  if (gapDays < AUCTION_GAP_DAYS) {
    errors.push({
      field: 'auctionDate',
      message: `Auction date must be at least ${AUCTION_GAP_DAYS} days after the sale notice date (currently ${gapDays} days) — Rule 8(6)`,
      severity: 'error',
    });
  }

  // 4. Two independent valuers required (both already enforced by Zod, but check names are different)
  if (parsed.valuer1Name.toLowerCase().trim() === parsed.valuer2Name.toLowerCase().trim()) {
    warnings.push({
      field: 'valuer2Name',
      message: 'Two independent valuers are recommended. Valuer 1 and Valuer 2 appear to have the same name.',
      severity: 'warning',
    });
  }

  // 5. EMD deadline must be before auction date
  if (parsed.emdDeadline >= parsed.auctionDate) {
    errors.push({
      field: 'emdDeadline',
      message: 'EMD deadline must be before the auction date',
      severity: 'error',
    });
  }

  // 6. EMD amount warn if > reserve price
  if (parsed.emdAmount > parsed.reservePrice) {
    warnings.push({
      field: 'emdAmount',
      message: `EMD amount (₹${parsed.emdAmount.toLocaleString('en-IN')}) exceeds reserve price (₹${parsed.reservePrice.toLocaleString('en-IN')})`,
      severity: 'warning',
    });
  }

  // 7. At least 2 inspection dates
  if (parsed.propertyInspectionDates.length < MIN_INSPECTION_DATES) {
    errors.push({
      field: 'propertyInspectionDates',
      message: `At least ${MIN_INSPECTION_DATES} property inspection dates are required (currently ${parsed.propertyInspectionDates.length})`,
      severity: 'error',
    });
  }

  // 8. Sanction amount must exceed SARFAESI threshold
  if (caseData.sanctionAmount <= SARFAESI_THRESHOLD) {
    errors.push({
      field: 'sanctionAmount',
      message: `Sanction amount must exceed ₹${SARFAESI_THRESHOLD.toLocaleString('en-IN')} for SARFAESI applicability`,
      severity: 'error',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

const legalValidationService = {
  validateDemandNotice,
  computeDemandNoticeFields,
  validatePossessionNotice,
  computePossessionNoticeFields,
  validateSaleAuctionNotice,
};

export { legalValidationService };
