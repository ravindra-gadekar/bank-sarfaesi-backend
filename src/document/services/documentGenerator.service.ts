import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  UnderlineType,
} from 'docx';
import puppeteer from 'puppeteer';

export interface GenerationContext {
  notice: {
    noticeType: string;
    fields: Record<string, unknown>;
    recipients: Array<{ name: string; address: string; type: string }>;
  };
  branch: {
    bankName: string;
    branchName: string;
    branchAddress: string;
    city: string;
    state: string;
    letterheadFileKey?: string;
    ifscCode: string;
    phone?: string;
    email: string;
  };
  caseData: {
    accountNo: string;
    loanType: string;
    sanctionDate: Date;
    sanctionAmount: number;
    npaDate: Date;
    securedAssets: Array<{
      assetType: string;
      description: string;
      surveyNo?: string;
      area?: string;
      district?: string;
      state?: string;
    }>;
    securityDocuments: Array<{ documentType: string; date: Date }>;
  };
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const documentGeneratorService = {
  generateDemandNoticeHtml(
    context: GenerationContext,
    recipientName: string,
    recipientAddress: string,
  ): string {
    const { branch, caseData, notice } = context;
    const fields = notice.fields;

    const principalOutstanding = Number(fields.outstandingPrincipal ?? fields.principalOutstanding ?? 0);
    const interestOutstanding = Number(fields.outstandingInterest ?? fields.interestOutstanding ?? 0);
    const otherCharges = Number(fields.otherCharges ?? 0);
    const totalOutstanding = principalOutstanding + interestOutstanding + otherCharges;

    const noticeDate = fields.noticeDate
      ? formatDate(new Date(fields.noticeDate as string))
      : formatDate(new Date());
    const noticePlace = escapeHtml(String(fields.placeOfNotice ?? fields.noticePlace ?? branch.city));

    const authorizedOfficerName = escapeHtml(
      String(fields.authorizedOfficerName ?? ''),
    );
    const authorizedOfficerDesignation = escapeHtml(
      String(fields.authorizedOfficerDesignation ?? ''),
    );

    const assetsHtml = caseData.securedAssets
      .map(
        (asset, idx) =>
          `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(asset.assetType)}</td>
            <td>${escapeHtml(asset.description)}${asset.surveyNo ? `, Survey No: ${escapeHtml(asset.surveyNo)}` : ''}${asset.area ? `, Area: ${escapeHtml(asset.area)}` : ''}${asset.district ? `, District: ${escapeHtml(asset.district)}` : ''}${asset.state ? `, State: ${escapeHtml(asset.state)}` : ''}</td>
          </tr>`,
      )
      .join('\n');

    const securityDocsHtml = caseData.securityDocuments
      .map(
        (doc, idx) =>
          `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(doc.documentType)}</td>
            <td>${formatDate(doc.date)}</td>
          </tr>`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Demand Notice under Section 13(2) — ${escapeHtml(caseData.accountNo)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
      padding: 20mm 15mm;
    }
    .letterhead {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .letterhead .bank-name {
      font-size: 18pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .letterhead .branch-info {
      font-size: 10pt;
      margin-top: 4px;
    }
    .notice-heading {
      text-align: center;
      font-weight: bold;
      font-size: 12pt;
      margin: 20px 0;
      text-decoration: underline;
      line-height: 1.4;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .recipient {
      margin-bottom: 16px;
    }
    .body-text {
      text-align: justify;
      margin-bottom: 12px;
    }
    .loan-details {
      margin-bottom: 12px;
    }
    .loan-details p {
      margin: 0;
      line-height: 1.6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    table th, table td {
      border: 1px solid #000;
      padding: 6px 8px;
      text-align: left;
      font-size: 11pt;
    }
    table th {
      font-weight: bold;
    }
    .outstanding-table th:last-child,
    .outstanding-table td:last-child {
      text-align: right;
    }
    .outstanding-table tr:last-child td {
      font-weight: bold;
      font-style: italic;
    }
    .signature-block {
      margin-top: 50px;
      text-align: right;
    }
    .signature-block .line {
      margin-top: 40px;
      border-top: 1px solid #000;
      width: 200px;
      margin-left: auto;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <div class="letterhead">
    <div class="bank-name">${escapeHtml(branch.bankName)}</div>
    <div class="branch-info">
      ${escapeHtml(branch.branchName)} Branch | ${escapeHtml(branch.branchAddress)}, ${escapeHtml(branch.city)}, ${escapeHtml(branch.state)}<br>
      IFSC: ${escapeHtml(branch.ifscCode)}${branch.phone ? ` | Phone: ${escapeHtml(branch.phone)}` : ''} | Email: ${escapeHtml(branch.email)}
    </div>
  </div>

  <div class="notice-heading">
    NOTICE UNDER SECTION 13(2) OF THE SECURITISATION AND RECONSTRUCTION OF FINANCIAL ASSETS AND ENFORCEMENT OF SECURITY INTEREST ACT, 2002
  </div>

  <div class="meta-row">
    <div><strong>Date:</strong> ${noticeDate}</div>
    <div><strong>Place:</strong> ${noticePlace}</div>
  </div>

  <div class="recipient">
    <p><strong>To:</strong></p>
    <p>${escapeHtml(recipientName)}</p>
    <p>${escapeHtml(recipientAddress)}</p>
  </div>

  <div class="loan-details">
    <p><strong>Loan Account No:</strong> ${escapeHtml(caseData.accountNo)}</p>
    <p><strong>Type of Loan:</strong> ${escapeHtml(caseData.loanType)}</p>
    <p><strong>Date of Sanction:</strong> ${formatDate(caseData.sanctionDate)}</p>
    <p><strong>Sanctioned Amount:</strong> ${formatCurrency(caseData.sanctionAmount)}</p>
    <p><strong>Date of NPA Classification:</strong> ${formatDate(caseData.npaDate)}</p>
  </div>

  <div class="body-text">
    Whereas, the above-mentioned loan account has been classified as a Non-Performing Asset (NPA)
    as on <strong>${formatDate(caseData.npaDate)}</strong> in the books of the Bank. The following
    amounts are outstanding and due as on the date of this notice:
  </div>

  <table class="outstanding-table">
    <thead>
      <tr>
        <th>Particulars</th>
        <th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Principal Outstanding</td>
        <td>${formatCurrency(principalOutstanding)}</td>
      </tr>
      <tr>
        <td>Interest Outstanding</td>
        <td>${formatCurrency(interestOutstanding)}</td>
      </tr>
      <tr>
        <td>Other Charges / Costs</td>
        <td>${formatCurrency(otherCharges)}</td>
      </tr>
      <tr>
        <td>Total Outstanding</td>
        <td>${formatCurrency(totalOutstanding)}</td>
      </tr>
    </tbody>
  </table>

  <div class="body-text">
    <strong>Details of Secured Assets:</strong>
  </div>

  <table>
    <thead>
      <tr>
        <th>Sr. No.</th>
        <th>Asset Type</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      ${assetsHtml}
    </tbody>
  </table>

  <div class="body-text">
    <strong>Security Documents:</strong>
  </div>

  <table>
    <thead>
      <tr>
        <th>Sr. No.</th>
        <th>Document Type</th>
        <th>Date</th>
      </tr>
    </thead>
    <tbody>
      ${securityDocsHtml}
    </tbody>
  </table>

  <div class="body-text">
    Now, therefore, in exercise of the powers conferred under Section 13(2) of the Securitisation
    and Reconstruction of Financial Assets and Enforcement of Security Interest Act, 2002
    read with Rule 3 of the Security Interest (Enforcement) Rules, 2002, you are hereby called
    upon to repay the total outstanding amount of <strong>${formatCurrency(totalOutstanding)}</strong>
    (together with further interest and costs thereon) within <strong>60 (sixty) days</strong>
    from the date of receipt of this notice, failing which the undersigned shall be constrained
    to exercise all or any of the rights under Section 13(4) of the said Act, including:
  </div>

  <div class="body-text" style="padding-left: 20px;">
    (a) Take possession of the secured assets;<br>
    (b) Take over the management of the secured assets;<br>
    (c) Appoint any person to manage the secured assets;<br>
    (d) Require any person who has acquired any of the secured assets from the borrower
        to pay the secured creditor.
  </div>

  <div class="body-text">
    You are further advised to note that in case of failure to comply with this demand notice,
    the Bank shall proceed to take necessary action under the provisions of the said Act
    without any further reference to you and all costs, charges and expenses shall be payable
    by you.
  </div>

  <div class="signature-block">
    <p>Yours faithfully,</p>
    <p>For and on behalf of <strong>${escapeHtml(branch.bankName)}</strong></p>
    <br><br>
    <p><strong>${authorizedOfficerName}</strong></p>
    <p>${authorizedOfficerDesignation}</p>
    <p>Authorised Officer</p>
    <p>${escapeHtml(branch.branchName)} Branch</p>
  </div>

</body>
</html>`;
  },

  async generateDemandNoticeDocx(
    context: GenerationContext,
    recipientName: string,
    recipientAddress: string,
  ): Promise<Buffer> {
    const { branch, caseData, notice } = context;
    const fields = notice.fields;

    const principal = Number(fields.outstandingPrincipal ?? fields.principalOutstanding ?? 0);
    const interest = Number(fields.outstandingInterest ?? fields.interestOutstanding ?? 0);
    const charges = Number(fields.otherCharges ?? 0);
    const total = principal + interest + charges;

    const noticeDate = fields.noticeDate
      ? formatDate(new Date(fields.noticeDate as string))
      : formatDate(new Date());
    const noticePlace = String(fields.placeOfNotice ?? fields.noticePlace ?? branch.city);
    const aoName = String(fields.authorizedOfficerName ?? '');
    const aoDesignation = String(fields.authorizedOfficerDesignation ?? '');

    const tableBorder = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    };

    // Outstanding amounts table rows
    const outstandingRows = [
      ['Particulars', 'Amount (₹)'],
      ['Principal Outstanding', formatCurrency(principal)],
      ['Interest Outstanding', formatCurrency(interest)],
      ['Other Charges / Costs', formatCurrency(charges)],
      ['Total Outstanding', formatCurrency(total)],
    ].map(
      (row, idx) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                borders: tableBorder,
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        bold: idx === 0 || idx === 4,
                        size: 22,
                        font: 'Times New Roman',
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    );

    // Asset table rows
    const assetHeaderRow = new TableRow({
      children: ['Sr. No.', 'Asset Type', 'Description'].map(
        (text) =>
          new TableCell({
            borders: tableBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true, size: 22, font: 'Times New Roman' })],
              }),
            ],
          }),
      ),
    });

    const assetRows = caseData.securedAssets.map(
      (asset, idx) =>
        new TableRow({
          children: [
            new TableCell({
              borders: tableBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: String(idx + 1), size: 22, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: tableBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: asset.assetType, size: 22, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: tableBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${asset.description}${asset.surveyNo ? `, Survey No: ${asset.surveyNo}` : ''}${asset.area ? `, Area: ${asset.area}` : ''}${asset.district ? `, District: ${asset.district}` : ''}${asset.state ? `, State: ${asset.state}` : ''}`,
                      size: 22,
                      font: 'Times New Roman',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
    );

    // Security documents table rows
    const secDocHeaderRow = new TableRow({
      children: ['Sr. No.', 'Document Type', 'Date'].map(
        (text) =>
          new TableCell({
            borders: tableBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text, bold: true, size: 22, font: 'Times New Roman' })],
              }),
            ],
          }),
      ),
    });

    const secDocRows = caseData.securityDocuments.map(
      (doc, idx) =>
        new TableRow({
          children: [
            new TableCell({
              borders: tableBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: String(idx + 1), size: 22, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: tableBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: doc.documentType, size: 22, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              borders: tableBorder,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: formatDate(doc.date), size: 22, font: 'Times New Roman' }),
                  ],
                }),
              ],
            }),
          ],
        }),
    );

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1440, bottom: 1440, left: 1080, right: 1080 },
            },
          },
          children: [
            // Letterhead
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: branch.bankName.toUpperCase(),
                  bold: true,
                  size: 36,
                  font: 'Times New Roman',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${branch.branchName} Branch | ${branch.branchAddress}, ${branch.city}, ${branch.state}`,
                  size: 20,
                  font: 'Times New Roman',
                }),
              ],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `IFSC: ${branch.ifscCode}${branch.phone ? ` | Phone: ${branch.phone}` : ''} | Email: ${branch.email}`,
                  size: 20,
                  font: 'Times New Roman',
                }),
              ],
              spacing: { after: 400 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 3 } },
            }),

            // Title
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 400, after: 200 },
              children: [
                new TextRun({
                  text: 'NOTICE UNDER SECTION 13(2) OF THE SECURITISATION AND RECONSTRUCTION OF FINANCIAL ASSETS AND ENFORCEMENT OF SECURITY INTEREST ACT, 2002',
                  bold: true,
                  size: 24,
                  font: 'Times New Roman',
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
            }),

            // Date and Place
            new Paragraph({
              children: [
                new TextRun({ text: `Date: ${noticeDate}`, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: `\t\t\t\tPlace: ${noticePlace}`, size: 22, font: 'Times New Roman' }),
              ],
              spacing: { after: 200 },
            }),

            // Recipient
            new Paragraph({
              children: [
                new TextRun({ text: 'To:', bold: true, size: 22, font: 'Times New Roman' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: recipientName, size: 22, font: 'Times New Roman' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: recipientAddress, size: 22, font: 'Times New Roman' }),
              ],
              spacing: { after: 200 },
            }),

            // Loan details
            new Paragraph({
              children: [
                new TextRun({ text: 'Loan Account No: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: caseData.accountNo, size: 22, font: 'Times New Roman' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Type of Loan: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: caseData.loanType, size: 22, font: 'Times New Roman' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Date of Sanction: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: formatDate(caseData.sanctionDate), size: 22, font: 'Times New Roman' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Sanctioned Amount: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: formatCurrency(caseData.sanctionAmount), size: 22, font: 'Times New Roman' }),
              ],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Date of NPA Classification: ', bold: true, size: 22, font: 'Times New Roman' }),
                new TextRun({ text: formatDate(caseData.npaDate), size: 22, font: 'Times New Roman' }),
              ],
              spacing: { after: 200 },
            }),

            // Body paragraph
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: `Whereas, the above-mentioned loan account has been classified as a Non-Performing Asset (NPA) as on ${formatDate(caseData.npaDate)} in the books of the Bank. The following amounts are outstanding and due as on the date of this notice:`,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              spacing: { after: 200 },
            }),

            // Outstanding amounts table
            new Table({ rows: outstandingRows }),

            // Assets heading
            new Paragraph({
              spacing: { before: 300, after: 100 },
              children: [
                new TextRun({
                  text: 'Details of Secured Assets:',
                  bold: true,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
            }),

            // Assets table
            new Table({ rows: [assetHeaderRow, ...assetRows] }),

            // Security documents heading
            new Paragraph({
              spacing: { before: 300, after: 100 },
              children: [
                new TextRun({
                  text: 'Security Documents:',
                  bold: true,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
            }),

            // Security documents table
            new Table({ rows: [secDocHeaderRow, ...secDocRows] }),

            // Demand paragraph
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              spacing: { before: 300 },
              children: [
                new TextRun({
                  text: `Now, therefore, in exercise of the powers conferred under Section 13(2) of the Securitisation and Reconstruction of Financial Assets and Enforcement of Security Interest Act, 2002 read with Rule 3 of the Security Interest (Enforcement) Rules, 2002, you are hereby called upon to repay the total outstanding amount of ${formatCurrency(total)} (together with further interest and costs thereon) within 60 (sixty) days from the date of receipt of this notice, failing which the undersigned shall be constrained to exercise all or any of the rights under Section 13(4) of the said Act, including:`,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
            }),

            // Rights list
            new Paragraph({
              indent: { left: 400 },
              children: [
                new TextRun({
                  text: '(a) Take possession of the secured assets;',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 400 },
              children: [
                new TextRun({
                  text: '(b) Take over the management of the secured assets;',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 400 },
              children: [
                new TextRun({
                  text: '(c) Appoint any person to manage the secured assets;',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
            }),
            new Paragraph({
              indent: { left: 400 },
              children: [
                new TextRun({
                  text: '(d) Require any person who has acquired any of the secured assets from the borrower to pay the secured creditor.',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              spacing: { after: 200 },
            }),

            // Warning paragraph
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: 'You are further advised to note that in case of failure to comply with this demand notice, the Bank shall proceed to take necessary action under the provisions of the said Act without any further reference to you and all costs, charges and expenses shall be payable by you.',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              spacing: { after: 600 },
            }),

            // Signature block
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Yours faithfully,',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `For and on behalf of ${branch.bankName}`,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              spacing: { after: 600 },
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: aoName,
                  bold: true,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: aoDesignation,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Authorised Officer',
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${branch.branchName} Branch`,
                  size: 22,
                  font: 'Times New Roman',
                }),
              ],
              alignment: AlignmentType.RIGHT,
            }),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // POSSESSION NOTICE — Section 13(4)
  // ══════════════════════════════════════════════════════════════════════════

  generatePossessionNoticeHtml(
    context: GenerationContext,
    recipientName: string,
    recipientAddress: string,
  ): string {
    const { branch, caseData, notice } = context;
    const f = notice.fields;

    const noticeDate = f.noticeDate ? formatDate(new Date(f.noticeDate as string)) : formatDate(new Date());
    const noticePlace = escapeHtml(String(f.placeOfNotice ?? branch.city));
    const aoName = escapeHtml(String(f.authorizedOfficerName ?? ''));
    const aoDesig = escapeHtml(String(f.authorizedOfficerDesignation ?? ''));
    const demandDate = f.refDemandNoticeDate ? formatDate(new Date(f.refDemandNoticeDate as string)) : '';
    const demandAmount = formatCurrency(Number(f.refDemandAmountDemanded ?? 0));
    const outstandingAmt = formatCurrency(Number(f.outstandingOnPossessionDate ?? 0));
    const possessionDate = f.dateOfPossession ? formatDate(new Date(f.dateOfPossession as string)) : '';
    const mode = String(f.modeOfPossession ?? 'symbolic');
    const w1Name = escapeHtml(String(f.witness1Name ?? ''));
    const w1Desig = escapeHtml(String(f.witness1Designation ?? ''));
    const w2Name = escapeHtml(String(f.witness2Name ?? ''));
    const w2Desig = escapeHtml(String(f.witness2Designation ?? ''));
    const news1 = escapeHtml(String(f.newspaper1Name ?? ''));
    const news1Date = f.newspaper1Date ? formatDate(new Date(f.newspaper1Date as string)) : '';
    const news2 = escapeHtml(String(f.newspaper2Name ?? ''));
    const news2Date = f.newspaper2Date ? formatDate(new Date(f.newspaper2Date as string)) : '';
    const drt = escapeHtml(String(f.drtNameLocation ?? ''));
    const sec17Deadline = f.section17Deadline ? formatDate(new Date(f.section17Deadline as string)) : '';

    const assetsHtml = caseData.securedAssets
      .map(
        (asset, idx) =>
          `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(asset.assetType)}</td>
            <td>${escapeHtml(asset.description)}${asset.surveyNo ? `, Survey No: ${escapeHtml(asset.surveyNo)}` : ''}${asset.area ? `, Area: ${escapeHtml(asset.area)}` : ''}${asset.district ? `, District: ${escapeHtml(asset.district)}` : ''}${asset.state ? `, State: ${escapeHtml(asset.state)}` : ''}</td>
          </tr>`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Possession Notice under Section 13(4) — ${escapeHtml(caseData.accountNo)}</title>
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; color: #000; background: #fff; padding: 20mm 15mm; }
    .letterhead { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .letterhead .bank-name { font-size: 18pt; font-weight: bold; text-transform: uppercase; }
    .letterhead .branch-info { font-size: 10pt; margin-top: 4px; }
    .notice-heading { text-align: center; font-weight: bold; font-size: 12pt; margin: 20px 0; text-decoration: underline; line-height: 1.4; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .recipient { margin-bottom: 16px; }
    .body-text { text-align: justify; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    table th, table td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11pt; }
    table th { font-weight: bold; }
    .signature-block { margin-top: 50px; text-align: right; }
  </style>
</head>
<body>

  <div class="letterhead">
    <div class="bank-name">${escapeHtml(branch.bankName)}</div>
    <div class="branch-info">
      ${escapeHtml(branch.branchName)} Branch | ${escapeHtml(branch.branchAddress)}, ${escapeHtml(branch.city)}, ${escapeHtml(branch.state)}<br>
      IFSC: ${escapeHtml(branch.ifscCode)}${branch.phone ? ` | Phone: ${escapeHtml(branch.phone)}` : ''} | Email: ${escapeHtml(branch.email)}
    </div>
  </div>

  <div class="notice-heading">
    POSSESSION NOTICE UNDER SECTION 13(4) OF THE SECURITISATION AND RECONSTRUCTION OF FINANCIAL ASSETS AND ENFORCEMENT OF SECURITY INTEREST ACT, 2002<br>
    (Read with Rule 8(1) of the Security Interest (Enforcement) Rules, 2002)
  </div>

  <div class="meta-row">
    <div><strong>Date:</strong> ${noticeDate}</div>
    <div><strong>Place:</strong> ${noticePlace}</div>
  </div>

  <div class="recipient">
    <p><strong>To:</strong></p>
    <p>${escapeHtml(recipientName)}</p>
    <p>${escapeHtml(recipientAddress)}</p>
  </div>

  <div class="body-text">
    <strong>Loan Account No:</strong> ${escapeHtml(caseData.accountNo)}<br>
    <strong>Type of Loan:</strong> ${escapeHtml(caseData.loanType)}<br>
    <strong>Date of NPA Classification:</strong> ${formatDate(caseData.npaDate)}
  </div>

  <div class="body-text">
    WHEREAS, a Demand Notice under Section 13(2) of the SARFAESI Act, 2002 was issued to you on
    <strong>${demandDate}</strong> demanding repayment of <strong>${demandAmount}</strong> within 60 days.
  </div>

  <div class="body-text">
    AND WHEREAS, you have failed to repay the said amount within the stipulated period. The total amount
    outstanding as on the date of taking possession is <strong>${outstandingAmt}</strong>.
  </div>

  <div class="body-text">
    NOW THEREFORE, in exercise of the powers conferred under Section 13(4) of the SARFAESI Act, 2002,
    read with Rule 8 of the Security Interest (Enforcement) Rules, 2002, the undersigned, being the
    Authorised Officer of <strong>${escapeHtml(branch.bankName)}</strong>, has taken
    <strong>${mode}</strong> possession of the following secured assets on <strong>${possessionDate}</strong>:
  </div>

  <div class="body-text"><strong>Details of Secured Assets:</strong></div>

  <table>
    <thead>
      <tr><th>Sr. No.</th><th>Asset Type</th><th>Description</th></tr>
    </thead>
    <tbody>${assetsHtml}</tbody>
  </table>

  <div class="body-text">
    The possession was taken in the presence of the following witnesses:
  </div>
  <div class="body-text" style="padding-left: 20px;">
    1. ${w1Name}, ${w1Desig}<br>
    ${w2Name ? `2. ${w2Name}, ${w2Desig}` : ''}
  </div>

  <div class="body-text">
    This Notice of Possession is being published in the following newspapers in accordance with Rule 8(2):
  </div>
  <div class="body-text" style="padding-left: 20px;">
    1. <strong>${news1}</strong> (English) — ${news1Date}<br>
    2. <strong>${news2}</strong> (Vernacular) — ${news2Date}
  </div>

  <div class="body-text">
    The borrower(s) / guarantor(s) are hereby informed that any objection / representation under
    Section 17 of the SARFAESI Act, 2002 may be filed before the <strong>${drt}</strong>
    within 45 days from the date of this notice, i.e., on or before <strong>${sec17Deadline}</strong>.
  </div>

  <div class="body-text">
    The borrower's attention is invited to the provisions of sub-section (8) of Section 13 of the Act,
    in respect of the time available to redeem the secured assets.
  </div>

  <div class="signature-block">
    <p>For and on behalf of <strong>${escapeHtml(branch.bankName)}</strong></p>
    <br><br>
    <p><strong>${aoName}</strong></p>
    <p>${aoDesig}</p>
    <p>Authorised Officer</p>
    <p>${escapeHtml(branch.branchName)} Branch</p>
  </div>

</body>
</html>`;
  },

  async generatePossessionNoticeDocx(
    context: GenerationContext,
    recipientName: string,
    recipientAddress: string,
  ): Promise<Buffer> {
    const { branch, caseData, notice } = context;
    const f = notice.fields;

    const noticeDate = f.noticeDate ? formatDate(new Date(f.noticeDate as string)) : formatDate(new Date());
    const noticePlace = String(f.placeOfNotice ?? branch.city);
    const aoName = String(f.authorizedOfficerName ?? '');
    const aoDesig = String(f.authorizedOfficerDesignation ?? '');
    const demandDate = f.refDemandNoticeDate ? formatDate(new Date(f.refDemandNoticeDate as string)) : '';
    const demandAmount = formatCurrency(Number(f.refDemandAmountDemanded ?? 0));
    const outstandingAmt = formatCurrency(Number(f.outstandingOnPossessionDate ?? 0));
    const possessionDate = f.dateOfPossession ? formatDate(new Date(f.dateOfPossession as string)) : '';
    const mode = String(f.modeOfPossession ?? 'symbolic');
    const w1Name = String(f.witness1Name ?? '');
    const w1Desig = String(f.witness1Designation ?? '');
    const w2Name = String(f.witness2Name ?? '');
    const w2Desig = String(f.witness2Designation ?? '');
    const news1 = String(f.newspaper1Name ?? '');
    const news1Date = f.newspaper1Date ? formatDate(new Date(f.newspaper1Date as string)) : '';
    const news2 = String(f.newspaper2Name ?? '');
    const news2Date = f.newspaper2Date ? formatDate(new Date(f.newspaper2Date as string)) : '';
    const drt = String(f.drtNameLocation ?? '');
    const sec17Deadline = f.section17Deadline ? formatDate(new Date(f.section17Deadline as string)) : '';

    const tableBorder = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    };

    const tr = (text: string, opts?: { bold?: boolean }) =>
      new TextRun({ text, size: 22, font: 'Times New Roman', bold: opts?.bold });

    const assetHeaderRow = new TableRow({
      children: ['Sr. No.', 'Asset Type', 'Description'].map(
        (text) => new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [tr(text, { bold: true })] })] }),
      ),
    });

    const assetRows = caseData.securedAssets.map(
      (asset, idx) =>
        new TableRow({
          children: [
            new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [tr(String(idx + 1))] })] }),
            new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [tr(asset.assetType)] })] }),
            new TableCell({
              borders: tableBorder,
              children: [new Paragraph({ children: [tr(`${asset.description}${asset.surveyNo ? `, Survey No: ${asset.surveyNo}` : ''}${asset.area ? `, Area: ${asset.area}` : ''}${asset.district ? `, District: ${asset.district}` : ''}${asset.state ? `, State: ${asset.state}` : ''}`)] })],
            }),
          ],
        }),
    );

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1080, right: 1080 } } },
        children: [
          // Letterhead
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: branch.bankName.toUpperCase(), bold: true, size: 36, font: 'Times New Roman' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [tr(`${branch.branchName} Branch | ${branch.branchAddress}, ${branch.city}, ${branch.state}`)] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [tr(`IFSC: ${branch.ifscCode}${branch.phone ? ` | Phone: ${branch.phone}` : ''} | Email: ${branch.email}`)],
            spacing: { after: 400 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 3 } },
          }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({
              text: 'POSSESSION NOTICE UNDER SECTION 13(4) OF THE SECURITISATION AND RECONSTRUCTION OF FINANCIAL ASSETS AND ENFORCEMENT OF SECURITY INTEREST ACT, 2002',
              bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE },
            })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [tr('(Read with Rule 8(1) of the Security Interest (Enforcement) Rules, 2002)')],
          }),

          // Date and Place
          new Paragraph({ children: [tr(`Date: ${noticeDate}`), tr(`\t\t\t\tPlace: ${noticePlace}`)], spacing: { after: 200 } }),

          // Recipient
          new Paragraph({ children: [tr('To:', { bold: true })] }),
          new Paragraph({ children: [tr(recipientName)] }),
          new Paragraph({ children: [tr(recipientAddress)], spacing: { after: 200 } }),

          // Loan details
          new Paragraph({ children: [tr('Loan Account No: ', { bold: true }), tr(caseData.accountNo)] }),
          new Paragraph({ children: [tr('Type of Loan: ', { bold: true }), tr(caseData.loanType)] }),
          new Paragraph({ children: [tr('Date of NPA Classification: ', { bold: true }), tr(formatDate(caseData.npaDate))], spacing: { after: 200 } }),

          // Demand reference
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr(`WHEREAS, a Demand Notice under Section 13(2) of the SARFAESI Act, 2002 was issued to you on ${demandDate} demanding repayment of ${demandAmount} within 60 days.`)],
          }),

          // Failed to repay
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr(`AND WHEREAS, you have failed to repay the said amount within the stipulated period. The total amount outstanding as on the date of taking possession is ${outstandingAmt}.`)],
          }),

          // Possession action
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr(`NOW THEREFORE, in exercise of the powers conferred under Section 13(4) of the SARFAESI Act, 2002, read with Rule 8 of the Security Interest (Enforcement) Rules, 2002, the undersigned, being the Authorised Officer of ${branch.bankName}, has taken ${mode} possession of the following secured assets on ${possessionDate}:`)],
          }),

          // Assets heading + table
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [tr('Details of Secured Assets:', { bold: true })] }),
          new Table({ rows: [assetHeaderRow, ...assetRows] }),

          // Witnesses
          new Paragraph({ spacing: { before: 300, after: 100 }, alignment: AlignmentType.JUSTIFIED, children: [tr('The possession was taken in the presence of the following witnesses:')] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`1. ${w1Name}, ${w1Desig}`)] }),
          ...(w2Name ? [new Paragraph({ indent: { left: 400 }, children: [tr(`2. ${w2Name}, ${w2Desig}`)] })] : []),

          // Newspaper publication
          new Paragraph({ spacing: { before: 300, after: 100 }, alignment: AlignmentType.JUSTIFIED, children: [tr('This Notice of Possession is being published in the following newspapers in accordance with Rule 8(2):')] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`1. ${news1} (English) — ${news1Date}`)] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`2. ${news2} (Vernacular) — ${news2Date}`)], spacing: { after: 200 } }),

          // DRT & Section 17
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr(`The borrower(s) / guarantor(s) are hereby informed that any objection / representation under Section 17 of the SARFAESI Act, 2002 may be filed before the ${drt} within 45 days from the date of this notice, i.e., on or before ${sec17Deadline}.`)],
          }),

          // Redemption note
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 600 },
            children: [tr('The borrower\'s attention is invited to the provisions of sub-section (8) of Section 13 of the Act, in respect of the time available to redeem the secured assets.')],
          }),

          // Signature block
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(`For and on behalf of ${branch.bankName}`)] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 600 }, children: [] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(aoName, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(aoDesig)] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr('Authorised Officer')] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(`${branch.branchName} Branch`)] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SALE / AUCTION NOTICE — Rule 8(5), 8(6), Rule 9
  // ══════════════════════════════════════════════════════════════════════════

  generateSaleAuctionNoticeHtml(
    context: GenerationContext,
    recipientName: string,
    recipientAddress: string,
  ): string {
    const { branch, caseData, notice } = context;
    const f = notice.fields;

    const noticeDate = f.noticeDate ? formatDate(new Date(f.noticeDate as string)) : formatDate(new Date());
    const noticePlace = escapeHtml(String(f.placeOfNotice ?? branch.city));
    const aoName = escapeHtml(String(f.authorizedOfficerName ?? ''));
    const aoDesig = escapeHtml(String(f.authorizedOfficerDesignation ?? ''));
    const refPossessionDate = f.refPossessionDate ? formatDate(new Date(f.refPossessionDate as string)) : '';
    const outstandingAmt = formatCurrency(Number(f.outstandingOnSaleNoticeDate ?? 0));
    const auctionDate = f.auctionDate ? formatDate(new Date(f.auctionDate as string)) : '';
    const auctionTime = escapeHtml(String(f.auctionTime ?? ''));
    const auctionMode = String(f.auctionVenueMode ?? 'physical');
    const auctionVenue = escapeHtml(String(f.auctionVenueAddress ?? ''));
    const reservePrice = formatCurrency(Number(f.reservePrice ?? 0));
    const bidIncrement = formatCurrency(Number(f.bidIncrementAmount ?? 0));
    const emdAmount = formatCurrency(Number(f.emdAmount ?? 0));
    const emdDeadline = f.emdDeadline ? formatDate(new Date(f.emdDeadline as string)) : '';
    const emdModes = Array.isArray(f.emdPaymentModes) ? (f.emdPaymentModes as string[]).join(', ') : '';
    const inspectionDates = Array.isArray(f.propertyInspectionDates)
      ? (f.propertyInspectionDates as string[]).map(d => formatDate(new Date(d))).join(', ')
      : '';
    const inspContactName = escapeHtml(String(f.inspectionContactName ?? ''));
    const inspContactPhone = escapeHtml(String(f.inspectionContactPhone ?? ''));
    const valuer1 = escapeHtml(String(f.valuer1Name ?? ''));
    const valuer1Date = f.valuer1ReportDate ? formatDate(new Date(f.valuer1ReportDate as string)) : '';
    const valuer2 = escapeHtml(String(f.valuer2Name ?? ''));
    const valuer2Date = f.valuer2ReportDate ? formatDate(new Date(f.valuer2ReportDate as string)) : '';
    const terms = escapeHtml(String(f.termsAndConditions ?? ''));
    const encumbrance = escapeHtml(String(f.encumbranceStatus ?? ''));

    const assetsHtml = caseData.securedAssets
      .map(
        (asset, idx) =>
          `<tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(asset.assetType)}</td>
            <td>${escapeHtml(asset.description)}${asset.surveyNo ? `, Survey No: ${escapeHtml(asset.surveyNo)}` : ''}${asset.area ? `, Area: ${escapeHtml(asset.area)}` : ''}${asset.district ? `, District: ${escapeHtml(asset.district)}` : ''}${asset.state ? `, State: ${escapeHtml(asset.state)}` : ''}</td>
          </tr>`,
      )
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sale / Auction Notice — ${escapeHtml(caseData.accountNo)}</title>
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; color: #000; background: #fff; padding: 20mm 15mm; }
    .letterhead { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
    .letterhead .bank-name { font-size: 18pt; font-weight: bold; text-transform: uppercase; }
    .letterhead .branch-info { font-size: 10pt; margin-top: 4px; }
    .notice-heading { text-align: center; font-weight: bold; font-size: 12pt; margin: 20px 0; text-decoration: underline; line-height: 1.4; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .recipient { margin-bottom: 16px; }
    .body-text { text-align: justify; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    table th, table td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11pt; }
    table th { font-weight: bold; }
    .detail-table td:first-child { font-weight: bold; width: 35%; }
    .signature-block { margin-top: 50px; text-align: right; }
  </style>
</head>
<body>

  <div class="letterhead">
    <div class="bank-name">${escapeHtml(branch.bankName)}</div>
    <div class="branch-info">
      ${escapeHtml(branch.branchName)} Branch | ${escapeHtml(branch.branchAddress)}, ${escapeHtml(branch.city)}, ${escapeHtml(branch.state)}<br>
      IFSC: ${escapeHtml(branch.ifscCode)}${branch.phone ? ` | Phone: ${escapeHtml(branch.phone)}` : ''} | Email: ${escapeHtml(branch.email)}
    </div>
  </div>

  <div class="notice-heading">
    SALE NOTICE FOR SALE OF IMMOVABLE / MOVABLE SECURED ASSETS<br>
    UNDER RULE 8(5), 8(6) AND RULE 9 OF THE SECURITY INTEREST (ENFORCEMENT) RULES, 2002
  </div>

  <div class="meta-row">
    <div><strong>Date:</strong> ${noticeDate}</div>
    <div><strong>Place:</strong> ${noticePlace}</div>
  </div>

  <div class="recipient">
    <p><strong>To:</strong></p>
    <p>${escapeHtml(recipientName)}</p>
    <p>${escapeHtml(recipientAddress)}</p>
  </div>

  <div class="body-text">
    <strong>Loan Account No:</strong> ${escapeHtml(caseData.accountNo)}<br>
    <strong>Type of Loan:</strong> ${escapeHtml(caseData.loanType)}<br>
    <strong>Date of NPA Classification:</strong> ${formatDate(caseData.npaDate)}
  </div>

  <div class="body-text">
    WHEREAS, the Authorised Officer of <strong>${escapeHtml(branch.bankName)}</strong> had taken possession
    of the secured assets on <strong>${refPossessionDate}</strong> under Section 13(4) of the SARFAESI Act, 2002.
  </div>

  <div class="body-text">
    The total amount outstanding as on the date of this Sale Notice is <strong>${outstandingAmt}</strong>.
  </div>

  <div class="body-text">
    Notice is hereby given to the borrower(s) and the general public that the undersigned, being the
    Authorised Officer, proposes to sell the following secured assets on <strong>"AS IS WHERE IS"</strong>,
    <strong>"AS IS WHAT IS"</strong> and <strong>"WHATEVER THERE IS"</strong> basis for recovery of the
    above outstanding dues:
  </div>

  <div class="body-text"><strong>Details of Secured Assets for Sale:</strong></div>

  <table>
    <thead>
      <tr><th>Sr. No.</th><th>Asset Type</th><th>Description</th></tr>
    </thead>
    <tbody>${assetsHtml}</tbody>
  </table>

  <div class="body-text"><strong>Auction / Sale Details:</strong></div>

  <table class="detail-table">
    <tbody>
      <tr><td>Date of Auction</td><td>${auctionDate}</td></tr>
      <tr><td>Time</td><td>${auctionTime}</td></tr>
      <tr><td>Mode of Auction</td><td>${auctionMode === 'online' ? 'E-Auction (Online)' : 'Physical Auction'}</td></tr>
      <tr><td>Venue / Platform</td><td>${auctionVenue}</td></tr>
      <tr><td>Reserve Price</td><td>${reservePrice}</td></tr>
      <tr><td>Bid Increment</td><td>${bidIncrement}</td></tr>
      <tr><td>EMD (Earnest Money Deposit)</td><td>${emdAmount}</td></tr>
      <tr><td>EMD Submission Deadline</td><td>${emdDeadline}</td></tr>
      <tr><td>EMD Payment Modes</td><td>${emdModes}</td></tr>
    </tbody>
  </table>

  <div class="body-text"><strong>Valuation Details:</strong></div>
  <div class="body-text" style="padding-left: 20px;">
    1. ${valuer1} — Report dated ${valuer1Date}<br>
    2. ${valuer2} — Report dated ${valuer2Date}
  </div>

  <div class="body-text"><strong>Property Inspection:</strong></div>
  <div class="body-text" style="padding-left: 20px;">
    Inspection Dates: ${inspectionDates}<br>
    Contact: ${inspContactName} — ${inspContactPhone}
  </div>

  <div class="body-text"><strong>Encumbrance Status:</strong> ${encumbrance}</div>

  <div class="body-text"><strong>Terms and Conditions:</strong></div>
  <div class="body-text">${terms}</div>

  <div class="body-text">
    The borrower's attention is invited to the provisions of sub-section (8) of Section 13 of the
    SARFAESI Act, 2002, in respect of the time available to redeem the secured assets before the
    date fixed for sale or transfer.
  </div>

  <div class="signature-block">
    <p>For and on behalf of <strong>${escapeHtml(branch.bankName)}</strong></p>
    <br><br>
    <p><strong>${aoName}</strong></p>
    <p>${aoDesig}</p>
    <p>Authorised Officer</p>
    <p>${escapeHtml(branch.branchName)} Branch</p>
  </div>

</body>
</html>`;
  },

  async generateSaleAuctionNoticeDocx(
    context: GenerationContext,
    recipientName: string,
    recipientAddress: string,
  ): Promise<Buffer> {
    const { branch, caseData, notice } = context;
    const f = notice.fields;

    const noticeDate = f.noticeDate ? formatDate(new Date(f.noticeDate as string)) : formatDate(new Date());
    const noticePlace = String(f.placeOfNotice ?? branch.city);
    const aoName = String(f.authorizedOfficerName ?? '');
    const aoDesig = String(f.authorizedOfficerDesignation ?? '');
    const refPossessionDate = f.refPossessionDate ? formatDate(new Date(f.refPossessionDate as string)) : '';
    const outstandingAmt = formatCurrency(Number(f.outstandingOnSaleNoticeDate ?? 0));
    const auctionDate = f.auctionDate ? formatDate(new Date(f.auctionDate as string)) : '';
    const auctionTime = String(f.auctionTime ?? '');
    const auctionMode = String(f.auctionVenueMode ?? 'physical');
    const auctionVenue = String(f.auctionVenueAddress ?? '');
    const reservePrice = formatCurrency(Number(f.reservePrice ?? 0));
    const bidIncrement = formatCurrency(Number(f.bidIncrementAmount ?? 0));
    const emdAmount = formatCurrency(Number(f.emdAmount ?? 0));
    const emdDeadline = f.emdDeadline ? formatDate(new Date(f.emdDeadline as string)) : '';
    const emdModes = Array.isArray(f.emdPaymentModes) ? (f.emdPaymentModes as string[]).join(', ') : '';
    const inspectionDates = Array.isArray(f.propertyInspectionDates)
      ? (f.propertyInspectionDates as string[]).map(d => formatDate(new Date(d))).join(', ')
      : '';
    const inspContactName = String(f.inspectionContactName ?? '');
    const inspContactPhone = String(f.inspectionContactPhone ?? '');
    const valuer1 = String(f.valuer1Name ?? '');
    const valuer1Date = f.valuer1ReportDate ? formatDate(new Date(f.valuer1ReportDate as string)) : '';
    const valuer2 = String(f.valuer2Name ?? '');
    const valuer2Date = f.valuer2ReportDate ? formatDate(new Date(f.valuer2ReportDate as string)) : '';
    const terms = String(f.termsAndConditions ?? '');
    const encumbrance = String(f.encumbranceStatus ?? '');

    const tableBorder = {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
    };

    const tr = (text: string, opts?: { bold?: boolean }) =>
      new TextRun({ text, size: 22, font: 'Times New Roman', bold: opts?.bold });

    const assetHeaderRow = new TableRow({
      children: ['Sr. No.', 'Asset Type', 'Description'].map(
        (text) => new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [tr(text, { bold: true })] })] }),
      ),
    });

    const assetRows = caseData.securedAssets.map(
      (asset, idx) =>
        new TableRow({
          children: [
            new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [tr(String(idx + 1))] })] }),
            new TableCell({ borders: tableBorder, children: [new Paragraph({ children: [tr(asset.assetType)] })] }),
            new TableCell({
              borders: tableBorder,
              children: [new Paragraph({ children: [tr(`${asset.description}${asset.surveyNo ? `, Survey No: ${asset.surveyNo}` : ''}${asset.area ? `, Area: ${asset.area}` : ''}${asset.district ? `, District: ${asset.district}` : ''}${asset.state ? `, State: ${asset.state}` : ''}`)] })],
            }),
          ],
        }),
    );

    // Auction detail rows
    const detailRows = [
      ['Date of Auction', auctionDate],
      ['Time', auctionTime],
      ['Mode of Auction', auctionMode === 'online' ? 'E-Auction (Online)' : 'Physical Auction'],
      ['Venue / Platform', auctionVenue],
      ['Reserve Price', reservePrice],
      ['Bid Increment', bidIncrement],
      ['EMD (Earnest Money Deposit)', emdAmount],
      ['EMD Submission Deadline', emdDeadline],
      ['EMD Payment Modes', emdModes],
    ].map(([label, value]) =>
      new TableRow({
        children: [
          new TableCell({ borders: tableBorder, width: { size: 35, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [tr(label, { bold: true })] })] }),
          new TableCell({ borders: tableBorder, width: { size: 65, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [tr(value)] })] }),
        ],
      }),
    );

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1080, right: 1080 } } },
        children: [
          // Letterhead
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: branch.bankName.toUpperCase(), bold: true, size: 36, font: 'Times New Roman' })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [tr(`${branch.branchName} Branch | ${branch.branchAddress}, ${branch.city}, ${branch.state}`)] }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [tr(`IFSC: ${branch.ifscCode}${branch.phone ? ` | Phone: ${branch.phone}` : ''} | Email: ${branch.email}`)],
            spacing: { after: 400 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 3 } },
          }),

          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 100 },
            children: [new TextRun({
              text: 'SALE NOTICE FOR SALE OF IMMOVABLE / MOVABLE SECURED ASSETS',
              bold: true, size: 24, font: 'Times New Roman', underline: { type: UnderlineType.SINGLE },
            })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [tr('UNDER RULE 8(5), 8(6) AND RULE 9 OF THE SECURITY INTEREST (ENFORCEMENT) RULES, 2002')],
          }),

          // Date and Place
          new Paragraph({ children: [tr(`Date: ${noticeDate}`), tr(`\t\t\t\tPlace: ${noticePlace}`)], spacing: { after: 200 } }),

          // Recipient
          new Paragraph({ children: [tr('To:', { bold: true })] }),
          new Paragraph({ children: [tr(recipientName)] }),
          new Paragraph({ children: [tr(recipientAddress)], spacing: { after: 200 } }),

          // Loan details
          new Paragraph({ children: [tr('Loan Account No: ', { bold: true }), tr(caseData.accountNo)] }),
          new Paragraph({ children: [tr('Type of Loan: ', { bold: true }), tr(caseData.loanType)] }),
          new Paragraph({ children: [tr('Date of NPA Classification: ', { bold: true }), tr(formatDate(caseData.npaDate))], spacing: { after: 200 } }),

          // Possession reference
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr(`WHEREAS, the Authorised Officer of ${branch.bankName} had taken possession of the secured assets on ${refPossessionDate} under Section 13(4) of the SARFAESI Act, 2002.`)],
          }),

          // Outstanding
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr(`The total amount outstanding as on the date of this Sale Notice is ${outstandingAmt}.`)],
          }),

          // Sale intent
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 },
            children: [tr('Notice is hereby given to the borrower(s) and the general public that the undersigned, being the Authorised Officer, proposes to sell the following secured assets on "AS IS WHERE IS", "AS IS WHAT IS" and "WHATEVER THERE IS" basis for recovery of the above outstanding dues:')],
          }),

          // Assets heading + table
          new Paragraph({ spacing: { before: 200, after: 100 }, children: [tr('Details of Secured Assets for Sale:', { bold: true })] }),
          new Table({ rows: [assetHeaderRow, ...assetRows] }),

          // Auction details heading + table
          new Paragraph({ spacing: { before: 300, after: 100 }, children: [tr('Auction / Sale Details:', { bold: true })] }),
          new Table({ rows: detailRows }),

          // Valuation
          new Paragraph({ spacing: { before: 300, after: 100 }, children: [tr('Valuation Details:', { bold: true })] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`1. ${valuer1} — Report dated ${valuer1Date}`)] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`2. ${valuer2} — Report dated ${valuer2Date}`)], spacing: { after: 200 } }),

          // Property inspection
          new Paragraph({ children: [tr('Property Inspection:', { bold: true })] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`Inspection Dates: ${inspectionDates}`)] }),
          new Paragraph({ indent: { left: 400 }, children: [tr(`Contact: ${inspContactName} — ${inspContactPhone}`)], spacing: { after: 200 } }),

          // Encumbrance
          new Paragraph({ children: [tr('Encumbrance Status: ', { bold: true }), tr(encumbrance)], spacing: { after: 200 } }),

          // Terms
          new Paragraph({ children: [tr('Terms and Conditions:', { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 200 }, children: [tr(terms)] }),

          // Redemption note
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED, spacing: { after: 600 },
            children: [tr('The borrower\'s attention is invited to the provisions of sub-section (8) of Section 13 of the SARFAESI Act, 2002, in respect of the time available to redeem the secured assets before the date fixed for sale or transfer.')],
          }),

          // Signature block
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(`For and on behalf of ${branch.bankName}`)] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 600 }, children: [] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(aoName, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(aoDesig)] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr('Authorised Officer')] }),
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [tr(`${branch.branchName} Branch`)] }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  },

  async generatePdfFromHtml(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        printBackground: true,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  },
};

export { documentGeneratorService };
