# Plan 002: Stop showing "Submitted Successfully" for intakes the server silently dropped

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8f2e6b..HEAD -- google-apps-script/Code.gs new-client-form/index.html`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the live intake pipeline)
- **Depends on**: plans/001-rotate-turnstile-secret.md (same code region; land 001 first)
- **Category**: bug
- **Planned at**: commit `e8f2e6b`, 2026-06-12

## Why this matters

This is a therapy-practice intake form. Today, five server-side paths
discard a submission and return a redirect with **no notification to
anyone**: honeypot, missing Turnstile token, failed Turnstile verification,
a timing check, and a rate limit. Meanwhile the browser submits with
`fetch(..., { mode: 'no-cors' })`, which yields an *opaque* response — the
page cannot tell success from rejection, so it **always** shows "Form
Submitted Successfully". Two of the rejection paths plausibly hit real
humans:

1. The timing check compares the **client's clock** (a hidden `_loaded`
   field set to `Date.now()` in the browser) against **Google's server
   clock**. A client whose device clock is ahead by a few seconds produces a
   small or negative delta and is silently rejected as a bot.
2. The rate limit (3 submissions/hour per email) can trip for a family
   sharing one email address, or a client retrying after a perceived error.

In both cases the client believes their intake went through and waits for a
call that never comes. After this plan: every rejection a human could hit
produces a visible error on the page (with the practice phone number, form
data preserved), and only the honeypot path stays silent.

## Current state

### Server — `google-apps-script/Code.gs`

`doPost(e)` rejection paths, all `return redirect()` (a meta-refresh HTML
page pointing at `?submitted=true`):

```js
// Code.gs:70-72 — honeypot
    if (p['_honey']) {
      return redirect();
    }
// Code.gs:76-78 — missing Turnstile token
    if (!turnstileToken) {
      return redirect();
    }
// Code.gs:89-91 — failed Turnstile verification
    if (!turnstileData.success) {
      return redirect();
    }
// Code.gs:93-98 — timing check (client clock vs server clock — the skew bug)
    var loadedTs = parseInt(p['_loaded'], 10);
    var nowTs = Date.now();
    if (!loadedTs || isNaN(loadedTs) || (nowTs - loadedTs) < 10000) {
      return redirect();
    }
// Code.gs:100-110 — rate limit, 3/hour per email via CacheService
      if (submissions >= 3) {
        return redirect();
      }
```

On success, `doPost` ends with `return redirect();` (`Code.gs:260`). On an
internal error, the catch block (`Code.gs:231-258`) emails the practice the
full submitted data ("INTAKE FORM ERROR" email, instructing them to reach
out to the client), then `throw error;` (`Code.gs:257`).

The `redirect()` helper is at `Code.gs:593-599`.

### Client — `new-client-form/index.html`

The submit handler (lines 813-938) does client-side validation, then:

```js
// new-client-form/index.html:923-936
        fetch(form.action, {
          method: 'POST',
          body: new FormData(form),
          mode: 'no-cors'
        }).then(function() {
          form.style.display = 'none';
          document.getElementById('form-success').classList.add('show');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }).catch(function() {
          alert('There was a problem submitting your form. Please try again or call (480) 782-0113.');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        });
```

A legacy handler at lines 796-803 shows the success block when the URL has
`?submitted=true` (left over from the redirect-based flow — keep it).

### Key platform fact

A Google Apps Script web app deployed with access "Anyone" serves
`ContentService` responses with `Access-Control-Allow-Origin: *` after its
internal redirect to `script.googleusercontent.com`. A browser `fetch` POST
of `FormData` is a CORS *simple request* (no preflight), so the response IS
readable from the page **without** `mode: 'no-cors'`. This is what makes the
fix possible. Verify it empirically in Step 5 before shipping.

## Commands you will need

No build/test/lint commands exist. Verification is `git grep` plus the
manual test matrix in the Test plan. `Code.gs` changes require a manual
redeploy at script.google.com (Deploy → Manage deployments → New version);
HTML changes deploy automatically on push to `master` via GitHub Pages.

## Scope

**In scope**:
- `google-apps-script/Code.gs`
- `new-client-form/index.html` (the submit-handler `<script>` block only)

**Out of scope**:
- The form's HTML fields, validation patterns, or Turnstile widget markup.
- `CONFIG.REDIRECT_URL` and the legacy `?submitted=true` handling — keep
  both, so the old deployed script version keeps working until the new one
  is live.
- The PDF/document-builder functions (`buildDocument` and below).

## Steps

### Step 1: Add a JSON response helper to Code.gs

Next to `redirect()` (`Code.gs:593`), add:

```js
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Verify**: `git grep -n "function jsonOut" google-apps-script/Code.gs` → 1 match.

### Step 2: Convert the rejection paths

- **Honeypot** (`Code.gs:70-72`): return `jsonOut({ ok: true })` — bots get
  fake success; no email.
- **Missing token** (`:76-78`) and **failed Turnstile** (`:89-91`): return
  `jsonOut({ ok: false, reason: 'captcha' })`.
- **Timing check** (`:93-98`): change the condition so **clock skew no
  longer rejects**. Only reject when the delta is a small *positive* number
  (a real sub-10-second fill); treat missing/NaN/negative deltas as
  inconclusive and let the submission through (Turnstile is the strong
  gate):

```js
    var loadedTs = parseInt(p['_loaded'], 10);
    var nowTs = Date.now();
    var fillMs = nowTs - loadedTs;
    if (loadedTs && !isNaN(loadedTs) && fillMs >= 0 && fillMs < 10000) {
      return jsonOut({ ok: false, reason: 'timing' });
    }
```

- **Rate limit** (`:107-109`): return `jsonOut({ ok: false, reason: 'rate-limit' })`.

**Verify**: `git grep -n "return redirect()" google-apps-script/Code.gs` →
exactly 1 match remaining (the success return at the end of `doPost`; it is
replaced in step 3).

### Step 3: Convert the success and error returns

- Success (`Code.gs:260`): `return jsonOut({ ok: true });`
- Error path: inside the catch block, **after** the "INTAKE FORM ERROR"
  email is sent successfully, the client's data HAS reached the practice —
  so return `jsonOut({ ok: true })` instead of `throw error;` (re-throwing
  would make the client resubmit data the practice already has). Only if
  even the error email fails (the inner `catch (e2)`) re-throw, so the
  client correctly sees a failure.

Target shape for the end of the catch block:

```js
    } catch (error) {
      try {
        // ... existing dataStr assembly and GmailApp.sendEmail unchanged ...
        return jsonOut({ ok: true });   // data preserved via error email
      } catch (e2) {
        throw error;                    // truly lost — client must see failure
      }
    }
```

**Verify**: `git grep -n "return redirect()" google-apps-script/Code.gs` → 0
matches. (`redirect()` itself may be deleted or kept; if kept, note it is
unused.)

### Step 4: Make the client read the response

In `new-client-form/index.html:923-936`, remove `mode: 'no-cors'` and branch
on the parsed body. Treat *any* unparseable/non-ok outcome as failure.
Target shape:

```js
        fetch(form.action, {
          method: 'POST',
          body: new FormData(form)
        }).then(function(r) { return r.json(); })
        .then(function(data) {
          if (data && data.ok) {
            form.style.display = 'none';
            document.getElementById('form-success').classList.add('show');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            var msg = (data && data.reason === 'captcha')
              ? 'CAPTCHA verification failed. Please reload the page and try again, or call (480) 782-0113.'
              : 'There was a problem submitting your form. Please try again or call (480) 782-0113. Your answers are still on this page.';
            alert(msg);
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
          }
        })
        .catch(function() {
          alert('There was a problem submitting your form. Please try again or call (480) 782-0113. Your answers are still on this page.');
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
          submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        });
```

Keep the legacy `?submitted=true` block (lines 796-803) untouched.

**Verify**: `git grep -n "no-cors" new-client-form/index.html` → 0 matches.

### Step 5 (HUMAN/OPERATOR + executor): Deploy server first, then verify CORS, then push client

Order matters — deploy the new `Code.gs` version **before** pushing the HTML
change (the old no-cors client works fine against the new JSON server; the
new client against the old server would fail to parse and show an error).

1. Operator redeploys the Apps Script (new version).
2. From a browser console on https://spectrumcounseling.net/, run a plain
   `fetch('<web app URL>', { method: 'POST', body: new FormData() })` and
   confirm the response is readable (status 200, body parses as JSON with
   `ok: false` since required gates fail). **If the response is blocked by
   CORS, STOP — do not push the client change, and report.**
3. Push the HTML change to `master`; GitHub Pages deploys it.

## Test plan

Manual matrix against the live form (use obviously-fake test data and tell
the practice inbox owner to expect test emails):

1. **Happy path**: full valid submission → success state shown AND intake
   PDF email arrives.
2. **Turnstile unsolved**: blank the hidden `cf-turnstile-response` via
   DevTools and submit → client-side alert fires (existing check at line
   873-877); then bypass it to hit the server path → error alert, form still
   visible with data intact.
3. **Rate limit**: 4 submissions in an hour with the same email → 4th shows
   the error alert, not success.
4. **Clock skew**: set `document.getElementById('_loaded').value` to a
   timestamp 1 hour in the future via DevTools, submit a valid form →
   submission SUCCEEDS (skew no longer rejects).

## Done criteria

- [ ] `git grep -n "no-cors" new-client-form/index.html` → 0 matches
- [ ] `git grep -n "return redirect()" google-apps-script/Code.gs` → 0 matches
- [ ] All four manual tests above pass
- [ ] Legacy `?submitted=true` block still present at `new-client-form/index.html:796-803`
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the "Current state" locations doesn't match the excerpts.
- Step 5.2 shows the Apps Script response is NOT CORS-readable from the
  live origin. Do not reintroduce `no-cors` and fake success — stop and
  report; the fallback design (form-target iframe or redirect flow) is a
  decision for the advisor/operator.
- Any change seems to require touching `buildDocument` or the form fields.

## Maintenance notes

- The honeypot intentionally returns `ok: true` — a reviewer may flag this
  as a bug; it is not.
- If a future plan adds a Google Sheet submission log (proposed direction
  finding), it should insert before the Turnstile gate so even rejected
  submissions are recorded.
- The client confirmation-email idea depends on this plan's readable
  success signal.
- Deferred: replacing `alert()` with inline error UI — cosmetic, separate
  change.
