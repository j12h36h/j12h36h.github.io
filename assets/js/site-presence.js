import { SITE_PRESENCE_CONFIG as CONFIG } from './site-presence-config.js';

const MODULES = Object.freeze({
  game: { label: 'GAME', order: 0 },
  lcs: { label: 'LCS', order: 1 },
  dai: { label: 'DAI', order: 2 },
  site: { label: 'SITE', order: 3 }
});

const path = location.pathname.toLowerCase().replace(/\/index\.html$/i, '/');
const moduleId = /^\/(?:game|game-mobile)(?:\/|$)/.test(path) ? 'game'
  : /^\/(?:logicalcommunicationservice|lcs-mobile|lcs)(?:\/|$)/.test(path) ? 'lcs'
  : /^\/dai(?:\/|$)/.test(path) ? 'dai'
  : 'site';

const VISITOR_KEY = 'eras_presence_visitor_v1';
const CONNECTION_KEY = 'eras_presence_connection_v1';
const cleanId = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
const freshId = (prefix) => `${prefix}_${cleanId(crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`)}`;

function storageId(storage, key, prefix) {
  try {
    let value = cleanId(storage.getItem(key));
    if (!value) { value = freshId(prefix); storage.setItem(key, value); }
    return value;
  } catch (_) { return freshId(prefix); }
}

const visitorId = storageId(localStorage, VISITOR_KEY, 'v');
const connectionId = storageId(sessionStorage, CONNECTION_KEY, 'c');
const label = MODULES[moduleId].label;

let rootEl = null;
let panelEl = null;
let stats = Object.fromEntries(Object.keys(MODULES).map(k => [k, { total: 0, signedIn: 0, guests: 0 }]));
let connected = false;
let authType = 'guest';
let lastWriteAt = 0;
let heartbeat = null;
let currentRef = null;
let db = null;
let dbMod = null;
let disposed = false;
const boundAuthApps = new Map();

function injectCss() {
  if (document.querySelector('link[data-eras-presence-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/css/site-presence.css?v=20260904-p1';
  link.dataset.erasPresenceCss = '1';
  document.head.appendChild(link);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function ensureUi() {
  if (rootEl?.isConnected) return rootEl;
  injectCss();
  rootEl = document.createElement('aside');
  rootEl.id = 'erasSitePresence';
  rootEl.dataset.module = moduleId;
  rootEl.dataset.state = 'connecting';
  rootEl.setAttribute('aria-label', 'Live site presence');
  rootEl.innerHTML = `
    <button class="eras-presence-pill" type="button" aria-expanded="false" aria-controls="erasPresencePanel">
      <span class="eras-presence-live-dot" aria-hidden="true"></span>
      <span class="eras-presence-module">${label}</span>
      <span class="eras-presence-count">…</span>
      <span class="eras-presence-split eras-presence-split-detail">CONNECTING</span>
    </button>
    <section class="eras-presence-panel" id="erasPresencePanel" hidden>
      <div class="eras-presence-panel-head"><b>ONLINE NOW</b><span>LIVE PRESENCE</span></div>
      <div class="eras-presence-rows"></div>
      <div class="eras-presence-total"><span>NETWORK TOTAL</span><b>0</b></div>
      <p class="eras-presence-note">Counts active browser visitors by main module. Signed-in and guest totals are separate; no name, email, profile ID, route history, or message content is stored here.</p>
    </section>`;
  document.body.appendChild(rootEl);
  panelEl = rootEl.querySelector('.eras-presence-panel');
  const button = rootEl.querySelector('.eras-presence-pill');
  button.addEventListener('click', () => {
    const open = panelEl.hidden;
    panelEl.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('pointerdown', e => {
    if (!panelEl?.hidden && !rootEl.contains(e.target)) {
      panelEl.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  }, { passive: true });
  render();
  return rootEl;
}

function render() {
  ensureUi();
  const current = stats[moduleId] || { total: 0, signedIn: 0, guests: 0 };
  rootEl.dataset.state = connected ? 'live' : 'connecting';
  rootEl.querySelector('.eras-presence-count').textContent = connected ? String(current.total) : '…';
  rootEl.querySelector('.eras-presence-split').textContent = connected
    ? `${current.signedIn} SIGNED IN · ${current.guests} GUEST`
    : 'CONNECTING';

  const rows = Object.entries(MODULES)
    .sort((a,b) => a[1].order - b[1].order)
    .map(([id, meta]) => {
      const row = stats[id] || { total: 0, signedIn: 0, guests: 0 };
      return `<div class="eras-presence-row ${id === moduleId ? 'is-current' : ''}"><b>${escapeHtml(meta.label)}</b><strong>${row.total}</strong><small>${row.signedIn} signed in · ${row.guests} guest</small></div>`;
    }).join('');
  rootEl.querySelector('.eras-presence-rows').innerHTML = rows;
  rootEl.querySelector('.eras-presence-total b').textContent = String(Object.values(stats).reduce((sum, row) => sum + row.total, 0));
}

function summarize(raw) {
  const now = Date.now();
  const next = Object.fromEntries(Object.keys(MODULES).map(k => [k, { total: 0, signedIn: 0, guests: 0 }]));
  for (const client of Object.values(raw || {})) {
    if (!client || typeof client !== 'object') continue;
    const perModule = new Map();
    for (const connection of Object.values(client)) {
      if (!connection || typeof connection !== 'object') continue;
      const id = String(connection.module || '');
      const at = Number(connection.at || 0);
      if (!MODULES[id] || !at || now - at > CONFIG.staleAfterMs || at - now > 15000) continue;
      const old = perModule.get(id) || { signedIn: false };
      if (connection.auth === 'signed_in') old.signedIn = true;
      perModule.set(id, old);
    }
    for (const [id, state] of perModule.entries()) {
      next[id].total += 1;
      if (state.signedIn) next[id].signedIn += 1;
      else next[id].guests += 1;
    }
  }
  stats = next;
  render();
}

function updateAuthType() {
  const signedIn = [...boundAuthApps.values()].some(entry => Boolean(entry.user));
  const next = signedIn ? 'signed_in' : 'guest';
  if (next === authType) return;
  authType = next;
  writePresence(true).catch(() => {});
}

function bindAuthApp(app, authMod) {
  if (!app || boundAuthApps.has(app.name)) return;
  try {
    if (app.options?.projectId !== CONFIG.firebase.projectId) return;
    const auth = authMod.getAuth(app);
    const entry = { auth, user: auth.currentUser || null, unsubscribe: null };
    entry.unsubscribe = authMod.onAuthStateChanged(auth, user => {
      entry.user = user || null;
      updateAuthType();
    }, () => {});
    boundAuthApps.set(app.name, entry);
    updateAuthType();
  } catch (_) {}
}

async function writePresence(force = false) {
  if (!db || !dbMod || disposed || document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (!force && now - lastWriteAt < Math.max(3000, CONFIG.heartbeatMs * .65)) return;
  lastWriteAt = now;
  currentRef = dbMod.ref(db, `${CONFIG.rootPath}/${visitorId}/${connectionId}`);
  try { await dbMod.onDisconnect(currentRef).remove(); } catch (_) {}
  await dbMod.set(currentRef, { module: moduleId, auth: authType, at: dbMod.serverTimestamp() });
}

async function removePresence() {
  if (!currentRef || !dbMod) return;
  try { await dbMod.remove(currentRef); } catch (_) {}
}

function startHeartbeat() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(() => writePresence().catch(() => {}), CONFIG.heartbeatMs);
}

async function init() {
  ensureUi();
  try {
    const v = CONFIG.firebaseVersion;
    const [appMod, authMod, databaseMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${v}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${v}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${v}/firebase-database.js`)
    ]);

    let app = appMod.getApps().find(item => item.name === 'site-account');
    if (!app) app = appMod.initializeApp(CONFIG.firebase, 'site-account');
    bindAuthApp(app, authMod);

    // LCS currently uses the default Firebase app while the rest of the site uses
    // the named site-account app. Watch both so either authenticated session counts.
    const bindAll = () => appMod.getApps().forEach(candidate => bindAuthApp(candidate, authMod));
    bindAll();
    let bindPasses = 0;
    const appPoll = setInterval(() => {
      bindAll();
      if (++bindPasses >= 20) clearInterval(appPoll);
    }, 750);

    dbMod = databaseMod;
    db = databaseMod.getDatabase(app, CONFIG.databaseURL);
    const rootRef = databaseMod.ref(db, CONFIG.rootPath);
    databaseMod.onValue(rootRef, snapshot => {
      connected = true;
      summarize(snapshot.val());
    }, error => {
      connected = false;
      rootEl.dataset.state = 'connecting';
      rootEl.querySelector('.eras-presence-split').textContent = 'PRESENCE OFFLINE';
      console.debug('E.R.A.S. presence read unavailable', error?.code || error?.message || error);
    });

    databaseMod.onValue(databaseMod.ref(db, '.info/connected'), snapshot => {
      if (snapshot.val() === true && document.visibilityState === 'visible') writePresence(true).catch(() => {});
    });

    await writePresence(true);
    startHeartbeat();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        writePresence(true).catch(() => {});
        startHeartbeat();
      } else {
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        removePresence().catch(() => {});
      }
    });

    window.addEventListener('pagehide', () => {
      disposed = true;
      if (heartbeat) clearInterval(heartbeat);
      // onDisconnect is authoritative; remove is a best-effort fast path.
      removePresence().catch(() => {});
    }, { once: true });
  } catch (error) {
    connected = false;
    ensureUi();
    rootEl.querySelector('.eras-presence-split').textContent = 'PRESENCE OFFLINE';
    console.debug('E.R.A.S. presence initialization unavailable', error?.code || error?.message || error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
