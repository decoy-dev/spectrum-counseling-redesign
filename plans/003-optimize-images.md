# Plan 003: Cut landing-page image payload from ~4 MB to under 1 MB

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8f2e6b..HEAD -- index.html contact/index.html new-client-form/index.html privacy/index.html terms/index.html 404.html assets/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (content-only: compression + attributes; no layout changes)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `e8f2e6b`, 2026-06-12

## Why this matters

Every visitor to the landing page downloads **both** theme heroes —
`assets/hero.jpg` (698 KB, light) and `assets/hero-dark.jpg` (2,159 KB,
dark) — because both `<img>` tags have `src` set; the inactive one is merely
`opacity-0`. Below the fold sit more multi-hundred-KB JPEGs, and only one
image in the whole site has `loading="lazy"`. Total image payload is ~4 MB
on a page whose audience largely arrives on phones. After this plan: one
hero loads initially, all assets are recompressed (WebP), below-fold images
are lazy, and first paint on mobile improves dramatically.

## Current state

- Asset sizes (bytes): `hero-dark.jpg` 2,159,090; `hero-office.jpg` 951,462
  (check whether referenced at all — see Step 1); `hero.jpg` 697,818;
  `about-hero.jpg` 630,268; `sc_og_image.png` 521,739;
  `office-exterior.jpg` 415,960; `contact-hero.jpg` 222,142;
  `specialties-hero.jpg` 197,378; `certificate.jpg` 189,292; `room.webp`
  73,762 (already WebP — the precedent).
- The double-hero, `index.html:718-721`:

```html
      <div class="relative w-full h-[45%] sm:h-full">
        <img id="hero-light" alt="Serene water lily pond — Spectrum Counseling Gilbert AZ therapy practice" class="absolute inset-0 w-full h-full object-cover" src="assets/hero.jpg" />
        <img id="hero-dark" alt="Lotus flowers at dusk — Spectrum Counseling dark theme" class="absolute inset-0 w-full h-full object-cover opacity-0" src="assets/hero-dark.jpg" />
      </div>
```

- The theme is decided by an inline `<head>` script that toggles the
  `dark`/`light` class on `<html>` before paint (`index.html` head, same
  pattern as `new-client-form/index.html:19`). A theme-toggle IIFE later in
  each page swaps the logo image on toggle — the hero swap should hook the
  same place. Find it with `git grep -n "updateLogo" index.html`.
- Only one `loading="lazy"` exists in `index.html` (line ~1065). Other
  pages (`contact/index.html`, etc.) also reference large JPEGs eagerly.
- `sc_og_image.png` is the OG/social image referenced by absolute URL in
  every page's meta tags — it must **stay PNG at the same path** (scrapers
  have it cached by URL).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Check ImageMagick | `magick -version` | version string (if absent, use `npx sharp-cli` per Step 2) |
| Convert one image | `magick assets/hero.jpg -resize "1920x>" -quality 80 assets/hero.webp` | exit 0, `.webp` created |
| Sizes after | `Get-ChildItem assets -File \| Sort-Object Length -Descending \| Select-Object Name, Length` | no non-OG raster asset over ~300 KB |
| Find stale refs | `git grep -n "hero.jpg\|hero-dark.jpg\|about-hero.jpg\|contact-hero.jpg\|specialties-hero.jpg\|certificate.jpg\|office-exterior.jpg\|hero-office.jpg"` | 0 matches after Step 3 |

No build step exists; pushing to `master` deploys via GitHub Pages.

## Scope

**In scope**:
- `assets/*.jpg`, `assets/sc_og_image.png` (recompress; jpgs may be replaced by `.webp`)
- `index.html`, `contact/index.html`, `new-client-form/index.html`,
  `privacy/index.html`, `terms/index.html`, `404.html` — image `src`
  references and `loading`/`decoding`/`fetchpriority` attributes only.

**Out of scope**:
- `assets/SC_logo.png`, `SC_logo_white.png`, `favicon*.png` — small, and the
  logo swap logic references them by name in JS on every page.
- `assets/fonts/`, `assets/room.webp` (already optimized).
- Any layout, class, or design change. Alt text stays as-is.
- `stitch_spectrum_counseling_landing_page/` (untracked reference material).

## Git workflow

- Branch `advisor/003-optimize-images` unless told to work on `master`.
- Single-line imperative commit messages (repo convention).

## Steps

### Step 1: Inventory which assets are actually referenced

`git grep -n "assets/" -- "*.html"` and list which of the large JPEGs are
referenced from tracked HTML. Any large asset referenced by **zero** pages
(candidate: `hero-office.jpg`) gets deleted instead of converted — note it
in your report.

**Verify**: you have a referenced/unreferenced list covering every file in
`assets/` over 100 KB.

### Step 2: Convert referenced JPEGs to WebP

For each referenced `.jpg`: resize to max 1920px wide, quality ~80, output
`.webp` alongside, then delete the `.jpg`:

```
magick assets/<name>.jpg -resize "1920x>" -quality 80 assets/<name>.webp
```

If ImageMagick is unavailable: `npx sharp-cli --input assets/<name>.jpg --output assets/<name>.webp resize 1920 --withoutEnlargement -- --quality 80`
(or any equivalent; the requirement is WebP, ≤1920px wide, visually clean).

Recompress `sc_og_image.png` in place as PNG (e.g.
`magick assets/sc_og_image.png -resize "1200x>" -strip assets/sc_og_image.png`)
— same filename, same format.

**Verify**: the size-listing command shows no converted asset above ~300 KB
(heroes may be up to ~350 KB if quality suffers below that — eyeball them).

### Step 3: Update every HTML reference

Replace each `assets/<name>.jpg` reference with `assets/<name>.webp` across
all six HTML files (remember `contact/`, `new-client-form/`, etc. use
`../assets/` paths).

**Verify**: the "find stale refs" grep → 0 matches in `*.html`.

### Step 4: Load only the active theme's hero

In `index.html`:

1. Remove `src` from both hero `<img>` tags; put the path in `data-src`.
2. Immediately after the two `<img>` tags, add a tiny inline script that
   sets `src` on the hero matching the already-decided theme class:

```html
<script>
(function(){
  var dark = document.documentElement.classList.contains('dark');
  var img = document.getElementById(dark ? 'hero-dark' : 'hero-light');
  if (img) { img.src = img.getAttribute('data-src'); img.setAttribute('fetchpriority','high'); }
})();
</script>
```

3. In the theme-toggle code (the function that calls `updateLogo`), add a
   step that, on toggle, sets `src` from `data-src` on the newly active hero
   if it has no `src` yet. Match the surrounding code style (plain ES5 IIFE,
   `var`, no frameworks).

**Verify**: open `index.html` in a browser (light system theme), DevTools →
Network → filter Img: `hero.webp` loads, `hero-dark.webp` does NOT. Toggle
the theme: `hero-dark.webp` loads and displays. Repeat starting in dark
mode.

### Step 5: Lazy-load below-the-fold images

Add `loading="lazy" decoding="async"` to every `<img>` that is not the
active hero or the nav logo, across all six pages. Do not add it to the two
hero `<img>` tags (the inactive one already has no `src`).

**Verify**: `git grep -c "loading=\"lazy\"" index.html` → ≥ 8;
spot-check `contact/index.html` similarly.

### Step 6: Full visual pass

Open all six pages locally in both themes. Every image renders, no broken
`src`, heroes look visually equivalent to before (compare against
`git stash` / the previous commit if unsure).

## Test plan

No automated tests exist. The test is Step 4's network-tab check plus Step
6's visual pass, in both themes, on all six pages. Record before/after total
image bytes for the landing page in your report (target: <1 MB initial).

## Done criteria

- [ ] No `.jpg` references remain in any tracked `*.html`
- [ ] No raster asset (except logos/favicons/OG) exceeds ~300 KB
- [ ] Landing page initial load fetches exactly one hero image per theme
- [ ] `sc_og_image.png` still exists as PNG at the same path
- [ ] All six pages visually intact in both themes
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- `index.html:718-721` doesn't match the excerpt (drift).
- WebP output looks visibly degraded at quality 80 even at quality 90 —
  report rather than shipping ugly heroes.
- The theme-toggle code structure differs enough that the hero-swap hook
  point isn't clear.
- You find a page or script referencing an image by a name you'd delete
  (e.g. the logo swap pattern) — re-check Scope before deleting anything.

## Maintenance notes

- Future images should be added as WebP ≤1920px; consider noting this in
  CLAUDE.md (plan 005 touches that file — coordinate if both run).
- WebP is supported by all browsers since ~2020; no fallback `<picture>`
  needed for this audience.
- Deferred: responsive `srcset` variants — real win on mobile but triples
  asset bookkeeping with no build step; revisit only if mobile metrics
  still lag.
