// Contract tests for the intake handler's pure/HTML parts.
// Run: node --test google-apps-script/
//
// Code.gs is plain ES5 written for Apps Script's V8 runtime. It is loaded into
// a vm sandbox with stubbed Google services so doPost and buildHtml can be
// exercised without Google.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');

function load(sandbox) {
  const ctx = vm.createContext(sandbox);
  vm.runInContext(SOURCE, ctx, { filename: 'Code.gs' });
  return ctx;
}

const SAMPLE = {
  clientFirst: 'Ann', clientLast: 'O\'Neil-Smith', preferredName: 'Annie', pronouns: 'she/her',
  dob: '1990-04-12', phone: '(480) 555-0100', email: 'ann@example.com',
  address: '1 Main St, Gilbert, AZ 85296', employer: 'Acme', occupation: 'Engineer',
  partnerFirst: '', partnerLast: '', partnerPref: '', partnerPro: '', partnerDob: '', partnerEmail: '',
  parentNames: '', school: '', grade: '',
  reason: 'Anxiety & stress', referredBy: 'Dr. Lee', prevCounseling: 'None',
  medications: 'None', medical: 'None',
  concerns: 'Anxiety, Sleep', payment: 'Credit card',
  finSig: 'Ann O\'Neil-Smith', finDate: '2026-09-02', hipaaSig: 'Ann O\'Neil-Smith', hipaaDate: '2026-09-02',
  ack1: 'AO', ack2: 'AO', ack3: 'AO', ack4: 'AO', ack5: 'AO',
  submissionDate: 'September 2, 2026'
};

test('buildHtml renders every section, field value, and acknowledgment', () => {
  const { buildHtml } = load({});
  const html = buildHtml(SAMPLE);

  assert.match(html, /^<!DOCTYPE html>/);
  for (const s of [
    'SPECTRUM COUNSELING, LLC', 'NEW CLIENT INTAKE FORM', 'Submitted: September 2, 2026',
    '1 \u2014 Client Information', '2 \u2014 Partner / Minor Information', '3 \u2014 Clinical Background',
    '4 \u2014 Areas of Concern', '5 \u2014 Payment &amp; Insurance', '6 \u2014 HIPAA Notice of Privacy Practices',
    '7 \u2014 Acknowledgment',
    'Financial Responsibility Acknowledgment:',
    'billed at a rate of $75',
    'I understand I may stop care at any time.',
    'Anxiety &amp; stress', 'Anxiety, Sleep', 'Credit card', 'ann@example.com', 'mhaddox@spectrumcounseling.net'
  ]) {
    assert.ok(html.includes(s), 'missing: ' + s);
  }
  // Five initials cells, each carrying the typed initials.
  assert.equal((html.match(/>AO</g) || []).length, 5);
});

test('buildHtml escapes markup in client-supplied values', () => {
  const { buildHtml } = load({});
  const html = buildHtml({ ...SAMPLE, reason: '<img src=x onerror=1> "quoted" & done' });
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=1&gt; &quot;quoted&quot; &amp; done'));
});

test('buildHtml renders an em dash for empty fields', () => {
  const { buildHtml } = load({});
  const html = buildHtml(SAMPLE);
  // Section 2 is entirely blank in SAMPLE (9 fields); 7 section headers also use an em dash.
  assert.ok((html.match(/\u2014/g) || []).length >= 9 + 7);
});

test('doPost converts the HTML to a PDF and emails it without Docs or Drive', () => {
  const sent = [];
  let converted = null;

  const stubs = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'secret' }) },
    UrlFetchApp: { fetch: () => ({ getContentText: () => JSON.stringify({ success: true }) }) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    Session: { getScriptTimeZone: () => 'America/Phoenix' },
    Utilities: {
      sleep: () => {},
      formatDate: () => 'September 2, 2026',
      newBlob: (content, mime) => ({
        getAs: (target) => {
          converted = { content, mime, target };
          let name = '';
          return { setName: (n) => { name = n; }, getName: () => name };
        }
      })
    },
    GmailApp: { sendEmail: (to, subject, body, opts) => { sent.push({ to, subject, body, opts }); } },
    MailApp: { sendEmail: () => { throw new Error('MailApp should not be needed'); } },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ setMimeType: () => ({ text: s }) })
    },
    Date,
    JSON,
    Math
  };
  // Deliberately no DocumentApp / DriveApp: any remaining use must fail loudly.

  const { doPost } = load(stubs);
  const params = {
    'cf-turnstile-response': 'tok',
    '_loaded': String(Date.now() - 60000),
    'Client First Name': 'Ann', 'Client Last Name': 'O\'Neil-Smith', 'Client Email': 'ann@example.com',
    'Reason for Counseling': 'Anxiety & stress',
    'Ack Initials 1 - Insurance': 'AO', 'Ack Initials 2 - Payment': 'AO',
    'Ack Initials 3 - Cancellation': 'AO', 'Ack Initials 4 - Consent': 'AO', 'Ack Initials 5 - Stop Care': 'AO'
  };
  const out = doPost({ parameter: params, parameters: { Concerns: ['Anxiety', 'Sleep'] } });

  assert.deepEqual(JSON.parse(out.text), { ok: true });
  assert.equal(sent.length, 1, 'exactly one email');
  assert.equal(sent[0].subject, 'New Client Intake: Ann O\'Neil-Smith');
  assert.equal(sent[0].opts.attachments.length, 1);
  assert.equal(sent[0].opts.attachments[0].getName(), 'Intake_ONeilSmith_Ann.pdf');
  assert.equal(converted.mime, 'text/html');
  assert.equal(converted.target, 'application/pdf');
  assert.ok(converted.content.includes('Anxiety &amp; stress'));
});
