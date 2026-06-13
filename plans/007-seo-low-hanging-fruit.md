# Plan 007: SEO cleanup — robots.txt, sitemap fixes, Psychologist schema, OG gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> Touch only the files listed as in scope. If any STOP condition occurs,
> stop and report — do not improvise. When done, update the status row in
> `plans/README.md` — unless a reviewer dispatched you and maintains the index.
>
> **Drift check (run first)**: `git diff --stat 37abbe5..HEAD -- sitemap.xml index.html contact/index.html new-client-form/index.html privacy/index.html terms/index.html`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (additive metadata; no layout or behavior changes)
- **Depends on**: none
- **Category**: seo/docs
- **Planned at**: commit `37abbe5`, 2026-06-12

## Why this matters

Four small, verified gaps: (1) `robots.txt` 404s on the live site, so
crawlers have no `Sitemap:` pointer; (2) `sitemap.xml` lists
`/new-client-form/`, which carries `noindex, nofollow` — contradictory
signals to Google — and lacks `lastmod` (the only date field Google reads);
(3) the landing page's JSON-LD uses the generic `ProfessionalService` type
where schema.org's `Psychologist` (a LocalBusiness subtype) matches exactly
and categorizes better for local search, and it lacks `image`/`logo`/`email`;
(4) `privacy/` and `terms/` lack `og:url`/`og:type`/Twitter tags, and no
page has `og:image:alt`.

## Current state

- `sitemap.xml` (whole file, 18 lines): three `<url>` entries — `/`,
  `/contact/`, `/new-client-form/` — each with `<priority>` and
  `<changefreq>`, no `<lastmod>`.
- `new-client-form/index.html:8`: `<meta name="robots" content="noindex, nofollow" />` (correct; keep).
- `index.html:31-76` — first JSON-LD block starts:

```json
  {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "name": "Spectrum Counseling",
    ...
    "telephone": "+1-480-782-0113",
    "address": { ... },
    "geo": { ... },
    "openingHours": "Mo-Fr 09:00-17:00",
    "priceRange": "$$",
    "areaServed": [...],
    "hasOfferCatalog": { ... },
    "founder": { ... },
    "sameAs": [...]
  }
```

- `privacy/index.html` and `terms/index.html` heads have `<title>`,
  description, canonical, `og:title`, `og:site_name`, `og:image` — but no
  `og:url`, `og:type`, `og:description`, or `twitter:*` tags.
- Pages with `og:image` (all five content pages) have no `og:image:alt`.
- There is no `robots.txt` in the repo.
- Live-site facts (verified 2026-06-12): `www.` 301s to apex; sitemap serves
  200; robots.txt 404s.

## Scope

**In scope**:
- `robots.txt` (create)
- `sitemap.xml`
- `index.html` (JSON-LD block + `og:image:alt` only)
- `contact/index.html`, `new-client-form/index.html` (`og:image:alt` only)
- `privacy/index.html`, `terms/index.html` (head meta additions only)

**Out of scope**:
- The `noindex` on the form page (correct as-is), the FAQPage JSON-LD block,
  the `meta keywords` tag (ignored by engines; leave it), `404.html`, any
  visible page content, CSS, or JS.

## Git workflow

- Branch `advisor/007-seo` unless told otherwise; single-line imperative
  commit message (repo convention).

## Steps

### Step 1: Create `robots.txt` at the repo root

```
User-agent: *
Allow: /

Sitemap: https://spectrumcounseling.net/sitemap.xml
```

**Verify**: `Test-Path robots.txt` → True.

### Step 2: Rewrite `sitemap.xml`

Replace the whole file with four entries — `/`, `/contact/`, `/privacy/`,
`/terms/` (the noindex'd form page is removed). Use `<lastmod>2026-06-12</lastmod>`
on every entry; drop `<priority>` and `<changefreq>` (ignored by Google):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://spectrumcounseling.net/</loc>
    <lastmod>2026-06-12</lastmod>
  </url>
  <url>
    <loc>https://spectrumcounseling.net/contact/</loc>
    <lastmod>2026-06-12</lastmod>
  </url>
  <url>
    <loc>https://spectrumcounseling.net/privacy/</loc>
    <lastmod>2026-06-12</lastmod>
  </url>
  <url>
    <loc>https://spectrumcounseling.net/terms/</loc>
    <lastmod>2026-06-12</lastmod>
  </url>
</urlset>
```

**Verify**: `[xml](Get-Content sitemap.xml -Raw)` parses without error;
`git grep -n "new-client-form" sitemap.xml` → 0 matches.

### Step 3: Upgrade the landing-page JSON-LD

In `index.html`'s first JSON-LD block:
- `"@type": "ProfessionalService"` → `"@type": "Psychologist"`
- Add three properties (e.g. after `"telephone"`):

```json
    "email": "mhaddox@spectrumcounseling.net",
    "image": "https://spectrumcounseling.net/assets/sc_og_image.png",
    "logo": "https://spectrumcounseling.net/assets/SC_logo.png",
```

Change nothing else in the block. Do NOT touch the second (FAQPage) block.

**Verify**: extract the block and parse it as JSON (e.g. save the text
between the first `<script type="application/ld+json">` and its `</script>`
to a temp file under `$env:TEMP`, then `Get-Content | ConvertFrom-Json`) →
parses, `@type` is `Psychologist`.

### Step 4: Fill the OG/Twitter gaps

1. In `privacy/index.html` and `terms/index.html`, after the existing
   `og:site_name` line, add (with the page's own URL and description text
   copied from its existing `name="description"` meta):

```html
  <meta property="og:description" content="<page's existing meta description text>" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://spectrumcounseling.net/<privacy|terms>/" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="<page's existing og:title text>" />
  <meta name="twitter:image" content="https://spectrumcounseling.net/assets/sc_og_image.png" />
```

2. In all five content pages (`index.html`, `contact/index.html`,
   `new-client-form/index.html`, `privacy/index.html`, `terms/index.html`),
   directly after the `og:image` meta line, add:

```html
  <meta property="og:image:alt" content="Spectrum Counseling — therapy practice of Marie Haddox, Ph.D. in Gilbert, AZ" />
```

**Verify**:
- `git grep -c "og:image:alt" -- "*.html"` → 5 files, 1 each.
- `git grep -n "og:url" privacy/index.html terms/index.html` → 1 match each.

## Test plan

No automated tests exist. The verifications above plus, post-deploy
(operator/reviewer): `https://spectrumcounseling.net/robots.txt` returns 200,
and Google's Rich Results Test on the homepage recognizes the `Psychologist`
local-business markup (or validator.schema.org parses it cleanly).

## Done criteria

- [ ] `robots.txt` exists with the `Sitemap:` line
- [ ] `sitemap.xml` parses as XML, has 4 URLs with `lastmod`, no form page
- [ ] JSON-LD block parses as JSON with `@type: Psychologist`, `email`, `image`, `logo`
- [ ] `og:image:alt` present on all five content pages
- [ ] `privacy/` and `terms/` have `og:url`, `og:type`, `og:description`, twitter tags
- [ ] No visible-content, CSS, or JS lines changed (`git diff` shows head/meta + new files only)
- [ ] `plans/README.md` status row updated (unless reviewer maintains it)

## STOP conditions

- The JSON-LD block doesn't match the excerpt (drift).
- Editing the JSON-LD produces unparseable JSON after one fix attempt.
- Any step seems to require touching page body content.

## Maintenance notes

- When pages are added or meaningfully edited, update `sitemap.xml`
  `lastmod` — CLAUDE.md's Pages table already notes the sitemap.
- Registering the site in Google Search Console and submitting the sitemap
  is a manual operator follow-up this plan cannot do.
- Deferred: `Psychologist`-specific properties like `medicalSpecialty`, and
  BreadcrumbList markup — marginal value for a 5-page site.
