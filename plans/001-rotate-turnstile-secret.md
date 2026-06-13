# Plan 001: Rotate the leaked Turnstile secret and move it to Script Properties

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8f2e6b..HEAD -- google-apps-script/Code.gs`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `e8f2e6b`, 2026-06-12

## Why this matters

`google-apps-script/Code.gs` line 83 contains the live Cloudflare Turnstile
**secret key** inline, and this repository is **public**
(https://github.com/decoy-dev/spectrum-counseling-redesign). Anyone can read
the secret and use it to forge CAPTCHA verifications, defeating the form's
bot protection. Because git history preserves the value forever, deleting it
from the file is not enough — the key must be **rotated** in Cloudflare and
the new value stored outside the repo, in Apps Script Script Properties.

## Current state

- `google-apps-script/Code.gs` — the intake form handler, deployed manually
  as a Google Apps Script web app (it is NOT deployed by GitHub Actions;
  changes to this file require a manual redeploy in script.google.com).
- The Turnstile verification call, `Code.gs:79-91`:

```js
    var turnstileResult = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        secret: '0x4AAAAAACvpvBo8NSS4cXVq9R5wnFWHuP8',   // ← the leaked secret (line 83)
        response: turnstileToken
      },
      muteHttpExceptions: true
    });
```

- The **site key** (`0x4AAAAAACvpvMdO8ZDUgz8y`) in
  `new-client-form/index.html:743` is public by design. Do NOT change it and
  do NOT try to hide it.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm secret removed from working tree | `git grep -n "0x4AAAAAACvpvBo8NSS4cXVq9R5wnFWHuP8"` (PowerShell: same) | only matches inside `plans/` docs, none in `google-apps-script/` |

There is no build, test, or lint command in this repo. Verification of the
deployed behavior is manual (see Steps).

## Scope

**In scope** (the only files you should modify):
- `google-apps-script/Code.gs`

**Out of scope** (do NOT touch):
- `new-client-form/index.html` — the site key there is public by design.
- Any other rejection/validation logic in `Code.gs` (covered by plan 002).

## Git workflow

- Work directly on `master` only if the operator says so; otherwise branch
  `advisor/001-rotate-turnstile-secret`.
- Commit message style in this repo is a single imperative summary line,
  e.g. `Remove intake form diagnostic logging`.

## Steps

### Step 1 (HUMAN/OPERATOR action — coordinate, do not skip): Rotate the key in Cloudflare

In the Cloudflare dashboard → Turnstile → the widget for
spectrumcounseling.net → **rotate the secret key**. The old key is
compromised regardless of any code change. The **site key stays the same**.

If you (the executor) do not have Cloudflare access, STOP after completing
steps 2–3 and report that rotation + property setup + redeploy (steps 1, 4, 5)
remain for the operator.

### Step 2: Read the secret from Script Properties in Code.gs

Replace the hardcoded `secret:` value in the `UrlFetchApp.fetch` payload with
a property lookup, and fail loudly if the property is missing (a missing
property must NOT silently reject every client). Target shape:

```js
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
```

The `throw` is correct here: `doPost`'s catch block already emails the
practice the submitted data with an error notice (`Code.gs:231-258`), so a
misconfiguration is recoverable instead of invisible.

**Verify**: `git grep -n "0x4AAAAAACvpv" -- google-apps-script/` → no matches.

### Step 3: Add a setup note in the Code.gs header comment

The header (`Code.gs:4-16`) lists setup instructions. Add a step:
`Set Script Property TURNSTILE_SECRET (Project Settings > Script Properties)
to the Cloudflare Turnstile secret key.`

**Verify**: `git grep -n "TURNSTILE_SECRET" google-apps-script/Code.gs` → at
least 2 matches (header + code).

### Step 4 (HUMAN/OPERATOR action): Set the Script Property

In script.google.com → the intake project → Project Settings → Script
Properties → add `TURNSTILE_SECRET` = the **new rotated** secret.

### Step 5 (HUMAN/OPERATOR action): Redeploy the web app and smoke-test

Deploy → Manage deployments → edit the existing deployment → New version.
Then submit a real test intake at
https://spectrumcounseling.net/new-client-form/ and confirm the PDF email
arrives at the practice inbox.

## Test plan

No automated tests exist in this repo. The smoke test in step 5 is the test:
one end-to-end submission producing the intake PDF email.

## Done criteria

- [ ] `git grep -n "0x4AAAAAACvpv" -- google-apps-script/` returns nothing
- [ ] `Code.gs` reads `TURNSTILE_SECRET` from `PropertiesService.getScriptProperties()` and throws if missing
- [ ] Cloudflare secret rotated (operator-confirmed)
- [ ] Script Property set and web app redeployed (operator-confirmed)
- [ ] End-to-end test submission produced the intake email
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `Code.gs:79-91` no longer matches the excerpt above (drift).
- You are tempted to put the new secret value anywhere in the repo — never
  do this; STOP and re-read this plan.
- The operator cannot rotate the Cloudflare key: complete code changes,
  then report the remaining manual steps.

## Maintenance notes

- Plan 002 modifies adjacent code in `doPost`; land this plan first so 002
  is written against the property-based lookup.
- Reviewer should confirm the secret value appears nowhere in the diff.
- Deferred: scrubbing the secret from git history (e.g. with
  `git filter-repo`) is intentionally out of scope — rotation makes the old
  value worthless, and history rewriting on a deployed Pages repo is riskier
  than it is worth.
