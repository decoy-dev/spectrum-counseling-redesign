# 010 — Intake PDF readability: darken light text (2026-08-26)

**Status: DONE** (code merged to master at `81ebe92`). Operator follow-up
pending: redeploy Apps Script (new version) + one test submission to verify
the real Google-rendered PDF.

Retrospective, written after the change, so the decision and the preview
method aren't lost.

## Complaint

The generated intake PDF (`google-apps-script/Code.gs`, built programmatically
via `DocumentApp` → PDF export — no Docs template) had text that was "too light
and hard to read against the background." The offenders were the low-contrast
greys in the `BRAND` palette:

| Element | Old color | Contrast on white | Where |
|---|---|---|---|
| Field labels (7pt bold) | `#888888` labelGrey | ~3.5:1 | every field, `styleFieldCell` / `addFieldFull` |
| "INITIALS" label (6pt) | `#888888` labelGrey | ~3.3:1 on `#f5f7f8` | `addAckItem` |
| Footer (8pt) | `#999999` footerGrey | ~2.9:1 | `buildDocument` footer |
| Muted body (9.5–11pt) | `#5a6062` textMuted | ~6.4:1 | notice box, HIPAA, instruction |
| Section head + initials (12pt bold) | `#567a96` primary | ~4.2:1 on `#f5f7f8` | `addSectionHeader`, `addAckItem` |

The field **values** were already near-black (`#2d3335`) and fine.

## Decision

Three color-only palettes were prototyped first (neutral / on-brand blue /
warm), each darkening the greys to mid-charcoal (~7:1). **Owner rejected them
as "extremely similar to the original, still has the same issues."** The
lesson: a passing WCAG ratio is not the same as *looking* dark — a 7pt grey
label reads as "light" to the eye even at 7:1, and since the values didn't
change, the page barely shifted.

Second pass went decisively dark and was accepted (option "A2 Neutral / max
contrast"): stop using light grey for text at all.

## What shipped (`Code.gs`, commit `81ebe92`)

`BRAND` palette retuned; brand blue `primary #567a96` kept ONLY for the 20pt
title, 14pt form title, and the divider rules.

| Key | Old | New | Role |
|---|---|---|---|
| labelGrey | `#888888` | `#242424` | field labels, address, "Submitted", INITIALS label (~15:1) |
| textMuted | `#5a6062` | `#2c2f31` | intro, instruction, HIPAA, notice body (~13:1) |
| textDark | `#2d3335` | `#1f2223` | field values, ack statements, notice heading (~15:1) |
| footerGrey | `#999999` | `#333333` | footer text |
| ruleLight | `#d0d0d0` | `#767676` | footer hairline + notice border (survives export/print) |
| primaryDark | `#365671` | `#2f4a63` | section-header text + initials (was the light `primary`) |
| bgLight | `#f5f7f8` | `#eef2f4` | notice / initials cell background |

Non-color changes (within accessibility caps — see below):
- Field labels 7pt → **8pt** (`styleFieldCell`, `addFieldFull`).
- "INITIALS" label 6pt → **7pt** (`addAckItem`).
- `addSectionHeader` + `addAckItem` initials now use `primaryDark`, not `primary`.

Unchanged: Times New Roman everywhere, the whole table/paragraph tree, field
order, padding, alignment, the intentional 1pt spacer/rule sizing, the em-dash
empty-field fallback, the notice-box substring bold/color styling, and all
legal/clinical wording.

## How it was previewed (reusable method)

`DocumentApp` only runs on Google's servers, so there is **no local way to get
Google's exact PDF**. To iterate on look without redeploying every time, the
form layout was reproduced faithfully in HTML/CSS (same point sizes, tables,
0.75in margins, sample data with some blank fields to show the em dash), one
palette per file, then printed to PDF with headless Chrome:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=out.pdf "file://.../preview.html"
```

Contrast ratios were computed with real WCAG relative-luminance math and
verified by pixel-sampling the rendered PNGs (label ink went `RGB(136,136,136)`
→ `(36,36,36)`). This is a high-fidelity **approximation for judging
contrast**, not a byte-exact copy of Google's export (wrapping/pagination may
differ slightly). The preview scaffolding was scratch and was NOT committed.

## Lessons / standing rules

- **WCAG ratio ≠ perceived darkness.** Grey reads as "light" regardless of the
  number. For "too light" complaints, go near-black, don't chase the minimum
  ratio. Sol optimized for the ratio and produced a too-timid first pass.
- **`DocumentApp` has no letter-spacing** (and no semibold). Don't design the
  PDF around CSS features the API can't reproduce; the preview must stay within
  what `DocumentApp` can do or it over-promises.
- **Safe accessibility caps for this layout** (from the design advisor): field
  labels ≤ 8pt, INITIALS label ≤ 7pt, footer stays 8pt, don't enlarge body
  copy — enlarging beyond this risks label wrap and pagination shift in the
  fixed two-column tables. Prefer darkening color over resizing.
- **The deployment still pins a version** (see 009). Repo is source of truth:
  edit here → paste into the browser editor → Manage deployments → New version.

## Operator follow-ups (outside the repo)

- [ ] Redeploy Apps Script from the new `Code.gs` (Manage deployments → New
      version, same URL).
- [ ] Submit one test intake and eyeball the real Google-rendered PDF — the
      exact-renderer check the local preview can't give.
