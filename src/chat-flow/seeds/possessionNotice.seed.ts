import { IQuestionNode } from '../models/chatFlowConfig.model';

const questionFlow: IQuestionNode[] = [
  // ─── Group: prior_notice ───
  {
    id: 'q_ref_demand_confirm',
    questionText:
      'This possession notice is linked to the Section 13(2) Demand Notice dated {refDemandNoticeDate} for ₹{refDemandAmountDemanded}. Is this correct?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Yes, proceed', 'No, I need to update'],
    validation: [{ type: 'required', message: 'Please confirm the prior demand notice reference.' }],
    chatScript:
      'A Section 13(4) Possession Notice must always refer back to the prior 13(2) Demand Notice. The system auto-links to the most recent finalized demand notice for this case.',
    nextQuestion: 'q_notice_date',
    conditionalNext: [
      { value: 'Yes, proceed', nextId: 'q_notice_date' },
      { value: 'No, I need to update', nextId: 'q_ref_demand_confirm' },
    ],
    group: 'prior_notice',
    required: true,
  },

  // ─── Group: notice_details ───
  {
    id: 'q_notice_date',
    questionText: 'What is the date of this possession notice?',
    fieldKey: 'noticeDate',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Notice date is required.' }],
    chatScript:
      'This is the date the possession notice is being issued. It should be today or a recent date. The Section 17 DRT appeal deadline (45 days) will be computed from the date of possession.',
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
    chatScript: 'The authorized officer who will sign this possession notice on behalf of the bank.',
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
    nextQuestion: 'q_outstanding',
    group: 'notice_details',
    required: true,
  },

  // ─── Group: possession_details ───
  {
    id: 'q_outstanding',
    questionText: 'What is the total outstanding amount as on the date of possession?',
    fieldKey: 'outstandingOnPossessionDate',
    inputType: 'currency',
    validation: [
      { type: 'required', message: 'Outstanding amount is required.' },
      { type: 'min', value: 1, message: 'Outstanding amount must be greater than zero.' },
    ],
    chatScript:
      'This is the total amount (principal + interest + charges) outstanding as of the date you are taking possession. It may differ from the demand notice amount due to accruing interest.',
    nextQuestion: 'q_possession_date',
    group: 'possession_details',
    required: true,
  },
  {
    id: 'q_possession_date',
    questionText: 'On which date was or will possession be taken?',
    fieldKey: 'dateOfPossession',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Date of possession is required.' }],
    chatScript:
      'This must be at least 60 days after the Section 13(2) demand notice date. If the borrower has not repaid within the 60-day period, the bank can take possession of the secured asset. The Section 17 DRT deadline (45 days) will be auto-computed from this date.',
    nextQuestion: 'q_possession_mode',
    group: 'possession_details',
    required: true,
  },
  {
    id: 'q_possession_mode',
    questionText: 'What mode of possession is being taken?',
    fieldKey: 'modeOfPossession',
    inputType: 'dropdown',
    options: ['symbolic', 'physical'],
    validation: [{ type: 'required', message: 'Mode of possession is required.' }],
    chatScript:
      'Symbolic possession means the bank puts up a notice/board on the property without physically occupying it. Physical possession means the bank takes actual control of the property. Symbolic possession is more common in SARFAESI proceedings.',
    nextQuestion: 'q_witness1_name',
    conditionalNext: [
      { value: 'symbolic', nextId: 'q_witness1_name' },
      { value: 'physical', nextId: 'q_witness1_name' },
    ],
    group: 'possession_details',
    required: true,
  },

  // ─── Group: witnesses ───
  {
    id: 'q_witness1_name',
    questionText: 'What is the name of Witness 1?',
    fieldKey: 'witness1Name',
    inputType: 'text',
    validation: [{ type: 'required', message: 'At least one witness is required.' }],
    chatScript:
      'Under SARFAESI rules, witnesses must be present during possession. At least one witness is mandatory; two witnesses are strongly recommended.',
    nextQuestion: 'q_witness1_designation',
    group: 'witnesses',
    required: true,
  },
  {
    id: 'q_witness1_designation',
    questionText: 'What is the designation of Witness 1?',
    fieldKey: 'witness1Designation',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Witness 1 designation is required.' }],
    chatScript: 'For example: Bank Officer, Panchayat Member, Notary Public, etc.',
    nextQuestion: 'q_witness2_name',
    group: 'witnesses',
    required: true,
  },
  {
    id: 'q_witness2_name',
    questionText: 'What is the name of Witness 2? (Strongly recommended)',
    fieldKey: 'witness2Name',
    inputType: 'text',
    validation: [],
    chatScript:
      'A second witness strengthens the legal standing of the possession. While not strictly mandatory, it is strongly recommended to have two independent witnesses.',
    nextQuestion: 'q_witness2_designation',
    group: 'witnesses',
    required: false,
  },
  {
    id: 'q_witness2_designation',
    questionText: 'What is the designation of Witness 2?',
    fieldKey: 'witness2Designation',
    inputType: 'text',
    validation: [],
    chatScript: 'Designation of the second witness.',
    nextQuestion: 'q_newspaper1_name',
    group: 'witnesses',
    required: false,
  },

  // ─── Group: newspaper_publication ───
  {
    id: 'q_newspaper1_name',
    questionText: 'What is the name of the English newspaper for publication?',
    fieldKey: 'newspaper1Name',
    inputType: 'text',
    validation: [{ type: 'required', message: 'English newspaper name is required.' }],
    chatScript:
      'Under Rule 8(1), the possession notice must be published in two newspapers — one in English and one in the local/vernacular language. The publication must be within 7 days of taking possession.',
    nextQuestion: 'q_newspaper1_date',
    group: 'newspaper_publication',
    required: true,
  },
  {
    id: 'q_newspaper1_date',
    questionText: 'On which date was or will the English publication appear?',
    fieldKey: 'newspaper1Date',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Publication date is required.' }],
    chatScript: 'This date must be within 7 days of the date of possession.',
    nextQuestion: 'q_newspaper2_name',
    group: 'newspaper_publication',
    required: true,
  },
  {
    id: 'q_newspaper2_name',
    questionText: 'What is the name of the vernacular (local language) newspaper?',
    fieldKey: 'newspaper2Name',
    inputType: 'text',
    validation: [{ type: 'required', message: 'Vernacular newspaper name is required.' }],
    chatScript:
      'This must be a newspaper in the local language of the area where the secured asset is located.',
    nextQuestion: 'q_newspaper2_date',
    group: 'newspaper_publication',
    required: true,
  },
  {
    id: 'q_newspaper2_date',
    questionText: 'On which date was or will the vernacular publication appear?',
    fieldKey: 'newspaper2Date',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Publication date is required.' }],
    chatScript: 'This date must also be within 7 days of the date of possession.',
    nextQuestion: 'q_drt',
    group: 'newspaper_publication',
    required: true,
  },

  // ─── Group: drt_review ───
  {
    id: 'q_drt',
    questionText: 'What is the DRT name and location for this asset jurisdiction?',
    fieldKey: 'drtNameLocation',
    inputType: 'text',
    validation: [{ type: 'required', message: 'DRT name and location is required.' }],
    chatScript:
      'The Debt Recovery Tribunal (DRT) where the borrower can file an appeal under Section 17 of SARFAESI. This is determined by the location of the secured asset. The borrower has 45 days from the date of possession to approach the DRT.',
    nextQuestion: 'q_section17_confirm',
    group: 'drt_review',
    required: true,
  },
  {
    id: 'q_section17_confirm',
    questionText:
      'The Section 17 DRT appeal deadline has been auto-computed as {section17Deadline} (possession date + 45 days). Is everything ready for review?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Yes, proceed to review', 'Let me check the form'],
    validation: [{ type: 'required', message: 'Please confirm.' }],
    chatScript:
      'Section 17 of SARFAESI allows the borrower to approach the DRT within 45 days of any action taken under Section 13(4). This deadline is auto-computed for reference.',
    nextQuestion: 'q_review',
    conditionalNext: [
      { value: 'Yes, proceed to review', nextId: 'q_review' },
      { value: 'Let me check the form', nextId: 'q_section17_confirm' },
    ],
    group: 'drt_review',
    required: true,
  },
  {
    id: 'q_review',
    questionText:
      "All fields for the Possession Notice are complete! Here's a summary. Would you like to submit it for review?",
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Submit for review', 'Let me review the form first'],
    validation: [{ type: 'required', message: 'Please select an option.' }],
    chatScript:
      'Review all details carefully before submitting. Once submitted, a Checker will review and approve this possession notice. After approval, DOCX and PDF documents will be auto-generated.',
    nextQuestion: null,
    group: 'drt_review',
    required: true,
  },
];

const keywordAnswerMap: Record<string, string> = {
  'what is section 13(4)':
    'Section 13(4) of the SARFAESI Act allows the secured creditor to take possession of the secured assets if the borrower fails to repay within the 60-day period given in the Section 13(2) demand notice. The secured creditor can: (a) take possession of the secured asset, (b) take over management of the borrower\'s business, (c) appoint a manager, or (d) require any person who acquired the asset from the borrower to pay remaining debt.',
  'what is symbolic possession':
    'Symbolic possession is when the bank affixes a notice or puts up a board on the secured property without physically occupying or taking control of it. The property remains in the physical custody of the borrower, but legally the bank has asserted its right. Symbolic possession is the most common form in SARFAESI proceedings and is typically the first step before physical possession.',
  'what is physical possession':
    'Physical possession means the bank takes actual, physical control of the secured asset — by entering the premises, changing locks, appointing a caretaker, or physically removing movable assets. Physical possession is more aggressive and usually follows symbolic possession if the borrower does not cooperate.',
  'what is section 17':
    'Section 17 of the SARFAESI Act gives the borrower the right to appeal to the Debt Recovery Tribunal (DRT) within 45 days of any action taken by the secured creditor under Section 13(4). The DRT can set aside the secured creditor\'s action if it finds it was not in accordance with the provisions of the Act.',
  'what about newspaper publication':
    'Under Rule 8(1) of the Security Interest (Enforcement) Rules, 2002, the secured creditor must publish a notice of possession in two newspapers — one in English and one in the local/vernacular language of the area where the property is located. Publication must be within 7 days of taking possession.',
  'how many witnesses are needed':
    'While the SARFAESI Act does not specify a minimum number of witnesses, it is standard practice and strongly recommended to have at least two independent witnesses present during the possession process. This strengthens the legal standing of the possession if challenged in court.',
  'what is the 60 day rule':
    'The Section 13(2) demand notice gives the borrower 60 days to repay the outstanding amount. The secured creditor cannot take possession under Section 13(4) before this 60-day period expires. The 60-day gap between the demand notice date and the possession date is a mandatory legal requirement.',
  'what is drt':
    'DRT (Debt Recovery Tribunal) is a specialized tribunal that handles cases related to recovery of debts above ₹20 lakh. Under SARFAESI, borrowers can appeal to the DRT within 45 days of any action taken by the secured creditor. The DRT has the power to set aside or modify the secured creditor\'s actions.',
  'can borrower stop possession':
    'The borrower can: (1) repay the full outstanding amount before possession, (2) make a representation under Section 13(3A) within the 60-day demand notice period, (3) approach the DRT under Section 17 within 45 days of possession, or (4) seek a stay order from the DRT. However, the borrower cannot simply refuse possession if all legal requirements have been met.',
  'what happens after possession':
    'After taking possession under Section 13(4), the secured creditor must: (1) publish a notice in two newspapers, (2) issue a sale notice under Rule 8(5)/8(6) with at least 30 days notice before the sale date, (3) get property valued by two independent valuers, and (4) conduct the sale/auction in a fair and transparent manner.',
};

export function getPossessionNoticeSeedConfig(): {
  noticeType: string;
  questionFlow: IQuestionNode[];
  keywordAnswerMap: Record<string, string>;
} {
  return {
    noticeType: 'possession_13_4',
    questionFlow,
    keywordAnswerMap,
  };
}
