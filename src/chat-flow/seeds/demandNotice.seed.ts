import { IQuestionNode } from '../models/chatFlowConfig.model';

const questionFlow: IQuestionNode[] = [
  // ─── Group: notice_details ───
  {
    id: 'q_notice_date',
    questionText: 'When should the notice be dated?',
    fieldKey: 'noticeDate',
    inputType: 'date',
    validation: [{ type: 'required', message: 'Notice date is required.' }],
    chatScript:
      'The notice date determines legal timelines. It should be today or a recent date. The 60-day repayment deadline will be calculated from this date.',
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
    chatScript: 'The authorized officer who will sign this notice.',
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
    nextQuestion: 'q_principal',
    group: 'notice_details',
    required: true,
  },

  // ─── Group: amounts ───
  {
    id: 'q_principal',
    questionText: 'What is the outstanding principal amount?',
    fieldKey: 'outstandingPrincipal',
    inputType: 'currency',
    validation: [
      { type: 'required', message: 'Principal amount is required.' },
      { type: 'min', value: 1, message: 'Principal amount must be greater than zero.' },
    ],
    chatScript: 'Enter the principal loan amount that is currently outstanding.',
    nextQuestion: 'q_interest',
    group: 'amounts',
    required: true,
  },
  {
    id: 'q_interest',
    questionText: 'What is the outstanding interest amount?',
    fieldKey: 'outstandingInterest',
    inputType: 'currency',
    validation: [
      { type: 'required', message: 'Interest amount is required.' },
      { type: 'min', value: 0, message: 'Interest amount cannot be negative.' },
    ],
    chatScript: 'Enter the accrued interest amount.',
    nextQuestion: 'q_other_charges',
    group: 'amounts',
    required: true,
  },
  {
    id: 'q_other_charges',
    questionText: 'Are there any other charges (penal interest, legal costs, etc.)?',
    fieldKey: 'otherCharges',
    inputType: 'currency',
    validation: [{ type: 'min', value: 0, message: 'Other charges cannot be negative.' }],
    chatScript:
      'Include any additional charges like penal interest, inspection fees, legal costs, etc. Enter 0 if none.',
    nextQuestion: 'q_total_confirm',
    group: 'amounts',
    required: false,
  },
  {
    id: 'q_total_confirm',
    questionText: 'The total amount demanded is ₹{totalAmountDemanded}. Is this correct?',
    fieldKey: 'totalAmountDemanded',
    inputType: 'dropdown',
    options: ['Yes, proceed', 'No, let me adjust'],
    validation: [{ type: 'required', message: 'Please confirm the total amount.' }],
    chatScript: 'This is automatically calculated as Principal + Interest + Other Charges.',
    nextQuestion: 'q_borrower_confirm',
    conditionalNext: [
      { value: 'Yes, proceed', nextId: 'q_borrower_confirm' },
      { value: 'No, let me adjust', nextId: 'q_principal' },
    ],
    group: 'amounts',
    required: true,
  },

  // ─── Group: borrower ───
  {
    id: 'q_borrower_confirm',
    questionText:
      'The primary borrower from the case is {borrowerName}. The address on file is {borrowerAddress}. Should we proceed with these details?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Yes, proceed', 'No, I need to update'],
    validation: [{ type: 'required', message: 'Please confirm borrower details.' }],
    chatScript:
      'These details are fetched from the linked NPA case. If you need to update them, please go to the case first.',
    nextQuestion: 'q_add_more_borrower',
    conditionalNext: [
      { value: 'Yes, proceed', nextId: 'q_add_more_borrower' },
      { value: 'No, I need to update', nextId: 'q_borrower_confirm' },
    ],
    group: 'borrower',
    required: true,
  },
  {
    id: 'q_add_more_borrower',
    questionText: 'Would you like to address this notice to any additional co-borrowers or guarantors?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Yes, add another', 'No, proceed'],
    validation: [],
    chatScript:
      'Under SARFAESI, the demand notice must be issued to the borrower and all co-borrowers/guarantors. Add all relevant parties.',
    nextQuestion: 'q_assets_confirm',
    conditionalNext: [
      { value: 'Yes, add another', nextId: 'q_add_more_borrower' },
      { value: 'No, proceed', nextId: 'q_assets_confirm' },
    ],
    isLoopStart: true,
    loopBackTo: 'q_add_more_borrower',
    loopPrompt: 'Add another co-borrower or guarantor?',
    group: 'borrower',
    required: false,
  },

  // ─── Group: assets ───
  {
    id: 'q_assets_confirm',
    questionText: 'The following secured assets are linked to this case: {assetList}. Is this correct?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Yes, proceed', 'No, I need to update'],
    validation: [{ type: 'required', message: 'Please confirm asset details.' }],
    chatScript:
      'These are the secured assets from the linked NPA case. If incorrect, please update the case record first.',
    nextQuestion: 'q_review',
    conditionalNext: [
      { value: 'Yes, proceed', nextId: 'q_review' },
      { value: 'No, I need to update', nextId: 'q_assets_confirm' },
    ],
    group: 'assets',
    required: true,
  },

  // ─── Group: review ───
  {
    id: 'q_review',
    questionText: 'All fields are filled! Here\'s a summary of the demand notice. Would you like to submit it for review?',
    fieldKey: '',
    inputType: 'dropdown',
    options: ['Submit for review', 'Let me review the form first'],
    validation: [{ type: 'required', message: 'Please select an option.' }],
    chatScript:
      'Review all the details carefully before submitting. Once submitted, a Checker will review and approve the notice.',
    nextQuestion: null,
    group: 'review',
    required: true,
  },
];

const keywordAnswerMap: Record<string, string> = {
  'what is sarfaesi':
    'The SARFAESI Act (Securitisation and Reconstruction of Financial Assets and Enforcement of Security Interest Act, 2002) allows banks and financial institutions to recover Non-Performing Assets (NPAs) without court intervention. It empowers secured creditors to take possession of and sell secured assets.',
  'what is section 13(2)':
    'Section 13(2) of the SARFAESI Act requires the secured creditor to issue a written demand notice to the borrower, calling upon them to repay the outstanding secured debt within 60 days from the date of the notice. This is the first formal step in the enforcement process.',
  'what is npa':
    'NPA (Non-Performing Asset) is a loan or advance where the borrower has failed to make interest or principal payments for 90 days or more. Once classified as NPA, the bank can initiate recovery proceedings under SARFAESI.',
  'what is the time limit':
    'Under Section 13(2), the borrower gets 60 days from the date of the demand notice to repay the outstanding amount. If the borrower fails to repay within 60 days, the bank can proceed to take possession of the secured assets under Section 13(4).',
  'who signs the notice':
    'The demand notice must be signed by an Authorized Officer of the bank. The authorized officer is appointed by the bank\'s board or management and must have the legal authority to act on behalf of the secured creditor.',
  'what is drt':
    'DRT (Debt Recovery Tribunal) is a specialized tribunal established under the Recovery of Debts Due to Banks and Financial Institutions Act, 1993. It handles cases related to recovery of debts above ₹20 lakh owed to banks and financial institutions. Under SARFAESI, borrowers can appeal to DRT within 45 days of any action taken by the secured creditor.',
  'what is section 13(4)':
    'Section 13(4) of the SARFAESI Act allows the secured creditor to take possession of the secured assets if the borrower fails to repay within the 60-day period given in the Section 13(2) demand notice. This is the second stage of the enforcement process.',
  'what is rule 8':
    'Rule 8 of the Security Interest (Enforcement) Rules, 2002 deals with the sale of secured assets. Rule 8(5) requires publication of a sale notice in two newspapers (one in local language). Rule 8(6) specifies the minimum 30-day notice period before the sale date.',
  'what is a secured creditor':
    'A secured creditor is any bank, financial institution, or asset reconstruction company that has a security interest (mortgage, hypothecation, pledge, or charge) over the borrower\'s assets. Only secured creditors with at least 60% of the outstanding debt can invoke SARFAESI.',
  'can borrower object':
    'Yes. Under Section 13(3A), the borrower can make a representation or raise objections within 60 days of receiving the demand notice. The secured creditor must consider the representation and communicate reasons if the objection is rejected.',
  'what documents are needed':
    'For a demand notice under Section 13(2), you need: loan account details, outstanding amount breakup (principal + interest + charges), borrower and co-borrower/guarantor details with addresses, description of secured assets, and the NPA classification date.',
  'what is the format':
    'The demand notice must be in the format prescribed under Rule 3 of the Security Interest (Enforcement) Rules, 2002. It must include: details of the secured debt, the amount due, the 60-day notice period, and a statement that the secured creditor will exercise rights under Section 13(4) if the borrower fails to comply.',
  'what happens after 60 days':
    'If the borrower fails to repay within 60 days of the demand notice, the secured creditor can: (a) take possession of the secured assets under Section 13(4), (b) take over management of the business, (c) appoint a manager to manage the secured assets, or (d) require any person who has acquired the secured asset to pay remaining debt.',
};

export function getDemandNoticeSeedConfig(): {
  noticeType: string;
  questionFlow: IQuestionNode[];
  keywordAnswerMap: Record<string, string>;
} {
  return {
    noticeType: 'demand_13_2',
    questionFlow,
    keywordAnswerMap,
  };
}
