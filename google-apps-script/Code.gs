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
  REDIRECT_URL: 'https://spectrumcounseling.net/new-client-form.html?submitted=true'
};

// ── Brand colors ──────────────────────────────────────────────
var BRAND = {
  primary:     '#567a96',
  primaryDark: '#365671',
  textDark:    '#2d3335',
  textMuted:   '#5a6062',
  labelGrey:   '#888888',
  ruleLight:   '#d0d0d0',
  footerGrey:  '#999999',
  white:       '#ffffff',
  bgLight:     '#f5f7f8'
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
    throw error;
  }

  return redirect();
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  DOCUMENT BUILDER                                           ║
// ╚══════════════════════════════════════════════════════════════╝

function buildDocument(body, f) {

  // ── HEADER ────────────────────────────────────────────────────
  // Reuse the default paragraph (body must always have >= 1 child)
  var titlePara = body.getChild(0).asParagraph();
  titlePara.setText('SPECTRUM COUNSELING, LLC');
  styleText(titlePara, 'Times New Roman', 20, true, BRAND.primary);
  titlePara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  titlePara.setSpacingBefore(0);
  titlePara.setSpacingAfter(2);

  addPara(body, 'Marie Haddox, Ph.D. \u2014 Licensed Psychologist',
    'Times New Roman', 11, false, BRAND.textMuted, 'CENTER', 0, 2);
  addPara(body, '428 S. Gilbert Rd. Ste. #105 (Bldg. 3) \u2022 Gilbert, AZ 85296 \u2022 (480) 782-0113',
    'Times New Roman', 9, false, BRAND.labelGrey, 'CENTER', 0, 8);

  // Primary colored divider
  addFullWidthRule(body, BRAND.primary, 2);

  addPara(body, 'NEW CLIENT INTAKE FORM',
    'Times New Roman', 14, true, BRAND.primary, 'CENTER', 12, 2);
  addPara(body, 'Submitted: ' + f.submissionDate,
    'Times New Roman', 9, false, BRAND.labelGrey, 'CENTER', 0, 14);


  // ── SECTION 1: CLIENT INFORMATION ─────────────────────────────
  addSectionHeader(body, '1 \u2014 Client Information');

  addFieldPair(body, 'First Name', f.clientFirst, 'Last Name', f.clientLast);
  addFieldPair(body, 'Preferred Name', f.preferredName, 'Pronouns', f.pronouns);
  addFieldPair(body, 'Date of Birth', f.dob, 'Phone Number', f.phone);
  addFieldFull(body, 'Email', f.email);
  addFieldFull(body, 'Address', f.address);
  addFieldPair(body, 'Employer', f.employer, 'Occupation', f.occupation);


  // ── SECTION 2: PARTNER / MINOR INFORMATION ────────────────────
  addSectionHeader(body, '2 \u2014 Partner / Minor Information');
  addPara(body, 'Complete if seeking couples therapy or if client is a minor.',
    'Times New Roman', 9, false, BRAND.textMuted, 'LEFT', 0, 6).editAsText().setItalic(true);

  addFieldPair(body, 'Partner First Name', f.partnerFirst, 'Partner Last Name', f.partnerLast);
  addFieldPair(body, 'Preferred Name', f.partnerPref, 'Pronouns', f.partnerPro);
  addFieldPair(body, 'Partner Date of Birth', f.partnerDob, 'Partner Email', f.partnerEmail);
  addFieldFull(body, 'Parent / Guardian Names (for minor clients)', f.parentNames);
  addFieldPair(body, 'School', f.school, 'Grade', f.grade);


  // ── SECTION 3: CLINICAL BACKGROUND ────────────────────────────
  addSectionHeader(body, '3 \u2014 Clinical Background');

  addFieldFull(body, 'Reason for Counseling', f.reason);
  addFieldFull(body, 'Referred By', f.referredBy);
  addFieldFull(body, 'Previous Counseling Experience', f.prevCounseling);
  addFieldFull(body, 'Current Medications & Reasons', f.medications);
  addFieldFull(body, 'Medical Problems / Concerns', f.medical);


  // ── SECTION 4: AREAS OF CONCERN ───────────────────────────────
  addSectionHeader(body, '4 \u2014 Areas of Concern');
  addFieldFull(body, 'Selected Concerns', f.concerns);


  // ── SECTION 5: PAYMENT & INSURANCE ────────────────────────────
  addSectionHeader(body, '5 \u2014 Payment & Insurance');
  addFieldFull(body, 'Payment Preference', f.payment);

  // Financial responsibility notice box
  addNoticeBox(body,
    'Financial Responsibility Acknowledgment:',
    ' The client/responsible party is responsible for payment of professional services at the time they are rendered. ' +
    'By signing below, I certify that I, the client/responsible party, acknowledge that Dr. Haddox does not accept any ' +
    'health insurance and will not submit claims for reimbursement to any insurance company on my behalf.'
  );
  addSpacer(body, 4);
  addFieldPair(body, 'Signature (Typed)', f.finSig, 'Date', f.finDate);


  // ── SECTION 6: HIPAA ─────────────────────────────────────────
  addSectionHeader(body, '6 \u2014 HIPAA Notice of Privacy Practices');

  addPara(body,
    'By signing below, I acknowledge that I have received and reviewed the HIPAA Notice of Privacy Practices ' +
    'for Spectrum Counseling, LLC, in accordance with the Health Insurance Portability and Accountability Act (HIPAA), ' +
    'the HITECH Act, and the 2013 Omnibus Rule.',
    'Times New Roman', 9.5, false, BRAND.textMuted, 'LEFT', 2, 8);

  addFieldPair(body, 'Signature (Typed)', f.hipaaSig, 'Date', f.hipaaDate);


  // ── SECTION 7: ACKNOWLEDGMENT ─────────────────────────────────
  addSectionHeader(body, '7 \u2014 Acknowledgment');

  addAckItem(body, f.ack1, 'I understand Dr. Haddox does not accept any health insurance and will not submit claims for reimbursement.');
  addAckItem(body, f.ack2, 'I am responsible for payment of professional services at the time they are rendered.');
  addAckItem(body, f.ack3, 'I voluntarily agree to receive mental health assessment, care, treatment, or services.');
  addAckItem(body, f.ack4, 'I understand I may stop care at any time.');


  // ── FOOTER ────────────────────────────────────────────────────
  addSpacer(body, 16);
  addFullWidthRule(body, BRAND.ruleLight, 1);
  addPara(body,
    'Spectrum Counseling, LLC \u2022 Marie Haddox, Ph.D. \u2022 428 S. Gilbert Rd. Ste. #105, Gilbert, AZ 85296 \u2022 (480) 782-0113 \u2022 mhaddox@spectrumcounseling.net',
    'Times New Roman', 8, false, BRAND.footerGrey, 'CENTER', 6, 0);
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  HELPER FUNCTIONS                                           ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Apply text styling to a paragraph via editAsText().
 */
function styleText(para, fontFamily, fontSize, bold, color) {
  var ts = para.editAsText();
  ts.setFontFamily(fontFamily);
  ts.setFontSize(fontSize);
  ts.setBold(bold);
  ts.setForegroundColor(color);
  return ts;
}

/**
 * Add a styled paragraph. Alignment is a string: 'LEFT', 'CENTER', 'RIGHT'.
 */
function addPara(body, text, fontFamily, fontSize, bold, color, align, spacingBefore, spacingAfter) {
  var para = body.appendParagraph(text);
  styleText(para, fontFamily, fontSize, bold, color);
  para.setAlignment(DocumentApp.HorizontalAlignment[align || 'LEFT']);
  para.setSpacingBefore(spacingBefore);
  para.setSpacingAfter(spacingAfter);
  return para;
}

/**
 * Full-width horizontal rule using a 1x1 table with a colored background.
 * The cell background creates a solid bar that stretches edge to edge.
 */
function addFullWidthRule(body, color, heightPx) {
  var table = body.appendTable([['']]);
  table.setBorderWidth(0);
  table.setBorderColor(color);

  var cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor(color);
  cell.setPaddingTop(heightPx || 1);
  cell.setPaddingBottom(0);
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);

  var para = cell.getChild(0).asParagraph();
  styleText(para, 'Times New Roman', 1, false, color);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);
}

/**
 * Section header: bold colored title with a full-width rule underneath.
 */
function addSectionHeader(body, text) {
  addPara(body, text, 'Times New Roman', 12, true, BRAND.primary, 'LEFT', 18, 3);
  addFullWidthRule(body, BRAND.primary, 1);
  addSpacer(body, 4);
}

/**
 * Two-column field row using a 2-column table.
 * Each cell has a small uppercase label and the field value below.
 * A light bottom border separates from the next row.
 */
function addFieldPair(body, label1, value1, label2, value2) {
  var val1 = value1 || '\u2014';
  var val2 = value2 || '\u2014';

  var table = body.appendTable([[' ', ' ']]);
  table.setBorderWidth(0);

  var row = table.getRow(0);
  styleFieldCell(row.getCell(0), label1, val1, 0, 12);
  styleFieldCell(row.getCell(1), label2, val2, 12, 0);

  // Add a light rule after the field pair
  addLightDivider(body);
}

/**
 * Style a table cell with label + value.
 */
function styleFieldCell(cell, label, value, paddingLeft, paddingRight) {
  cell.setPaddingTop(4);
  cell.setPaddingBottom(6);
  cell.setPaddingLeft(paddingLeft);
  cell.setPaddingRight(paddingRight);

  // Label (use the auto-created paragraph)
  var labelPara = cell.getChild(0).asParagraph();
  labelPara.setText(label.toUpperCase());
  styleText(labelPara, 'Times New Roman', 7, true, BRAND.labelGrey);
  labelPara.setSpacingBefore(0);
  labelPara.setSpacingAfter(2);

  // Value
  var valuePara = cell.appendParagraph(value);
  styleText(valuePara, 'Times New Roman', 11, false, BRAND.textDark);
  valuePara.setSpacingBefore(0);
  valuePara.setSpacingAfter(0);
}

/**
 * Single full-width field with label above value.
 */
function addFieldFull(body, label, value) {
  var val = value || '\u2014';

  var table = body.appendTable([[' ']]);
  table.setBorderWidth(0);

  var cell = table.getRow(0).getCell(0);
  cell.setPaddingTop(4);
  cell.setPaddingBottom(6);
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);

  // Label
  var labelPara = cell.getChild(0).asParagraph();
  labelPara.setText(label.toUpperCase());
  styleText(labelPara, 'Times New Roman', 7, true, BRAND.labelGrey);
  labelPara.setSpacingBefore(0);
  labelPara.setSpacingAfter(2);

  // Value
  var valuePara = cell.appendParagraph(val);
  styleText(valuePara, 'Times New Roman', 11, false, BRAND.textDark);
  valuePara.setSpacingBefore(0);
  valuePara.setSpacingAfter(0);

  // Light divider
  addLightDivider(body);
}

/**
 * Thin light-grey full-width divider between fields.
 */
function addLightDivider(body) {
  var table = body.appendTable([['']]);
  table.setBorderWidth(0);

  var cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor(BRAND.ruleLight);
  cell.setPaddingTop(0);
  cell.setPaddingBottom(0);
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);

  var para = cell.getChild(0).asParagraph();
  styleText(para, 'Times New Roman', 1, false, BRAND.ruleLight);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);
}

/**
 * Bordered notice box with bold heading.
 */
function addNoticeBox(body, heading, text) {
  var table = body.appendTable([[heading + text]]);
  table.setBorderWidth(1);
  table.setBorderColor(BRAND.ruleLight);

  var cell = table.getRow(0).getCell(0);
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(10);
  cell.setPaddingRight(10);
  cell.setBackgroundColor(BRAND.bgLight);

  var para = cell.getChild(0).asParagraph();
  var ts = styleText(para, 'Times New Roman', 9.5, false, BRAND.textMuted);
  para.setSpacingBefore(0);
  para.setSpacingAfter(0);
  para.setLineSpacing(1.3);

  // Bold the heading portion
  ts.setBold(0, heading.length - 1, true);
  ts.setForegroundColor(0, heading.length - 1, BRAND.textDark);
}

/**
 * Acknowledgment item: initials box + statement in a two-column table.
 */
function addAckItem(body, initials, statement) {
  var initVal = initials || '\u2014';

  var table = body.appendTable([['', '']]);
  table.setBorderWidth(0);

  var row = table.getRow(0);

  // Initials cell (narrow, with background)
  var initCell = row.getCell(0);
  initCell.setWidth(56);
  initCell.setPaddingTop(6);
  initCell.setPaddingBottom(6);
  initCell.setPaddingLeft(4);
  initCell.setPaddingRight(4);
  initCell.setBackgroundColor(BRAND.bgLight);

  var initLabelPara = initCell.getChild(0).asParagraph();
  initLabelPara.setText('INITIALS');
  styleText(initLabelPara, 'Times New Roman', 6, true, BRAND.labelGrey);
  initLabelPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  initLabelPara.setSpacingBefore(0);
  initLabelPara.setSpacingAfter(2);

  var initValPara = initCell.appendParagraph(initVal);
  styleText(initValPara, 'Times New Roman', 12, true, BRAND.primary);
  initValPara.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  initValPara.setSpacingBefore(0);
  initValPara.setSpacingAfter(0);

  // Statement cell
  var stmtCell = row.getCell(1);
  stmtCell.setPaddingTop(10);
  stmtCell.setPaddingBottom(6);
  stmtCell.setPaddingLeft(10);
  stmtCell.setPaddingRight(0);

  var stmtPara = stmtCell.getChild(0).asParagraph();
  stmtPara.setText(statement);
  styleText(stmtPara, 'Times New Roman', 10, false, BRAND.textDark);
  stmtPara.setSpacingBefore(0);
  stmtPara.setSpacingAfter(0);
  stmtPara.setLineSpacing(1.2);
}

/**
 * Vertical spacing.
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
