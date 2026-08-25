# 009 — Intake outage incident & fixes (2026-08-24)

**Status: DONE** (all code merged to master at `9863c6f`; Apps Script redeployed
by owner 2026-08-24; live form + endpoint verified).

This is a retrospective of a live incident, written after the fix — kept here
so the diagnosis and remaining operator follow-ups aren't lost.

## Incident

A client ("KM") submitting the intake form on 2026-08-24 saw the generic
failure alert twice, then a CAPTCHA rejection, and gave up. Apps Script
executions log showed:

| Time (PM) | Duration | Status | What actually happened |
|---|---|---|---|
| 3:28:02 | 69.4 s | Failed | Docs outage; `doc.saveAndClose()` failed through all 6 retry attempts (62 s of backoff is the fingerprint) |
| 3:29:31 | 65.6 s | Failed | Same. Fallback error email **was sent** (arrived 3:30 PM with full form data) but `GmailApp.sendEmail` threw anyway, so the catch rethrew and the client saw failure |
| 3:30:31 | 0.7 s | Completed | Client retry bounced instantly: Turnstile tokens are single-use, form never refreshed the widget, so `siteverify` rejected the spent token |

Root cause of the failures: a ~2-minute Google-side Documents service outage.
Not caused by our code; will recur eventually.

## What the investigation also uncovered

1. **Dropped acknowledgment initials (worse than the outage).** The live
   Apps Script had been edited in the script.google.com browser editor
   (~2026-08-14) to add a 5th acknowledgment (cancellation fee, $75) and
   rename ack fields 3–5 — but the live form still sent 4 fields with the
   old names. Result: every intake PDF from ~Aug 14 to Aug 24 shows "—"
   for the cancellation, consent, and stop-care initials even though
   clients typed them. The matching form fix existed as an **unpushed
   commit on the owner's MacBook** (`8bb658d`, authored Aug 14, pushed
   Aug 24) — deploy drift in both directions at once.
2. **Fallback email was a single point of failure.** One unretried
   `GmailApp.sendEmail` call was the last line of defense for client data.
3. **Rate limit punished victims.** The 3/hour counter incremented before
   the PDF build, so outage-failed attempts burned the client's quota.

## Fixes shipped (commits `8bb658d` + `9863c6f`)

- Form: 5 acknowledgment fields with names matching the script
  (`Ack Initials 3 - Cancellation` / `4 - Consent` / `5 - Stop Care`).
- Form: `turnstile.reset()` after both failure paths so retries get a
  fresh single-use token; captcha error message no longer says "reload".
- `Code.gs`: fallback error email wrapped in `retry(…, 3, 1000)` with a
  `MailApp.sendEmail` fallback (separate service from GmailApp).
- `Code.gs`: rate-limit counter now increments only after the intake
  email sends successfully.
- Repo `Code.gs` synced with the browser-edited live script (ack5).
- Owner redeployed Apps Script (new version, same URL) 2026-08-24.

## Operator follow-ups (outside the repo)

- [ ] Reach out to client KM — their full submission survived in the
      2026-08-24 "INTAKE FORM ERROR" email; acknowledge receipt.
- [ ] Review intake PDFs received ~2026-08-14 → 2026-08-24: initials for
      acknowledgments 3–5 are "—"; clients must re-initial if the clinical
      record requires them. The typed values were never stored.
- [ ] Optional: one end-to-end test submission to verify the full
      pipeline post-redeploy (June redeploy was smoke-tested this way).

## Lessons / standing rules

- **The Apps Script deployment pins a version.** Editor code ≠ live code
  until "Manage deployments → New version". Conversely, browser edits to
  the script silently diverge from the repo. Treat the repo as source of
  truth: edit here, paste there, redeploy, in that order.
- **Sub-second "Completed" `doPost` runs are early rejections** (honeypot/
  captcha/timing/rate-limit), not successful intakes. Durations of ~65 s
  mean the retry ladder ran to exhaustion.
- **A "Failed" execution can still have sent email** — Gmail can throw
  after transmitting during the same disruptions that break Docs.
- The structurally complete fix remains the deferred **durable Google
  Sheet submission log** (see README "rejected/deferred") — one
  `appendRow` before the spam gates would make data loss impossible even
  if every email path dies.
