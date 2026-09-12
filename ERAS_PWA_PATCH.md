# E.R.A.S. Installable Web App Patch

This patch makes the existing E.R.A.S. website installable while preserving normal browser access.

## What it changes

- Adds a root web app manifest with `/` as both the app start URL and scope.
- Adds 192x192 and 512x512 E.R.A.S. app icons plus a 180x180 Apple touch icon.
- Adds manifest/install metadata to the existing root Universe page.
- Adds shortcuts to LCS, Play, and D.A.I. inside supported installed-app launchers.

## What it deliberately does NOT change

- No service worker.
- No offline cache.
- No fetch interception.
- No redirects.
- No alternate app runtime.
- No replacement mobile routes.
- No app-only pages.

The browser website remains the canonical runtime. The installed version launches the same `/` site and can navigate to every same-origin E.R.A.S. path because the manifest scope is `/`.
