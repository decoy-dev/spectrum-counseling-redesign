# 011 — Intake PDF: remove the Google Docs dependency (2026-09-02)

**Status: DONE** (code on master). Operator follow-ups pending: redeploy
Apps Script (new version) + one test submission to eyeball Google's real
HTML→PDF output.

Retrospective, written after the change.

## Incident

Second occurrence of the 2026-08-24 failure (see 009): an "INTAKE FORM
ERROR" email at 6:13 PM with `Service Documents failed while accessing
document` at `doc.saveAndClose()` after all six retry attempts (~62 s). The
data-preservation fallback from 009 worked — the client's submission
arrived in the error email — so nothing was lost, but the pipeline failed
again on the same Google-side Docs boundary.

Neither this nor the Aug 24 blip appears on Google's public Workspace
status dashboard; it is not sensitive enough to confirm or rule out short
Docs disruptions.

## Diagnosis

The intake handler used Google Docs purely as a layout engine:

```
DocumentApp.create → ~100 body mutations → saveAndClose  (failure point)
→ sleep 1.5 s → DriveApp.getFileById → getAs(pdf) → Gmail → setTrashed
```

Three services, two eventual-consistency boundaries, a temp file, and a
cleanup step — none of it necessary to produce a PDF. Two further problems
with that design surfaced during the investigation:

- `saveAndClose()` closes the handle; retrying it on the same `Document`
  object after a partial failure is undefined behavior, and no retry ladder
  beats a Docs outage longer than the ~6 min web-app budget anyway.
- The temp Doc contained PHI and `setTrashed` leaves it in Drive Trash for
  30 days; a run that died before cleanup left it in Drive indefinitely.

An intermediate idea — `doc.getAs('application/pdf')` on the live handle
without saving — was considered and **rejected**: Google's docs only promise
"current contents", and community reports say pre-save exports can come back
blank. Trading a loud failure for a silently empty PDF would be worse.

## What shipped (`Code.gs`)

- `buildDocument()` and its ten DocumentApp helpers replaced by
  `buildHtml(f)` + small HTML helpers (`para`, `rule`, `sectionHeader`,
  `fieldPair`, `fieldFull`, `noticeBox`, `ackItem`, `spacer`, `esc`).
  The HTML mirrors the Doc one-to-one: Times New Roman, same point sizes,
  `BRAND` colors, paddings, paragraph spacing, tables for rules/fields/
  notice/initials cells, em-dash for blank fields, 0.75 in page margins via
  `@page`.
- `doPost` now does a single idempotent conversion, wrapped in the existing
  `retry` (4 attempts, 2/4/8 s):
  `Utilities.newBlob(buildHtml(f), 'text/html').getAs('application/pdf')`.
- Removed: `DocumentApp.create`, margins setup, `saveAndClose` retry, the
  1.5 s Drive sleep, `DriveApp.getFileById(...).getAs`, `setTrashed`.
  `DocumentApp` and `DriveApp` are no longer referenced anywhere.
- Every client value is HTML-escaped (`esc`) before entering markup, in
  addition to the existing tag-stripping `sanitize`.
- Unchanged: Turnstile/honeypot/timing/rate-limit gates, the Gmail send,
  the error-email fallback with MailApp, and the rate-limit counting.

## Tests

`google-apps-script/Code.test.js` — zero-dependency `node --test` harness
that loads `Code.gs` into a `vm` sandbox with stubbed Google services:

```
node --test google-apps-script/Code.test.js
```

Covers: every section/field/acknowledgment renders; markup in client values
is escaped; blank fields render an em dash; `doPost` converts `text/html` →
`application/pdf`, names the attachment `Intake_Last_First.pdf`, and sends
exactly one Gmail — with **no** `DocumentApp`/`DriveApp` in the sandbox, so
any regression back to Docs fails the test. All four were watched failing
before the implementation (the `doPost` test failed into the
`INTAKE FORM ERROR` path, incidentally re-proving the 009 fallback).

## How it was previewed

Same method as 010 — now with less approximation, because the HTML *is*
the artifact Google receives:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=out.pdf "file:///tmp/intake-preview/preview.html"
```

(`preview.html` = `buildHtml(sampleData)` dumped from Node.) Header, rules,
two-column fields, notice box, signature rows, initials cells, and footer
all matched the Doc layout. Chrome's renderer ≠ Google's HTML→PDF
converter; the test submission below is the exact-renderer check.

## Known uncertainty

Whether `Utilities.newBlob(html).getAs('application/pdf')` shares backend
infrastructure with the Docs service that failed is not documented. It is a
different API surface and skips every step that broke (create, mutate,
save/close, Drive propagation, trash), but it cannot be *proven* independent
from the repo. If it also fails during a Docs disruption, the remaining
option that removes Google's conversion entirely is generating the PDF bytes
in pure JS — more code to own, and non-Latin names would need an embedded
font.

## Operator follow-ups (outside the repo)

- [ ] Paste `Code.gs` into the browser editor → Manage deployments → New
      version (same URL). Because `DocumentApp`/`DriveApp` are gone, the
      script's auto-detected scopes shrink; if prompted, re-authorize.
- [ ] Submit one test intake and compare the received PDF to the previous
      one: page margins (converter may ignore `@page`), font, rule
      thickness, table widths, pagination. Report differences and the HTML
      can be adjusted — it is now the single source of truth for the layout.
- [ ] Optional: purge old "Intake - …" Docs from Drive Trash (PHI at rest
      from the previous design).

## Lessons / standing rules

- **Ask what a dependency is *for*.** Docs was a layout engine, not a
  requirement. Two incidents were spent hardening retries around a service
  the pipeline never needed.
- **Never retry a non-idempotent close.** Retry pure conversions; for
  stateful handles, reopen by ID or restructure so there is nothing to
  close.
- `redirect()` in `Code.gs` is dead code (HtmlService, never called) — left
  in place as out of scope; candidate for removal.
