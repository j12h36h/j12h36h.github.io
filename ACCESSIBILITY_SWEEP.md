# E.R.A.S. Website Accessibility Sweep — 2026-09-06

## Goal

This patch establishes a site-wide accessibility foundation aimed at WCAG 2.2 Level AA across the E.R.A.S. Universe, browser game, mobile game, LCS desktop/mobile, Content/Trade/Account surfaces, Simple Animation Designer, DAI, and remaining legacy static pages.

It is a code-and-design remediation pass, not a certification claim. Final conformance still requires browser + assistive-technology testing with real users and representative workflows.

## Problems confirmed during the sweep

### Keyboard and focus
- Several component styles remove the native outline and replace it with subtle border/glow changes.
- Focus styling is not consistent across the site families.
- Fixed/sticky headers can make focused controls harder to see after keyboard navigation.
- Chat already exposes `role="dialog"` and `aria-modal="true"`, but the shared dialog did not itself guarantee focus trapping and focus restoration.

### Motion / vestibular accessibility
- The E.R.A.S. visual language uses continuous orbit, ring, glow, and transition animation.
- Some game JavaScript already respects `prefers-reduced-motion`, but the policy was not shared across all site families.

### Contrast / low vision
- Most major text colors are strong, but multiple pieces of tiny terminal/status text use colors below 4.5:1 against their dark backgrounds.
- Examples found during the sweep included `#55777a` on `#02090b` (~4.11:1), `#4e6b6e` on `#02090b` (~3.49:1), and `#587a7d` on `#02090b` (~4.30:1).

### Zoom and reflow
- The shared Universe stylesheet uses `body { overflow:hidden; }` and fixed viewport-height presentation on the landing surfaces.
- This can clip content on short viewports and when browser zoom effectively reduces the CSS viewport.
- True game canvases still need intentional fixed-screen behavior, so the remediation only relaxes clipping for non-game Universe/Play landing surfaces.

### Touch / motor accessibility
- Mobile forms generally already use large 48px fields, but target sizing is inconsistent elsewhere.
- The shared layer guarantees the WCAG 2.2 24px minimum for common controls and expands common controls to 44px on coarse-pointer/touch devices.

### Forms and status feedback
- A number of controls are correctly wrapped in labels, but some dynamically created textareas/inputs rely only on placeholders.
- Several dynamic feedback regions visually update without a consistent live-region policy.

### Legacy markup
- `media.html`, `play.html`, and `watchlist.html` placed navigation links outside `<body>` and lacked consistent landmarks.
- These pages are normalized in this patch.

## What this patch changes

### `/assets/css/accessibility-core.css`
- Strong two-tone `:focus-visible` indicator that overrides local `outline:none` rules.
- Scroll margins/padding to reduce focus being hidden behind sticky headers.
- 24px minimum control targets; 44px targets on coarse-pointer devices.
- Shared reduced-motion handling through `prefers-reduced-motion`.
- `prefers-contrast: more` and Windows forced-colors support.
- Raises known low-contrast microtext/status selectors.
- Makes zoomed/narrow Universe landing pages scroll rather than clip.
- Keeps Chat usable at small viewport heights and browser zoom.

### `/assets/js/accessibility.js`
- Injects the accessibility stylesheet once per page.
- Adds a keyboard-visible “Skip to main content” link when a `<main>` landmark exists.
- Adds fallback accessible names only to otherwise-unlabelled form controls that have a placeholder/title.
- Adds polite live-region semantics to known dynamic feedback/status regions.
- Synchronizes `aria-pressed` for known button-based view/toggle controls.
- Detects modal dialogs, traps Tab focus inside open `aria-modal` dialogs, focuses the first usable control, and restores focus to the opener when the dialog closes.
- Exposes the current reduced-motion preference on the root document for future game/runtime code.

### Shared loaders
- `/assets/js/credit-system.js` imports the accessibility runtime. This reaches the main E.R.A.S./Account/Game/Content/Trade/LCS surfaces through their existing shared account/LCS modules.
- `/dai/assets/js/lcs-bridge.js` imports the same runtime so DAI Home, Creator, Guides, Packs, Info, and tutorial pages share the accessibility foundation.

### Standalone pages
- `media.html`, `play.html`, `watchlist.html`, `logicalcommunicationservice/privacy.html`, and `logicalcommunicationservice/terms.html` load the shared accessibility layer directly.
- The three legacy root pages also receive valid body/header/nav/main structure.

## Manual verification still required

Run these checks after deploying the patch:

1. Keyboard-only: Tab/Shift+Tab through every main route; activate all controls with keyboard; verify focus is never lost or hidden.
2. Screen readers: NVDA + Firefox/Chrome on Windows, VoiceOver + Safari on iOS/macOS where available. Confirm headings, landmarks, form names, live updates, and dialog behavior.
3. Zoom/reflow: 200% and 400% browser zoom; 320 CSS px equivalent viewport; no two-dimensional scrolling for normal content.
4. Reduced motion: enable the OS/browser Reduce Motion preference; verify orbit/parallax/transition motion is suppressed without hiding essential state.
5. Forced colors/high contrast: Windows High Contrast / forced-colors; verify controls and focus remain identifiable.
6. Touch/motor: confirm controls are comfortably selectable and do not overlap at common mobile sizes.
7. Color: run automated contrast checks on every final visual theme/state, including hover/disabled/error states.
8. Media: verify every meaningful video has captions and, where needed, a transcript/audio-description path. Embedded media accessibility cannot be guaranteed by CSS/JS alone.
9. Games: each game mode needs an input-equivalence review. Dragging, rapid timing, and gesture-only mechanics need non-drag/keyboard alternatives where the mechanic is not essential.
10. User testing: automated and code review cannot substitute for testing with disabled users who use keyboard-only navigation, screen readers, magnification, switch/touch access, and reduced-motion settings.

## Platform-fighter requirement retained

The planned platform-fighter mode should inherit this accessibility layer. Its mobile arena requirement remains: the play arena should use roughly 40–50% of the mobile viewport height so the complete stage and the touch controls are visible at the same time. The fighter controls should also expose keyboard/touch equivalents and avoid gesture-only actions.
