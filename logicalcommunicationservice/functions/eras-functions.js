/*
 * E.R.A.S. Functions aggregate entry.
 * Existing backend exports remain owned by index.js.
 * Global premade reward functions are isolated in a second module so the
 * existing large backend does not need to be rewritten to add new tracks.
 */
Object.assign(exports, require('./index.js'));
Object.assign(exports, require('./global-premade-functions.js'));
