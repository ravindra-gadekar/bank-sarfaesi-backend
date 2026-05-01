import { z } from 'zod/v4';

export const SaleAuctionNoticeFieldsSchema = z.object({
  // Reference to prior 13(4) notice
  refPossessionNoticeId: z.string().min(1, 'Reference Possession Notice is required'),
  refPossessionDate: z.coerce.date(),

  // Outstanding amount
  outstandingOnSaleNoticeDate: z.number().positive('Outstanding amount must be greater than zero'),

  // Auction details
  auctionDate: z.coerce.date(),
  auctionTime: z.string().min(1, 'Auction time is required'),
  auctionVenueMode: z.enum(['physical', 'online'], {
    error: 'Auction venue mode must be either physical or online',
  }),
  auctionVenueAddress: z.string().min(1, 'Auction venue address or URL is required'),
  reservePrice: z.number().positive('Reserve price must be greater than zero'),
  bidIncrementAmount: z.number().min(0, 'Bid increment must be zero or positive'),

  // Valuation reports (two independent valuers required)
  valuer1Name: z.string().min(1, 'Valuer 1 name is required'),
  valuer1ReportDate: z.coerce.date(),
  valuer2Name: z.string().min(1, 'Valuer 2 name is required'),
  valuer2ReportDate: z.coerce.date(),

  // EMD (Earnest Money Deposit)
  emdAmount: z.number().positive('EMD amount must be greater than zero'),
  emdDeadline: z.coerce.date(),
  emdPaymentModes: z.array(z.string().min(1)).min(1, 'At least one EMD payment mode is required'),

  // Property inspection
  propertyInspectionDates: z.array(z.coerce.date()).min(2, 'At least 2 property inspection dates are required'),
  inspectionContactName: z.string().min(1, 'Inspection contact name is required'),
  inspectionContactPhone: z.string().min(10, 'Valid phone number is required'),

  // Terms & legal
  termsAndConditions: z.string().min(1, 'Terms and conditions are required'),
  encumbranceStatus: z.string().min(1, 'Encumbrance status is required'),

  // Notice metadata
  noticeDate: z.coerce.date(),
  authorizedOfficerName: z.string().min(1, 'Authorized Officer Name is required'),
  authorizedOfficerDesignation: z.string().min(1, 'Designation is required'),
  placeOfNotice: z.string().min(1, 'Place of notice is required'),
});

export type SaleAuctionNoticeFields = z.infer<typeof SaleAuctionNoticeFieldsSchema>;
