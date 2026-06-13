# Plan 008: Load both theme heroes eagerly again so the theme-toggle crossfade is smooth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on.
> Touch only the file in scope. If any STOP condition occurs, stop and
> report — do not improvise. When done, update the status row in
> `plans/README.md` — unless a reviewer dispatched you and maintains the index.
>
> **Drift check (run first)**: `git diff --stat 0438c6a..HEAD -- index.html`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/003-optimize-images.md (DONE — this partially relaxes its hero-deferral)
- **Category**: bug (UX regression from plan 003)
- **Planned at**: commit `0438c6a`, 2026-06-12

## Why this matters

Plan 003 deferred the inactive theme's hero image (no `src` until first
toggle) back when the heroes were 698 KB and 2,159 KB JPEGs. Now they are
114 KB and 26 KB WebPs, and the deferral causes a visible regression the
owner reported: toggling the theme starts a network fetch mid-crossfade, so
the hero pops in instead of fading smoothly. Loading both eagerly costs
~140 KB total and restores the original smooth transition. Keep a
`fetchpriority` hint so the visible hero still loads first.

## Current state

`index.html` at commit `0438c6a`:

- Hero markup + activation script, lines 722-731:

```html
      <div class="relative w-full h-[45%] sm:h-full">
        <img id="hero-light" alt="Serene water lily pond — Spectrum Counseling Gilbert AZ therapy practice" class="absolute inset-0 w-full h-full object-cover" data-src="assets/hero.webp" />
        <img id="hero-dark" alt="Lotus flowers at dusk — Spectrum Counseling dark theme" class="absolute inset-0 w-full h-full object-cover opacity-0" data-src="assets/hero-dark.webp" />
        <script>
(function(){
  var dark = document.documentElement.classList.contains('dark');
  var img = document.getElementById(dark ? 'hero-dark' : 'hero-light');
  if (img) { img.src = img.getAttribute('data-src'); img.setAttribute('fetchpriority','high'); }
})();
</script>
      </div>
```

- `updateHero` in the theme-toggle IIFE, lines 1678-1688:

```js
      function updateHero(dark) {
        if (heroLight && heroDark) {
          var active = dark ? heroDark : heroLight;
          var inactive = dark ? heroLight : heroDark;
          if (!active.src && active.getAttribute('data-src')) {
            active.src = active.getAttribute('data-src');
          }
          active.style.opacity = '1';
          inactive.style.opacity = '0';
        }
      }
```

- The theme is set on `<html>` by an inline `<head>` script before paint, so
  `document.documentElement.classList.contains('dark')` is reliable at hero
  parse time.
- Conventions: ES5 (`var`, IIFEs), no frameworks.

## Scope

**In scope**: `index.html` only — the hero `<img>` tags, the inline script
between them and `</div>`, and the `updateHero` function.

**Out of scope**: every other image (lazy-loading from plan 003 stays), the
rest of the theme-toggle code, all other pages, all assets.

## Git workflow

- Branch `advisor/008-dual-hero` unless told otherwise; single-line
  imperative commit message (repo convention).

## Steps

### Step 1: Restore eager `src` on both hero images

Change lines 723-724 so both `<img>` tags have `src` (not `data-src`)
pointing at the same `.webp` files, everything else unchanged:

```html
        <img id="hero-light" alt="Serene water lily pond — Spectrum Counseling Gilbert AZ therapy practice" class="absolute inset-0 w-full h-full object-cover" src="assets/hero.webp" />
        <img id="hero-dark" alt="Lotus flowers at dusk — Spectrum Counseling dark theme" class="absolute inset-0 w-full h-full object-cover opacity-0" src="assets/hero-dark.webp" />
```

### Step 2: Repurpose the inline script as a priority hint

Replace the inline script body (keep the `<script>` element and IIFE shape)
so it no longer sets `src` — it only sets fetch priority: `high` on the
active theme's hero, `low` on the inactive one:

```html
        <script>
(function(){
  var dark = document.documentElement.classList.contains('dark');
  var active = document.getElementById(dark ? 'hero-dark' : 'hero-light');
  var inactive = document.getElementById(dark ? 'hero-light' : 'hero-dark');
  if (active) active.setAttribute('fetchpriority', 'high');
  if (inactive) inactive.setAttribute('fetchpriority', 'low');
})();
</script>
```

(Note: the hint may arrive after the preload scanner has started both
fetches — that's acceptable; it's a hint, not a gate.)

### Step 3: Simplify `updateHero` back to a pure opacity swap

```js
      function updateHero(dark) {
        if (heroLight && heroDark) {
          heroLight.style.opacity = dark ? '0' : '1';
          heroDark.style.opacity = dark ? '1' : '0';
        }
      }
```

**Verify (all steps)**:
- `git grep -n "data-src" index.html` → 0 matches.
- `git grep -n 'src="assets/hero.webp"' index.html` → 1 match; same for `hero-dark.webp`.
- `git grep -c "fetchpriority" index.html` → 2 (both in the inline script).

### Step 4: Manual browser check

Open `index.html` locally. DevTools → Network → Img filter, reload:
BOTH `hero.webp` and `hero-dark.webp` download. Toggle the theme several
times: the crossfade is smooth with no pop-in or blank frame in either
direction. Check starting from both light and dark system themes.

## Test plan

The Step 4 manual check is the test. No automated tests exist.

## Done criteria

- [ ] Both hero `<img>` tags have eager `src`; no `data-src` remains in `index.html`
- [ ] `updateHero` contains no `src` logic
- [ ] Both heroes download on page load; theme crossfade is smooth both ways (manual)
- [ ] No files outside `index.html` modified (`git status`)
- [ ] `plans/README.md` status row updated (unless reviewer maintains it)

## STOP conditions

- The code at lines 722-731 / 1678-1688 doesn't match the excerpts (drift).
- The change appears to require touching other pages or assets.

## Maintenance notes

- This intentionally trades ~140 KB of extra initial download for toggle
  smoothness — a deliberate owner decision (2026-06-12) reversing part of
  plan 003. Do not "re-optimize" it away without asking the owner.
- If heroes are ever replaced with larger files, revisit: past ~300 KB per
  image the deferral trade-off flips back.
