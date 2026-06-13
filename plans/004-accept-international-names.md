# Plan 004: Accept accented and non-ASCII names in intake signatures and initials

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8f2e6b..HEAD -- new-client-form/index.html`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plans 001/002; coordinate merges if run together — same file as 002, different lines)
- **Category**: bug
- **Planned at**: commit `e8f2e6b`, 2026-06-12

## Why this matters

The signature fields require `pattern="[A-Za-z][A-Za-z \.\-']{1,149}"` and a
duplicate JavaScript regex re-checks the same thing. `[A-Za-z]` matches only
ASCII letters, so a client named **José García** or **Renée Müller** cannot
sign the financial-responsibility or HIPAA sections — the form refuses to
submit with a vague alert. Same for the four initials boxes
(`[A-Za-z]{1,5}`: "JÖ" fails). For a counseling practice this silently turns
away exactly the clients the form should welcome. The fix is switching to
Unicode letter classes while keeping the structural intent (must contain
letters, allows spaces/periods/hyphens/apostrophes, same length caps).

## Current state

All in `new-client-form/index.html`:

- Financial signature input, line 619:
```html
<input class="form-input" type="text" id="financial-signature" name="Financial Responsibility Signature" autocomplete="name" required placeholder="Type your full legal name" maxlength="150" pattern="[A-Za-z][A-Za-z \.\-']{1,149}" title="Enter your full legal name (letters, spaces, hyphens, apostrophes)" />
```
- HIPAA signature input, line 685: identical `pattern`.
- Four initials inputs, lines 708, 715, 722, 729, each with
  `pattern="[A-Za-z]{1,5}"`.
- JS initials re-check, lines 893-901:
```js
        var initials = document.querySelectorAll('[id^="ack-initials-"]');
        for (var j = 0; j < initials.length; j++) {
          if (initials[j].value && !/^[A-Za-z]{1,5}$/.test(initials[j].value)) {
            alert('Initials should contain only letters (A-Z).');
```
- JS signature re-check, lines 903-914:
```js
          if (sigFields[s] && sigFields[s].value && !/^[A-Za-z][A-Za-z \.\-']{1,149}$/.test(sigFields[s].value)) {
            alert('Please enter a valid name for your signature.');
```

Server side: `Code.gs` `sanitize()` accepts any string (strips HTML tags,
caps length) — **no server change needed**.

Browser context: the HTML `pattern` attribute is compiled with the `v` flag
in current browsers. Inside a `v`-mode class, `.`, `-`, `'` need care: `-`
must be escaped or placed last, and the literal must not form a reserved
double punctuator. The patterns below are valid under the `v` flag.

## Commands you will need

No build/test/lint. Verification is `git grep` plus manual browser checks.

## Scope

**In scope**: `new-client-form/index.html` only (6 `pattern` attributes + 2
JS regexes + 1 alert message).

**Out of scope**:
- `google-apps-script/Code.gs` — sanitization already handles Unicode.
- The phone `pattern` (line 447) — digits/symbols only, correctly so.
- Any other validation logic in the submit handler.

## Git workflow

- Branch `advisor/004-international-names` unless told otherwise; single-line
  imperative commit message (repo convention).

## Steps

### Step 1: Update the two signature `pattern` attributes (lines 619, 685)

Replace `pattern="[A-Za-z][A-Za-z \.\-']{1,149}"` with:

```
pattern="[\p{L}][\p{L} .'\-]{1,149}"
```

(Letter first, then letters/spaces/periods/apostrophes/hyphens; hyphen
escaped last. `.` needs no escape inside a class.) Keep `maxlength="150"`
and the `title` text unchanged.

### Step 2: Update the four initials `pattern` attributes (lines 708, 715, 722, 729)

Replace `pattern="[A-Za-z]{1,5}"` with `pattern="[\p{L}]{1,5}"`.

### Step 3: Update the two JS regexes

- Line 896: `/^[A-Za-z]{1,5}$/` → `/^[\p{L}]{1,5}$/u`
- Line 909: `/^[A-Za-z][A-Za-z \.\-']{1,149}$/` → `/^[\p{L}][\p{L} .'\-]{1,149}$/u`

The `u` flag is required for `\p{L}` in JS. Also update the alert at line
897 from "only letters (A-Z)" to "only letters".

**Verify (all steps)**: `git grep -n "A-Za-z" new-client-form/index.html` →
exactly 1 match (the phone pattern at line ~447).

### Step 4: Manual browser check

Open `new-client-form/index.html` locally. In both signature fields type
`José Müller-O'Brien`, in an initials box type `JÖ`:

1. Field-level: with the value in place, run in DevTools console
   `document.getElementById('financial-signature').checkValidity()` → `true`.
2. Negative check: value `1234` → `checkValidity()` → `false`.
3. Fill the whole form with valid test data and click Submit — the
   client-side validation loop must pass the signature/initials checks (it
   will stop at the Turnstile alert locally; that is expected and fine).

## Test plan

The manual matrix in Step 4 is the test: accented happy path, digit
rejection, end-to-end client-side validation pass. No automated tests exist
in this repo.

## Done criteria

- [ ] `git grep -n "A-Za-z" new-client-form/index.html` → exactly 1 match (phone pattern)
- [ ] `checkValidity()` is `true` for `José Müller-O'Brien` in both signature fields
- [ ] `checkValidity()` is `false` for `1234`
- [ ] Both JS regexes use `\p{L}` with the `u` flag
- [ ] No files outside `new-client-form/index.html` modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The patterns at the cited lines don't match the excerpts (drift — plan
  002 edits the same file; if it landed first, line numbers shift but the
  patterns should be findable by grep; only stop if the patterns themselves
  changed).
- `checkValidity()` returns `false` for `José` after the change in a current
  Chrome/Edge — the `pattern` syntax interpretation differs from this plan's
  assumption; report rather than loosening validation further.

## Maintenance notes

- If signature validation is ever moved server-side, mirror the Unicode
  class there — `Code.gs` runs on V8 and supports `\p{L}`/`u`.
- Reviewer should confirm the phone pattern was NOT touched.
- Deferred: replacing `alert()` validation UX with inline messages —
  separate, cosmetic.
