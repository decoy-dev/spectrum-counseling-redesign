# HANDOFF — Spectrum Counseling (updated 2026-09-03)

Living pointer for picking work back up in a fresh session. Read this first,
then the numbered plans it references. Update it when state changes.

---

## TL;DR

Two threads were worked across sessions: (1) the **intake-form PDF pipeline** and
(2) an **SEO pass**. Everything in-repo is done and deployed. The intake PDF
pipeline is now **live** — the Cloudflare Browser Rendering renderer was
deployed and verified with a real test submission (2026-09-03). What remains is
**owner/dashboard SEO/citation work outside the repo** (items 2–4 below).

---

## ⚠️ Immediate action items (owner, outside the repo)

1. ~~**Finish the intake PDF renderer.**~~ **DONE (2026-09-03).** The Cloudflare
   Browser Rendering pipeline is live and verified:
   - Created a Cloudflare API token with **Account → Browser Run → Edit**
     (note: Cloudflare renamed "Browser Rendering" → "Browser Run"; the REST
     endpoint is still `/browser-rendering/pdf`, so no code change was needed),
     account `92162a0f546c14e218e1e0eff7ee6197`.
   - Added it as Script Property `CF_BROWSER_TOKEN`, pasted the current `Code.gs`
     (with `renderPdf`), and deployed a new version at the same `/exec` URL.
   - A real test submission produced the branded 3-page PDF (all 7 sections,
     notice box, and 5 initialed acknowledgments) — confirmed.

2. **Revoke the temporary Dynamic-Redirect API token** created earlier for the
   301 setup (My Profile → API Tokens). The redirect rules are already live;
   the token is no longer needed. (The local copy at `~/.cf_redirect_token`
   was already deleted.)

3. **GBP / citation NAP reconciliation** (`plans/012`, item remaining). Align
   across Google Business Profile, Psychology Today, and the chamber listing:
   - Hours: **Mon, Tue, Thu, Fri · 10:30 AM – 6:00 PM** (now the site's
     source of truth).
   - Address format: **428 S. Gilbert Rd. Ste. #105 (Bldg. 3), Gilbert, AZ
     85296**.
   - Credential: **Licensed Professional Counselor (LPC-11797)** — not
     "psychologist".

4. **Google Search Console** (`plans/012`): property is verified (owner). If
   not already done, submit `https://spectrumcounseling.net/sitemap.xml` and,
   when data accrues, revisit whether any legacy specialty page is worth
   rebuilding.

### Optional / when convenient
- Direct Google **reviews URL** → add a visible "Read our reviews" link.
- Remove unused `assets/fonts/Soria-Bold.otf`; compress `assets/sc_og_image.png`
  (~510 KB, link-preview only); consider making the entrance page-transition
  overlay start transparent (perceived load speed). All noted in `plans/012`.

---

## What was done this session (all committed to master)

### Intake PDF pipeline
- `plans/011` — moved rendering OFF Google Docs (two Docs-service outages had
  failed `saveAndClose`). **Superseded** by 013 for the renderer choice, but
  the "no DocumentApp/DriveApp" decision stands.
- `plans/013` — **current renderer (LIVE)**: `buildHtml()` → Cloudflare Browser
  Rendering REST `/browser-rendering/pdf` (real Chrome, `printBackground`+`preferCSSPageSize`).
  Deployed and verified with a real test submission on 2026-09-03. Auth uses the
  `CF_BROWSER_TOKEN` Script Property (an **Account → Browser Run → Edit** token).
- `google-apps-script/Code.gs` is the source of truth; deploy is **manual**
  (paste into script.google.com → new deployment version). Not deployed by
  GitHub Actions.
- `google-apps-script/Code.test.js` — run `node --test google-apps-script/Code.test.js`
  after any `Code.gs` change (4 tests; no DocumentApp/DriveApp/newBlob in the
  sandbox on purpose).

### SEO (`plans/012`, IN PROGRESS)
- Credential corrected everywhere to **LPC-11797 / Licensed Professional
  Counselor**; business JSON-LD is now `LocalBusiness`.
- Visible phone/email added (homepage Location + footer + mobile CTA + 404);
  FAQ JSON-LD synced to visible copy; enriched `LocalBusiness` facts;
  owner-confirmed hours + Google Business URL (`https://share.google/Mw9tMcAxO62nrUnmG`).
- Perf/hygiene: font preconnects, subset Material Symbols (~311 KB → ~6 KB/page),
  root-relative 404 assets, contact heading order, decorative `alt=""`, logo
  dimensions, `about-hero.webp` 263 KB → 86 KB, sitemap dates, OG tags.
- **Legacy 404 redirects → live Cloudflare edge 301s** (`plans/012` "Legacy-URL
  redirects"): `/home`→`/`, `/about`→`/#about`, `/specialties`→`/#specializations`,
  `/privacy-policy`→`/privacy/`. Ruleset `f3e534191b43494a833d9e9f200ebd43`.
  The earlier in-repo meta-refresh stubs were removed (edge 301 supersedes them).
- Google Search Console verification file `googleb65386975bedb0a9.html` at the
  site root.

---

## How this repo works (for the next session)

- **Static site**, no build step. Pages/assets served as-is.
- **Deploy = push to `master`.** GitHub Actions (`.github/workflows/static.yml`)
  uploads the repo to GitHub Pages on push.
- **Push auth gotcha:** the repo is `decoy-dev/spectrum-counseling-redesign`,
  but the machine's default `gh`/git account is `ch-readycloud` (no write
  access). Before pushing:
  `gh auth switch --hostname github.com --user decoy-dev` — then push — then
  switch back with `--user ch-readycloud`. (Workflow warns about deprecated
  Node 20 actions; deploys still succeed — bumping the action versions is a
  future nicety.)
- **Cloudflare** fronts the domain: live `/robots.txt` has a dashboard-managed
  AI-bot block prepended; redirects are edge Redirect Rules (not in the repo);
  the intake PDF uses Browser Rendering. Local `wrangler` is logged in as
  `chris@hvddox.com` (account `92162a0f…`) but as a **read-only** zone OAuth
  token — fine for reads, not for creating rules (that needed a scoped token).
- **Local preview:** `python3 -m http.server` in the repo root, or open HTML
  files directly. Headless Chrome is at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` for
  screenshots/PDF checks. `gs` (ghostscript) renders PDFs to PNG for review.

---

## Re-verify live state (safe read-only commands)

```
# Redirects (expect 301 + correct Location)
for p in /home /about /specialties /privacy-policy; do
  curl -sS -o /dev/null -D - "https://spectrumcounseling.net$p" \
    | awk '/^HTTP/{c=$2} tolower($1)=="location:"{l=$2} END{print "'$p' -> "c" "l}'
done

# GSC token, credential, hours, schema type on the homepage
curl -s https://spectrumcounseling.net/googleb65386975bedb0a9.html
curl -s https://spectrumcounseling.net/ | grep -o -e 'LPC-11797' \
  -e '"@type": "LocalBusiness"' -e 'Mo,Tu,Th,Fr 10:30-18:00'

# Intake tests
node --test google-apps-script/Code.test.js
```

---

## Plan index

See `plans/README.md` for the full table. Most relevant now:
- `plans/013` — intake PDF via Cloudflare Browser Rendering (**do action 1**).
- `plans/012` — SEO audit + reviewed action plan (IN PROGRESS; owner items).
- `plans/011` — intake off Google Docs (superseded by 013 for rendering).
- `plans/009` — 2026-08-24 intake outage retrospective (context).

## Known smells (not blocking)
- `plans/*` and this handoff are served publicly by GitHub Pages (not linked,
  not in the sitemap, so unlikely indexed). They contain no secrets. If that
  exposure is unwanted, exclude the folder at deploy time.
- `redirect()` in `Code.gs` is dead code (unused HtmlService function).
- Shared `site.js`/`site.css` extraction across the 6 pages is still deferred
  (`plans/README.md`).
