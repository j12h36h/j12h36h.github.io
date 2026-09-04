import { db, fs, watchIdentity, profileById } from '/game/assets/js/eras-data.js?v=20260905-u1';
import { SITE_PRESENCE_CONFIG as PRESENCE } from '/assets/js/site-presence-config.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getDatabase, ref as rtdbRef, onValue } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js';

const root = document.querySelector('#universeDashboard');
if (!root) throw new Error('Universe dashboard root not found.');

const els = {
  friends: root.querySelector('[data-friends-list]'),
  friendCount: root.querySelector('[data-friend-count]'),
  activity: root.querySelector('[data-friend-activity]'),
  activityCount: root.querySelector('[data-activity-count]'),
  alerts: root.querySelector('[data-alerts-list]'),
  alertCount: root.querySelector('[data-alert-count]')
};

const state = {
  identity: null,
  friendIds: [],
  profiles: new Map(),
  online: new Map(),
  posts: [],
  objects: [],
  comments: [],
  friendRequests: [],
  lfgRequests: [],
  trades: [],
  threads: [],
  unsubs: [],
  presenceUnsub: null
};

const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeMs = (ts) => ts?.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : Number(ts || 0));
const timeAgo = (ts) => {
  const n = timeMs(ts);
  if (!n) return 'NOW';
  const d = Math.max(0, Date.now() - n);
  const m = Math.floor(d / 60000);
  if (m < 1) return 'NOW';
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H`;
  const days = Math.floor(h / 24);
  return days < 30 ? `${days}D` : new Date(n).toLocaleDateString([], { month:'short', day:'numeric' }).toUpperCase();
};
const moduleLabel = (m) => ({game:'GAME', lcs:'LCS', dai:'DAI', site:'SITE'})[m] || 'SITE';
const moduleHref = (m) => ({game:'/game/', lcs:'/logicalcommunicationservice/', dai:'/dai/', site:'/'})[m] || '/';
const profileName = (id) => state.profiles.get(id)?.displayName || `Member-${String(id).replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase()}`;

function stopPrivate() {
  state.unsubs.splice(0).forEach(fn => { try { fn?.(); } catch (_) {} });
  state.friendIds = [];
  state.friendRequests = [];
  state.lfgRequests = [];
  state.trades = [];
  state.threads = [];
}

async function hydrate(ids) {
  const todo = [...new Set(ids)].filter(id => id && !state.profiles.has(id));
  await Promise.all(todo.slice(0, 250).map(async id => {
    try {
      const p = await profileById(id);
      if (p) state.profiles.set(id, p);
    } catch (_) {}
  }));
}

function presenceFor(profileId) {
  const row = state.online.get(profileId);
  if (!row || Date.now() - row.lastSeen > PRESENCE.staleAfterMs) return null;
  return row;
}

function renderFriends() {
  if (!state.identity?.profileId) {
    els.friendCount.textContent = '0';
    els.friends.innerHTML = '<p class="udp-empty">SIGN IN TO LOAD YOUR FRIENDS.</p>';
    return;
  }

  const rows = state.friendIds.map(id => {
    const p = state.profiles.get(id);
    const online = presenceFor(id);
    const modules = online ? [...online.modules].map(moduleLabel) : [];
    return { id, name: p?.displayName || profileName(id), online, modules };
  }).sort((a,b) => {
    if (Boolean(a.online) !== Boolean(b.online)) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  els.friendCount.textContent = String(rows.length);
  if (!rows.length) {
    els.friends.innerHTML = '<p class="udp-empty">NO ACCEPTED FRIENDS YET. ADD CONNECTIONS IN LCS.</p>';
    return;
  }

  els.friends.innerHTML = rows.map(row => `
    <a class="friend-row ${row.online ? 'is-online' : ''}" href="/game/social/" title="Open E.R.A.S. Social">
      <span class="friend-copy">
        <b>${esc(row.name)}</b>
        <small>${row.online ? `ACTIVE // ${esc(row.modules.join(' + ') || 'NETWORK')}` : 'OFFLINE'}</small>
      </span>
      <span class="friend-state">${row.online ? 'ONLINE' : 'OFFLINE'}<i aria-hidden="true"></i></span>
    </a>`).join('');
}

function publicActivityRows() {
  if (!state.identity?.profileId || !state.friendIds.length) return [];
  const friendSet = new Set(state.friendIds);
  const rows = [];

  for (const [id, online] of state.online) {
    if (!friendSet.has(id) || Date.now() - online.lastSeen > PRESENCE.staleAfterMs) continue;
    const mods = [...online.modules];
    const lead = mods[0] || 'site';
    rows.push({
      key:`online:${id}`,
      at:online.lastSeen,
      icon:'●',
      title:`${profileName(id)} is online`,
      detail:mods.map(moduleLabel).join(' + '),
      href:moduleHref(lead)
    });
  }

  state.posts.forEach(p => {
    if (!friendSet.has(p.authorProfileId) || p.deleted) return;
    rows.push({
      key:`post:${p.id}`, at:p.createdAt, icon:'↗',
      title:`${profileName(p.authorProfileId)} posted in LCS`,
      detail:String(p.text || '').slice(0,90),
      href:'/logicalcommunicationservice/'
    });
  });

  state.objects.forEach(o => {
    if (!friendSet.has(o.authorProfileId) || o.deleted) return;
    rows.push({
      key:`object:${o.id}`, at:o.updatedAt || o.createdAt, icon:'◇',
      title:`${profileName(o.authorProfileId)} ${o.updatedAt ? 'updated' : 'created'} ${o.kind || 'work'}`,
      detail:String(o.title || o.description || '').slice(0,90),
      href:'/logicalcommunicationservice/'
    });
  });

  state.comments.forEach(c => {
    if (!friendSet.has(c.authorProfileId) || c.deleted) return;
    rows.push({
      key:`comment:${c.id}`, at:c.createdAt, icon:'↩',
      title:`${profileName(c.authorProfileId)} responded in LCS`,
      detail:String(c.text || '').slice(0,90),
      href:'/logicalcommunicationservice/'
    });
  });

  return [...new Map(rows.map(x => [x.key, x])).values()]
    .sort((a,b) => timeMs(b.at) - timeMs(a.at))
    .slice(0, 16);
}

function renderActivity() {
  if (!state.identity?.profileId) {
    els.activityCount.textContent = '0';
    els.activity.innerHTML = '<p class="udp-empty">SIGN IN TO LOAD FRIEND ACTIVITY.</p>';
    return;
  }
  const rows = publicActivityRows();
  els.activityCount.textContent = String(rows.length);
  els.activity.innerHTML = rows.length ? rows.map(row => `
    <a class="activity-row" href="${esc(row.href)}">
      <span class="activity-icon" aria-hidden="true">${esc(row.icon)}</span>
      <span class="activity-copy"><b>${esc(row.title)}</b><small>${esc(row.detail || '')}</small></span>
      <time>${esc(timeAgo(row.at))}</time>
    </a>`).join('') : '<p class="udp-empty">NO RECENT FRIEND ACTIVITY.</p>';
}

function readAt(threadId, profileId) {
  try {
    const n = Number(localStorage.getItem(`eras_chat_read_v1:${profileId}:${threadId}`) || 0);
    return Number.isFinite(n) ? n : 0;
  } catch (_) { return 0; }
}

function alertRows() {
  const pid = state.identity?.profileId;
  if (!pid) return [];
  const rows = [];

  state.friendRequests.filter(x => x.status === 'pending' && x.toProfileId === pid).forEach(x => rows.push({
    key:`friend:${x.id}`, at:x.updatedAt || x.createdAt, icon:'↔',
    title:`Friend request from ${profileName(x.fromProfileId)}`,
    detail:'OPEN LCS CONNECTIONS',
    href:'/logicalcommunicationservice/'
  }));

  state.lfgRequests.filter(x => x.status === 'pending' && x.toProfileId === pid).forEach(x => rows.push({
    key:`lfg:${x.id}`, at:x.updatedAt || x.createdAt, icon:'⚑',
    title:`LFG response from ${profileName(x.fromProfileId)}`,
    detail:'OPEN LCS MATCH REQUEST',
    href:'/logicalcommunicationservice/'
  }));

  state.trades.filter(x => x.recipientProfileId === pid && (x.status === 'pending' || x.status === 'locked')).forEach(x => rows.push({
    key:`trade:${x.id}`, at:x.updatedAt || x.createdAt, icon:'⇄',
    title:`Trade ${x.status === 'locked' ? 'locked' : 'offer'} from ${profileName(x.initiatorProfileId)}`,
    detail:'OPEN PLAYER TRADE',
    href:'/trade/'
  }));

  state.threads.forEach(t => {
    const stamp = timeMs(t.lastMessageAt);
    if (!stamp || t.lastMessageSenderProfileId === pid || stamp <= readAt(t.id, pid)) return;
    const peer = (t.members || []).find(id => id !== pid) || '';
    rows.push({
      key:`dm:${t.id}`, at:t.lastMessageAt, icon:'✉',
      title:`Message from ${profileName(peer)}`,
      detail:String(t.lastMessagePreview || 'Unread conversation').slice(0,90),
      href:'/game/social/'
    });
  });

  return rows.sort((a,b) => timeMs(b.at) - timeMs(a.at)).slice(0, 20);
}

function renderAlerts() {
  if (!state.identity?.profileId) {
    els.alertCount.textContent = '0';
    els.alerts.innerHTML = '<p class="udp-empty">SIGN IN TO LOAD PERSONAL ALERTS.</p>';
    return;
  }
  const rows = alertRows();
  els.alertCount.textContent = String(rows.length);
  els.alerts.innerHTML = rows.length ? rows.map(row => `
    <a class="alert-row is-urgent" href="${esc(row.href)}">
      <span class="alert-icon" aria-hidden="true">${esc(row.icon)}</span>
      <span class="alert-copy"><b>${esc(row.title)}</b><small>${esc(row.detail || '')}</small></span>
      <time>${esc(timeAgo(row.at))}</time>
    </a>`).join('') : '<p class="udp-empty">NO PERSONAL ALERTS. NETWORK CLEAR.</p>';
}

function renderAll() {
  renderFriends();
  renderActivity();
  renderAlerts();
}

function subscribePublicActivity() {
  const subscribe = (name, target, orderField='createdAt', max=140) => {
    try {
      const q = fs.query(fs.collection(db, name), fs.orderBy(orderField, 'desc'), fs.limit(max));
      state.unsubs.push(fs.onSnapshot(q, snap => {
        state[target] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
        const ids = state[target].map(x => x.authorProfileId).filter(Boolean);
        hydrate(ids).then(renderAll);
      }, err => console.debug(`Universe dashboard ${name}`, err?.code || err)));
    } catch (err) { console.debug(`Universe dashboard ${name}`, err); }
  };
  subscribe('publicPosts', 'posts', 'createdAt', 140);
  subscribe('publicObjects', 'objects', 'updatedAt', 140);
  subscribe('publicComments', 'comments', 'createdAt', 160);
}

function subscribeIdentityData(pid) {
  const on = (name, field, value, assign) => {
    const q = fs.query(fs.collection(db, name), fs.where(field, '==', value), fs.limit(250));
    state.unsubs.push(fs.onSnapshot(q, snap => {
      state[assign] = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      const ids = state[assign].flatMap(x => [x.fromProfileId, x.toProfileId, x.initiatorProfileId, x.recipientProfileId, ...(x.members || [])]).filter(Boolean);
      hydrate(ids).then(renderAll);
    }, err => console.debug(`Universe dashboard ${name}`, err?.code || err)));
  };

  const friendshipQ = fs.query(fs.collection(db, 'privateFriendships'), fs.where('members', 'array-contains', pid), fs.limit(250));
  state.unsubs.push(fs.onSnapshot(friendshipQ, snap => {
    state.friendIds = [...new Set(snap.docs.flatMap(d => (d.data().members || []).filter(id => id && id !== pid)))];
    hydrate(state.friendIds).then(renderAll);
  }, err => console.debug('Universe dashboard friendships', err?.code || err)));

  on('privateFriendRequests', 'toProfileId', pid, 'friendRequests');
  on('privateLfgRequests', 'toProfileId', pid, 'lfgRequests');
  on('playerTrades', 'recipientProfileId', pid, 'trades');
  on('directMessageThreads', 'members', pid, 'threads');
  subscribePublicActivity();
}

function startPresence() {
  try {
    const app = getApp('site-account');
    const rtdb = getDatabase(app, PRESENCE.databaseURL);
    state.presenceUnsub = onValue(rtdbRef(rtdb, PRESENCE.rootPath), snap => {
      const next = new Map();
      const now = Date.now();
      for (const client of Object.values(snap.val() || {})) {
        if (!client || typeof client !== 'object') continue;
        for (const connection of Object.values(client)) {
          if (!connection || typeof connection !== 'object') continue;
          const profile = String(connection.profile || '');
          const at = Number(connection.at || 0);
          const module = String(connection.module || '');
          if (!profile || !at || now - at > PRESENCE.staleAfterMs || !['game','lcs','dai','site'].includes(module)) continue;
          const row = next.get(profile) || { lastSeen:0, modules:new Set() };
          row.lastSeen = Math.max(row.lastSeen, at);
          row.modules.add(module);
          next.set(profile, row);
        }
      }
      state.online = next;
      renderAll();
    }, err => console.debug('Universe dashboard presence', err?.code || err));
  } catch (err) {
    console.debug('Universe dashboard presence startup', err?.message || err);
  }
}

startPresence();

watchIdentity(identity => {
  stopPrivate();
  state.identity = identity?.profileId ? identity : null;
  if (!state.identity) {
    renderAll();
    return;
  }
  state.profiles.set(identity.profileId, identity.profile || { id:identity.profileId });
  subscribeIdentityData(identity.profileId);
  renderAll();
});
