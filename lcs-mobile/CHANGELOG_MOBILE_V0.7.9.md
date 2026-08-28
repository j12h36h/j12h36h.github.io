# LCS Mobile v0.7.9

- Created a dedicated `/lcs-mobile/` build from the stable desktop v0.7.6 codebase.
- Desktop `/logicalcommunicationservice/` is not changed by this package.
- Removed the persistence `await` from the Google button path so the popup opens directly from the mobile tap gesture.
- Added an authentication in-flight lock to prevent repeated Google popup attempts.
- Added mobile/in-app-browser-specific authentication diagnostics without changing Firebase identity architecture.
- Added mobile-first touch navigation, safe-area handling, full-screen dialogs, larger controls, and iOS-friendly form sizes.
- Retains v0.7.5 live discussion, popup closing, tag parsing, duplicate-create protection, and readable idea-map styling.
