import { z } from 'zod/v4';

export const PossessionNoticeFieldsSchema = z.object({
  // Reference to prior 13(2) demand notice
  refDemandNoticeId: z.string().min(1, 'Reference Demand Notice is required'),
  refDemandNoticeDate: z.coerce.date(),
  refDemandAmountDemanded: z.number().positive('Demand amount must be greater than zero'),

  // Possession details
  outstandingOnPossessionDate: z.number().positive('Outstanding amount must be greater than zero'),
  dateOfPossession: z.coerce.date(),
  modeOfPossession: z.enum(['symbolic', 'physical'], {
    error: 'Mode of possession must be either symbolic or physical',
  }),

  // Witnesses
  witness1Name: z.string().min(1, 'Witness 1 name is required'),
  witness1Designation: z.string().min(1, 'Witness 1 designation is required'),
  witness2Name: z.string().optional(),
  witness2Designation: z.string().optional(),

  // Newspaper publication
  newspaper1Name: z.string().min(1, 'English newspaper name is required'),
  newspaper1Date: z.coerce.date(),
  newspaper2Name: z.string().min(1, 'Vernacular newspaper name is required'),
  newspaper2Date: z.coerce.date(),

  // DRT & Legal
  drtNameLocation: z.string().min(1, 'DRT name and location is required'),
  section17Deadline: z.coerce.date(), // auto-computed: dateOfPossession + 45 days

  // Authorized officer
  authorizedOfficerName: z.string().min(1, 'Authorized Officer Name is required'),
  authorizedOfficerDesignation: z.string().min(1, 'Designation is required'),
  placeOfNotice: z.string().min(1, 'Place of notice is required'),
  noticeDate: z.coerce.date(),
});

export type PossessionNoticeFields = z.infer<typeof PossessionNoticeFieldsSchema>;
