# LCS v0.7.1 — 96-Layer Character Avatars

- Raises the avatar definition limit from 24 to 96 character layers.
- Raises the public `avatarJson` cap from 6,000 to 32,000 characters.
- Adds a bounded SVG render cache so complex avatars reused across the interface do not regenerate all layers on every appearance.
- Keeps the same allowlisted fonts, character-length limits, numeric clamps, hex-color validation, and no-upload/no-URL security model.
- Bumps browser asset cache versions.
