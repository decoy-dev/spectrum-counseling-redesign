// ============================================================
// Spectrum Counseling — New Client Intake Form Handler
// ============================================================
// SETUP INSTRUCTIONS:
//
// 1. Go to https://script.google.com and create a new project
// 2. Paste this entire file into Code.gs
// 3. Deploy: Deploy > New deployment > Web app
//    - Execute as: Me
//    - Who has access: Anyone
// 4. Copy the web app URL and paste it into new-client-form.html
//    as the form's action attribute
//
// NOTE: This version builds the intake PDF programmatically —
// no Google Docs template needed.
// ============================================================

var CONFIG = {
  RECIPIENT_EMAIL: 'mhaddox@spectrumcounseling.net',
  REDIRECT_URL: 'https://decoy-dev.github.io/spectrum-counseling-redesign/new-client-form.html?submitted=true'
};

// ── Brand colors ──────────────────────────────────────────────
var BRAND = {
  primary:     '#567a96',
  primaryDark: '#365671',
  textDark:    '#2d3335',
  textMuted:   '#5a6062',
  labelGrey:   '#888888',
  ruleLight:   '#cccccc',
  ruleDark:    '#333333',
  footerGrey:  '#999999',
  white:       '#ffffff'
};

function doPost(e) {
  try {
    var p = e.parameter;
    var ps = e.parameters;

    // Honeypot — if filled, it's a bot
    if (p['_honey']) {
      return redirect();
    }

    var clientName = ((p['Client First Name'] || '') + ' ' + (p['Client Last Name'] || '')).trim();
    var concerns = ps['Concerns'] ? ps['Concerns'].join(', ') : 'None selected';
    var submissionDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');

    // Collect all field values
    var f = {
      clientFirst:    p['Client First Name'] || '',
      clientLast:     p['Client Last Name'] || '',
      preferredName:  p['Client Preferred Name'] || '',
      pronouns:       p['Client Pronouns'] || '',
      dob:            p['Client Date of Birth'] || '',
      phone:          p['Client Phone'] || '',
      email:          p['Client Email'] || '',
      address:        p['Client Address'] || '',
      employer:       p['Employer'] || '',
      occupation:     p['Occupation'] || '',
      partnerFirst:   p['Partner First Name'] || '',
      partnerLast:    p['Partner Last Name'] || '',
      partnerPref:    p['Partner Preferred Name'] || '',
      partnerPro:     p['Partner Pronouns'] || '',
      partnerDob:     p['Partner Date of Birth'] || '',
      partnerEmail:   p['Partner Email'] || '',
      parentNames:    p['Parent Guardian Names'] || '',
      school:         p['School'] || '',
      grade:          p['Grade'] || '',
      reason:         p['Reason for Counseling'] || '',
      referredBy:     p['Referred By'] || '',
      prevCounseling: p['Previous Counseling'] || '',
      medications:    p['Current Medications'] || '',
      medical:        p['Medical Problems'] || '',
      concerns:       concerns,
      payment:        p['Payment Preference'] || '',
      finSig:         p['Financial Responsibility Signature'] || '',
      finDate:        p['Financial Responsibility Date'] || '',
      hipaaSig:       p['HIPAA Signature'] || '',
      hipaaDate:      p['HIPAA Signature Date'] || '',
      ack1:           p['Ack Initials 1 - Insurance'] || '',
      ack2:           p['Ack Initials 2 - Payment'] || '',
      ack3:           p['Ack Initials 3 - Consent'] || '',
      ack4:           p['Ack Initials 4 - Stop Care'] || '',
      submissionDate: submissionDate
    };

    // Build the Google Doc
    var doc = DocumentApp.create('Intake - ' + (clientName || 'Unknown') + ' - ' + submissionDate);
    var body = doc.getBody();

    // Page margins (0.75 in = ~54 pt)
    body.setMarginTop(54);
    body.setMarginBottom(54);
    body.setMarginLeft(54);
    body.setMarginRight(54);

    buildDocument(body, f);

    doc.saveAndClose();

    // Export as PDF
    var pdf = DriveApp.getFileById(doc.getId()).getAs('application/pdf');
    var safeName = (f.clientLast || 'Unknown').replace(/[^a-zA-Z0-9]/g, '')
                 + '_'
                 + (f.clientFirst || '').replace(/[^a-zA-Z0-9]/g, '');
    pdf.setName('Intake_' + safeName + '.pdf');

    // Email the PDF
    GmailApp.sendEmail(
      CONFIG.RECIPIENT_EMAIL,
      'New Client Intake: ' + (clientName || 'Unknown'),
      'A new client intake form has been submitted.\n\n' +
      'Client: ' + (clientName || 'Unknown') + '\n' +
      'Email: '  + (f.email || 'Not provided') + '\n' +
      'Phone: '  + (f.phone || 'Not provided') + '\n\n' +
      'The completed intake form is attached as a PDF.',
      {
        attachments: [pdf],
        name: 'Spectrum Counseling Forms'
      }
    );

    // Delete the temporary Google Doc
    DriveApp.getFileById(doc.getId()).setTrashed(true);

  } catch (error) {
    Logger.log('Intake form error: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'no stack'));
    // Re-throw so the execution shows as Failed in the dashboard
    throw error;
  }

  return redirect();
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  DOCUMENT BUILDER                                           ║
// ╚══════════════════════════════════════════════════════════════╝

function buildDocument(body, f) {

  // Use the default empty paragraph for the first line instead of removing it
  // (Google Docs requires at least one child in the body at all times)
  var firstPara = body.getChild(0).asParagraph();
  firstPara.setText('SPECTRUM COUNSELING, LLC');
  var firstTs = firstPara.editAsText();
  firstTs.setFontFamily('Times New Roman');
  firstTs.setFontSize(18);
  firstTs.setBold(true);
  firstTs.setForegroundColor(BRAND.primary);
  firstPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  firstPara.setSpacingBefore(0);
  firstPara.setSpacingAfter(0);
  addStyledPara(body, 'Marie Haddox, Ph.D. \u2014 Licensed Psychologist', 'Times New Roman', 11, false, BRAND.textMuted, DocumentApp.HorizontalAlignment.CENTER, 0, 0);
  addStyledPara(body, '428 S. Gilbert Rd. Ste. #105 (Bldg. 3) \u2022 Gilbert, AZ 85296 \u2022 (480) 782-0113', 'Times New Roman', 9, false, BRAND.labelGrey, DocumentApp.HorizontalAlignment.CENTER, 0, 6);

  // Header divider
  addColoredRule(body, BRAND.primary);

  addStyledPara(body, 'NEW CLIENT INTAKE FORM', 'Times New Roman', 13, true, BRAND.primary, DocumentApp.HorizontalAlignment.CENTER, 10, 0);
  addStyledPara(body, 'Submitted: ' + f.submissionDate, 'Times New Roman', 9, false, BRAND.labelGrey, DocumentApp.HorizontalAlignment.CENTER, 0, 12);


  // ── SECTION 1: CLIENT INFORMATION ─────────────────────────────
  addSectionTitle(body, '1 \u2014 Client Information');

  addTwoColFields(body, 'FIRST NAME', f.clientFirst, 'LAST NAME', f.clientLast);
  addTwoColFields(body, 'PREFERRED NAME', f.preferredName, 'PRONOUNS', f.pronouns);
  addTwoColFields(body, 'DATE OF BIRTH', f.dob, 'PHONE NUMBER', f.phone);
  addSingleField(body, 'EMAIL', f.email);
  addSingleField(body, 'ADDRESS', f.address);
  addTwoColFields(body, 'EMPLOYER', f.employer, 'OCCUPATION', f.occupation);


  // ── SECTION 2: PARTNER / MINOR INFORMATION ────────────────────
  addSectionTitle(body, '2 \u2014 Partner / Minor Information');
  addItalicNote(body, 'Complete if seeking couples therapy or if client is a minor.');

  addTwoColFields(body, 'PARTNER FIRST NAME', f.partnerFirst, 'PARTNER LAST NAME', f.partnerLast);
  addTwoColFields(body, 'PREFERRED NAME', f.partnerPref, 'PRONOUNS', f.partnerPro);
  addTwoColFields(body, 'PARTNER DATE OF BIRTH', f.partnerDob, 'PARTNER EMAIL', f.partnerEmail);
  addSingleField(body, 'PARENT / GUARDIAN NAMES (FOR MINOR CLIENTS)', f.parentNames);
  addTwoColFields(body, 'SCHOOL', f.school, 'GRADE', f.grade);


  // ── SECTION 3: CLINICAL BACKGROUND ────────────────────────────
  addSectionTitle(body, '3 \u2014 Clinical Background');

  addSingleField(body, 'REASON FOR COUNSELING', f.reason);
  addSingleField(body, 'REFERRED BY', f.referredBy);
  addSingleField(body, 'PREVIOUS COUNSELING EXPERIENCE', f.prevCounseling);
  addSingleField(body, 'CURRENT MEDICATIONS & REASONS', f.medications);
  addSingleField(body, 'MEDICAL PROBLEMS / CONCERNS', f.medical);


  // ── SECTION 4: AREAS OF CONCERN ───────────────────────────────
  addSectionTitle(body, '4 \u2014 Areas of Concern');
  addSingleField(body, 'SELECTED CONCERNS', f.concerns);


  // ── SECTION 5: PAYMENT & INSURANCE ────────────────────────────
  addSectionTitle(body, '5 \u2014 Payment & Insurance');
  addSingleField(body, 'PAYMENT PREFERENCE', f.payment);

  // Financial responsibility notice box
  addNoticeBox(body,
    'Financial Responsibility Acknowledgment:',
    'The client/responsible party is responsible for payment of professional services at the time they are rendered. ' +
    'By signing below, I certify that I, the client/responsible party, acknowledge that Dr. Haddox does not accept any ' +
    'health insurance and will not submit claims for reimbursement to any insurance company on my behalf.'
  );

  addTwoColFields(body, 'SIGNATURE (TYPED)', f.finSig, 'DATE', f.finDate);


  // ── SECTION 6: HIPAA ─────────────────────────────────────────
  addSectionTitle(body, '6 \u2014 HIPAA Notice of Privacy Practices');

  addStyledPara(body, 'By signing below, I acknowledge that I have received and reviewed the HIPAA Notice of Privacy Practices for Spectrum Counseling, LLC, in accordance with the Health Insurance Portability and Accountability Act (HIPAA), the HITECH Act, and the 2013 Omnibus Rule.', 'Times New Roman', 9.5, false, BRAND.textMuted, DocumentApp.HorizontalAlignment.LEFT, 2, 8);

  addTwoColFields(body, 'SIGNATURE (TYPED)', f.hipaaSig, 'DATE', f.hipaaDate);


  // ── SECTION 7: ACKNOWLEDGMENT ─────────────────────────────────
  addSectionTitle(body, '7 \u2014 Acknowledgment');

  addAckItem(body, f.ack1, 'I understand Dr. Haddox does not accept any health insurance and will not submit claims for reimbursement.');
  addAckItem(body, f.ack2, 'I am responsible for payment of professional services at the time they are rendered.');
  addAckItem(body, f.ack3, 'I voluntarily agree to receive mental health assessment, care, treatment, or services.');
  addAckItem(body, f.ack4, 'I understand I may stop care at any time.');


  // ── FOOTER ────────────────────────────────────────────────────
  addSpacer(body, 10);
  addColoredRule(body, BRAND.ruleLight);
  addStyledPara(body, 'Spectrum Counseling, LLC \u2022 Marie Haddox, Ph.D. \u2022 428 S. Gilbert Rd. Ste. #105, Gilbert, AZ 85296 \u2022 (480) 782-0113 \u2022 mhaddox@spectrumcounseling.net', 'Times New Roman', 8, false, BRAND.footerGrey, DocumentApp.HorizontalAlignment.CENTER, 4, 0);
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  HELPER FUNCTIONS                                           ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Add a paragraph with full style control.
 */
function addStyledPara(body, text, fontFamily, fontSize, bold, color, alignment, spacingBefore, spacingAfter) {
  var para = body.appendParagraph(text);
  var ts = para.editAsText();
  ts.setFontFamily(fontFamily);
  ts.setFontSize(fontSize);
  ts.setBold(bold);
  ts.setForegroundColor(color);
  para.setAlignment(alignment);
  para.setSpacingBefore(spacingBefore);
  para.setSpacingAfter(spacingAfter);
  return para;
}

/**
 * Add a colored section title with a rule underneath.
 */
function addSectionTitle(body, text) {
  addStyledPara(body, text, 'Times New Roman', 12, true, BRAND.primary, DocumentApp.HorizontalAlignment.LEFT, 16, 2);
  addColoredRule(body, BRAND.primary);
}

/**
 * Draw a colored horizontal rule using a single-cell table.
 */
function addColoredRule(body, color) {
  var table = body.appendTable([['']]);
  table.setBorderColor(color);
  table.setBorderWidth(0);

  var cell = table.getRow(0).getCell(0);
  cell.setPaddingTop(0);
  cell.setPaddingBottom(0);
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);

  // Style the paragraph inside the cell to be minimal
  var para = cell.getChild(0).asParagraph();
  para.editAsText().setFontSize(1);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);

  // Use a bottom border on the cell's paragraph to create the line effect
  // Since we can't do per-side borders, use the paragraph's built-in HR
  // Actually, the simplest approach: just use appendHorizontalRule on body
  // But that doesn't support color. So let's use a colored text line instead.

  // Replace the table approach with a simple colored dash line
  body.removeChild(table);

  var rule = body.appendParagraph('\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500');
  var ruleTs = rule.editAsText();
  ruleTs.setFontFamily('Times New Roman');
  ruleTs.setFontSize(4);
  ruleTs.setForegroundColor(color);
  rule.setSpacingBefore(0);
  rule.setSpacingAfter(2);
}

/**
 * Add a two-column field row using a 1-row, 2-column table.
 */
function addTwoColFields(body, label1, value1, label2, value2) {
  var val1 = value1 || '\u2014';
  var val2 = value2 || '\u2014';

  // Create a table with one row and two cells
  var table = body.appendTable([[' ', ' ']]);
  table.setBorderWidth(0);

  var row = table.getRow(0);

  // Style cell 1
  var cell1 = row.getCell(0);
  cell1.setPaddingTop(2);
  cell1.setPaddingBottom(4);
  cell1.setPaddingLeft(0);
  cell1.setPaddingRight(10);
  styleLabelValueCell(cell1, label1, val1);

  // Style cell 2
  var cell2 = row.getCell(1);
  cell2.setPaddingTop(2);
  cell2.setPaddingBottom(4);
  cell2.setPaddingLeft(10);
  cell2.setPaddingRight(0);
  styleLabelValueCell(cell2, label2, val2);
}

/**
 * Style a table cell with a label paragraph and a value paragraph.
 */
function styleLabelValueCell(cell, label, value) {
  // The cell already has one auto-created paragraph — use it for the label
  var labelPara = cell.getChild(0).asParagraph();
  labelPara.setText(label);
  var labelTs = labelPara.editAsText();
  labelTs.setFontFamily('Times New Roman');
  labelTs.setFontSize(8);
  labelTs.setBold(true);
  labelTs.setForegroundColor(BRAND.labelGrey);
  labelPara.setSpacingBefore(0);
  labelPara.setSpacingAfter(1);

  // Append value paragraph
  var valuePara = cell.appendParagraph(value);
  var valueTs = valuePara.editAsText();
  valueTs.setFontFamily('Times New Roman');
  valueTs.setFontSize(11);
  valueTs.setBold(false);
  valueTs.setForegroundColor(BRAND.textDark);
  valuePara.setSpacingBefore(0);
  valuePara.setSpacingAfter(0);
}

/**
 * Add a single full-width field (label + value + thin divider).
 */
function addSingleField(body, label, value) {
  var val = value || '\u2014';

  addStyledPara(body, label, 'Times New Roman', 8, true, BRAND.labelGrey, DocumentApp.HorizontalAlignment.LEFT, 6, 1);
  addStyledPara(body, val, 'Times New Roman', 11, false, BRAND.textDark, DocumentApp.HorizontalAlignment.LEFT, 0, 2);
  addColoredRule(body, BRAND.ruleLight);
}

/**
 * Add an italic info note.
 */
function addItalicNote(body, text) {
  var para = addStyledPara(body, text, 'Times New Roman', 9, false, BRAND.textMuted, DocumentApp.HorizontalAlignment.LEFT, 0, 6);
  para.editAsText().setItalic(true);
}

/**
 * Add a bordered notice box with a bold heading and body text.
 */
function addNoticeBox(body, heading, text) {
  var table = body.appendTable([[heading + ' ' + text]]);
  table.setBorderWidth(1);
  table.setBorderColor(BRAND.ruleLight);

  var cell = table.getRow(0).getCell(0);
  cell.setPaddingTop(6);
  cell.setPaddingBottom(6);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);

  var para = cell.getChild(0).asParagraph();
  var paraTs = para.editAsText();
  paraTs.setFontFamily('Times New Roman');
  paraTs.setFontSize(9.5);
  paraTs.setForegroundColor(BRAND.textMuted);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);

  // Bold just the heading portion
  var headingLength = heading.length;
  paraTs.setBold(0, headingLength - 1, true);
}

/**
 * Add an acknowledgment item: initials + statement in a two-column table.
 */
function addAckItem(body, initials, statement) {
  var initVal = initials || '\u2014';

  var table = body.appendTable([['INITIALS', statement]]);
  table.setBorderWidth(0);

  var row = table.getRow(0);

  // Initials cell (narrow)
  var initCell = row.getCell(0);
  initCell.setWidth(60);
  initCell.setPaddingTop(4);
  initCell.setPaddingBottom(4);
  initCell.setPaddingLeft(0);
  initCell.setPaddingRight(8);

  // Replace the auto text with label + value
  var initLabelPara = initCell.getChild(0).asParagraph();
  initLabelPara.setText('INITIALS');
  var initLabelTs = initLabelPara.editAsText();
  initLabelTs.setFontFamily('Times New Roman');
  initLabelTs.setFontSize(7);
  initLabelTs.setBold(true);
  initLabelTs.setForegroundColor(BRAND.labelGrey);
  initLabelPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  initLabelPara.setSpacingBefore(0);
  initLabelPara.setSpacingAfter(1);

  var initValPara = initCell.appendParagraph(initVal);
  var initValTs = initValPara.editAsText();
  initValTs.setFontFamily('Times New Roman');
  initValTs.setFontSize(11);
  initValTs.setBold(true);
  initValTs.setForegroundColor(BRAND.textDark);
  initValPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  initValPara.setSpacingBefore(0);
  initValPara.setSpacingAfter(0);

  // Statement cell
  var stmtCell = row.getCell(1);
  stmtCell.setPaddingTop(8);
  stmtCell.setPaddingBottom(4);
  stmtCell.setPaddingLeft(4);
  stmtCell.setPaddingRight(0);

  var stmtPara = stmtCell.getChild(0).asParagraph();
  stmtPara.setText(statement);
  var stmtTs = stmtPara.editAsText();
  stmtTs.setFontFamily('Times New Roman');
  stmtTs.setFontSize(10);
  stmtTs.setBold(false);
  stmtTs.setForegroundColor(BRAND.textDark);
  stmtPara.setSpacingBefore(0);
  stmtPara.setSpacingAfter(0);
}

/**
 * Add vertical spacing.
 */
function addSpacer(body, pts) {
  var p = body.appendParagraph('');
  p.editAsText().setFontSize(1);
  p.setSpacingBefore(pts || 4);
  p.setSpacingAfter(0);
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  ROUTING                                                    ║
// ╚══════════════════════════════════════════════════════════════╝

function redirect() {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head>' +
    '<meta http-equiv="refresh" content="0;url=' + CONFIG.REDIRECT_URL + '">' +
    '</head><body><p>Redirecting&hellip;</p></body></html>'
  );
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<p>Spectrum Counseling intake form handler is active.</p>'
  );
}
