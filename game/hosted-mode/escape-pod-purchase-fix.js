// v1.1 compatibility tombstone.
// Escape Pod purchases are now handled directly by hosted-mode.js using the
// real eras:escape_pod Sprite asset. Kept as a no-op so a cached older HTML
// shell that still references this module cannot intercept the new purchase flow.
export {};
