import { LCS_CONFIG } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SYSTEM_SPACE = Object.freeze({
  id: 'open-commons',
  name: 'Open Commons',
  description: 'The shared public space for ideas, problems, projects, and discussion.',
  system: true
});

const reasoning = {
  observation: { plain: 'I noticed', formal: 'Observation', symbol: '👀', description: 'Something you directly saw, measured, heard, or recorded.', example: 'Three people ran into the same setup problem today.' },
  premise: { plain: 'We know', formal: 'Premise', symbol: '📌', description: 'A starting fact, rule, or agreed point used by the reasoning that follows.', example: 'A public post can be read by anyone visiting this network.' },
  deduction: { plain: 'This follows', formal: 'Deduction', symbol: '→', description: 'A conclusion connected to stated facts or premises.', example: 'If the same information is required in two places, one shared source should reduce drift.' },
  assumption: { plain: "I'm assuming", formal: 'Assumption', symbol: '☁', description: 'Something being treated as true even though it has not been established.', example: 'I am assuming most people want a nickname instead of their provider name.' },
  hypothesis: { plain: 'Maybe', formal: 'Hypothesis', symbol: '🧪', description: 'A possible explanation or solution that can be tested.', example: 'Maybe connecting posts to projects will preserve why a decision was made.' },
  question: { plain: 'I need to know', formal: 'Question', symbol: '?', description: 'Missing information that could change the conclusion.', example: 'Which project does this observation belong to?' },
  unclassified: { plain: 'Just say it', formal: 'Unclassified', symbol: '💬', description: 'Normal communication with no reasoning label required.', example: 'I have an idea I want to share.' }
};

const state = {
  user: null,
  authReady: false,
  firebaseReady: false,
  firebase: null,
  publicProfile: null,
  profiles: {},
  posts: [],
  objects: [],
  spaces: [],
  reactions: [],
  follows: [],
  connections: [],
  postLinks: [],
  comments: [],
  activeType: 'unclassified',
  activeFilter: 'all',
  activeView: 'home',
  activeSpaceId: 'all',
  detail: null,
  detailUnsub: null,
  connectContext: null,
  profilePrompted: false,
  mapLayoutSeed: 0,
  unsubs: []
};

function isFirebaseConfigured() {
  const cfg = LCS_CONFIG.firebase || {};
  return Boolean(cfg.apiKey && cfg.projectId && cfg.appId && !String(cfg.apiKey).includes('YOUR_'));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function safeId(value = '') {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function timeValue(ts) {
  if (typeof ts === 'number') return ts;
  if (ts?.toMillis) return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function timeAgo(ts) {
  const n = timeValue(ts) || Date.now();
  const seconds = Math.max(1, Math.floor((Date.now() - n) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(n).toLocaleDateString();
}

function toast(message) {
  const region = $('#toastRegion');
  if (!region) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.appendChild(el);
  window.setTimeout(() => el.remove(), 3400);
}

function setBackendStatus(title, text, tone = '') {
  $('#backendStatusTitle').textContent = title;
  $('#backendStatusText').textContent = text;
  $('#backendStatusCard').dataset.tone = tone;
}

function requireUser() {
  if (state.user) return true;
  clearAuthError();
  $('#authDialog').showModal();
  return false;
}

function generatedPublicName(user) {
  const suffix = String(user?.uid || 'member').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'NEW';
  return `Member-${suffix}`;
}

function fallbackPublicProfile(user = state.user) {
  return { displayName: generatedPublicName(user), bio: '', useGooglePhoto: false, photoURL: '' };
}

function ownPublicProfile() {
  if (!state.user) return null;
  return state.publicProfile || state.profiles[state.user.uid] || fallbackPublicProfile(state.user);
}

function publicIdentity(uid, fallbackName = 'Member', fallbackPhoto = '') {
  const profile = uid ? state.profiles[uid] : null;
  return {
    uid: uid || '',
    displayName: profile?.displayName || fallbackName || 'Member',
    photoURL: profile?.photoURL || fallbackPhoto || '',
    bio: profile?.bio || ''
  };
}

function initialsFor(name = 'Member') {
  return String(name).trim().split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
}

function avatarMarkup(identity, className = 'fallback-avatar') {
  if (identity?.photoURL) return `<img src="${escapeHtml(identity.photoURL)}" alt="" referrerpolicy="no-referrer">`;
  return `<span class="${className}">${escapeHtml(initialsFor(identity?.displayName || 'Member'))}</span>`;
}

function allSpaces() {
  const seen = new Set([SYSTEM_SPACE.id]);
  const remote = state.spaces.filter(space => space?.id && !seen.has(space.id) && seen.add(space.id));
  return [SYSTEM_SPACE, ...remote];
}

function spaceById(id) {
  return allSpaces().find(space => space.id === id) || SYSTEM_SPACE;
}

function contentMatchesQuery(content, extra = '') {
  const q = $('#globalSearch')?.value.trim().toLowerCase() || '';
  if (!q) return true;
  const haystack = `${content || ''} ${extra || ''}`.toLowerCase();
  return haystack.includes(q);
}

function isOwnReaction(targetType, targetId) {
  if (!state.user) return false;
  const key = `${targetType}:${targetId}`;
  return state.reactions.some(r => r.targetKey === key && r.userUid === state.user.uid && r.type === 'helpful');
}

function reactionCount(targetType, targetId) {
  const key = `${targetType}:${targetId}`;
  return state.reactions.filter(r => r.targetKey === key && r.type === 'helpful').length;
}

function isFollowing(targetType, targetId) {
  if (!state.user) return false;
  const key = `${targetType}:${targetId}`;
  return state.follows.some(f => f.targetKey === key && f.userUid === state.user.uid);
}

function followCount(targetType, targetId) {
  const key = `${targetType}:${targetId}`;
  return state.follows.filter(f => f.targetKey === key).length;
}

function linkedObjectsForPost(postId) {
  const ids = state.postLinks.filter(link => link.postId === postId).map(link => link.objectId);
  return ids.map(id => state.objects.find(obj => obj.id === id)).filter(Boolean);
}

function relationsForObject(objectId) {
  return state.connections.filter(connection => connection.sourceId === objectId || connection.targetId === objectId);
}

function clearAuthError() {
  const box = $('#authErrorBox');
  if (!box) return;
  box.hidden = true;
  $('#authErrorTitle').textContent = '';
  $('#authErrorText').textContent = '';
  $('#authErrorCode').textContent = '';
}

function authErrorMessage(error) {
  const code = String(error?.code || 'auth/unknown');
  const message = String(error?.message || '');
  const authDomain = LCS_CONFIG.firebase?.authDomain || 'the Firebase auth domain';
  if (code === 'auth/unauthorized-domain') return { title: 'This website is not authorized yet', text: `Add ${location.hostname} in Firebase Authentication → Settings → Authorized domains.` };
  if (code === 'auth/operation-not-allowed') return { title: 'Google sign-in is not enabled', text: 'Enable Google in Firebase Authentication → Sign-in method.' };
  if (code === 'auth/configuration-not-found') return { title: 'Firebase Authentication needs setup', text: 'Initialize Authentication for this Firebase project and enable Google.' };
  if (code === 'auth/popup-blocked') return { title: 'The browser blocked the Google window', text: 'Allow popups for this site and try again.' };
  if (code === 'auth/popup-closed-by-user') return { title: 'Google sign-in closed before completion', text: `If you did not close it, verify ${location.hostname} is authorized and the Firebase browser key permits https://${authDomain}/* when HTTP-referrer restrictions are enabled.` };
  if (code === 'auth/network-request-failed') return { title: 'Could not reach Firebase', text: 'Check the connection and browser privacy/ad-blocking settings, then try again.' };
  if (['auth/api-key-not-valid', 'auth/invalid-api-key'].includes(code)) return { title: 'The Firebase Web API key is invalid', text: 'Copy the Firebase Web App configuration again from Project settings → Your apps.' };
  if (code === 'auth/web-storage-unsupported' || code === 'auth/unsupported-persistence-type') return { title: 'Saved sign-in is blocked by this browser', text: 'Allow site storage for this site so Firebase can persist the session across refreshes.' };
  if (code.includes('requests-from-referer') || /Requests from referer/i.test(message)) return { title: 'The Firebase browser key is blocking this website', text: `Allow https://${location.hostname}/* and https://${authDomain}/* in the API key's HTTP-referrer restrictions.` };
  return { title: 'Google sign-in did not complete', text: 'The Firebase error code is shown below.' };
}

function showAuthError(error) {
  const details = authErrorMessage(error);
  $('#authErrorTitle').textContent = details.title;
  $('#authErrorText').textContent = details.text;
  $('#authErrorCode').textContent = String(error?.code || error?.message || 'auth/unknown');
  $('#authErrorBox').hidden = false;
}

function setView(view, updateHash = true) {
  const valid = ['home', 'universe', 'ideas', 'problems', 'projects', 'account'];
  if (!valid.includes(view)) view = 'home';
  state.activeView = view;
  $$('.view').forEach(section => section.classList.toggle('active-view', section.id === `view-${view}`));
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (updateHash) history.replaceState(null, '', `#${view}`);
  if (view === 'universe') requestAnimationFrame(renderUniverse);
  if (['ideas', 'problems', 'projects'].includes(view)) renderCatalogs();
  if (view === 'account') renderAccount();
}

function renderSpaces() {
  const spaces = allSpaces();
  if (state.activeSpaceId !== 'all' && !spaces.some(space => space.id === state.activeSpaceId)) state.activeSpaceId = 'all';
  $('#spaceList').innerHTML = [
    `<button class="space-item ${state.activeSpaceId === 'all' ? 'active' : ''}" data-space-filter="all" type="button"><i></i><span>All spaces</span></button>`,
    ...spaces.map(space => `<button class="space-item ${state.activeSpaceId === space.id ? 'active' : ''}" data-space-filter="${escapeHtml(space.id)}" type="button" title="${escapeHtml(space.description || '')}"><i></i><span>${escapeHtml(space.name)}</span></button>`)
  ].join('');

  const options = spaces.map(space => `<option value="${escapeHtml(space.id)}">${escapeHtml(space.name)}</option>`).join('');
  for (const selectId of ['postSpace', 'createSpaceSelect']) {
    const select = $(`#${selectId}`);
    if (!select) continue;
    const previous = select.value;
    select.innerHTML = options;
    if ([...select.options].some(option => option.value === previous)) select.value = previous;
  }
}

function renderAuth() {
  const area = $('#authArea');
  if (!state.authReady) {
    area.innerHTML = '<div class="auth-checking" aria-live="polite"><span class="auth-checking-dot" aria-hidden="true"></span><span>Checking account…</span></div>';
    $('#composerName').textContent = 'Share a thought';
    $('#composerHint').textContent = 'Checking your saved sign-in…';
    $('#composerAvatar').textContent = 'You';
    renderAccount();
    return;
  }

  if (state.user) {
    const profile = ownPublicProfile();
    area.innerHTML = `<div class="auth-user"><button class="auth-account-main" data-open-account type="button" aria-label="Open account settings">${avatarMarkup(profile, 'auth-fallback-avatar')}<span>${escapeHtml(profile.displayName || 'Account')}</span></button><button id="signOutButton" type="button" title="Sign out" aria-label="Sign out">↪</button></div>`;
    $('#composerName').textContent = profile.displayName || 'Share a thought';
    $('#composerHint').textContent = 'This is your public LCS identity. Your Google name and email remain private.';
    $('#composerAvatar').innerHTML = profile.photoURL ? `<img src="${escapeHtml(profile.photoURL)}" alt="" referrerpolicy="no-referrer">` : escapeHtml(initialsFor(profile.displayName));
  } else {
    area.innerHTML = '<button class="ghost-button signin-button" data-open-auth type="button"><span>G</span> Sign in</button>';
    $('#composerName').textContent = 'Share a thought';
    $('#composerHint').textContent = state.firebaseReady ? 'Sign in to publish to the shared network.' : 'The live backend is not connected.';
    $('#composerAvatar').textContent = 'You';
  }
  renderAccount();
}

function updateAccountPreview() {
  if (!$('#accountDisplayName')) return;
  const profile = ownPublicProfile() || fallbackPublicProfile(state.user);
  const name = $('#accountDisplayName').value.trim() || profile.displayName || 'Member';
  const bio = $('#accountBio').value.trim();
  const useGooglePhoto = $('#accountUseGooglePhoto').checked;
  const photo = useGooglePhoto ? (state.user?.photoURL || '') : '';
  $('#accountPreviewName').textContent = name;
  $('#accountPreviewBio').textContent = bio || 'No public bio yet.';
  $('#accountBioCounter').textContent = `${$('#accountBio').value.length} / 240`;
  $('#accountPublicAvatar').innerHTML = photo ? `<img src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer">` : escapeHtml(initialsFor(name));
}

function renderAccount() {
  const loading = $('#accountAuthLoading');
  const signedOut = $('#accountSignedOut');
  const signedIn = $('#accountSignedIn');
  if (!loading || !signedOut || !signedIn) return;

  loading.hidden = state.authReady;
  if (!state.authReady) {
    signedOut.hidden = true;
    signedIn.hidden = true;
    return;
  }

  signedOut.hidden = Boolean(state.user);
  signedIn.hidden = !state.user;
  if (!state.user) return;

  const profile = ownPublicProfile();
  $('#accountDisplayName').value = profile.displayName || generatedPublicName(state.user);
  $('#accountBio').value = profile.bio || '';
  $('#accountUseGooglePhoto').checked = Boolean(profile.useGooglePhoto && state.user.photoURL);
  $('#accountConnectionStatus').textContent = state.firebaseReady ? 'Signed in · Firebase session saved on this device' : 'Backend unavailable';
  $('#accountProviderName').textContent = state.user.displayName || 'Not provided by Google';
  $('#accountProviderEmail').textContent = state.user.email || 'Not provided by Google';
  $('#accountSaveStatus').textContent = '';
  updateAccountPreview();
}

function renderFeed() {
  let posts = state.posts.filter(post => !post.deleted);
  if (state.activeFilter !== 'all') posts = posts.filter(post => post.kind === state.activeFilter);
  if (state.activeSpaceId !== 'all') posts = posts.filter(post => (post.spaceId || SYSTEM_SPACE.id) === state.activeSpaceId);
  posts = posts.filter(post => {
    const identity = publicIdentity(post.authorUid, post.authorName, post.authorPhoto);
    const space = spaceById(post.spaceId || SYSTEM_SPACE.id);
    return contentMatchesQuery(post.text, `${identity.displayName} ${space.name} ${post.kind}`);
  });

  if (!posts.length) {
    $('#feed').innerHTML = '<div class="empty-state">No posts match this view yet. Publish the first one or change the filters.</div>';
    return;
  }

  $('#feed').innerHTML = posts.map(post => {
    const identity = publicIdentity(post.authorUid, post.authorName, post.authorPhoto);
    const r = reasoning[post.reasoningType] || reasoning.unclassified;
    const helpful = isOwnReaction('post', post.id);
    const helpfulCount = reactionCount('post', post.id);
    const links = linkedObjectsForPost(post.id);
    return `<article class="post-card" data-post-card="${escapeHtml(post.id)}">
      <div class="post-head">
        <button class="post-author identity-button" data-open-profile="${escapeHtml(post.authorUid || '')}" type="button">${avatarMarkup(identity)}<span class="post-author-copy"><b>${escapeHtml(identity.displayName)}</b><small>${escapeHtml(spaceById(post.spaceId || SYSTEM_SPACE.id).name)}</small></span></button>
        <span class="post-time">${timeAgo(post.createdAt)}</span>
      </div>
      <button class="post-body-button" data-open-post="${escapeHtml(post.id)}" type="button"><span class="post-text">${escapeHtml(post.text)}</span></button>
      <div class="post-meta"><span class="type-pill type-${escapeHtml(post.reasoningType || 'unclassified')}">${escapeHtml(r.plain)} · ${escapeHtml(r.formal)}</span><span class="kind-pill">${escapeHtml(post.kind || 'idea')}</span>${links.length ? `<span class="kind-pill linked-pill">${links.length} connection${links.length === 1 ? '' : 's'}</span>` : ''}</div>
      <div class="post-actions">
        <button class="${helpful ? 'active-action' : ''}" data-helpful-type="post" data-helpful-id="${escapeHtml(post.id)}" type="button">${helpful ? '♥' : '♡'} Helpful${helpfulCount ? ` · ${helpfulCount}` : ''}</button>
        <button data-open-post="${escapeHtml(post.id)}" type="button">💬 Discuss</button>
        <button data-connect-post="${escapeHtml(post.id)}" type="button">↗ Connect</button>
        <button data-reason="${escapeHtml(post.reasoningType || 'unclassified')}" type="button">Why this label?</button>
      </div>
    </article>`;
  }).join('');
}

function objectCard(object) {
  const identity = publicIdentity(object.authorUid, object.authorName, object.authorPhoto);
  const following = isFollowing('object', object.id);
  const followers = followCount('object', object.id);
  const helpful = isOwnReaction('object', object.id);
  const helpfulCount = reactionCount('object', object.id);
  const relations = relationsForObject(object.id).length;
  return `<article class="catalog-card">
    <div class="catalog-card-top"><span class="object-type">${escapeHtml(object.kind)}</span><span class="muted tiny">${escapeHtml(spaceById(object.spaceId || SYSTEM_SPACE.id).name)}</span></div>
    <button class="catalog-open" data-open-object="${escapeHtml(object.id)}" type="button"><h3>${escapeHtml(object.title)}</h3><p>${escapeHtml(object.description)}</p></button>
    <div class="tag-row">${(object.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="catalog-byline"><button class="identity-inline" data-open-profile="${escapeHtml(object.authorUid || '')}" type="button">${escapeHtml(identity.displayName)}</button><span>${timeAgo(object.createdAt)}</span></div>
    <div class="catalog-actions">
      <button class="${following ? 'active-action' : ''}" data-follow-type="object" data-follow-id="${escapeHtml(object.id)}" type="button">${following ? '★ Following' : '☆ Follow'}${followers ? ` · ${followers}` : ''}</button>
      <button class="${helpful ? 'active-action' : ''}" data-helpful-type="object" data-helpful-id="${escapeHtml(object.id)}" type="button">${helpful ? '♥' : '♡'}${helpfulCount ? ` ${helpfulCount}` : ''}</button>
      <button data-open-object="${escapeHtml(object.id)}" type="button">Open${relations ? ` · ${relations} link${relations === 1 ? '' : 's'}` : ''}</button>
    </div>
  </article>`;
}

function renderCatalogs() {
  for (const kind of ['idea', 'problem', 'project']) {
    const root = $(`#${kind}Catalog`);
    let items = state.objects.filter(object => object.kind === kind && !object.deleted);
    if (state.activeSpaceId !== 'all') items = items.filter(object => (object.spaceId || SYSTEM_SPACE.id) === state.activeSpaceId);
    items = items.filter(object => {
      const identity = publicIdentity(object.authorUid, object.authorName, object.authorPhoto);
      return contentMatchesQuery(`${object.title} ${object.description} ${(object.tags || []).join(' ')}`, `${identity.displayName} ${spaceById(object.spaceId || SYSTEM_SPACE.id).name}`);
    });
    root.innerHTML = items.length ? items.map(objectCard).join('') : '<div class="empty-state">Nothing matches this view yet.</div>';
  }
}

function renderTrends() {
  const tagCounts = new Map();
  for (const object of state.objects) for (const tag of object.tags || []) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  const relationCounts = new Map();
  for (const connection of state.connections) relationCounts.set(connection.relation || 'related', (relationCounts.get(connection.relation || 'related') || 0) + 1);
  const rows = [
    ...[...relationCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => [`${name} connections`, `${count} link${count === 1 ? '' : 's'}`]),
    ...[...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => [`#${name}`, `${count} object${count === 1 ? '' : 's'}`])
  ].slice(0, 5);
  $('#trendList').innerHTML = rows.length ? rows.map(([label, count]) => `<div class="trend-item"><span>${escapeHtml(label)}</span><b>${escapeHtml(count)}</b></div>`).join('') : '<p class="muted tiny">Connections and shared tags will appear here as the network grows.</p>';
}

function hashNumber(text) {
  let hash = 2166136261;
  for (const ch of String(text)) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

function positionForObject(object, index, total) {
  const hash = hashNumber(`${object.id}:${state.mapLayoutSeed}`);
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 + ((hash % 100) / 100) * 0.35;
  const ring = 30 + (hash % 18);
  return { x: 50 + Math.cos(angle) * ring, y: 50 + Math.sin(angle) * Math.min(ring, 34) };
}

function renderUniverse() {
  const canvas = $('#universeCanvas');
  const svg = $('#universeLines');
  if (!canvas || !svg) return;
  let objects = state.objects.filter(object => !object.deleted);
  if (state.activeSpaceId !== 'all') objects = objects.filter(object => (object.spaceId || SYSTEM_SPACE.id) === state.activeSpaceId);
  objects = objects.filter(object => contentMatchesQuery(`${object.title} ${object.description} ${(object.tags || []).join(' ')}`, object.kind)).slice(0, 36);
  if (!objects.length) {
    canvas.innerHTML = '<div class="map-empty">Create an idea, problem, or project and it will appear here.</div>';
    svg.innerHTML = '';
    return;
  }
  const positions = new Map(objects.map((object, index) => [object.id, positionForObject(object, index, objects.length)]));
  canvas.innerHTML = objects.map(object => {
    const position = positions.get(object.id);
    return `<button class="universe-node node-${escapeHtml(object.kind)}" style="left:calc(${position.x}% - 56px);top:calc(${position.y}% - 56px)" data-open-object="${escapeHtml(object.id)}" type="button"><b>${escapeHtml(object.title)}</b><small>${escapeHtml(object.kind)}</small></button>`;
  }).join('');
  requestAnimationFrame(() => {
    const canvasRect = canvas.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;
    svg.setAttribute('viewBox', `0 0 ${canvasRect.width} ${canvasRect.height}`);
    const lines = [];
    for (const connection of state.connections) {
      if (!positions.has(connection.sourceId) || !positions.has(connection.targetId)) continue;
      const a = $(`[data-open-object="${CSS.escape(connection.sourceId)}"]`, canvas)?.getBoundingClientRect();
      const b = $(`[data-open-object="${CSS.escape(connection.targetId)}"]`, canvas)?.getBoundingClientRect();
      if (!a || !b) continue;
      const x1 = a.left - canvasRect.left + a.width / 2;
      const y1 = a.top - canvasRect.top + a.height / 2;
      const x2 = b.left - canvasRect.left + b.width / 2;
      const y2 = b.top - canvasRect.top + b.height / 2;
      lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(210,190,255,.24)" stroke-width="1.5" />`);
    }
    svg.innerHTML = lines.join('');
  });
}

function renderSearchPanel() {
  const panel = $('#searchResultsPanel');
  const q = $('#globalSearch').value.trim().toLowerCase();
  if (!q) { panel.hidden = true; panel.innerHTML = ''; return; }

  const people = Object.entries(state.profiles).map(([uid, profile]) => ({ uid, ...profile })).filter(profile => `${profile.displayName || ''} ${profile.bio || ''}`.toLowerCase().includes(q)).slice(0, 4);
  const objects = state.objects.filter(object => `${object.title} ${object.description} ${(object.tags || []).join(' ')}`.toLowerCase().includes(q)).slice(0, 5);
  const posts = state.posts.filter(post => `${post.text} ${publicIdentity(post.authorUid, post.authorName).displayName}`.toLowerCase().includes(q)).slice(0, 5);
  const spaces = allSpaces().filter(space => `${space.name} ${space.description || ''}`.toLowerCase().includes(q)).slice(0, 4);

  const groups = [];
  if (objects.length) groups.push(`<div class="search-group"><b>Ideas / problems / projects</b>${objects.map(object => `<button data-open-object="${escapeHtml(object.id)}" type="button"><span>${escapeHtml(object.title)}</span><small>${escapeHtml(object.kind)}</small></button>`).join('')}</div>`);
  if (posts.length) groups.push(`<div class="search-group"><b>Posts</b>${posts.map(post => `<button data-open-post="${escapeHtml(post.id)}" type="button"><span>${escapeHtml(post.text.slice(0, 86))}${post.text.length > 86 ? '…' : ''}</span><small>${escapeHtml(publicIdentity(post.authorUid, post.authorName).displayName)}</small></button>`).join('')}</div>`);
  if (people.length) groups.push(`<div class="search-group"><b>People</b>${people.map(profile => `<button data-open-profile="${escapeHtml(profile.uid)}" type="button"><span>${escapeHtml(profile.displayName)}</span><small>${escapeHtml(profile.bio || 'Public LCS profile')}</small></button>`).join('')}</div>`);
  if (spaces.length) groups.push(`<div class="search-group"><b>Spaces</b>${spaces.map(space => `<button data-space-filter="${escapeHtml(space.id)}" type="button"><span>${escapeHtml(space.name)}</span><small>${escapeHtml(space.description || '')}</small></button>`).join('')}</div>`);
  panel.innerHTML = groups.length ? groups.join('') : '<div class="search-empty">No matches yet.</div>';
  panel.hidden = false;
}

function openLogicGuide(type) {
  const dialog = $('#logicDialog');
  if (type && reasoning[type]) {
    const r = reasoning[type];
    $('#logicDialogTitle').textContent = `${r.plain} — ${r.formal}`;
    $('#logicDialogBody').innerHTML = `<div class="guide-block"><h3>${r.symbol} ${escapeHtml(r.plain)}</h3><p>${escapeHtml(r.description)}</p><div class="guide-example"><b>Example:</b> ${escapeHtml(r.example)}</div></div>`;
  } else {
    $('#logicDialogTitle').textContent = 'Six useful thought types';
    $('#logicDialogBody').innerHTML = Object.entries(reasoning).filter(([key]) => key !== 'unclassified').map(([, r]) => `<div class="guide-block"><h3>${r.symbol} ${escapeHtml(r.plain)} <small>(${escapeHtml(r.formal)})</small></h3><p>${escapeHtml(r.description)}</p><div class="guide-example">${escapeHtml(r.example)}</div></div>`).join('');
  }
  dialog.showModal();
}

function renderDetailThread() {
  const section = $('#detailThreadSection');
  if (!state.detail || state.detail.type === 'profile') { section.hidden = true; return; }
  section.hidden = false;
  $('#detailCommentList').innerHTML = state.comments.length ? state.comments.map(comment => {
    const identity = publicIdentity(comment.authorUid, comment.authorName, comment.authorPhoto);
    const r = reasoning[comment.reasoningType] || reasoning.unclassified;
    return `<article class="comment-card"><div class="comment-head"><button class="identity-inline" data-open-profile="${escapeHtml(comment.authorUid || '')}" type="button">${escapeHtml(identity.displayName)}</button><span>${timeAgo(comment.createdAt)}</span></div><p>${escapeHtml(comment.text)}</p><span class="type-pill type-${escapeHtml(comment.reasoningType || 'unclassified')}">${escapeHtml(r.plain)}</span></article>`;
  }).join('') : '<div class="thread-empty">No discussion yet. Add the first response.</div>';
  const composer = $('#detailCommentForm');
  composer.hidden = !state.user;
  $('#detailCommentSignIn').hidden = Boolean(state.user);
}

function stopDetailSubscription() {
  if (state.detailUnsub) { state.detailUnsub(); state.detailUnsub = null; }
  state.comments = [];
}

function subscribeDetailComments(type, id) {
  stopDetailSubscription();
  if (!state.firebaseReady) { renderDetailThread(); return; }
  const { db, fsMod } = state.firebase;
  const targetKey = `${type}:${id}`;
  const q = fsMod.query(fsMod.collection(db, 'comments'), fsMod.where('targetKey', '==', targetKey), fsMod.limit(250));
  state.detailUnsub = fsMod.onSnapshot(q, snap => {
    state.comments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => timeValue(a.createdAt) - timeValue(b.createdAt));
    renderDetailThread();
  }, error => {
    console.error('Could not load discussion:', error);
    state.comments = [];
    renderDetailThread();
  });
}

function openPostDetail(postId) {
  const isNewDetail = state.detail?.type !== 'post' || state.detail?.id !== postId;
  const post = state.posts.find(item => item.id === postId);
  if (!post) { toast('That post is no longer available.'); return; }
  state.detail = { type: 'post', id: postId };
  const identity = publicIdentity(post.authorUid, post.authorName, post.authorPhoto);
  const r = reasoning[post.reasoningType] || reasoning.unclassified;
  const helpful = isOwnReaction('post', post.id);
  const links = linkedObjectsForPost(post.id);
  $('#detailEyebrow').textContent = 'Post';
  $('#detailTitle').textContent = `${r.plain} · ${post.kind || 'idea'}`;
  $('#detailBody').innerHTML = `<div class="detail-author-row"><button class="identity-button" data-open-profile="${escapeHtml(post.authorUid || '')}" type="button">${avatarMarkup(identity)}<span><b>${escapeHtml(identity.displayName)}</b><small>${escapeHtml(spaceById(post.spaceId || SYSTEM_SPACE.id).name)} · ${timeAgo(post.createdAt)}</small></span></button></div><p class="detail-main-copy">${escapeHtml(post.text)}</p><div class="detail-pills"><span class="type-pill type-${escapeHtml(post.reasoningType || 'unclassified')}">${escapeHtml(r.plain)} · ${escapeHtml(r.formal)}</span><span class="kind-pill">${escapeHtml(post.kind || 'idea')}</span></div><div class="detail-actions"><button class="ghost-button ${helpful ? 'active-action' : ''}" data-helpful-type="post" data-helpful-id="${escapeHtml(post.id)}" type="button">${helpful ? '♥ Helpful' : '♡ Helpful'} · ${reactionCount('post', post.id)}</button><button class="ghost-button" data-connect-post="${escapeHtml(post.id)}" type="button">↗ Connect to work</button></div><section class="linked-section"><h3>Connected work</h3>${links.length ? links.map(object => `<button class="linked-object" data-open-object="${escapeHtml(object.id)}" type="button"><b>${escapeHtml(object.title)}</b><small>${escapeHtml(object.kind)}</small></button>`).join('') : '<p class="muted">This post is not connected to an idea, problem, or project yet.</p>'}</section>`;
  if (isNewDetail) subscribeDetailComments('post', postId);
  if (!$('#detailDialog').open) $('#detailDialog').showModal();
  renderDetailThread();
}

function relationSentence(connection, objectId) {
  const outgoing = connection.sourceId === objectId;
  const otherId = outgoing ? connection.targetId : connection.sourceId;
  const other = state.objects.find(object => object.id === otherId);
  if (!other) return null;
  const relation = connection.relation || 'related to';
  return { other, text: outgoing ? `${relation} →` : `← ${relation}` };
}

function openObjectDetail(objectId) {
  const isNewDetail = state.detail?.type !== 'object' || state.detail?.id !== objectId;
  const object = state.objects.find(item => item.id === objectId);
  if (!object) { toast('That item is no longer available.'); return; }
  state.detail = { type: 'object', id: objectId };
  const identity = publicIdentity(object.authorUid, object.authorName, object.authorPhoto);
  const relations = relationsForObject(objectId).map(connection => relationSentence(connection, objectId)).filter(Boolean);
  const linkedPosts = state.postLinks.filter(link => link.objectId === objectId).map(link => state.posts.find(post => post.id === link.postId)).filter(Boolean);
  const following = isFollowing('object', object.id);
  const helpful = isOwnReaction('object', object.id);
  $('#detailEyebrow').textContent = object.kind;
  $('#detailTitle').textContent = object.title;
  $('#detailBody').innerHTML = `<div class="detail-author-row"><button class="identity-button" data-open-profile="${escapeHtml(object.authorUid || '')}" type="button">${avatarMarkup(identity)}<span><b>${escapeHtml(identity.displayName)}</b><small>${escapeHtml(spaceById(object.spaceId || SYSTEM_SPACE.id).name)} · ${timeAgo(object.createdAt)}</small></span></button></div><p class="detail-main-copy">${escapeHtml(object.description)}</p><div class="tag-row detail-tags">${(object.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><div class="detail-actions"><button class="ghost-button ${following ? 'active-action' : ''}" data-follow-type="object" data-follow-id="${escapeHtml(object.id)}" type="button">${following ? '★ Following' : '☆ Follow'} · ${followCount('object', object.id)}</button><button class="ghost-button ${helpful ? 'active-action' : ''}" data-helpful-type="object" data-helpful-id="${escapeHtml(object.id)}" type="button">${helpful ? '♥ Helpful' : '♡ Helpful'} · ${reactionCount('object', object.id)}</button><button class="ghost-button" data-connect-object="${escapeHtml(object.id)}" type="button">↗ Connect another item</button></div><section class="linked-section"><h3>Relationships</h3>${relations.length ? relations.map(item => `<button class="linked-object" data-open-object="${escapeHtml(item.other.id)}" type="button"><span>${escapeHtml(item.text)}</span><b>${escapeHtml(item.other.title)}</b><small>${escapeHtml(item.other.kind)}</small></button>`).join('') : '<p class="muted">No object-to-object relationships yet.</p>'}</section><section class="linked-section"><h3>Connected posts</h3>${linkedPosts.length ? linkedPosts.slice(0, 12).map(post => `<button class="linked-object" data-open-post="${escapeHtml(post.id)}" type="button"><b>${escapeHtml(post.text.slice(0, 120))}${post.text.length > 120 ? '…' : ''}</b><small>${escapeHtml(reasoning[post.reasoningType]?.plain || 'Post')}</small></button>`).join('') : '<p class="muted">No posts are connected to this item yet.</p>'}</section>`;
  if (isNewDetail) subscribeDetailComments('object', objectId);
  if (!$('#detailDialog').open) $('#detailDialog').showModal();
  renderDetailThread();
}

function openProfileDetail(uid) {
  if (!uid) return;
  const isNewDetail = state.detail?.type !== 'profile' || state.detail?.id !== uid;
  const profile = state.profiles[uid];
  if (!profile) { toast('That public profile is not available yet.'); return; }
  state.detail = { type: 'profile', id: uid };
  if (isNewDetail) stopDetailSubscription();
  const authoredObjects = state.objects.filter(object => object.authorUid === uid && !object.deleted);
  const authoredPosts = state.posts.filter(post => post.authorUid === uid && !post.deleted);
  const following = isFollowing('profile', uid);
  $('#detailEyebrow').textContent = 'Public profile';
  $('#detailTitle').textContent = profile.displayName || 'Member';
  $('#detailBody').innerHTML = `<div class="profile-detail-hero">${avatarMarkup(profile, 'profile-detail-fallback')}<div><h3>${escapeHtml(profile.displayName || 'Member')}</h3><p>${escapeHtml(profile.bio || 'No public bio yet.')}</p></div></div><div class="detail-actions"><button class="ghost-button ${following ? 'active-action' : ''}" data-follow-type="profile" data-follow-id="${escapeHtml(uid)}" type="button">${following ? '★ Following' : '☆ Follow'} · ${followCount('profile', uid)}</button></div><div class="profile-stats"><div><b>${authoredObjects.length}</b><span>Ideas / problems / projects</span></div><div><b>${authoredPosts.length}</b><span>Posts</span></div></div><section class="linked-section"><h3>Recent work</h3>${authoredObjects.length ? authoredObjects.slice(0, 8).map(object => `<button class="linked-object" data-open-object="${escapeHtml(object.id)}" type="button"><b>${escapeHtml(object.title)}</b><small>${escapeHtml(object.kind)}</small></button>`).join('') : '<p class="muted">No public work yet.</p>'}</section>`;
  $('#detailThreadSection').hidden = true;
  if (!$('#detailDialog').open) $('#detailDialog').showModal();
}

function closeDetail() {
  stopDetailSubscription();
  state.detail = null;
  $('#detailDialog').close();
}

function openCreate(kind = 'idea') {
  if (!requireUser()) return;
  const radio = $(`input[name="kind"][value="${CSS.escape(kind)}"]`, $('#createForm'));
  if (radio) radio.checked = true;
  renderSpaces();
  $('#createDialog').showModal();
}

function openSpaceDialog() {
  if (!requireUser()) return;
  $('#spaceForm').reset();
  $('#spaceDialog').showModal();
}

function openConnect(mode, id) {
  if (!requireUser()) return;
  const sourceObject = mode === 'object' ? state.objects.find(object => object.id === id) : null;
  const options = state.objects.filter(object => !object.deleted && (!sourceObject || object.id !== sourceObject.id)).map(object => `<option value="${escapeHtml(object.id)}">${escapeHtml(object.title)} · ${escapeHtml(object.kind)}</option>`).join('');
  if (!options) { toast('Create another idea, problem, or project first.'); return; }
  state.connectContext = { mode, id };
  $('#connectTargetObject').innerHTML = options;
  $('#connectRelation').value = mode === 'post' ? 'context for' : 'related to';
  $('#connectDialogTitle').textContent = mode === 'post' ? 'Connect this post to work' : 'Connect two pieces of work';
  $('#connectRelationLabel').textContent = mode === 'post' ? 'What is the connection?' : 'How does the first item relate to the second?';
  $('#connectDialog').showModal();
}

async function toggleHelpful(targetType, targetId) {
  if (!requireUser() || !state.firebaseReady) return;
  const { db, fsMod } = state.firebase;
  const id = `${safeId(state.user.uid)}__${safeId(targetType)}__${safeId(targetId)}__helpful`;
  const ref = fsMod.doc(db, 'reactions', id);
  const existing = await fsMod.getDoc(ref);
  if (existing.exists()) await fsMod.deleteDoc(ref);
  else await fsMod.setDoc(ref, { targetKey: `${targetType}:${targetId}`, targetType, targetId, userUid: state.user.uid, type: 'helpful', createdAt: fsMod.serverTimestamp() });
}

async function toggleFollow(targetType, targetId) {
  if (!requireUser() || !state.firebaseReady) return;
  const { db, fsMod } = state.firebase;
  const id = `${safeId(state.user.uid)}__${safeId(targetType)}__${safeId(targetId)}`;
  const ref = fsMod.doc(db, 'follows', id);
  const existing = await fsMod.getDoc(ref);
  if (existing.exists()) await fsMod.deleteDoc(ref);
  else await fsMod.setDoc(ref, { targetKey: `${targetType}:${targetId}`, targetType, targetId, userUid: state.user.uid, createdAt: fsMod.serverTimestamp() });
}

async function publishPost() {
  const text = $('#composerText').value.trim();
  if (!text) { toast('Write something first.'); return; }
  if (text.length > LCS_CONFIG.maxPostLength) { toast(`Posts are limited to ${LCS_CONFIG.maxPostLength} characters.`); return; }
  if (!requireUser() || !state.firebaseReady) return;
  const profile = ownPublicProfile();
  const payload = {
    text,
    reasoningType: state.activeType,
    kind: $('#postKind').value,
    spaceId: $('#postSpace').value || SYSTEM_SPACE.id,
    authorUid: state.user.uid,
    authorName: profile.displayName || 'Member',
    authorPhoto: profile.photoURL || '',
    createdAt: state.firebase.fsMod.serverTimestamp(),
    updatedAt: state.firebase.fsMod.serverTimestamp()
  };
  await state.firebase.fsMod.addDoc(state.firebase.fsMod.collection(state.firebase.db, 'posts'), payload);
  $('#composerText').value = '';
  $('#charCounter').textContent = `0 / ${LCS_CONFIG.maxPostLength}`;
  toast('Published to the network.');
}

async function createObject(event) {
  event.preventDefault();
  if (!requireUser() || !state.firebaseReady) return;
  const kind = $('input[name="kind"]:checked', $('#createForm')).value;
  const title = $('#createTitle').value.trim();
  const description = $('#createDescription').value.trim();
  const tags = $('#createTags').value.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8);
  if (!title || !description) return;
  const profile = ownPublicProfile();
  const payload = {
    kind,
    title,
    description,
    tags,
    spaceId: $('#createSpaceSelect').value || SYSTEM_SPACE.id,
    authorUid: state.user.uid,
    authorName: profile.displayName || 'Member',
    authorPhoto: profile.photoURL || '',
    createdAt: state.firebase.fsMod.serverTimestamp(),
    updatedAt: state.firebase.fsMod.serverTimestamp()
  };
  const ref = await state.firebase.fsMod.addDoc(state.firebase.fsMod.collection(state.firebase.db, 'objects'), payload);
  const relatedId = $('#createRelatedObject').value;
  if (relatedId) {
    await state.firebase.fsMod.addDoc(state.firebase.fsMod.collection(state.firebase.db, 'connections'), {
      sourceId: ref.id,
      targetId: relatedId,
      relation: 'related to',
      authorUid: state.user.uid,
      createdAt: state.firebase.fsMod.serverTimestamp()
    });
  }
  $('#createForm').reset();
  $('#createDialog').close();
  setView(`${kind}s`);
  toast(`${kind[0].toUpperCase() + kind.slice(1)} created.`);
}

async function createSpace(event) {
  event.preventDefault();
  if (!requireUser() || !state.firebaseReady) return;
  const name = $('#spaceName').value.trim().replace(/\s+/g, ' ');
  const description = $('#spaceDescription').value.trim();
  if (name.length < 2 || name.length > 50) { toast('Space names must be 2–50 characters.'); return; }
  if (allSpaces().some(space => space.name.toLowerCase() === name.toLowerCase())) { toast('A space with that name already exists.'); return; }
  await state.firebase.fsMod.addDoc(state.firebase.fsMod.collection(state.firebase.db, 'spaces'), {
    name,
    description,
    ownerUid: state.user.uid,
    createdAt: state.firebase.fsMod.serverTimestamp(),
    updatedAt: state.firebase.fsMod.serverTimestamp()
  });
  $('#spaceDialog').close();
  toast('Space created.');
}

async function submitConnection(event) {
  event.preventDefault();
  if (!requireUser() || !state.firebaseReady || !state.connectContext) return;
  const targetId = $('#connectTargetObject').value;
  const relation = $('#connectRelation').value;
  if (!targetId) return;
  const { db, fsMod } = state.firebase;
  const { mode, id } = state.connectContext;
  if (mode === 'post') {
    if (state.postLinks.some(link => link.postId === id && link.objectId === targetId)) { toast('That post is already connected to this item.'); return; }
    await fsMod.addDoc(fsMod.collection(db, 'postLinks'), { postId: id, objectId: targetId, relation, authorUid: state.user.uid, createdAt: fsMod.serverTimestamp() });
  } else {
    if (state.connections.some(connection => connection.sourceId === id && connection.targetId === targetId && connection.relation === relation)) { toast('That relationship already exists.'); return; }
    await fsMod.addDoc(fsMod.collection(db, 'connections'), { sourceId: id, targetId, relation, authorUid: state.user.uid, createdAt: fsMod.serverTimestamp() });
  }
  $('#connectDialog').close();
  state.connectContext = null;
  toast('Connection saved.');
}

async function submitComment(event) {
  event.preventDefault();
  if (!state.detail || state.detail.type === 'profile') return;
  if (!requireUser() || !state.firebaseReady) return;
  const text = $('#detailCommentText').value.trim();
  if (!text) return;
  const profile = ownPublicProfile();
  await state.firebase.fsMod.addDoc(state.firebase.fsMod.collection(state.firebase.db, 'comments'), {
    targetKey: `${state.detail.type}:${state.detail.id}`,
    targetType: state.detail.type,
    targetId: state.detail.id,
    text,
    reasoningType: $('#detailCommentReasoning').value,
    authorUid: state.user.uid,
    authorName: profile.displayName || 'Member',
    authorPhoto: profile.photoURL || '',
    createdAt: state.firebase.fsMod.serverTimestamp(),
    updatedAt: state.firebase.fsMod.serverTimestamp()
  });
  $('#detailCommentText').value = '';
  toast('Response added.');
}

async function savePublicProfile(event) {
  event.preventDefault();
  if (!requireUser() || !state.firebaseReady) return;
  const displayName = $('#accountDisplayName').value.trim().replace(/\s+/g, ' ');
  const bio = $('#accountBio').value.trim();
  const useGooglePhoto = $('#accountUseGooglePhoto').checked && Boolean(state.user.photoURL);
  if (displayName.length < 2 || displayName.length > 40) { toast('Display name must be 2–40 characters.'); return; }
  if (bio.length > 240) { toast('Public bio must be 240 characters or less.'); return; }
  const button = $('#accountSaveButton');
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const payload = {
      displayName,
      bio,
      useGooglePhoto,
      photoURL: useGooglePhoto ? (state.user.photoURL || '') : '',
      updatedAt: state.firebase.fsMod.serverTimestamp()
    };
    const existing = state.publicProfile || state.profiles[state.user.uid];
    if (!existing?.createdAt) payload.createdAt = state.firebase.fsMod.serverTimestamp();
    await state.firebase.fsMod.setDoc(state.firebase.fsMod.doc(state.firebase.db, 'users', state.user.uid), payload, { merge: true });
    state.publicProfile = { ...(existing || {}), ...payload, updatedAt: Date.now() };
    state.profiles[state.user.uid] = state.publicProfile;
    $('#accountSaveStatus').textContent = 'Saved';
    renderAuth();
    renderFeed();
    renderCatalogs();
    if (state.detail?.type === 'profile' && state.detail.id === state.user.uid) openProfileDetail(state.user.uid);
    toast('Public profile saved.');
  } catch (error) {
    console.error(error);
    $('#accountSaveStatus').textContent = 'Could not save';
    toast('Profile could not be saved.');
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
}

async function ensurePublicProfile(user) {
  const { db, fsMod } = state.firebase;
  const ref = fsMod.doc(db, 'users', user.uid);
  const snap = await fsMod.getDoc(ref);
  if (snap.exists()) {
    state.publicProfile = { id: snap.id, ...snap.data() };
    state.profiles[user.uid] = state.publicProfile;
    return;
  }
  const profile = {
    displayName: generatedPublicName(user),
    bio: '',
    useGooglePhoto: false,
    photoURL: '',
    createdAt: fsMod.serverTimestamp(),
    updatedAt: fsMod.serverTimestamp()
  };
  await fsMod.setDoc(ref, profile);
  state.publicProfile = { ...profile, createdAt: Date.now(), updatedAt: Date.now() };
  state.profiles[user.uid] = state.publicProfile;
  if (!state.profilePrompted) {
    state.profilePrompted = true;
    setView('account');
    toast('Choose the public name people should know you by.');
  }
}

async function signInGoogle() {
  clearAuthError();
  if (!state.firebaseReady) { showAuthError({ code: 'auth/configuration-not-found' }); return; }
  const { auth, authMod } = state.firebase;
  const provider = new authMod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const button = $('#googleSignInButton');
  const oldHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = '<span class="google-g">G</span>Opening Google…';
  try {
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    await authMod.signInWithPopup(auth, provider);
    $('#authDialog').close();
    toast('Signed in. This session is configured to survive page refreshes.');
  } catch (error) {
    console.error('Google sign-in failed:', error);
    showAuthError(error);
  } finally {
    button.disabled = false;
    button.innerHTML = oldHtml;
  }
}

async function signOutUser() {
  if (!state.firebaseReady) return;
  await state.firebase.authMod.signOut(state.firebase.auth);
  if (state.activeView === 'account') setView('home');
  toast('Signed out.');
}

function subscribeCollection(collectionName, apply, options = {}) {
  const { db, fsMod } = state.firebase;
  let q = fsMod.collection(db, collectionName);
  if (options.orderBy) q = fsMod.query(q, fsMod.orderBy(options.orderBy, options.direction || 'desc'), fsMod.limit(options.limit || 250));
  else q = fsMod.query(q, fsMod.limit(options.limit || 500));
  const unsub = fsMod.onSnapshot(q, snap => apply(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))), error => {
    console.error(`Could not subscribe to ${collectionName}:`, error);
    setBackendStatus('Live network needs attention', `Firestore could not read ${collectionName}. Deploy the included firestore.rules and check the database.`, 'error');
  });
  state.unsubs.push(unsub);
}

function refreshDerivedUI() {
  updateCreateRelatedOptions();
  renderSpaces();
  renderFeed();
  renderCatalogs();
  renderTrends();
  renderSearchPanel();
  if (state.activeView === 'universe') renderUniverse();
  if (state.detail?.type === 'post') openPostDetail(state.detail.id);
  if (state.detail?.type === 'object') openObjectDetail(state.detail.id);
}

async function initFirebase() {
  if (!isFirebaseConfigured()) {
    state.authReady = true;
    setBackendStatus('Backend configuration missing', 'This build is live-backend only. Add the Firebase Web App configuration in assets/js/config.js.', 'error');
    $('#authSetupWarning').hidden = false;
    renderAuth();
    renderSpaces();
    renderFeed();
    renderCatalogs();
    return;
  }

  try {
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);
    const app = appMod.initializeApp(LCS_CONFIG.firebase);
    const auth = authMod.getAuth(app);
    authMod.useDeviceLanguage(auth);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    const db = fsMod.getFirestore(app);
    state.firebase = { app, auth, db, authMod, fsMod };
    state.firebaseReady = true;

    subscribeCollection('users', rows => {
      state.profiles = Object.fromEntries(rows.map(profile => [profile.id, profile]));
      if (state.user && state.profiles[state.user.uid]) state.publicProfile = state.profiles[state.user.uid];
      renderAuth();
      renderFeed();
      renderCatalogs();
      renderSearchPanel();
    }, { limit: 750 });
    subscribeCollection('posts', rows => { state.posts = rows; renderFeed(); renderSearchPanel(); if (state.detail?.type === 'post') openPostDetail(state.detail.id); }, { orderBy: 'createdAt', limit: 160 });
    subscribeCollection('objects', rows => { state.objects = rows; refreshDerivedUI(); }, { orderBy: 'createdAt', limit: 240 });
    subscribeCollection('spaces', rows => { state.spaces = rows; renderSpaces(); renderFeed(); renderCatalogs(); renderSearchPanel(); }, { orderBy: 'createdAt', limit: 150 });
    subscribeCollection('reactions', rows => { state.reactions = rows; renderFeed(); renderCatalogs(); if (state.detail?.type === 'post') openPostDetail(state.detail.id); if (state.detail?.type === 'object') openObjectDetail(state.detail.id); }, { limit: 2000 });
    subscribeCollection('follows', rows => { state.follows = rows; renderCatalogs(); if (state.detail?.type === 'object') openObjectDetail(state.detail.id); if (state.detail?.type === 'profile') openProfileDetail(state.detail.id); }, { limit: 2000 });
    subscribeCollection('connections', rows => { state.connections = rows; renderTrends(); if (state.activeView === 'universe') renderUniverse(); if (state.detail?.type === 'object') openObjectDetail(state.detail.id); }, { limit: 1200 });
    subscribeCollection('postLinks', rows => { state.postLinks = rows; renderFeed(); if (state.detail?.type === 'post') openPostDetail(state.detail.id); if (state.detail?.type === 'object') openObjectDetail(state.detail.id); }, { limit: 1200 });

    authMod.onAuthStateChanged(auth, async user => {
      state.user = user || null;
      state.authReady = true;
      state.publicProfile = null;
      if (user) {
        try { await ensurePublicProfile(user); }
        catch (error) { console.error('Could not load public profile:', error); state.publicProfile = fallbackPublicProfile(user); }
        setBackendStatus('Live network connected', 'Google identity, persistent authentication, and Firestore realtime data are active.', 'ok');
      } else {
        setBackendStatus('Live network connected', 'Public content is live. Sign in with Google to publish, follow, react, connect, and create.', 'ok');
      }
      renderAuth();
      renderAccount();
      renderFeed();
      renderCatalogs();
      renderDetailThread();
    });

    if (typeof auth.authStateReady === 'function') await auth.authStateReady();
    if (!state.authReady) {
      state.user = auth.currentUser || null;
      state.authReady = true;
      if (state.user) await ensurePublicProfile(state.user);
      renderAuth();
    }
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    state.authReady = true;
    setBackendStatus('Could not connect to Firebase', 'The site loaded, but live authentication or Firestore did not initialize. Check Firebase configuration, authorized domains, and browser console.', 'error');
    renderAuth();
    renderSpaces();
  }
}

function updateCreateRelatedOptions() {
  const select = $('#createRelatedObject');
  const current = select.value;
  select.innerHTML = '<option value="">No initial relationship</option>' + state.objects.filter(object => !object.deleted).slice(0, 200).map(object => `<option value="${escapeHtml(object.id)}">${escapeHtml(object.title)} · ${escapeHtml(object.kind)}</option>`).join('');
  if ([...select.options].some(option => option.value === current)) select.value = current;
}

function bindUI() {
  document.addEventListener('click', event => {
    const target = event.target.closest('button,a');
    if (!target) return;

    if (target.matches('[data-open-account]')) { event.preventDefault(); setView('account'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (target.matches('[data-open-auth]')) { event.preventDefault(); clearAuthError(); $('#authDialog').showModal(); return; }
    if (target.matches('#signOutButton')) { signOutUser().catch(console.error); return; }
    if (target.matches('[data-open-post]')) { openPostDetail(target.dataset.openPost); return; }
    if (target.matches('[data-open-object]')) { openObjectDetail(target.dataset.openObject); return; }
    if (target.matches('[data-open-profile]')) { openProfileDetail(target.dataset.openProfile); return; }
    if (target.matches('[data-helpful-type]')) { toggleHelpful(target.dataset.helpfulType, target.dataset.helpfulId).catch(error => { console.error(error); toast('Could not update that reaction.'); }); return; }
    if (target.matches('[data-follow-type]')) { toggleFollow(target.dataset.followType, target.dataset.followId).catch(error => { console.error(error); toast('Could not update that follow.'); }); return; }
    if (target.matches('[data-connect-post]')) { openConnect('post', target.dataset.connectPost); return; }
    if (target.matches('[data-connect-object]')) { openConnect('object', target.dataset.connectObject); return; }
    if (target.matches('[data-reason]')) { openLogicGuide(target.dataset.reason); return; }
    if (target.matches('[data-space-filter]')) {
      state.activeSpaceId = target.dataset.spaceFilter;
      renderSpaces(); renderFeed(); renderCatalogs(); renderUniverse();
      $('#searchResultsPanel').hidden = true;
      return;
    }
    if (target.matches('[data-close-dialog]')) { target.closest('dialog')?.close(); return; }
  });

  $$('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $$('.thought-chip').forEach(button => button.addEventListener('click', () => {
    $$('.thought-chip').forEach(item => item.classList.remove('selected'));
    button.classList.add('selected');
    state.activeType = button.dataset.type;
  }));
  $$('.segment').forEach(button => button.addEventListener('click', () => {
    $$('.segment').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    state.activeFilter = button.dataset.filter;
    renderFeed();
  }));

  $('#composerText').addEventListener('input', event => { $('#charCounter').textContent = `${event.target.value.length} / ${LCS_CONFIG.maxPostLength}`; });
  $('#publishButton').addEventListener('click', () => publishPost().catch(error => { console.error(error); toast('Could not publish that post.'); }));
  $('#googleSignInButton').addEventListener('click', () => signInGoogle().catch(console.error));
  $('#accountSignInButton').addEventListener('click', () => { clearAuthError(); $('#authDialog').showModal(); });
  $('#accountSignOutButton').addEventListener('click', () => signOutUser().catch(console.error));
  $('#accountProfileForm').addEventListener('submit', event => savePublicProfile(event).catch(console.error));
  $('#accountDisplayName').addEventListener('input', updateAccountPreview);
  $('#accountBio').addEventListener('input', updateAccountPreview);
  $('#accountUseGooglePhoto').addEventListener('change', updateAccountPreview);

  $('#openLogicGuide').addEventListener('click', () => openLogicGuide());
  $('#explainButton').addEventListener('click', () => openLogicGuide());
  $$('[data-guide]').forEach(button => button.addEventListener('click', () => openLogicGuide(button.dataset.guide)));

  $('#newSpaceButton').addEventListener('click', openSpaceDialog);
  $$('.quick-create').forEach(button => button.addEventListener('click', () => { updateCreateRelatedOptions(); openCreate(button.dataset.kind); }));
  $('#createForm').addEventListener('submit', event => createObject(event).catch(error => { console.error(error); toast('Could not create that item.'); }));
  $('#spaceForm').addEventListener('submit', event => createSpace(event).catch(error => { console.error(error); toast('Could not create that space.'); }));
  $('#connectForm').addEventListener('submit', event => submitConnection(event).catch(error => { console.error(error); toast('Could not save that connection.'); }));
  $('#detailCommentForm').addEventListener('submit', event => submitComment(event).catch(error => { console.error(error); toast('Could not add that response.'); }));
  $('#detailCommentSignIn').addEventListener('click', () => { clearAuthError(); $('#authDialog').showModal(); });

  $('#globalSearch').addEventListener('input', () => { renderSearchPanel(); renderFeed(); renderCatalogs(); if (state.activeView === 'universe') renderUniverse(); });
  $('#globalSearch').addEventListener('keydown', event => { if (event.key === 'Escape') { event.currentTarget.value = ''; renderSearchPanel(); renderFeed(); renderCatalogs(); } });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#globalSearch').focus(); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('.top-search')) $('#searchResultsPanel').hidden = true; });

  $('#focusMapButton').addEventListener('click', () => { state.mapLayoutSeed += 1; renderUniverse(); toast('Map re-centered.'); });
  window.addEventListener('resize', () => { if (state.activeView === 'universe') renderUniverse(); });
  $('#detailDialog').addEventListener('close', () => { stopDetailSubscription(); state.detail = null; });

  window.addEventListener('hashchange', () => setView(location.hash.replace('#', '') || 'home', false));
}

function initialRender() {
  renderSpaces();
  renderAuth();
  renderFeed();
  renderCatalogs();
  renderTrends();
  updateCreateRelatedOptions();
  const requestedView = location.hash.replace('#', '') || 'home';
  setView(requestedView, false);
}

bindUI();
initialRender();
initFirebase();
