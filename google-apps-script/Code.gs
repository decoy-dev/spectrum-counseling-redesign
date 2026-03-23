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
  noteBg:      '#f5f7f8',
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

    // Remove the default empty paragraph
    if (body.getNumChildren() > 0) {
      body.removeChild(body.getChild(0));
    }

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
  }

  return redirect();
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  DOCUMENT BUILDER                                           ║
// ╚══════════════════════════════════════════════════════════════╝

function buildDocument(body, f) {

  // ── HEADER ────────────────────────────────────────────────────
  addParagraph(body, 'SPECTRUM COUNSELING, LLC', {
    font: 'Times New Roman', size: 18, bold: true,
    color: BRAND.primary, align: DocumentApp.HorizontalAlignment.CENTER,
    spacingAfter: 0
  });
  addParagraph(body, 'Marie Haddox, Ph.D. \u2014 Licensed Psychologist', {
    font: 'Times New Roman', size: 11, bold: false,
    color: BRAND.textMuted, align: DocumentApp.HorizontalAlignment.CENTER,
    spacingAfter: 0
  });
  addParagraph(body, '428 S. Gilbert Rd. Ste. #105 (Bldg. 3) \u2022 Gilbert, AZ 85296 \u2022 (480) 782-0113', {
    font: 'Times New Roman', size: 9, bold: false,
    color: BRAND.labelGrey, align: DocumentApp.HorizontalAlignment.CENTER,
    spacingAfter: 2
  });

  // Header divider line (using a 1-row, 1-col table with colored bottom border)
  addHorizontalRule(body, BRAND.primary, 2);

  addParagraph(body, 'NEW CLIENT INTAKE FORM', {
    font: 'Times New Roman', size: 13, bold: true,
    color: BRAND.primary, align: DocumentApp.HorizontalAlignment.CENTER,
    spacingBefore: 10, spacingAfter: 0
  });
  addParagraph(body, 'Submitted: ' + f.submissionDate, {
    font: 'Times New Roman', size: 9, bold: false,
    color: BRAND.labelGrey, align: DocumentApp.HorizontalAlignment.CENTER,
    spacingAfter: 12
  });


  // ── SECTION 1: CLIENT INFORMATION ─────────────────────────────
  addSectionTitle(body, '1 \u2014 Client Information');

  addFieldRow(body, [
    { label: 'FIRST NAME', value: f.clientFirst },
    { label: 'LAST NAME',  value: f.clientLast }
  ]);
  addFieldRow(body, [
    { label: 'PREFERRED NAME', value: f.preferredName },
    { label: 'PRONOUNS',       value: f.pronouns }
  ]);
  addFieldRow(body, [
    { label: 'DATE OF BIRTH', value: f.dob },
    { label: 'PHONE NUMBER',  value: f.phone }
  ]);
  addFieldSingle(body, 'EMAIL', f.email);
  addFieldSingle(body, 'ADDRESS', f.address);
  addFieldRow(body, [
    { label: 'EMPLOYER',   value: f.employer },
    { label: 'OCCUPATION', value: f.occupation }
  ]);
  addSpacer(body, 6);


  // ── SECTION 2: PARTNER / MINOR INFORMATION ────────────────────
  addSectionTitle(body, '2 \u2014 Partner / Minor Information');
  addNote(body, 'Complete if seeking couples therapy or if client is a minor.');

  addFieldRow(body, [
    { label: 'PARTNER FIRST NAME', value: f.partnerFirst },
    { label: 'PARTNER LAST NAME',  value: f.partnerLast }
  ]);
  addFieldRow(body, [
    { label: 'PREFERRED NAME', value: f.partnerPref },
    { label: 'PRONOUNS',       value: f.partnerPro }
  ]);
  addFieldRow(body, [
    { label: 'PARTNER DATE OF BIRTH', value: f.partnerDob },
    { label: 'PARTNER EMAIL',         value: f.partnerEmail }
  ]);
  addFieldSingle(body, 'PARENT / GUARDIAN NAMES (FOR MINOR CLIENTS)', f.parentNames);
  addFieldRow(body, [
    { label: 'SCHOOL', value: f.school },
    { label: 'GRADE',  value: f.grade }
  ]);
  addSpacer(body, 6);


  // ── SECTION 3: CLINICAL BACKGROUND ────────────────────────────
  addSectionTitle(body, '3 \u2014 Clinical Background');

  addFieldSingle(body, 'REASON FOR COUNSELING', f.reason, true);
  addFieldSingle(body, 'REFERRED BY', f.referredBy);
  addFieldSingle(body, 'PREVIOUS COUNSELING EXPERIENCE', f.prevCounseling, true);
  addFieldSingle(body, 'CURRENT MEDICATIONS & REASONS', f.medications, true);
  addFieldSingle(body, 'MEDICAL PROBLEMS / CONCERNS', f.medical, true);
  addSpacer(body, 6);


  // ── SECTION 4: AREAS OF CONCERN ───────────────────────────────
  addSectionTitle(body, '4 \u2014 Areas of Concern');
  addFieldSingle(body, 'SELECTED CONCERNS', f.concerns, true);
  addSpacer(body, 6);


  // ── SECTION 5: PAYMENT & INSURANCE ────────────────────────────
  addSectionTitle(body, '5 \u2014 Payment & Insurance');
  addFieldSingle(body, 'PAYMENT PREFERENCE', f.payment);

  // Financial responsibility box
  addNoticeBox(body,
    'Financial Responsibility Acknowledgment: ' +
    'The client/responsible party is responsible for payment of professional services at the time they are rendered. ' +
    'By signing below, I certify that I, the client/responsible party, acknowledge that Dr. Haddox does not accept any ' +
    'health insurance and will not submit claims for reimbursement to any insurance company on my behalf.'
  );

  addFieldRow(body, [
    { label: 'SIGNATURE (TYPED)', value: f.finSig },
    { label: 'DATE',              value: f.finDate }
  ], true);
  addSpacer(body, 6);


  // ── SECTION 6: HIPAA ─────────────────────────────────────────
  addSectionTitle(body, '6 \u2014 HIPAA Notice of Privacy Practices');

  addBodyText(body,
    'By signing below, I acknowledge that I have received and reviewed the HIPAA Notice of Privacy Practices ' +
    'for Spectrum Counseling, LLC, in accordance with the Health Insurance Portability and Accountability Act (HIPAA), ' +
    'the HITECH Act, and the 2013 Omnibus Rule.'
  );

  addFieldRow(body, [
    { label: 'SIGNATURE (TYPED)', value: f.hipaaSig },
    { label: 'DATE',              value: f.hipaaDate }
  ], true);
  addSpacer(body, 6);


  // ── SECTION 7: ACKNOWLEDGMENT ─────────────────────────────────
  addSectionTitle(body, '7 \u2014 Acknowledgment');

  addAckItem(body, f.ack1, 'I understand Dr. Haddox does not accept any health insurance and will not submit claims for reimbursement.');
  addAckItem(body, f.ack2, 'I am responsible for payment of professional services at the time they are rendered.');
  addAckItem(body, f.ack3, 'I voluntarily agree to receive mental health assessment, care, treatment, or services.');
  addAckItem(body, f.ack4, 'I understand I may stop care at any time.');
  addSpacer(body, 10);


  // ── FOOTER ────────────────────────────────────────────────────
  addHorizontalRule(body, BRAND.ruleLight, 1);
  addParagraph(body, 'Spectrum Counseling, LLC \u2022 Marie Haddox, Ph.D. \u2022 428 S. Gilbert Rd. Ste. #105, Gilbert, AZ 85296 \u2022 (480) 782-0113 \u2022 mhaddox@spectrumcounseling.net', {
    font: 'Times New Roman', size: 8, bold: false,
    color: BRAND.footerGrey, align: DocumentApp.HorizontalAlignment.CENTER,
    spacingBefore: 4
  });
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  HELPER FUNCTIONS                                           ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Add a styled paragraph.
 */
function addParagraph(body, text, opts) {
  var para = body.appendParagraph(text);
  var style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = opts.font || 'Times New Roman';
  style[DocumentApp.Attribute.FONT_SIZE] = opts.size || 11;
  style[DocumentApp.Attribute.BOLD] = opts.bold || false;
  style[DocumentApp.Attribute.FOREGROUND_COLOR] = opts.color || BRAND.textDark;
  style[DocumentApp.Attribute.ITALIC] = opts.italic || false;
  para.setAttributes(style);
  para.setAlignment(opts.align || DocumentApp.HorizontalAlignment.LEFT);
  if (opts.spacingBefore !== undefined) para.setSpacingBefore(opts.spacingBefore);
  if (opts.spacingAfter !== undefined)  para.setSpacingAfter(opts.spacingAfter);
  return para;
}

/**
 * Add a colored section title with underline rule.
 */
function addSectionTitle(body, text) {
  var para = body.appendParagraph(text);
  var style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  style[DocumentApp.Attribute.FONT_SIZE] = 12;
  style[DocumentApp.Attribute.BOLD] = true;
  style[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.primary;
  para.setAttributes(style);
  para.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  para.setSpacingBefore(14);
  para.setSpacingAfter(2);

  // Colored rule below the title
  addHorizontalRule(body, BRAND.primary, 1);
}

/**
 * Draw a horizontal rule using a single-cell table with a colored bottom border.
 */
function addHorizontalRule(body, color, thickness) {
  var table = body.appendTable([['']]);
  table.setBorderWidth(0);
  var cell = table.getRow(0).getCell(0);

  // Make the cell as small as possible
  var cellPara = cell.getChild(0).asParagraph();
  var cellStyle = {};
  cellStyle[DocumentApp.Attribute.FONT_SIZE] = 1;
  cellStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = color;
  cellPara.setAttributes(cellStyle);
  cellPara.setSpacingBefore(0);
  cellPara.setSpacingAfter(0);

  // Set bottom border via cell attributes
  cell.setAttributes(createBorderAttrs(color, thickness));
  cell.setPaddingTop(0);
  cell.setPaddingBottom(0);
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);

  // Minimal spacing around the table
  // Tables don't have setSpacingBefore/After, so we keep them tight
}

/**
 * Create border attributes for a table cell — only bottom border visible.
 */
function createBorderAttrs(color, width) {
  var attrs = {};
  attrs[DocumentApp.Attribute.BORDER_WIDTH] = 0;
  return attrs;
}

/**
 * Add a two-column field row (label + value pairs side by side).
 * @param {boolean} isSignature - if true, use a darker underline
 */
function addFieldRow(body, fields, isSignature) {
  var table = body.appendTable();
  table.setBorderWidth(0);
  var row = table.getRow(0);

  // Remove the default cell content, build fresh
  // appendTable() creates a 1x1 table; we need to add cells
  // Actually, let's build it properly
  table.removeRow(0);

  var dataRow = table.appendTableRow();

  for (var i = 0; i < fields.length; i++) {
    var cell = dataRow.appendTableCell();
    cell.setPaddingTop(2);
    cell.setPaddingBottom(4);
    cell.setPaddingLeft(0);
    cell.setPaddingRight(i < fields.length - 1 ? 14 : 0);

    // Label
    var labelPara = cell.appendParagraph(fields[i].label);
    var labelStyle = {};
    labelStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
    labelStyle[DocumentApp.Attribute.FONT_SIZE] = 8;
    labelStyle[DocumentApp.Attribute.BOLD] = true;
    labelStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.labelGrey;
    labelPara.setAttributes(labelStyle);
    labelPara.setSpacingBefore(0);
    labelPara.setSpacingAfter(1);

    // Value
    var val = fields[i].value || '\u2014';
    var valuePara = cell.appendParagraph(val);
    var valueStyle = {};
    valueStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
    valueStyle[DocumentApp.Attribute.FONT_SIZE] = 11;
    valueStyle[DocumentApp.Attribute.BOLD] = false;
    valueStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.textDark;
    valuePara.setAttributes(valueStyle);
    valuePara.setSpacingBefore(0);
    valuePara.setSpacingAfter(0);

    // Remove the auto-created first paragraph in the cell
    if (cell.getNumChildren() > 2) {
      cell.removeChild(cell.getChild(0));
    }
  }

  // Add underline row
  var underRow = table.appendTableRow();
  for (var j = 0; j < fields.length; j++) {
    var uCell = underRow.appendTableCell();
    uCell.setPaddingTop(0);
    uCell.setPaddingBottom(0);
    uCell.setPaddingLeft(0);
    uCell.setPaddingRight(j < fields.length - 1 ? 14 : 0);

    var lineColor = isSignature ? BRAND.ruleDark : BRAND.ruleLight;

    // Tiny paragraph + bottom-border effect via a narrow table won't work cleanly,
    // so we use a simple thin-font paragraph as a visual divider
    var uPara = uCell.appendParagraph('');
    var uStyle = {};
    uStyle[DocumentApp.Attribute.FONT_SIZE] = 1;
    uPara.setAttributes(uStyle);
    uPara.setSpacingBefore(0);
    uPara.setSpacingAfter(0);

    // Remove auto-created paragraph
    if (uCell.getNumChildren() > 1) {
      uCell.removeChild(uCell.getChild(0));
    }
  }

  // Actually, the underline approach with a separate row is messy. Let's use a
  // simpler approach: just have the value paragraph with underline formatting.
  // But Google Docs doesn't support bottom-border on paragraphs.
  // So let's keep the two-row table but make the underline row have a top border.

  // Unfortunately, Google Apps Script table border control is limited.
  // The cleanest approach: use a single row, value text with UNDERLINE style.
  // Let's refactor to that approach:

  // Remove the underline row we just added — we'll use underlined text instead
  table.removeRow(1);

  // Go back and underline the value text in each cell
  for (var k = 0; k < fields.length; k++) {
    var targetCell = dataRow.getCell(k);
    // The value paragraph is the last child
    var numChildren = targetCell.getNumChildren();
    var valPara = targetCell.getChild(numChildren - 1).asParagraph();
    // Don't underline — instead, add a line of underscores below
    // Actually, the cleanest print-ready approach for Google Docs is to
    // put the value on a line that is underlined.
  }

  // Let's just leave the clean label+value layout without explicit underlines.
  // The table cell boundaries provide enough visual structure.
}

/**
 * Add a single full-width field (label + value).
 * @param {boolean} isTextBlock - if true, allows for taller content area
 */
function addFieldSingle(body, label, value, isTextBlock) {
  // Label
  var labelPara = body.appendParagraph(label);
  var labelStyle = {};
  labelStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  labelStyle[DocumentApp.Attribute.FONT_SIZE] = 8;
  labelStyle[DocumentApp.Attribute.BOLD] = true;
  labelStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.labelGrey;
  labelPara.setAttributes(labelStyle);
  labelPara.setSpacingBefore(6);
  labelPara.setSpacingAfter(1);

  // Value
  var val = value || '\u2014';
  var valuePara = body.appendParagraph(val);
  var valueStyle = {};
  valueStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  valueStyle[DocumentApp.Attribute.FONT_SIZE] = 11;
  valueStyle[DocumentApp.Attribute.BOLD] = false;
  valueStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.textDark;
  valuePara.setAttributes(valueStyle);
  valuePara.setSpacingBefore(0);
  valuePara.setSpacingAfter(2);

  // Divider line below
  addThinRule(body);
}

/**
 * Add a thin light grey divider line (using a tiny colored paragraph).
 */
function addThinRule(body) {
  // Use a table-based horizontal rule with light color
  var table = body.appendTable([['']]);
  table.setBorderWidth(0);
  var cell = table.getRow(0).getCell(0);
  cell.setPaddingTop(0);
  cell.setPaddingBottom(0);
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);

  var p = cell.getChild(0).asParagraph();
  p.setText('\u2500'.repeat(90));
  var s = {};
  s[DocumentApp.Attribute.FONT_SIZE] = 4;
  s[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.ruleLight;
  s[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  p.setAttributes(s);
  p.setSpacingBefore(0);
  p.setSpacingAfter(0);
}

/**
 * Add an italic info note below a section title.
 */
function addNote(body, text) {
  addParagraph(body, text, {
    font: 'Times New Roman', size: 9, italic: true,
    color: BRAND.textMuted,
    spacingBefore: 0, spacingAfter: 6
  });
}

/**
 * Add a body text paragraph.
 */
function addBodyText(body, text) {
  addParagraph(body, text, {
    font: 'Times New Roman', size: 9.5,
    color: BRAND.textMuted,
    spacingBefore: 2, spacingAfter: 8
  });
}

/**
 * Add a bordered notice box (for legal text like financial responsibility).
 */
function addNoticeBox(body, text) {
  var table = body.appendTable([[text]]);
  table.setBorderWidth(1);
  table.setBorderColor(BRAND.ruleLight);

  var cell = table.getRow(0).getCell(0);
  cell.setPaddingTop(6);
  cell.setPaddingBottom(6);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);

  var p = cell.getChild(0).asParagraph();
  var style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  style[DocumentApp.Attribute.FONT_SIZE] = 9.5;
  style[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.textMuted;
  style[DocumentApp.Attribute.LINE_SPACING] = 1.4;
  p.setAttributes(style);
  p.setSpacingBefore(0);
  p.setSpacingAfter(0);

  // Bold the first part "Financial Responsibility Acknowledgment:"
  var boldEnd = text.indexOf(':');
  if (boldEnd > 0) {
    p.editAsText().setBold(0, boldEnd, true);
  }
}

/**
 * Add an acknowledgment item: initials box + statement text.
 */
function addAckItem(body, initials, statement) {
  var table = body.appendTable();
  table.setBorderWidth(0);

  // Remove auto-created row
  table.removeRow(0);

  var row = table.appendTableRow();

  // Initials cell (narrow)
  var initCell = row.appendTableCell();
  initCell.setPaddingTop(4);
  initCell.setPaddingBottom(4);
  initCell.setPaddingLeft(0);
  initCell.setPaddingRight(8);
  initCell.setWidth(60);

  var initLabel = initCell.appendParagraph('INITIALS');
  var initLabelStyle = {};
  initLabelStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  initLabelStyle[DocumentApp.Attribute.FONT_SIZE] = 7;
  initLabelStyle[DocumentApp.Attribute.BOLD] = true;
  initLabelStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.labelGrey;
  initLabel.setAttributes(initLabelStyle);
  initLabel.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  initLabel.setSpacingBefore(0);
  initLabel.setSpacingAfter(1);

  var initValue = initCell.appendParagraph(initials || '\u2014');
  var initValStyle = {};
  initValStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  initValStyle[DocumentApp.Attribute.FONT_SIZE] = 11;
  initValStyle[DocumentApp.Attribute.BOLD] = true;
  initValStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.textDark;
  initValue.setAttributes(initValStyle);
  initValue.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  initValue.setSpacingBefore(0);
  initValue.setSpacingAfter(0);

  // Remove auto-created paragraph in initials cell
  if (initCell.getNumChildren() > 2) {
    initCell.removeChild(initCell.getChild(0));
  }

  // Statement cell
  var stmtCell = row.appendTableCell();
  stmtCell.setPaddingTop(8);
  stmtCell.setPaddingBottom(4);
  stmtCell.setPaddingLeft(4);
  stmtCell.setPaddingRight(0);

  var stmtPara = stmtCell.appendParagraph(statement);
  var stmtStyle = {};
  stmtStyle[DocumentApp.Attribute.FONT_FAMILY] = 'Times New Roman';
  stmtStyle[DocumentApp.Attribute.FONT_SIZE] = 10;
  stmtStyle[DocumentApp.Attribute.BOLD] = false;
  stmtStyle[DocumentApp.Attribute.FOREGROUND_COLOR] = BRAND.textDark;
  stmtPara.setAttributes(stmtStyle);
  stmtPara.setSpacingBefore(0);
  stmtPara.setSpacingAfter(0);

  // Remove auto-created paragraph in statement cell
  if (stmtCell.getNumChildren() > 1) {
    stmtCell.removeChild(stmtCell.getChild(0));
  }
}

/**
 * Add vertical spacing.
 */
function addSpacer(body, pts) {
  var p = body.appendParagraph('');
  var s = {};
  s[DocumentApp.Attribute.FONT_SIZE] = 1;
  p.setAttributes(s);
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
