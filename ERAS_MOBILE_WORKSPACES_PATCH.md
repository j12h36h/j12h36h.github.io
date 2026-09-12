# E.R.A.S. Mobile Portrait + Landscape Workspaces Patch

This patch is designed for the current `j12h36h/j12h36h.github.io` site.

## What changes

### Site-wide mobile landscape layer
A shared orientation stylesheet is loaded through the standard account/site chrome and is also loaded last on the Universe homepage and the three creator editors.

It improves:
- safe-area spacing on iPhone/Android landscape
- compact fixed header behavior
- frame sizing
- dialogs in short landscape viewports
- horizontal overflow prevention
- common landing/workspace behavior

### Universe homepage landscape
The radial Universe view gets a dedicated phone-landscape geometry instead of inheriting desktop/portrait positions.

The social dashboard begins below the first landscape viewport, so the homepage remains scrollable instead of clipping the Universe.

### Simple Animation Designer
Portrait:
- preview remains the primary workspace
- bottom mobile dock: View / Actions / Source / Info
- JSON source and engine/media information open as modular bottom sheets

Landscape:
- preview uses nearly the full screen
- dock moves to a right-side rail
- Source opens from the left
- Info opens from the right
- Actions open as a compact bottom module

### DRAW / Creative Graphic Editor
Portrait:
- canvas-first workspace
- bottom dock: Canvas / Tools / Layers / Frames / Actions
- tools and properties become expandable modular sheets
- zoom/fit/grid controls stay directly attached to the canvas viewport

Landscape:
- canvas gets maximum horizontal room
- dock becomes a right rail
- Tools slide from the left
- Layers/Frames slide from the right
- Actions become a bottom module

The existing pointer-event drawing engine is preserved.

### CODE / Advanced Text Editor
Portrait:
- editor-first workspace
- bottom dock: Editor / Files / Actions / Inspect / Output
- explorer, inspector and output become modular sheets

Landscape:
- editor gets the center width
- Files slide from left
- Inspector slides from right
- Actions/Output become bottom modules
- tabs/status bar remain touch-scrollable

### Rotation / mobile keyboard behavior
The shared controller tracks the visual viewport so workspaces resize around mobile browser chrome and virtual keyboards.
DRAW automatically re-runs FIT after rotation/resizing.

## Compatibility
Desktop layouts are unchanged.
The same existing buttons, inputs, lists and editor engines are reused; this patch changes mobile presentation instead of forking functionality.

## Also preserved
This ZIP includes the earlier floating homepage action menu with:
- Share
- Install

So this patch supersedes the earlier Action Menu patch.

## Install
Extract the ZIP over the repository root and allow replacement of:
- `index.html`
- `account/assets/css/account-button.css`
- `animation-engine/index.html`
- `draw/index.html`
- `code/index.html`

New shared files:
- `assets/css/mobile-orientation.css`
- `assets/js/mobile-creator-workspace.js`

Also included from the prior patch:
- `assets/css/action-menu.css`
- `assets/js/action-menu.js`
