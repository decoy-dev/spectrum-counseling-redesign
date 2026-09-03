# 013 — Intake PDF rendered by Cloudflare Browser Rendering (2026-09-02)

**Status: DONE** (code on master). Operator follow-ups: set the
`CF_BROWSER_TOKEN` Script Property, redeploy Apps Script, submit one test.

Retrospective, written after the change.

## Problem

Plan 011 moved the intake PDF off Google Docs onto
`Utilities.newBlob(html, 'text/html').getAs('application/pdf')`. A live test
submission (owner, 2026-09-02) showed that converter is **low-fidelity**: it
drops `background-color` entirely (so every divider rule and the notice-box /
initials-cell fills vanished) and applies text `color` inconsistently (section
headers kept their navy, but the 20 pt title rendered near-black instead of
brand blue). Content, tables, borders, bold/italic/size, and alignment
survived, but the branded look did not — failing plan 011's acceptance bar
("so long as the layout/formatting stays the same"). The converter cannot be
run locally, so tuning it would cost a live deploy + submission per attempt
and still not reach fidelity.

## Decision

Keep `buildHtml()` (it is faithful HTML) but render it with **real Chrome** via
the **Cloudflare Browser Rendering REST API** `/pdf` endpoint. Chosen over
(a) reverting to DocumentApp — exact look but reintroduces the Docs-outage
dependency — and (b) approximating with border-based rules — dependency-free
but imperfect and slow to tune. Cloudflare gives exact fidelity *and* high
reliability, reuses infrastructure the practice already has, and keeps the
existing data-preservation fallback for the rare case it is unreachable.

Verified before committing: posted the real `buildHtml` output to the endpoint
with `printBackground:true` + `preferCSSPageSize:true` and rendered the
returned PDF — pixel-faithful to the old DocumentApp output (blue title, blue
section headers with full-width rules, notice-box fill, initials-cell boxes).

## What shipped (`Code.gs`)

- New `renderPdf(html)` helper: `POST https://api.cloudflare.com/client/v4/
  accounts/{CONFIG.CF_ACCOUNT_ID}/browser-rendering/pdf` with
  `Authorization: Bearer <CF_BROWSER_TOKEN>` and body
  `{ html, pdfOptions: { printBackground: true, preferCSSPageSize: true } }`.
  Throws on any non-200 or non-PDF content type so the caller's retry/fallback
  fires.
- `doPost` renders with `retry(function(){ return renderPdf(buildHtml(f)); },
  4, 2000)` — idempotent, so retry is safe.
- `CONFIG.CF_ACCOUNT_ID` added (account id is not secret). Token lives in the
  `CF_BROWSER_TOKEN` Script Property.
- `printBackground` is the critical flag: Chrome omits backgrounds in print by
  default; without it the divider rules/fills would be missing just like the
  Google converter.
- Unchanged: Turnstile/spam gates, Gmail send, error-email + MailApp fallback,
  rate-limit counting. Still no DocumentApp/DriveApp.

## Tests

`Code.test.js` `doPost` test rewritten: the `UrlFetchApp.fetch` stub routes the
Turnstile call and the Browser Rendering call separately, returns a 200
`application/pdf` response for the latter, and asserts the endpoint is called
with `printBackground`/`preferCSSPageSize` and the built HTML. `DocumentApp`,
`DriveApp`, and `Utilities.newBlob` are absent from the sandbox, so any
regression to the old paths fails. All four tests pass (`node --test
google-apps-script/Code.test.js`).

## Operator follow-ups (outside the repo)

- [ ] Create a Cloudflare API token with **Browser Rendering — Edit**
      (My Profile → API Tokens → Create Custom Token), account
      `92162a0f546c14e218e1e0eff7ee6197`.
- [ ] In the Apps Script project: Project Settings → Script Properties → add
      `CF_BROWSER_TOKEN` = that token.
- [ ] Redeploy Apps Script (Manage deployments → New version, same URL).
- [ ] Submit one test intake and confirm the received PDF matches the branded
      layout.

## Notes / limits

- Browser Rendering REST is rate-limited (well above a solo practice's volume)
  and request bodies cap at 50 MB (our HTML is ~21 KB). If Cloudflare is ever
  unreachable, the submission falls through to the data-preservation email.
- The account id in `CONFIG` is not sensitive; the token is — it stays in
  Script Properties, never in the repo.
