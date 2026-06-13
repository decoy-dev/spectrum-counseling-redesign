# Plan 005: Correct CLAUDE.md to match the real codebase; delete the dead intake template

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8f2e6b..HEAD -- CLAUDE.md google-apps-script/`
> If either path changed since this plan was written, compare the "Current
> state" facts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (docs + one dead-file deletion)
- **Depends on**: none (but if plans 001–003 land first, fold their outcomes in — see Step 2 notes)
- **Category**: docs
- **Planned at**: commit `e8f2e6b`, 2026-06-12

## Why this matters

`CLAUDE.md` is loaded into every agent session on this repo, and several of
its claims are now false: it describes a Google-Docs-template PDF flow that
was replaced by programmatic document building; it lists pages at flat paths
(`contact.html`, `new-client-form.html`) that moved into directories; and it
omits `privacy/`, `terms/`, `404.html`, and `sitemap.xml` entirely.
`google-apps-script/intake-template.html` is referenced by nothing except
the stale doc. Wrong instructions misdirect every future session — worse
than no instructions.

## Current state

- `CLAUDE.md:29` (Backend section) claims Code.gs "clones a Google Docs
  intake template, fills in placeholders (`{{Field Name}}`), exports to
  PDF" and that "The HTML email template is in
  `google-apps-script/intake-template.html`."
- Reality: `google-apps-script/Code.gs:14-15` says "This version builds the
  intake PDF programmatically — no Google Docs template needed"; the doc is
  assembled by `buildDocument()` (`Code.gs:268`), exported via `DriveApp`,
  emailed with `GmailApp.sendEmail` (plain-text body, no HTML template),
  and trashed.
- `git grep -n "intake-template"` matches only `CLAUDE.md:29` — the file is
  dead.
- The CLAUDE.md Pages table lists `index.html`, `contact.html`,
  `new-client-form.html`. Actual page files: `index.html`,
  `contact/index.html`, `new-client-form/index.html`, `privacy/index.html`,
  `terms/index.html`, `404.html`. Plus `sitemap.xml`.
- `stitch_spectrum_counseling_landing_page/` is cited as the design
  reference but is **untracked** (not in git, therefore also not deployed —
  GitHub Actions deploys from the checkout).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Confirm dead file gone | `git grep -n "intake-template"` | 0 matches |
| Confirm paths in doc exist | manually check each path named in CLAUDE.md | all exist |

## Scope

**In scope**:
- `CLAUDE.md`
- `google-apps-script/intake-template.html` (delete)

**Out of scope**:
- `google-apps-script/Code.gs` and all HTML pages — no behavior changes.
- `stitch_spectrum_counseling_landing_page/` — leave untracked; just
  document its status.

## Git workflow

- Branch `advisor/005-truth-up-claude-md` unless told otherwise;
  single-line imperative commit message.

## Steps

### Step 1: Delete the dead template

Delete `google-apps-script/intake-template.html`.

**Verify**: `git grep -n "intake-template"` → matches only in `CLAUDE.md`
(removed in Step 2) and `plans/` files.

### Step 2: Rewrite the stale CLAUDE.md sections

Replace the Pages table with:

```markdown
| File | Purpose |
|---|---|
| `index.html` | Landing page — hero, services, about, testimonials, FAQ, location |
| `contact/index.html` | Contact page (phone/email/address cards — no form) |
| `new-client-form/index.html` | Multi-step intake form with client info, consent, HIPAA acknowledgment |
| `privacy/index.html` | Privacy policy |
| `terms/index.html` | Terms of service |
| `404.html` | Not-found page |
| `sitemap.xml` | Sitemap (update when adding indexed pages) |
```

Replace the Backend paragraph (currently `CLAUDE.md:27-29`) with:

```markdown
### Backend (Google Apps Script)

`google-apps-script/Code.gs` — Deployed manually as a Google Apps Script web
app (NOT deployed by GitHub Actions; changes require a new deployment
version in script.google.com). Receives POST submissions from
`new-client-form/index.html`, verifies a Cloudflare Turnstile token, applies
spam checks (honeypot, timing, per-email rate limit), builds the intake PDF
programmatically with DocumentApp (`buildDocument()`), emails it to the
practice via GmailApp, then trashes the temp doc.
```

In the Reference Design section, add one sentence: the
`stitch_spectrum_counseling_landing_page/` folder is intentionally untracked
local reference material — it is not in git and not deployed.

Adjust details to reality if earlier plans already landed (e.g. plan 001
adds a `TURNSTILE_SECRET` Script Property — worth one line; plan 002 changes
responses to JSON). Verify any such claim against the live `Code.gs` before
writing it.

**Verify**: every file path named anywhere in CLAUDE.md exists
(`Test-Path` each one); `git grep -n "contact.html\|new-client-form.html"
CLAUDE.md` → 0 matches.

### Step 3: Read-through pass

Read the full CLAUDE.md top to bottom and fix any other claim that
contradicts the repo (e.g. the Development section's "Open any HTML file
directly in a browser" still holds — directory pages open fine from disk).
Do not add new policy or style rules — corrections only.

**Verify**: no statement in CLAUDE.md names a file, path, or flow that does
not exist in the repo.

## Test plan

Docs-only: the verifications above are the test. No automated suite exists.

## Done criteria

- [ ] `google-apps-script/intake-template.html` deleted
- [ ] `git grep -n "intake-template"` → 0 matches outside `plans/`
- [ ] Every path named in CLAUDE.md exists
- [ ] Backend section describes the programmatic `buildDocument()` flow, not template cloning
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `git grep` shows `intake-template.html` referenced from any code file
  (not just CLAUDE.md) — it is not dead after all; report.
- `Code.gs` no longer matches the described flow (a later plan changed it)
  — describe what IS there, and if unsure, report rather than guess.

## Maintenance notes

- CLAUDE.md should be re-checked whenever pages are added/moved or the
  Apps Script flow changes — consider it part of the definition of done for
  such changes.
- Reviewer: confirm no behavioral files changed in the diff.
