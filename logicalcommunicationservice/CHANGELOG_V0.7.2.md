# LCS v0.7.2 — Multilingual Character Avatars

- Avatar `char` values now explicitly accept visible Unicode grapheme characters from non-English writing systems.
- Character counting uses `Intl.Segmenter` when available so composed glyphs are counted visually rather than by UTF-16 code units.
- Added `system-ui` to the safe font allowlist for broader built-in international glyph coverage.
- Continues to reject control characters and Unicode bidirectional override/isolate controls.
- No custom fonts, remote fonts, URLs, raw SVG, HTML, CSS, or executable content are permitted.
- Avatar capacity remains 96 layers and 32,000 canonical JSON characters.
- No Firestore rules/schema change is required from v0.7.1.
