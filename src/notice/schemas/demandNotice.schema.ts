import { z } from 'zod/v4';

export const DemandNoticeFieldsSchema = z.object({
  noticeDate: z.coerce.date(),
  outstandingPrincipal: z.number().positive('Principal must be greater than zero'),
  outstandingInterest: z.number().min(0),
  otherCharges: z.number().min(0),
  totalAmountDemanded: z.number().positive(),
  repaymentDeadline: z.coerce.date(),
  authorizedOfficerName: z.string().min(1, 'Authorized Officer Name is required'),
  authorizedOfficerDesignation: z.string().min(1, 'Designation is required'),
  placeOfNotice: z.string().min(1, 'Place of notice is required'),
});

export type DemandNoticeFields = z.infer<typeof DemandNoticeFieldsSchema>;
