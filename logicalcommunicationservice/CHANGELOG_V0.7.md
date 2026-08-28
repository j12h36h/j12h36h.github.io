# LCS v0.7 — JSON Character Avatars

- Public profile image on Account is now clickable.
- Opens a JSON editor containing the current avatar definition.
- JSON edits update a live avatar preview immediately when valid.
- Save writes a canonical, validated avatar definition to the public profile.
- Character layers can overlap with independent position, color, size, font, weight, rotation, opacity, and alignment.
- Up to 24 layers; 1–4 visible characters per layer.
- No image uploads, external image URLs, raw SVG, HTML, CSS, or script input.
- All profile/avatar render sites now use the same validated avatar renderer.
- Invalid/missing avatar JSON falls back safely to generated initials.
- Firestore rules allow only a capped public `avatarJson` string in public profile documents.
