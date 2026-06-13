# Plan 006: Show live staged feedback while the intake form is submitting

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 5c336cd..HEAD -- new-client-form/index.html`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (client-only; no backend change)
- **Depends on**: plans/002-fix-silent-intake-loss.md (DONE — this builds on its fetch handler)
- **Category**: dx/ux
- **Planned at**: commit `5c336cd`, 2026-06-12

## Why this matters

Submitting the intake form takes 5–10 seconds (the Apps Script backend
builds a PDF server-side). Today the only feedback is the button text
changing to "Submitting..." — long enough that clients may think the page
froze, click elsewhere, or close the tab mid-request. The request is a
single POST with one response at the end, so true progress is not
observable; the right UX is a spinner plus staged status messages whose
stages are real (verify → generate PDF → finalize) with approximated
timing, and a note that it can take up to ~15 seconds.

## Current state

All in `new-client-form/index.html` (at commit `5c336cd`):

- Submit button block, lines 746-752:

```html
        <!-- Submit -->
        <div class="text-center fade-in">
          <button id="submit-btn" type="submit" class="bg-gradient-to-r from-primary to-primary-dim text-on-primary px-10 sm:px-14 py-4 rounded-full text-lg font-bold shadow-xl shadow-primary/10 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01] hover:brightness-110 transition-all duration-200 active:scale-95">
            Submit Client Form
          </button>
          <p class="text-xs text-on-surface-variant mt-4">Your information is transmitted securely and kept confidential.</p>
        </div>
```

- The submit/settle code, lines 916-947:

```js
        // All validation passed — submit via fetch
        lastSubmitTime = now;
        var originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');

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

- Page CSS lives in two `<style>` blocks in `<head>` (the second contains
  `.form-input`, `.form-success` etc. around lines 266-337) — add new rules
  there.
- Conventions: ES5 only (`var`, IIFEs, no arrow functions), Tailwind utility
  classes with the page's CSS-variable tokens (`rgb(var(--color-primary))`
  etc.), Manrope body font, rounded corners, soft blues. Match them.
- Design-system rules (CLAUDE.md): no pure black, generous spacing, rounded
  corners ≥ 0.75rem.

## Commands you will need

No build/test/lint exists. Verification is `git grep` plus a manual browser
check (Steps include exact instructions). Pushing to `master` deploys.

## Scope

**In scope**: `new-client-form/index.html` only — the submit-button block,
one new CSS addition in the existing `<style>` block, and the submit/settle
JS shown above.

**Out of scope**:
- `google-apps-script/Code.gs` — no backend change.
- The validation logic above line 916, the Turnstile widget, the success
  block markup (`#form-success`), the legacy `?submitted=true` handler.
- Do not replace the error `alert()`s with new UI in this plan (deferred);
  they remain as-is.

## Steps

### Step 1: Add the status element under the submit button

Inside the `<!-- Submit -->` div, after the existing `<p>` (line 751), add:

```html
          <div id="submit-status" class="hidden mt-6 mx-auto max-w-md rounded-xl bg-surface-container-low px-6 py-5 text-left" role="status" aria-live="polite">
            <div class="flex items-center gap-3">
              <span class="submit-spinner" aria-hidden="true"></span>
              <span id="submit-status-text" class="text-sm font-semibold text-on-surface">Verifying your information&hellip;</span>
            </div>
            <p class="text-xs text-on-surface-variant mt-2">This can take up to 15 seconds &mdash; please keep this page open.</p>
          </div>
```

### Step 2: Add the spinner CSS

In the second `<style>` block (near the `.form-success` rules), add:

```css
    .submit-spinner {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      border-radius: 50%;
      border: 3px solid rgb(var(--color-primary) / 0.25);
      border-top-color: rgb(var(--color-primary));
      animation: submit-spin 0.8s linear infinite;
    }
    @keyframes submit-spin {
      to { transform: rotate(360deg); }
    }
```

### Step 3: Drive the staged messages from the submit handler

Replace the block between `// All validation passed — submit via fetch` and
the end of the `.catch(...)` (current lines 916-947) so that:

1. On submit: disable the button as today (keep `originalText`,
   `opacity-60`, `cursor-not-allowed`), set button text to
   `'Submitting…'`, reveal `#submit-status` (remove `hidden`), and start a
   staged message sequence:
   - immediately: `Verifying your information…`
   - after 2.5 s: `Securely generating your intake packet…`
   - after 7 s: `Almost done — finalizing your submission…`
   - after 14 s: `Still working — thank you for your patience…`
   Implement with `setTimeout` handles collected in an array (ES5), and a
   single `clearStatusTimers()` helper that clears them all.
2. On success (`data.ok`): clear timers, hide `#submit-status` (add
   `hidden` back), then the existing behavior (hide form, show
   `#form-success`, scroll to top).
3. On failure (non-ok response) and on `.catch`: clear timers, hide
   `#submit-status`, then the existing behavior (alert + restore button).
   The restore must reset the status text back to the first message so a
   retry starts the sequence fresh.

Keep the fetch call, the `data.ok` branching, and both alert messages
byte-identical to the current code — this plan only adds the status
mechanics around them.

**Verify**:
- `git grep -n "submit-status" new-client-form/index.html` → ≥ 4 matches
  (div, text span, and JS references).
- `git grep -c "clearStatusTimers\|statusTimers" new-client-form/index.html` → ≥ 2.
- `git grep -n "no-cors" new-client-form/index.html` → 0 (regression guard).

### Step 4: Manual browser check

Open `new-client-form/index.html` locally. In DevTools console, simulate the
submitting state without a real POST:

```js
document.getElementById('submit-status').classList.remove('hidden');
```

Confirm: spinner animates, card is styled consistently with the page (light
AND dark theme — toggle it), text is readable in both themes. Then reload,
fill the form with test data, and submit (it will fail at the Turnstile or
network stage locally) — confirm the status card appears on submit and
disappears again when the error alert fires, with the button restored.

## Test plan

The manual matrix in Step 4 plus, post-deploy (operator): one real test
submission to watch the full 5–10 s sequence and the success transition.
No automated tests exist in this repo.

## Done criteria

- [ ] `#submit-status` element exists with `role="status"` and `aria-live="polite"`
- [ ] Spinner CSS uses the page's `--color-primary` token (no hardcoded hex)
- [ ] Staged messages advance on timers and are fully cleared/reset on success AND on both failure paths
- [ ] Fetch call and alert texts unchanged from current code
- [ ] Status card looks correct in light and dark themes (manual check)
- [ ] No files outside `new-client-form/index.html` modified (`git status`)
- [ ] `plans/README.md` status row updated (unless reviewer maintains it)

## STOP conditions

- The code at lines 746-752 / 916-947 doesn't match the excerpts (drift).
- The change appears to require touching the backend or the validation
  logic above line 916.

## Maintenance notes

- If backend timing changes materially (e.g. the PDF build gets faster or a
  Sheet-logging step is added), revisit the timer thresholds (2.5/7/14 s).
- A future plan replacing the error `alert()`s with inline UI should reuse
  the `#submit-status` card (swap spinner for an error icon) — that's why
  it's a generic card, not a button-internal spinner.
- Reviewer: scrutinize that timers can't leak (every settle path clears
  them) and that a failed-then-retried submission starts the message
  sequence from the beginning.
