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

`google-apps-script/Code.gs` — Deployed manually as a Google Apps Script web app (NOT deployed by GitHub Actions; changes require a new deployment version in script.google.com). Receives POST submissions from `new-client-form/index.html`, verifies a Cloudflare Turnstile token (secret read from the `TURNSTILE_SECRET` Script Property), applies spam checks (honeypot, timing, per-email rate limit), builds the intake PDF programmatically with DocumentApp (`buildDocument()`), emails it to the practice via GmailApp, then trashes the temp doc. Responds with JSON (`{ok: true/false, reason}`), which the form's fetch handler reads to show success or an error.

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

## Development

Open any HTML file directly in a browser for local preview. No dev server required. For the intake form backend, the Google Apps Script must be deployed separately per the instructions in `Code.gs`.
