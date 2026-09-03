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
// 5. Set Script Property TURNSTILE_SECRET (Project Settings > Script
//    Properties) to the Cloudflare Turnstile secret key.
// 6. Set Script Property CF_BROWSER_TOKEN to a Cloudflare API token with the
//    "Browser Rendering — Edit" permission (used to render the intake PDF).
//
// NOTE: The intake PDF is built as HTML (buildHtml) and rendered to PDF by
// Cloudflare's Browser Rendering REST API (real headless Chrome), so the
// branded layout — colors, divider rules, fills — renders faithfully. No
// Google Doc is created; DocumentApp and DriveApp are not used at all.
// ============================================================

var CONFIG = {
  RECIPIENT_EMAIL: 'mhaddox@spectrumcounseling.net',
  REDIRECT_URL: 'https://spectrumcounseling.net/new-client-form/?submitted=true',
  CF_ACCOUNT_ID: '92162a0f546c14e218e1e0eff7ee6197'
};

// ── Brand colors — "A2 Neutral (max contrast)" palette ────────
// Readability-tuned: text is near-black instead of light grey so it
// stays legible on white and on the light box background after PDF
// export/print. Same Times New Roman, same layout. Brand blue is kept
// for the large headings and divider rules only.
var BRAND = {
  primary:     '#567a96',  // large headings (title, form title) + all divider rules
  primaryDark: '#2f4a63',  // section-header text + acknowledgment initials (12pt bold)
  textDark:    '#1f2223',  // field values, ack statements, notice heading  (~15:1 on white)
  textMuted:   '#2c2f31',  // intro, instruction, HIPAA + notice body        (~13:1 on white)
  labelGrey:   '#242424',  // field labels, address, submitted, INITIALS lbl (~15:1 on white)
  ruleLight:   '#767676',  // footer hairline + notice-box border (darkened so it survives export)
  footerGrey:  '#333333',  // footer text
  white:       '#ffffff',
  bgLight:     '#eef2f4'   // notice / initials cell background
};

// ── Input sanitization & validation helpers ─────────────────
function sanitize(str, maxLen) {
  if (!str || typeof str !== 'string') return '';
  // Strip HTML tags and trim
  return str.replace(/<[^>]*>/g, '').trim().substring(0, maxLen || 500);
}

// Retry a function up to maxAttempts times with exponential backoff on failure.
// Used to recover from transient Google Apps Script service errors.
function retry(fn, maxAttempts, baseDelayMs) {
  var attempts = 0;
  while (true) {
    try {
      return fn();
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) throw err;
      // Exponential backoff: baseDelay * 2^(attempts-1)
      Utilities.sleep(baseDelayMs * Math.pow(2, attempts - 1));
    }
  }
}


// Render an HTML string to a PDF blob via Cloudflare Browser Rendering (real
// headless Chrome). printBackground keeps the colored divider rules and fills;
// preferCSSPageSize honors the document's @page letter size and margins.
// Throws on any non-200 so the caller's retry/fallback can handle it.
function renderPdf(html) {
  var token = PropertiesService.getScriptProperties().getProperty('CF_BROWSER_TOKEN');
  if (!token) throw new Error('CF_BROWSER_TOKEN script property is not set');
  var resp = UrlFetchApp.fetch(
    'https://api.cloudflare.com/client/v4/accounts/' + CONFIG.CF_ACCOUNT_ID + '/browser-rendering/pdf',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({
        html: html,
        pdfOptions: { printBackground: true, preferCSSPageSize: true }
      }),
      muteHttpExceptions: true
    }
  );
  var code = resp.getResponseCode();
  var ct = resp.getHeaders()['Content-Type'] || resp.getHeaders()['content-type'] || '';
  if (code !== 200 || ct.indexOf('pdf') === -1) {
    throw new Error('Browser Rendering PDF failed (HTTP ' + code + '): ' + resp.getContentText().substring(0, 300));
  }
  return resp.getBlob();
}


function doPost(e) {
  var f = null;
  var rawData = null;
  try {
    var p = e.parameter;
    var ps = e.parameters;
    rawData = p;

    // Honeypot — if filled, it's a bot
    if (p['_honey']) {
      return jsonOut({ ok: true });
    }

    // Cloudflare Turnstile verification
    var turnstileToken = p['cf-turnstile-response'] || '';
    if (!turnstileToken) {
      return jsonOut({ ok: false, reason: 'captcha' });
    }
    var turnstileSecret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
    if (!turnstileSecret) {
      throw new Error('TURNSTILE_SECRET script property is not set');
    }
    var turnstileResult = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        secret: turnstileSecret,
        response: turnstileToken
      },
      muteHttpExceptions: true
    });
    var turnstileData = JSON.parse(turnstileResult.getContentText());
    if (!turnstileData.success) {
      return jsonOut({ ok: false, reason: 'captcha' });
    }

    // Bot timing detection — reject only when delta is a small positive number;
    // missing/NaN/negative deltas (e.g. client clock ahead of server) pass through
    var loadedTs = parseInt(p['_loaded'], 10);
    var nowTs = Date.now();
    var fillMs = nowTs - loadedTs;
    if (loadedTs && !isNaN(loadedTs) && fillMs >= 0 && fillMs < 10000) {
      return jsonOut({ ok: false, reason: 'timing' });
    }

    // Rate limiting — max 3 submissions per email per hour. The counter is
    // incremented only after the intake email sends (end of the try block),
    // so attempts that fail through no fault of the client don't burn quota.
    var rateLimitEmail = (p['Client Email'] || '').trim().toLowerCase();
    var rateCache = null;
    var rateCacheKey = null;
    if (rateLimitEmail) {
      rateCache = CacheService.getScriptCache();
      rateCacheKey = 'intake_' + rateLimitEmail.replace(/[^a-z0-9@.]/g, '');
      if ((parseInt(rateCache.get(rateCacheKey), 10) || 0) >= 3) {
        return jsonOut({ ok: false, reason: 'rate-limit' });
      }
    }

    // ── Sanitize all fields ──────────────────────────────────────
    var clientFirst = sanitize(p['Client First Name'], 100);
    var clientLast  = sanitize(p['Client Last Name'], 100);
    var clientPhone = sanitize(p['Client Phone'], 20);
    var clientEmail = sanitize(p['Client Email'], 254);
    var clientAddr  = sanitize(p['Client Address'], 300);
    var reason      = sanitize(p['Reason for Counseling'], 2000);
    var payment     = sanitize(p['Payment Preference'], 100);
    var finSig      = sanitize(p['Financial Responsibility Signature'], 150);
    var finDate     = sanitize(p['Financial Responsibility Date'], 10);
    var hipaaSig    = sanitize(p['HIPAA Signature'], 150);
    var hipaaDate   = sanitize(p['HIPAA Signature Date'], 10);
    var ack1        = sanitize(p['Ack Initials 1 - Insurance'], 5);
    var ack2        = sanitize(p['Ack Initials 2 - Payment'], 5);
    var ack3        = sanitize(p['Ack Initials 3 - Cancellation'], 5);
    var ack4        = sanitize(p['Ack Initials 4 - Consent'], 5);
    var ack5        = sanitize(p['Ack Initials 5 - Stop Care'], 5);
    var clientDob   = sanitize(p['Client Date of Birth'], 10);
    var partnerEmail = sanitize(p['Partner Email'], 254);
    var partnerDob  = sanitize(p['Partner Date of Birth'], 10);

    // Collect concerns — accept any values, just sanitize them
    var rawConcerns = ps['Concerns'] || [];
    var concerns = [];
    for (var c = 0; c < rawConcerns.length; c++) {
      var concern = sanitize(rawConcerns[c], 50);
      if (concern) concerns.push(concern);
    }
    concerns = concerns.length > 0 ? concerns.join(', ') : 'None selected';

    var clientName = (clientFirst + ' ' + clientLast).trim() || 'Unknown';
    var submissionDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');

    // Collect all sanitized field values
    f = {
      clientFirst:    clientFirst,
      clientLast:     clientLast,
      preferredName:  sanitize(p['Client Preferred Name'], 100),
      pronouns:       sanitize(p['Client Pronouns'], 50),
      dob:            clientDob,
      phone:          clientPhone,
      email:          clientEmail,
      address:        clientAddr,
      employer:       sanitize(p['Employer'], 150),
      occupation:     sanitize(p['Occupation'], 150),
      partnerFirst:   sanitize(p['Partner First Name'], 100),
      partnerLast:    sanitize(p['Partner Last Name'], 100),
      partnerPref:    sanitize(p['Partner Preferred Name'], 100),
      partnerPro:     sanitize(p['Partner Pronouns'], 50),
      partnerDob:     partnerDob,
      partnerEmail:   partnerEmail,
      parentNames:    sanitize(p['Parent Guardian Names'], 200),
      school:         sanitize(p['School'], 150),
      grade:          sanitize(p['Grade'], 20),
      reason:         reason,
      referredBy:     sanitize(p['Referred By'], 150),
      prevCounseling: sanitize(p['Previous Counseling'], 2000),
      medications:    sanitize(p['Current Medications'], 2000),
      medical:        sanitize(p['Medical Problems'], 2000),
      concerns:       concerns,
      payment:        payment,
      finSig:         finSig,
      finDate:        finDate,
      hipaaSig:       hipaaSig,
      hipaaDate:      hipaaDate,
      ack1:           ack1,
      ack2:           ack2,
      ack3:           ack3,
      ack4:           ack4,
      ack5:           ack5,
      submissionDate: submissionDate
    };

    // Render the intake HTML to a PDF via Cloudflare Browser Rendering (real
    // Chrome). Idempotent, so it is safe to retry (2s, 4s, 8s backoff). On
    // failure the catch below preserves the client's data by email.
    var pdf = retry(function() { return renderPdf(buildHtml(f)); }, 4, 2000);
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

    // Count this successful submission toward the hourly rate limit
    if (rateCache) {
      var sent = parseInt(rateCache.get(rateCacheKey), 10) || 0;
      rateCache.put(rateCacheKey, String(sent + 1), 3600); // expires in 1 hour
    }

  } catch (error) {
    try {
      var dataStr = '(no data captured)';
      if (f) {
        dataStr = '';
        for (var fk in f) {
          dataStr += fk + ': ' + (f[fk] || '(empty)') + '\n';
        }
      } else if (rawData) {
        dataStr = '';
        for (var rk in rawData) {
          if (rk === '_honey' || rk === 'cf-turnstile-response' || rk === '_loaded') continue;
          dataStr += rk + ': ' + rawData[rk] + '\n';
        }
      }
      var errSubject = 'INTAKE FORM ERROR';
      var errBody =
        'Error: ' + error.toString() + '\n\n' +
        'Stack: ' + (error.stack || 'no stack') + '\n\n' +
        '===== SUBMITTED FORM DATA =====\n' +
        'The PDF generation failed, but the client\'s data is preserved below. ' +
        'Reach out to them to acknowledge receipt.\n\n' +
        dataStr;
      // This email is the last line of defense for the client's data, and
      // Gmail can glitch during the same service disruptions that break the
      // PDF conversion — retry it, then fall back to MailApp, a separate
      // service that may be up when GmailApp is not.
      try {
        retry(function() { GmailApp.sendEmail(CONFIG.RECIPIENT_EMAIL, errSubject, errBody); }, 3, 1000);
      } catch (gmailErr) {
        retry(function() { MailApp.sendEmail(CONFIG.RECIPIENT_EMAIL, errSubject, errBody); }, 3, 1000);
      }
      return jsonOut({ ok: true });   // data preserved via error email
    } catch (e2) {
      throw error;                    // truly lost — client must see failure
    }
  }

  return jsonOut({ ok: true });
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  HTML BUILDER                                               ║
// ╚══════════════════════════════════════════════════════════════╝
//
// Mirrors the former DocumentApp layout one-to-one: same Times New Roman
// point sizes, colors, paddings, and paragraph spacing; tables carry the
// rules, field rows, notice box, and initials cells exactly as the Doc did.
// All client-supplied values pass through esc() before entering markup.

var FONT = "'Times New Roman', Times, serif";

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(f) {
  var h = [];

  // ── HEADER ────────────────────────────────────────────────────
  h.push(para('SPECTRUM COUNSELING, LLC', 20, true, BRAND.primary, 'center', 0, 2));
  h.push(para('Marie Haddox, Ph.D.', 11, false, BRAND.textMuted, 'center', 0, 2));
  h.push(para('428 S. Gilbert Rd. Ste. #105 (Bldg. 3) \u2022 Gilbert, AZ 85296 \u2022 (480) 782-0113',
    9, false, BRAND.labelGrey, 'center', 0, 8));
  h.push(rule(BRAND.primary, 2));
  h.push(para('NEW CLIENT INTAKE FORM', 14, true, BRAND.primary, 'center', 12, 2));
  h.push(para('Submitted: ' + f.submissionDate, 9, false, BRAND.labelGrey, 'center', 0, 14));

  // ── SECTION 1: CLIENT INFORMATION ─────────────────────────────
  h.push(sectionHeader('1 \u2014 Client Information'));
  h.push(fieldPair('First Name', f.clientFirst, 'Last Name', f.clientLast));
  h.push(fieldPair('Preferred Name', f.preferredName, 'Pronouns', f.pronouns));
  h.push(fieldPair('Date of Birth', f.dob, 'Phone Number', f.phone));
  h.push(fieldFull('Email', f.email));
  h.push(fieldFull('Address', f.address));
  h.push(fieldPair('Employer', f.employer, 'Occupation', f.occupation));

  // ── SECTION 2: PARTNER / MINOR INFORMATION ────────────────────
  h.push(sectionHeader('2 \u2014 Partner / Minor Information'));
  h.push(para('Complete if seeking couples therapy or if client is a minor.',
    9, false, BRAND.textMuted, 'left', 0, 6, 'font-style:italic;'));
  h.push(fieldPair('Partner First Name', f.partnerFirst, 'Partner Last Name', f.partnerLast));
  h.push(fieldPair('Preferred Name', f.partnerPref, 'Pronouns', f.partnerPro));
  h.push(fieldPair('Partner Date of Birth', f.partnerDob, 'Partner Email', f.partnerEmail));
  h.push(fieldFull('Parent / Guardian Names (for minor clients)', f.parentNames));
  h.push(fieldPair('School', f.school, 'Grade', f.grade));

  // ── SECTION 3: CLINICAL BACKGROUND ────────────────────────────
  h.push(sectionHeader('3 \u2014 Clinical Background'));
  h.push(fieldFull('Reason for Counseling', f.reason));
  h.push(fieldFull('Referred By', f.referredBy));
  h.push(fieldFull('Previous Counseling Experience', f.prevCounseling));
  h.push(fieldFull('Current Medications & Reasons', f.medications));
  h.push(fieldFull('Medical Problems / Concerns', f.medical));

  // ── SECTION 4: AREAS OF CONCERN ───────────────────────────────
  h.push(sectionHeader('4 \u2014 Areas of Concern'));
  h.push(fieldFull('Selected Concerns', f.concerns));

  // ── SECTION 5: PAYMENT & INSURANCE ────────────────────────────
  h.push(sectionHeader('5 \u2014 Payment & Insurance'));
  h.push(fieldFull('Payment Preference', f.payment));
  h.push(noticeBox(
    'Financial Responsibility Acknowledgment:',
    ' The client/responsible party is responsible for payment of professional services at the time they are rendered. ' +
    'By signing below, I certify that I, the client/responsible party, acknowledge that Dr. Haddox does not accept any ' +
    'health insurance and will not submit claims for reimbursement to any insurance company on my behalf.'
  ));
  h.push(spacer(4));
  h.push(fieldPair('Signature (Typed)', f.finSig, 'Date', f.finDate));

  // ── SECTION 6: HIPAA ─────────────────────────────────────────
  h.push(sectionHeader('6 \u2014 HIPAA Notice of Privacy Practices'));
  h.push(para(
    'By signing below, I acknowledge that I have received and reviewed the HIPAA Notice of Privacy Practices ' +
    'for Spectrum Counseling, LLC, in accordance with the Health Insurance Portability and Accountability Act (HIPAA), ' +
    'the HITECH Act, and the 2013 Omnibus Rule.',
    9.5, false, BRAND.textMuted, 'left', 2, 8));
  h.push(fieldPair('Signature (Typed)', f.hipaaSig, 'Date', f.hipaaDate));

  // ── SECTION 7: ACKNOWLEDGMENT ─────────────────────────────────
  h.push(sectionHeader('7 \u2014 Acknowledgment'));
  h.push(ackItem(f.ack1, 'I understand Dr. Haddox does not accept any health insurance and will not submit claims for reimbursement.'));
  h.push(ackItem(f.ack2, 'I am responsible for payment of professional services at the time they are rendered.'));
  h.push(ackItem(f.ack3, 'I understand that appointments cancelled without 24-hour notice will be billed at a rate of $75. Third and subsequent late cancellations, as well as appointments missed without any notice, will be billed the full session fee. These fees may be charged to the credit card on file.'));
  h.push(ackItem(f.ack4, 'I voluntarily agree to receive mental health assessment, care, treatment, or services.'));
  h.push(ackItem(f.ack5, 'I understand I may stop care at any time.'));

  // ── FOOTER ────────────────────────────────────────────────────
  h.push(spacer(16));
  h.push(rule(BRAND.ruleLight, 1));
  h.push(para(
    'Spectrum Counseling, LLC \u2022 Marie Haddox, Ph.D. \u2022 428 S. Gilbert Rd. Ste. #105, Gilbert, AZ 85296 \u2022 (480) 782-0113 \u2022 mhaddox@spectrumcounseling.net',
    8, false, BRAND.footerGrey, 'center', 6, 0));

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Intake</title>' +
    '<style>@page{size:letter;margin:0.75in}' +
    'body{margin:0;font-family:' + FONT + ';color:' + BRAND.textDark + '}' +
    'table{border-collapse:collapse;width:100%}td{vertical-align:top}</style>' +
    '</head><body>' + h.join('') + '</body></html>';
}


// ╔══════════════════════════════════════════════════════════════╗
// ║  HTML HELPERS                                               ║
// ╚══════════════════════════════════════════════════════════════╝

function textStyle(size, bold, color) {
  return 'font-family:' + FONT + ';font-size:' + size + 'pt;' +
    'font-weight:' + (bold ? 'bold' : 'normal') + ';color:' + color + ';';
}

/**
 * Styled paragraph. spacingBefore/After are points, like the Doc API.
 */
function para(text, size, bold, color, align, spacingBefore, spacingAfter, extra) {
  return '<p style="' + textStyle(size, bold, color) +
    'text-align:' + (align || 'left') + ';' +
    'margin:' + spacingBefore + 'pt 0 ' + spacingAfter + 'pt 0;' +
    (extra || '') + '">' + esc(text) + '</p>';
}

/**
 * Full-width horizontal rule: a 1x1 table whose cell background is the bar.
 */
function rule(color, heightPt) {
  return '<table cellspacing="0" cellpadding="0"><tr><td style="background-color:' + color + ';' +
    'padding:' + (heightPt || 1) + 'pt 0 0 0;font-size:1pt;line-height:1pt;height:1pt">' +
    '&nbsp;</td></tr></table>';
}

function sectionHeader(text) {
  return para(text, 12, true, BRAND.primaryDark, 'left', 18, 3) +
    rule(BRAND.primary, 1) +
    spacer(4);
}

/**
 * Label + value stack inside a field cell.
 */
function fieldCell(label, value, paddingLeft, paddingRight, width) {
  return '<td style="padding:6pt ' + paddingRight + 'pt 10pt ' + paddingLeft + 'pt;' +
    (width ? 'width:' + width + ';' : '') + '">' +
    para(label.toUpperCase(), 8, true, BRAND.labelGrey, 'left', 0, 2) +
    para(value || '\u2014', 11, false, BRAND.textDark, 'left', 0, 0) +
    '</td>';
}

function fieldPair(label1, value1, label2, value2) {
  return '<table cellspacing="0" cellpadding="0"><tr>' +
    fieldCell(label1, value1, 0, 12, '50%') +
    fieldCell(label2, value2, 12, 0, '50%') +
    '</tr></table>';
}

function fieldFull(label, value) {
  return '<table cellspacing="0" cellpadding="0"><tr>' +
    fieldCell(label, value, 0, 0) +
    '</tr></table>';
}

/**
 * Bordered notice box with a bold heading run.
 */
function noticeBox(heading, text) {
  return '<table cellspacing="0" cellpadding="0" style="border:1px solid ' + BRAND.ruleLight + '"><tr>' +
    '<td style="padding:8pt 10pt;background-color:' + BRAND.bgLight + '">' +
    '<p style="' + textStyle(9.5, false, BRAND.textMuted) + 'margin:0;line-height:1.3">' +
    '<span style="font-weight:bold;color:' + BRAND.textDark + '">' + esc(heading) + '</span>' +
    esc(text) + '</p></td></tr></table>';
}

/**
 * Acknowledgment item: initials box + statement in a two-column table.
 */
function ackItem(initials, statement) {
  return '<table cellspacing="0" cellpadding="0"><tr>' +
    '<td style="width:56pt;padding:6pt 4pt;background-color:' + BRAND.bgLight + '">' +
    para('INITIALS', 7, true, BRAND.labelGrey, 'center', 0, 2) +
    para(initials || '\u2014', 12, true, BRAND.primaryDark, 'center', 0, 0) +
    '</td>' +
    '<td style="padding:10pt 0 6pt 10pt">' +
    para(statement, 10, false, BRAND.textDark, 'left', 0, 0, 'line-height:1.2;') +
    '</td></tr></table>';
}

function spacer(pts) {
  return '<p style="font-size:1pt;line-height:1pt;margin:' + (pts || 4) + 'pt 0 0 0">&nbsp;</p>';
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

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return HtmlService.createHtmlOutput(
    '<p>Spectrum Counseling intake form handler is active.</p>'
  );
}
