# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spectrum Counseling is a static website for Dr. Marie Haddox's therapy practice in Gilbert, AZ. It is hosted on GitHub Pages and deployed automatically on push to `master` via `.github/workflows/static.yml`.

**Live site:** https://spectrumcounseling.net/

## Architecture

- **Pure static site** — no build step, no bundler, no package manager. HTML files are served directly.
- **Tailwind CSS** via CDN (`cdn.tailwindcss.com`) with an inline `tailwind.config` block in each HTML file defining custom design tokens (colors, fonts, spacing).
- **Fonts:** Google Fonts (Noto Serif + Manrope) for body text; local `assets/fonts/Soria-Bold.otf` for display use.
- **Icons:** Material Symbols Outlined via Google Fonts CDN.
- **No JavaScript framework** — vanilla JS only, inline in each page.

### Pages

| File | Purpose |
|---|---|
| `index.html` | Landing page — hero, services, about, testimonials, FAQ, location |
| `contact/index.html` | Contact page (phone/email/address cards — no form) |
| `new-client-form/index.html` | Multi-step intake form with client info, consent, HIPAA acknowledgment |
| `privacy/index.html` | Privacy policy |
| `terms/index.html` | Terms of service |
| `404.html` | Not-found page |
| `sitemap.xml` | Sitemap (update when adding indexed pages) |

### Backend (Google Apps Script)

`google-apps-script/Code.gs` — Deployed manually as a Google Apps Script web app (NOT deployed by GitHub Actions; changes require a new deployment version in script.google.com). Receives POST submissions from `new-client-form/index.html`, verifies a Cloudflare Turnstile token (secret read from the `TURNSTILE_SECRET` Script Property), applies spam checks (honeypot, timing, per-email rate limit), builds the intake as an HTML string (`buildHtml()`), renders it to a PDF via the Cloudflare Browser Rendering REST API (`renderPdf()` — real headless Chrome, `printBackground`+`preferCSSPageSize` so brand colors/rules/fills render; token in the `CF_BROWSER_TOKEN` Script Property, account in `CONFIG.CF_ACCOUNT_ID`), and emails it to the practice via GmailApp. It deliberately uses neither DocumentApp nor DriveApp — the former Docs-based pipeline failed on Google-side Docs disruptions twice (see `plans/009`, `plans/011`, `plans/013`); do not reintroduce a temp Doc. Responds with JSON (`{ok: true/false, reason}`). If PDF rendering fails, the client's data is emailed as plain text instead (subject "INTAKE FORM ERROR").

`google-apps-script/Code.test.js` — zero-dependency contract tests (`node --test google-apps-script/Code.test.js`) that load `Code.gs` into a `vm` sandbox with stubbed Google services. Run them after any `Code.gs` change; the `doPost` test has no `DocumentApp`/`DriveApp` in scope on purpose.

### Reference Design

`stitch_spectrum_counseling_landing_page/` contains the original AI-generated design mockup (`code.html`, `screen.png`) and its `DESIGN.md` specification ("Editorial Serenity" design system). Use this as the design reference for color palette, typography pairing, spacing philosophy, and component patterns. Note: this folder is intentionally untracked local reference material — it is not in git and not deployed.

## Design System Key Rules

These rules from the design spec should be followed when editing any page:

- **No borders for sectioning** — use background color shifts between surface tones instead of `border` properties.
- **No horizontal rules** — separate content with spacing or alternating background colors.
- **No pure black** — use `on-surface` (#2d3335) instead of #000000.
- **Generous whitespace** — when in doubt, add more vertical spacing between sections.
- **Rounded corners** — minimum `md` (0.75rem) on all elements; `xl` (1.5rem) for content cards.
- **Typography:** Noto Serif for headlines/display, Manrope for body/UI text.
- **Color palette:** Soft therapeutic blues and greys. Primary is #567a96. See `tailwind.config` in each HTML file for the full token set.

## Deployment

Push to `master` triggers GitHub Actions to deploy. No build command needed — the workflow uploads the repo contents directly to GitHub Pages.

The domain is fronted by Cloudflare. Two consequences: (1) the live `/robots.txt` is the repo file with a Cloudflare "Managed robots.txt" block prepended (blocks AI-training crawlers; Googlebot/Bingbot unaffected) — that block is controlled from the Cloudflare dashboard, not this repo; (2) redirects for legacy URLs from the previous site must be done as Cloudflare Redirect Rules — GitHub Pages has no server-side redirect mechanism (see `plans/012`).

Icons: every page loads a single shared Material Symbols subset URL (`icon_names=…`, alphabetical). If you add an icon anywhere — in markup or set from JS like `light_mode` — add its name to that URL on all six pages or it will render as text.

## Development

Open any HTML file directly in a browser for local preview. No dev server required. For the intake form backend, the Google Apps Script must be deployed separately per the instructions in `Code.gs`; run `node --test google-apps-script/Code.test.js` first. To preview the intake PDF layout locally, dump `buildHtml(sample)` to a file and print it with headless Chrome (`--headless=new --print-to-pdf=…`); the HTML is the source of truth for the layout, though Google's converter may differ slightly from Chrome.
