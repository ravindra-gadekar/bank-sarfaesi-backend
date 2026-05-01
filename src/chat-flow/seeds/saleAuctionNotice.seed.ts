import { IQuestionNode } from '../models/chatFlowConfig.model';

const questionFlow: IQuestionNode[] = [
  // ─── Group: prior_notice ───
  {
    id: 'q_ref_possession_confirm',
    questionText:
      'This sale notice is linked to the Section 13(4) Possession Notice dated {refPossessionDate}. Is this correct?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Yes, proceed', 'No, I need to update'],
    validation: [{ type: 'required', message: 'Please confirm the prior possession notice reference.' }],
    chatScript:
      'A Sale/Auction Notice under Rule 8/9 must always refer back to the prior Section 13(4) Possession Notice. The system auto-links to the most recent finalized possession notice for this case.',
    nextQuestion: 'q_outstanding',
    conditionalNext: [
      { value: 'Yes, proceed', nextId: 'q_outstanding' },
      { value: 'No, I need to update', nextId: 'q_ref_possession_confirm' },
    ],
    group: 'prior_notice',
    required: true,
  },
  {
    id: 'q_outstanding',
    questionText: 'What is the total outstanding amount as on the sale notice date?',
    fieldKey: 'outstandingOnSaleNoticeDate',
    inputType: 'currency',
    validation: [
      { type: 'required', message: 'Outstanding amount is required.' },
      { type: 'min', value: 1, message: 'Outstanding amount must be greater than zero.' },
    ],
    chatScript:
      'This is the total amount (principal + interest + charges) outstanding as of the date of this sale notice. It may be higher than previous notices due to continued interest accrual.',
    nextQuestion: 'q_notice_date',
    group: 'prior_notice',
    required: true,
  },

  // ─── Group: notice_details ───
  {
    id: 'q_notice_date',
    questionText: 'What is the date of this sale notice?',
    fieldKey: 'noticeDate',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Sale notice date is required.' }],
    chatScript:
      'This is the date the sale notice is being issued. The auction must be scheduled at least 30 days after this date as per Rule 8(6).',
    nextQuestion: 'q_place',
    group: 'notice_details',
    required: true,
  },
  {
    id: 'q_place',
    questionText: 'Where is this notice being issued from?',
    fieldKey: 'placeOfNotice',
    inputType: 'text',
    validation: [
      { type: 'required', message: 'Place of notice is required.' },
      { type: 'minLength', value: 2, message: 'Place must be at least 2 characters.' },
    ],
    chatScript: 'This is typically the city where your branch is located.',
    nextQuestion: 'q_ao_name',
    group: 'notice_details',
    required: true,
  },
  {
    id: 'q_ao_name',
    questionText: 'What is the name of the Authorized Officer?',
    fieldKey: 'authorizedOfficerName',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Authorized officer name is required.' }],
    chatScript: 'The authorized officer who will sign this sale notice and conduct the auction on behalf of the bank.',
    nextQuestion: 'q_ao_designation',
    group: 'notice_details',
    required: true,
  },
  {
    id: 'q_ao_designation',
    questionText: 'What is the designation of the Authorized Officer?',
    fieldKey: 'authorizedOfficerDesignation',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Designation is required.' }],
    chatScript: 'For example: Chief Manager, Branch Manager, etc.',
    nextQuestion: 'q_auction_date',
    group: 'notice_details',
    required: true,
  },

  // ─── Group: auction_details ───
  {
    id: 'q_auction_date',
    questionText: 'What is the date of the auction?',
    fieldKey: 'auctionDate',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Auction date is required.' }],
    chatScript:
      'Under Rule 8(6), the auction date must be at least 30 days after the sale notice date. The system will auto-compute and show the minimum allowed auction date.',
    nextQuestion: 'q_auction_time',
    group: 'auction_details',
    required: true,
  },
  {
    id: 'q_auction_time',
    questionText: 'What time will the auction start?',
    fieldKey: 'auctionTime',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Auction time is required.' }],
    chatScript: 'Specify the start time of the auction. For example: 11:00 AM, 2:00 PM.',
    nextQuestion: 'q_venue_mode',
    group: 'auction_details',
    required: true,
  },
  {
    id: 'q_venue_mode',
    questionText: 'Will the auction be conducted physically or online (e-auction)?',
    fieldKey: 'auctionVenueMode',
    inputType: 'dropdown',
    options: ['physical', 'online'],
    validation: [{ type: 'required', message: 'Auction venue mode is required.' }],
    chatScript:
      'Physical auctions are held at a physical location. E-auctions are conducted on government-approved portals like IBAPI (Indian Banks Auctions Mortgaged Properties Information). E-auctions are increasingly preferred for transparency.',
    nextQuestion: 'q_venue_address',
    conditionalNext: [
      { value: 'physical', nextId: 'q_venue_address' },
      { value: 'online', nextId: 'q_venue_address' },
    ],
    group: 'auction_details',
    required: true,
  },
  {
    id: 'q_venue_address',
    questionText: 'What is the auction venue address or e-auction portal URL?',
    fieldKey: 'auctionVenueAddress',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Venue address or portal URL is required.' }],
    chatScript:
      'For physical auction: provide the full address of the auction venue. For e-auction: provide the portal URL (e.g., https://ibapi.in).',
    nextQuestion: 'q_reserve_price',
    group: 'auction_details',
    required: true,
  },
  {
    id: 'q_reserve_price',
    questionText: 'What is the reserve price for the property?',
    fieldKey: 'reservePrice',
    inputType: 'currency',
    validation: [
      { type: 'required', message: 'Reserve price is required.' },
      { type: 'min', value: 1, message: 'Reserve price must be greater than zero.' },
    ],
    chatScript:
      'The reserve price is the minimum price below which the property will not be sold. It is typically based on the average of two independent valuations. Bidding starts from the reserve price.',
    nextQuestion: 'q_bid_increment',
    group: 'auction_details',
    required: true,
  },
  {
    id: 'q_bid_increment',
    questionText: 'What is the minimum bid increment amount?',
    fieldKey: 'bidIncrementAmount',
    inputType: 'currency',
    validation: [{ type: 'min', value: 0, message: 'Bid increment cannot be negative.' }],
    chatScript:
      'This is the minimum amount by which each subsequent bid must exceed the previous bid. Enter 0 if there is no minimum increment.',
    nextQuestion: 'q_valuer1_name',
    group: 'auction_details',
    required: false,
  },

  // ─── Group: valuation ───
  {
    id: 'q_valuer1_name',
    questionText: 'What is the name of Valuer 1?',
    fieldKey: 'valuer1Name',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Valuer 1 name is required.' }],
    chatScript:
      'Under SARFAESI rules, the property must be valued by two independent valuers before sale. The reserve price is typically based on the average of these two valuations.',
    nextQuestion: 'q_valuer1_date',
    group: 'valuation',
    required: true,
  },
  {
    id: 'q_valuer1_date',
    questionText: 'What is the date of Valuer 1\'s report?',
    fieldKey: 'valuer1ReportDate',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Valuer 1 report date is required.' }],
    chatScript: 'The date when the first valuation report was prepared.',
    nextQuestion: 'q_valuer2_name',
    group: 'valuation',
    required: true,
  },
  {
    id: 'q_valuer2_name',
    questionText: 'What is the name of Valuer 2?',
    fieldKey: 'valuer2Name',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Valuer 2 name is required.' }],
    chatScript:
      'The second valuer must be independent from the first. Using the same person for both valuations may invalidate the sale process.',
    nextQuestion: 'q_valuer2_date',
    group: 'valuation',
    required: true,
  },
  {
    id: 'q_valuer2_date',
    questionText: 'What is the date of Valuer 2\'s report?',
    fieldKey: 'valuer2ReportDate',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Valuer 2 report date is required.' }],
    chatScript: 'The date when the second valuation report was prepared.',
    nextQuestion: 'q_emd_amount',
    group: 'valuation',
    required: true,
  },

  // ─── Group: emd_inspection ───
  {
    id: 'q_emd_amount',
    questionText: 'What is the EMD (Earnest Money Deposit) amount?',
    fieldKey: 'emdAmount',
    inputType: 'currency',
    validation: [
      { type: 'required', message: 'EMD amount is required.' },
      { type: 'min', value: 1, message: 'EMD amount must be greater than zero.' },
    ],
    chatScript:
      'EMD is the earnest money deposit that bidders must pay before participating in the auction. It is typically 10% of the reserve price. The EMD of unsuccessful bidders is refunded after the auction.',
    nextQuestion: 'q_emd_deadline',
    group: 'emd_inspection',
    required: true,
  },
  {
    id: 'q_emd_deadline',
    questionText: 'What is the deadline for EMD submission?',
    fieldKey: 'emdDeadline',
    inputType: 'date',
    validation: [{ type: 'required', message: 'EMD deadline is required.' }],
    chatScript:
      'The EMD must be deposited before the auction date. Typically this is 1-2 days before the auction to allow verification.',
    nextQuestion: 'q_emd_modes',
    group: 'emd_inspection',
    required: true,
  },
  {
    id: 'q_emd_modes',
    questionText: 'What payment modes are accepted for EMD? (Select all that apply: DD, RTGS, NEFT, Online Banking, UPI)',
    fieldKey: 'emdPaymentModes',
    inputType: 'text',
    validation: [{ type: 'required', message: 'At least one payment mode is required.' }],
    chatScript:
      'Specify all acceptable payment methods for the EMD. Common modes include Demand Draft (DD), RTGS, NEFT, Online Banking, and UPI. Enter them separated by commas.',
    nextQuestion: 'q_inspection_dates',
    group: 'emd_inspection',
    required: true,
  },
  {
    id: 'q_inspection_dates',
    questionText: 'On which dates can interested bidders inspect the property? (At least 2 dates required)',
    fieldKey: 'propertyInspectionDates',
    inputType: 'text',
    validation: [{ type: 'required', message: 'At least 2 inspection dates are required.' }],
    chatScript:
      'Interested bidders must be given an opportunity to inspect the property before the auction. At least 2 inspection dates should be provided. Dates should be before the auction date.',
    nextQuestion: 'q_inspection_contact_name',
    group: 'emd_inspection',
    required: true,
  },
  {
    id: 'q_inspection_contact_name',
    questionText: 'Who is the contact person for property inspection?',
    fieldKey: 'inspectionContactName',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Contact person name is required.' }],
    chatScript:
      'This person will be available to show the property to interested bidders during the scheduled inspection dates.',
    nextQuestion: 'q_inspection_contact_phone',
    group: 'emd_inspection',
    required: true,
  },
  {
    id: 'q_inspection_contact_phone',
    questionText: 'What is the contact phone number for property inspection?',
    fieldKey: 'inspectionContactPhone',
    inputType: 'text',
    validation: [
      { type: 'required', message: 'Contact phone number is required.' },
      { type: 'minLength', value: 10, message: 'Phone number must be at least 10 digits.' },
    ],
    chatScript: 'Provide the phone number that will be published in the sale notice for bidder inquiries.',
    nextQuestion: 'q_terms',
    group: 'emd_inspection',
    required: true,
  },

  // ─── Group: terms_legal ───
  {
    id: 'q_terms',
    questionText: 'The standard terms and conditions have been pre-filled. Would you like to review or modify them?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Keep standard terms', 'I will edit in the form'],
    validation: [{ type: 'required', message: 'Please select an option.' }],
    chatScript:
      'The terms and conditions cover: sale on "as is where is" basis, successful bidder\'s obligations, payment timelines, forfeiture of EMD on default, and other standard clauses per SARFAESI rules.',
    nextQuestion: 'q_encumbrance',
    conditionalNext: [
      { value: 'Keep standard terms', nextId: 'q_encumbrance' },
      { value: 'I will edit in the form', nextId: 'q_encumbrance' },
    ],
    group: 'terms_legal',
    required: true,
  },
  {
    id: 'q_encumbrance',
    questionText: 'The standard encumbrance status has been pre-filled. Would you like to review or modify it?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Keep standard text', 'I will edit in the form'],
    validation: [{ type: 'required', message: 'Please select an option.' }],
    chatScript:
      'Encumbrance status discloses any known charges, liens, or encumbrances on the property. This is important for bidders to know the legal status of the property being auctioned.',
    nextQuestion: 'q_review',
    conditionalNext: [
      { value: 'Keep standard text', nextId: 'q_review' },
      { value: 'I will edit in the form', nextId: 'q_review' },
    ],
    group: 'terms_legal',
    required: true,
  },

  // ─── Group: review ───
  {
    id: 'q_review',
    questionText:
      "All fields for the Sale/Auction Notice are complete! Here's a summary. Would you like to submit it for review?",
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Submit for review', 'Let me review the form first'],
    validation: [{ type: 'required', message: 'Please select an option.' }],
    chatScript:
      'Review all details carefully — especially the auction date (must be ≥ 30 days from sale notice), reserve price, EMD details, and inspection dates. Once submitted, a Checker will review and approve. After approval, DOCX and PDF documents will be auto-generated.',
    nextQuestion: null,
    group: 'review',
    required: true,
  },
];

const keywordAnswerMap: Record<string, string> = {
  'what is rule 8':
    'Rule 8 of the Security Interest (Enforcement) Rules, 2002 governs the sale of secured assets. Rule 8(5) requires publication of a sale notice in two newspapers (one in English, one in local language). Rule 8(6) specifies a minimum 30-day notice period between the sale notice and the auction date. Rule 8(1) requires the auction to be conducted in a fair and transparent manner.',
  'what is rule 9':
    'Rule 9 of the Security Interest (Enforcement) Rules deals with the time and mode of sale. The authorized officer can sell the secured asset by public auction, by private treaty, or by inviting tenders. The sale must ensure the best possible price is obtained for the asset.',
  'what is reserve price':
    'The reserve price is the minimum price below which the property will not be sold at auction. It is typically determined based on the average of two independent valuations. If no bidder meets the reserve price, the auction may be rescheduled with a reduced reserve price (typically up to 25% reduction).',
  'what is emd':
    'EMD (Earnest Money Deposit) is a refundable deposit that bidders must pay before participating in the auction. It shows the seriousness of the bidder. The EMD is typically 10% of the reserve price. The successful bidder\'s EMD is adjusted against the sale price, while unsuccessful bidders\' EMD is refunded after the auction.',
  'what is e-auction':
    'E-auction (electronic auction) is an online auction conducted through approved portals like IBAPI (Indian Banks Auctions Mortgaged Properties Information) at https://ibapi.in. E-auctions provide greater transparency, wider participation, and are increasingly mandated by banking regulators. Bidders can participate from anywhere with an internet connection.',
  'what is ibapi':
    'IBAPI (Indian Banks Auctions Mortgaged Properties Information) is the centralized platform created by Indian Banks Association for conducting e-auctions of properties under SARFAESI and DRT proceedings. It is available at https://ibapi.in and is used by most banks for transparent online auctions.',
  'how is reserve price determined':
    'The reserve price is determined based on valuations by two independent, government-approved valuers. The bank typically takes the average of the two valuations. The valuers must assess the current market value of the property considering its location, condition, and similar transaction prices in the area.',
  'what happens if no bidder':
    'If no bids are received at or above the reserve price, the auction is deemed unsuccessful. The authorized officer can then: (1) reschedule the auction with a reduced reserve price (up to 25% reduction), (2) attempt a private sale, or (3) seek fresh valuations and conduct another auction.',
  'what is the 30 day rule':
    'Rule 8(6) mandates that the sale notice must be published at least 30 days before the date fixed for the sale/auction. This 30-day notice period gives interested bidders sufficient time to arrange funds, inspect the property, and submit their EMD.',
  'can borrower redeem property':
    'Yes. Under Section 13(8) of SARFAESI, the borrower can redeem the secured asset at any time before the sale/auction by paying the entire outstanding amount (principal + interest + costs + charges). Once the sale is confirmed and the sale certificate issued, the right to redeem is extinguished.',
  'what about stamp duty':
    'Stamp duty on the sale of secured assets under SARFAESI is payable as per the stamp duty laws of the respective state where the property is located. The buyer (successful bidder) is responsible for paying the stamp duty and registration charges.',
  'what is as is where is basis':
    '"As is where is" means the property is sold in its current condition without any warranties or guarantees from the bank. The buyer accepts the property in whatever state it is found, including any defects, encumbrances, or issues. It is the bidder\'s responsibility to inspect the property before bidding.',
};

export function getSaleAuctionNoticeSeedConfig(): {
  noticeType: string;
  questionFlow: IQuestionNode[];
  keywordAnswerMap: Record<string, string>;
} {
  return {
    noticeType: 'sale_auction',
    questionFlow,
    keywordAnswerMap,
  };
}
