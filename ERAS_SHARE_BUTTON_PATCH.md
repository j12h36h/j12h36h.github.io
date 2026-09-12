# E.R.A.S. Floating Share Button Patch

Target: `j12h36h/j12h36h.github.io`

## What it adds
- Floating share button on the E.R.A.S. Universe page.
- Native Web Share sheet on supported phones/tablets.
- Clipboard-copy fallback when Web Share is unavailable.
- iPhone/iPad safe-area spacing.
- Button remains in the same viewport position while content moves behind it.
- No service worker, routing, authentication, PWA manifest, or existing runtime behavior is changed.

## Placement
The control intentionally does **not** touch the bottom-right corner.

Desktop:
- 22px from the right
- 24px from the bottom
- 42px control

Mobile:
- 16px from the right
- 18px from the bottom
- 40px control

`env(safe-area-inset-*)` is added automatically on devices such as iPhones.

## Install
Extract this ZIP over the repository root and allow `index.html` to replace the existing root file.

Added:
- `assets/css/share-button.css`
- `assets/js/share-button.js`

Updated:
- `index.html`
