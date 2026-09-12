# E.R.A.S. Floating Action Menu Patch

Target: `j12h36h/j12h36h.github.io`

## Changes
Replaces the single-purpose floating share concept with one floating menu toggle.

Menu actions:
- Share
- Install

## Share
Uses the native Web Share sheet when available.
Falls back to copying the current URL.

## Install
- Android / Chromium: invokes the browser's real PWA install prompt when `beforeinstallprompt` is available.
- iPhone / iPad: shows Safari instructions for `Share → Add to Home Screen → Open as Web App → Add`.
- Already-installed standalone mode: shows `Installed`.

## Position
The menu toggle remains fixed to the viewport, slightly inset from the bottom-right edge, and respects iOS safe-area insets.

## Files
Added:
- `assets/css/action-menu.css`
- `assets/js/action-menu.js`

Updated:
- `index.html`

## Install this patch
Extract the ZIP over the repository root and replace `index.html` when prompted.
