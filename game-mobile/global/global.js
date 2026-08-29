import { db, fs, watchIdentity, profileById, avatarSvg } from '/game/assets/js/eras-data.js';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const lobbyId = params.get('lobby') || '';
const worldId = lobbyId ? `lobby:${lobbyId}` : 'global';

// Every E.R.A.S. battlefield shares the same sixty-second world turn.
// Turn 1 begins at the public E.R.A.S. tactical baseline epoch.
const TURN_LENGTH_MS = 60_000;
const TURN_EPOCH_MS = Date.UTC(2026, 7, 29, 0, 0, 0);
const MOVE_BUDGET = 40;
const MOVE_SPEED = 10;
const GAME_LOG_TURNS = 10;

const state = {
  identity: null,
  x: 50,
  y: 50,
  vx: 0,
  vy: 0,
  moveUsed: 0,
  turnNumber: 0,
  lastFrame: performance.now(),
  lastWrite: 0,
  lastHeartbeat: 0,
  dirty: false,
  velocityDirty: false,
  presenceUnsub: null,
  actionUnsub: null,
  profiles: new Map(),
  remote: new Map(),
  keys: new Set(),
  touch: new Set(),
  tokenMap: new Map(),
  autoTarget: null,
  selectedTarget: null,
  actions: new Map(),
  ownQueuedActionId: '',
  resolvedSeen: new Set(),
  serverOffsetMs: 0,
  pendingClockSentAt: 0,
  pruningActions: new Set(),
  lastPruneAt: 0
};

const message = text => {
  const el = $('#globalMessage');
  if (el) el.textContent = String(text).toUpperCase();
};

function clockNow() {
  return Date.now() + state.serverOffsetMs;
}

function turnInfo(now = clockNow()) {
  const elapsed = Math.max(0, now - TURN_EPOCH_MS);
  const turnNumber = Math.floor(elapsed / TURN_LENGTH_MS) + 1;
  const inTurn = elapsed % TURN_LENGTH_MS;
  return {
    turnNumber,
    remainingMs: TURN_LENGTH_MS - inTurn,
    progress: inTurn / TURN_LENGTH_MS
  };
}

function presenceId(profileId) {
  return `${profileId}__${worldId}`.replace(/\//g, '_');
}

function sampleServerClock(serverMillis) {
  if (!state.pendingClockSentAt || !Number.isFinite(serverMillis)) return;
  const receivedAt = Date.now();
  const rtt = receivedAt - state.pendingClockSentAt;
  if (rtt < 0 || rtt > 6000) return;
  const midpoint = state.pendingClockSentAt + rtt / 2;
  const estimate = serverMillis - midpoint;
  // Smooth clock corrections so the visible global timer never jumps around.
  state.serverOffsetMs = state.serverOffsetMs * 0.72 + estimate * 0.28;
  state.pendingClockSentAt = 0;
}

async function loadWorldName() {
  if (!lobbyId) {
    $('#worldName').textContent = 'GLOBAL TABLE';
    return;
  }
  try {
    const snap = await fs.getDoc(fs.doc(db, 'gameLobbies', lobbyId));
    if (snap.exists()) {
      $('#worldName').textContent = snap.data().name || 'HOSTED GAME';
      const member = state.identity?.profileId;
      if (member) {
        await fs.setDoc(fs.doc(db, 'gameLobbies', lobbyId, 'members', member), {
          profileId: member,
          role: snap.data().hostProfileId === member ? 'host' : 'player',
          joinedAt: fs.serverTimestamp(),
          lastSeenAt: fs.serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
}

async function getProfile(id) {
  if (state.profiles.has(id)) return state.profiles.get(id);
  const profile = await profileById(id);
  if (profile) state.profiles.set(id, profile);
  return profile;
}

function targetLabel(target) {
  if (!target) return 'NONE';
  if (target.type === 'profile') {
    return state.profiles.get(target.id)?.displayName || target.label || 'PLAYER';
  }
  return target.label || target.id || 'OBJECT';
}

function setSelectedTarget(target) {
  state.selectedTarget = target;
  document.querySelectorAll('.player-token.is-selected').forEach(el => el.classList.remove('is-selected'));
  document.querySelectorAll('.battle-object.is-selected').forEach(el => el.classList.remove('is-selected'));
  if (target?.type === 'profile') state.tokenMap.get(target.id)?.classList.add('is-selected');
  if (target?.type === 'object') document.querySelector(`[data-tactical-target="${CSS.escape(target.id)}"]`)?.classList.add('is-selected');
  renderActionPanel();
}

function ensureToken(id, profile, isLocal = false) {
  let el = state.tokenMap.get(id);
  if (el) return el;

  el = document.createElement('div');
  el.className = `player-token${isLocal ? ' is-local' : ''}`;
  el.dataset.profileId = id;
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `${profile?.displayName || 'Member'} token`);

  const base = document.createElement('div');
  base.className = 'player-base';

  const avatar = document.createElement('div');
  avatar.className = 'player-avatar';
  avatar.innerHTML = avatarSvg(profile || { displayName: 'Member' });

  const statusPip = document.createElement('i');
  statusPip.className = 'player-action-pip';
  statusPip.setAttribute('aria-hidden', 'true');

  base.append(avatar, statusPip);

  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = profile?.displayName || 'Member';

  const sub = document.createElement('small');
  sub.className = 'player-token-state';
  sub.textContent = isLocal ? 'YOU' : 'PLAYER';

  el.append(base, name, sub);

  const select = event => {
    event.stopPropagation();
    state.autoTarget = null;
    if (isLocal) {
      setSelectedTarget(null);
      message(`Movement ${Math.max(0, MOVE_BUDGET - state.moveUsed).toFixed(1)} / ${MOVE_BUDGET} remaining this global turn.`);
      return;
    }
    setSelectedTarget({ type: 'profile', id, label: profile?.displayName || 'Player' });
    message(`${profile?.displayName || 'Player'} selected. Queue an attack or interaction before the marker.`);
  };
  el.addEventListener('click', select);
  el.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') select(event);
  });

  $('#globalMap').appendChild(el);
  state.tokenMap.set(id, el);
  return el;
}

function updateToken(el, x, y) {
  el.style.left = `${Math.max(2, Math.min(98, x))}%`;
  el.style.top = `${Math.max(3, Math.min(96, y))}%`;
}

function renderLocalBase() {
  const id = state.identity?.profileId;
  if (!id) return;
  const el = state.tokenMap.get(id);
  if (!el) return;
  const ratio = Math.max(0, Math.min(1, state.moveUsed / MOVE_BUDGET));
  el.style.setProperty('--move-angle', `${ratio * 360}deg`);
  el.classList.toggle('is-exhausted', ratio >= 0.999);
  const label = el.querySelector('.player-token-state');
  if (label) label.textContent = ratio >= 0.999 ? 'RESTING' : 'YOU';
}

function setRemoteSnapshot(id, data) {
  const prev = state.remote.get(id);
  const ts = data.updatedAt?.toMillis?.() || Date.now();
  const x = Number(data.x || 50);
  const y = Number(data.y || 50);
  const vx = Number(data.vx || 0);
  const vy = Number(data.vy || 0);
  const stopped = vx === 0 && vy === 0;
  const turnNumber = Number(data.turnNumber || 0);
  const moveUsed = Number(data.moveUsed || 0);
  if (prev) {
    Object.assign(prev, { x, y, vx, vy, ts, receivedAt: Date.now(), stopped, turnNumber, moveUsed });
    if (!Number.isFinite(prev.renderX)) prev.renderX = x;
    if (!Number.isFinite(prev.renderY)) prev.renderY = y;
  } else {
    state.remote.set(id, { x, y, vx, vy, ts, receivedAt: Date.now(), stopped, turnNumber, moveUsed, renderX: x, renderY: y });
  }
}

async function ensureRemoteTokens() {
  for (const [id, remote] of state.remote) {
    if (id === state.identity?.profileId) continue;
    let el = state.tokenMap.get(id);
    if (!el) el = ensureToken(id, await getProfile(id), false);
    const ratio = remote.turnNumber === state.turnNumber ? Math.max(0, Math.min(1, remote.moveUsed / MOVE_BUDGET)) : 0;
    el.style.setProperty('--move-angle', `${ratio * 360}deg`);
    el.classList.toggle('is-exhausted', ratio >= 0.999);
  }
}

function renderRemote(dt) {
  const now = clockNow();
  for (const [id, p] of [...state.remote]) {
    if (id === state.identity?.profileId) continue;
    if (p.ts && now - p.ts > 25_000) {
      state.remote.delete(id);
      state.tokenMap.get(id)?.remove();
      state.tokenMap.delete(id);
      continue;
    }
    const el = state.tokenMap.get(id);
    if (!el) continue;
    const serverAge = p.ts ? Math.max(0, (now - p.ts) / 1000) : 0;
    const receiveAge = p.receivedAt ? Math.max(0, (Date.now() - p.receivedAt) / 1000) : 0;
    const elapsed = p.stopped ? 0 : Math.min(1.55, serverAge);
    const tx = Math.max(2, Math.min(98, p.x + p.vx * elapsed));
    const ty = Math.max(3, Math.min(96, p.y + p.vy * elapsed));
    const dx = tx - p.renderX;
    const dy = ty - p.renderY;
    if (Math.hypot(dx, dy) > 18) {
      p.renderX = tx;
      p.renderY = ty;
    } else {
      const strength = p.stopped ? 18 : (receiveAge < .16 ? 13 : 10);
      const blend = 1 - Math.exp(-strength * dt);
      p.renderX += dx * blend;
      p.renderY += dy * blend;
    }
    updateToken(el, p.renderX, p.renderY);
  }
}

function watchPresence() {
  state.presenceUnsub?.();
  const q = fs.query(fs.collection(db, 'gamePresence'), fs.where('worldId', '==', worldId));
  state.presenceUnsub = fs.onSnapshot(q, snap => {
    const seen = new Set();
    snap.forEach(d => {
      const data = { id: d.id, ...d.data() };
      seen.add(data.profileId);
      if (data.profileId === state.identity?.profileId) {
        if (!d.metadata.hasPendingWrites) sampleServerClock(data.updatedAt?.toMillis?.());
      } else {
        setRemoteSnapshot(data.profileId, data);
      }
    });
    for (const id of [...state.remote.keys()]) {
      if (!seen.has(id)) {
        state.remote.delete(id);
        state.tokenMap.get(id)?.remove();
        state.tokenMap.delete(id);
      }
    }
    $('#worldState').textContent = `ONLINE // ${snap.size} TOKEN${snap.size === 1 ? '' : 'S'}`;
    ensureRemoteTokens();
  }, error => {
    console.error(error);
    $('#worldState').textContent = 'FIRESTORE PRESENCE ERROR';
    message(`WORLD ERROR: ${error.code || error.message}`);
  });
}

async function restorePosition() {
  if (!state.identity?.profileId) return;
  try {
    const ref = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
    const snap = await fs.getDoc(ref);
    if (snap.exists() && snap.data().worldId === worldId) {
      state.x = Number(snap.data().x || 50);
      state.y = Number(snap.data().y || 50);
      const currentTurn = turnInfo().turnNumber;
      if (Number(snap.data().turnNumber || 0) === currentTurn) {
        state.moveUsed = Math.max(0, Number(snap.data().moveUsed || 0));
      }
    }
    updateToken(ensureToken(state.identity.profileId, state.identity.profile, true), state.x, state.y);
    renderLocalBase();
  } catch (error) {
    console.error(error);
  }
}

async function flushPresence(force = false) {
  if (!state.identity?.profileId) return;
  const now = performance.now();
  const moving = state.vx !== 0 || state.vy !== 0;
  if (!force && !state.dirty && now - state.lastHeartbeat < 15_000) return;
  const minGap = state.velocityDirty ? 180 : (moving ? 1400 : 3000);
  if (!force && state.dirty && now - state.lastWrite < minGap) return;

  state.lastWrite = now;
  state.lastHeartbeat = now;
  state.dirty = false;
  state.velocityDirty = false;
  state.pendingClockSentAt = Date.now();

  try {
    await fs.setDoc(fs.doc(db, 'gamePresence', presenceId(state.identity.profileId)), {
      worldId,
      profileId: state.identity.profileId,
      x: state.x,
      y: state.y,
      vx: state.vx,
      vy: state.vy,
      turnNumber: state.turnNumber,
      moveUsed: state.moveUsed,
      updatedAt: fs.serverTimestamp()
    });
    if (lobbyId) {
      fs.updateDoc(fs.doc(db, 'gameLobbies', lobbyId, 'members', state.identity.profileId), {
        lastSeenAt: fs.serverTimestamp()
      }).catch(() => {});
    }
  } catch (error) {
    console.error(error);
    message(`PRESENCE WRITE FAILED: ${error.code || error.message}`);
  }
}

function rawDirection() {
  const has = key => state.keys.has(key) || state.touch.has(key);
  let dx = (has('right') ? 1 : 0) - (has('left') ? 1 : 0);
  let dy = (has('down') ? 1 : 0) - (has('up') ? 1 : 0);
  if (dx && dy) {
    dx *= .7071;
    dy *= .7071;
  }
  return [dx, dy];
}

function autoDirection() {
  if (!state.autoTarget) return [0, 0];
  const dx = state.autoTarget.x - state.x;
  const dy = state.autoTarget.y - state.y;
  const distance = Math.hypot(dx, dy);
  if (distance < .35) {
    state.autoTarget = null;
    return [0, 0];
  }
  return [dx / distance, dy / distance];
}

function direction() {
  const raw = rawDirection();
  if (raw[0] || raw[1]) return raw;
  return autoDirection();
}

function syncVelocity() {
  const [dx, dy] = direction();
  const remaining = Math.max(0, MOVE_BUDGET - state.moveUsed);
  const allowed = remaining > .001;
  const nvx = allowed ? dx * MOVE_SPEED : 0;
  const nvy = allowed ? dy * MOVE_SPEED : 0;
  const changed = nvx !== state.vx || nvy !== state.vy;
  if (changed) {
    state.vx = nvx;
    state.vy = nvy;
    state.dirty = true;
    state.velocityDirty = true;
  }
  return { dx, dy, changed, allowed };
}

function publishInputChange() {
  const next = syncVelocity();
  if (next.changed) flushPresence(true);
  return next;
}

function stopAllMovement(clearAuto = false) {
  const hadMovement = state.keys.size || state.touch.size || state.vx !== 0 || state.vy !== 0;
  state.keys.clear();
  state.touch.clear();
  if (clearAuto) state.autoTarget = null;
  syncVelocity();
  if (hadMovement) flushPresence(true);
}

function movementStep(dt) {
  const { dx, dy, allowed } = syncVelocity();
  if ((!dx && !dy) || !allowed) return false;

  const remaining = Math.max(0, MOVE_BUDGET - state.moveUsed);
  const wantedDistance = MOVE_SPEED * dt;
  const actualDistance = Math.min(remaining, wantedDistance);
  if (actualDistance <= 0) return false;

  state.x = Math.max(3, Math.min(97, state.x + dx * actualDistance));
  state.y = Math.max(5, Math.min(94, state.y + dy * actualDistance));
  state.moveUsed = Math.min(MOVE_BUDGET, state.moveUsed + actualDistance);
  state.dirty = true;

  const el = state.tokenMap.get(state.identity.profileId);
  if (el) updateToken(el, state.x, state.y);
  renderLocalBase();
  renderMovementHud();

  if (state.moveUsed >= MOVE_BUDGET - .001) {
    syncVelocity();
    flushPresence(true);
    message('Movement limit reached. Rest until the global turn marker.');
  }
  return true;
}

function renderMovementHud() {
  const remaining = Math.max(0, MOVE_BUDGET - state.moveUsed);
  const remainingEl = $('#moveRemaining');
  const bar = $('#moveBudgetBar');
  if (remainingEl) remainingEl.textContent = `${remaining.toFixed(1)} / ${MOVE_BUDGET}`;
  if (bar) bar.style.setProperty('--budget-left', `${Math.max(0, Math.min(100, remaining / MOVE_BUDGET * 100))}%`);
  const auto = $('#autoMoveState');
  if (auto) auto.textContent = state.autoTarget ? `AUTO → ${state.autoTarget.x.toFixed(0)}, ${state.autoTarget.y.toFixed(0)}` : 'CLICK / TAP BOARD TO AUTO-MOVE';
}

function markerWindowLabel(turn, currentTurn) {
  const age = Math.max(0, currentTurn - turn);
  if (age === 0) return 'CURRENT WINDOW';
  if (age === 1) return 'LAST MARKER';
  return `${age} MARKERS AGO`;
}

function actionStatusLabel(action) {
  if (action.status === 'cancelled') return 'CANCELLED';
  if (action.status === 'resolved') return 'RESOLVED';
  return 'QUEUED';
}

function renderGameLog() {
  const host = $('#gameLog');
  if (!host) return;
  const currentTurn = turnInfo().turnNumber;
  const groups = [];
  for (let age = 0; age < GAME_LOG_TURNS; age += 1) {
    const turn = currentTurn - age;
    if (turn < 1) break;
    const actions = [...state.actions.values()]
      .filter(action => Number(action.declaredTurn || 0) === turn)
      .sort((a, b) => {
        const at = a.createdAt?.toMillis?.() || 0;
        const bt = b.createdAt?.toMillis?.() || 0;
        return bt - at;
      });
    const rows = actions.map(action => {
      const actor = state.profiles.get(action.actorProfileId)?.displayName
        || (action.actorProfileId === state.identity?.profileId ? 'YOU' : 'PLAYER');
      const verb = action.actionType === 'attack' ? 'ATTACK' : 'INTERACT';
      return `<li><b>${escapeLog(actor)}</b><span>${verb} → ${escapeLog(action.targetLabel || 'TARGET')}</span><em data-status="${action.status}">${actionStatusLabel(action)}</em></li>`;
    }).join('');
    groups.push(`<section class="game-log-turn${age === 0 ? ' is-current' : ''}"><h3>${markerWindowLabel(turn, currentTurn)}</h3>${rows ? `<ul>${rows}</ul>` : '<p>NO DECLARATIONS</p>'}</section>`);
  }
  host.innerHTML = groups.join('');
}

function escapeLog(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function pruneOldActions(force = false) {
  const now = Date.now();
  if (!force && now - state.lastPruneAt < 20_000) return;
  state.lastPruneAt = now;
  const cutoffTurn = turnInfo().turnNumber - (GAME_LOG_TURNS - 1);
  const stale = [...state.actions.entries()].filter(([, action]) => Number(action.declaredTurn || 0) < cutoffTurn);
  for (const [id] of stale) {
    if (state.pruningActions.has(id)) continue;
    state.pruningActions.add(id);
    fs.deleteDoc(fs.doc(db, 'gameActions', id))
      .catch(() => {})
      .finally(() => state.pruningActions.delete(id));
  }
}

function applyTurnChange(nextTurn) {
  const previous = state.turnNumber;
  state.turnNumber = nextTurn;
  state.moveUsed = 0;
  renderLocalBase();
  renderMovementHud();
  processResolvedActions(nextTurn);
  syncVelocity();
  state.dirty = true;
  state.velocityDirty = true;
  flushPresence(true);
  if (previous) message('GLOBAL MARKER // refreshed. Movement and actions restored.');
  renderGameLog();
  pruneOldActions(true);
}

function renderTurnClock() {
  const info = turnInfo();
  if (info.turnNumber !== state.turnNumber) applyTurnChange(info.turnNumber);

  const seconds = Math.max(0, Math.ceil(info.remainingMs / 1000));
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const countdown = $('#turnCountdown');
  const ring = $('#turnProgress');
  const stateEl = $('#turnState');
  if (countdown) countdown.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (ring) ring.style.setProperty('--turn-angle', `${info.progress * 360}deg`);
  if (stateEl) {
    stateEl.textContent = state.moveUsed >= MOVE_BUDGET - .001
      ? 'RESTING // NEXT REFRESH AT MARKER'
      : 'LIVE DECLARATION WINDOW';
  }
}

function actionDocPayload(actionType) {
  const target = state.selectedTarget;
  if (!target || !state.identity?.profileId) return null;
  const current = turnInfo().turnNumber;
  return {
    worldId,
    actorProfileId: state.identity.profileId,
    actionType,
    targetType: target.type,
    targetId: target.id,
    targetLabel: targetLabel(target).slice(0, 80),
    declaredTurn: current,
    resolveTurn: current + 1,
    status: 'queued',
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp(),
    resolvedAt: null
  };
}

async function queueAction(actionType) {
  if (!state.identity?.profileId) {
    message('Sign in before declaring an action.');
    return;
  }
  if (!state.selectedTarget) {
    message('Select a player or battlefield object first.');
    return;
  }
  if (state.ownQueuedActionId) {
    message('Cancel your current declaration before replacing it.');
    return;
  }
  if (actionType === 'attack' && state.selectedTarget.type !== 'profile') {
    message('Attack requires another player token as the target.');
    return;
  }

  const id = crypto.randomUUID();
  const payload = actionDocPayload(actionType);
  try {
    await fs.setDoc(fs.doc(db, 'gameActions', id), payload);
    state.ownQueuedActionId = id;
    message(`${actionType} declared. It resolves at the next global turn marker and may be cancelled until then.`);
    renderActionPanel();
  } catch (error) {
    console.error(error);
    message(`ACTION QUEUE FAILED: ${error.code || error.message}`);
  }
}

async function cancelQueuedAction() {
  const id = state.ownQueuedActionId;
  if (!id) return;
  const action = state.actions.get(id);
  if (!action || action.status !== 'queued' || turnInfo().turnNumber >= Number(action.resolveTurn || 0)) {
    message('That action has already reached its turn marker.');
    return;
  }
  try {
    await fs.updateDoc(fs.doc(db, 'gameActions', id), {
      status: 'cancelled',
      updatedAt: fs.serverTimestamp(),
      resolvedAt: null
    });
    state.ownQueuedActionId = '';
    message('Declared action cancelled before resolution.');
    renderActionPanel();
  } catch (error) {
    console.error(error);
    message(`CANCEL FAILED: ${error.code || error.message}`);
  }
}

function pulseTarget(action) {
  let el = null;
  if (action.targetType === 'profile') el = state.tokenMap.get(action.targetId);
  if (action.targetType === 'object') el = document.querySelector(`[data-tactical-target="${CSS.escape(action.targetId)}"]`);
  if (!el) return;
  el.classList.remove('action-resolved');
  void el.offsetWidth;
  el.classList.add('action-resolved');
  setTimeout(() => el.classList.remove('action-resolved'), 1200);
}

function processResolvedActions(currentTurn) {
  for (const [id, action] of state.actions) {
    const resolveTurn = Number(action.resolveTurn || 0);
    // Cancelled declarations never fire. Resolved declarations are still
    // rendered if this client received the marker a little later than the actor.
    if (action.status === 'cancelled' || resolveTurn > currentTurn || resolveTurn < currentTurn - 1 || state.resolvedSeen.has(id)) continue;
    state.resolvedSeen.add(id);
    pulseTarget(action);
    const actorName = state.profiles.get(action.actorProfileId)?.displayName || (action.actorProfileId === state.identity?.profileId ? 'YOU' : 'PLAYER');
    message(`${actorName} ${action.actionType === 'attack' ? 'ATTACK' : 'INTERACTION'} RESOLVED → ${action.targetLabel || 'TARGET'}.`);
    if (action.status === 'queued' && action.actorProfileId === state.identity?.profileId) {
      state.ownQueuedActionId = '';
      fs.updateDoc(fs.doc(db, 'gameActions', id), {
        status: 'resolved',
        updatedAt: fs.serverTimestamp(),
        resolvedAt: fs.serverTimestamp()
      }).catch(() => {});
    }
  }
  renderActionPanel();
}

function renderActionPanel() {
  const target = $('#selectedTarget');
  const queued = $('#queuedAction');
  const attack = $('#queueAttack');
  const interact = $('#queueInteract');
  const cancel = $('#cancelAction');
  if (target) target.textContent = targetLabel(state.selectedTarget);

  const ownAction = state.ownQueuedActionId ? state.actions.get(state.ownQueuedActionId) : null;
  if (queued) {
    if (ownAction?.status === 'queued') {
      queued.textContent = `${ownAction.actionType.toUpperCase()} → ${ownAction.targetLabel} // NEXT MARKER`;
    } else {
      queued.textContent = 'NONE';
    }
  }
  const hasTarget = Boolean(state.selectedTarget);
  const locked = Boolean(ownAction?.status === 'queued');
  if (attack) attack.disabled = !hasTarget || state.selectedTarget?.type !== 'profile' || locked;
  if (interact) interact.disabled = !hasTarget || locked;
  if (cancel) cancel.disabled = !locked;
}

function watchActions() {
  state.actionUnsub?.();
  const q = fs.query(fs.collection(db, 'gameActions'), fs.where('worldId', '==', worldId));
  state.actionUnsub = fs.onSnapshot(q, snap => {
    const next = new Map();
    snap.forEach(docSnap => {
      const action = { id: docSnap.id, ...docSnap.data() };
      next.set(action.id, action);
      if (action.actorProfileId === state.identity?.profileId && action.status === 'queued' && Number(action.resolveTurn || 0) > turnInfo().turnNumber) {
        state.ownQueuedActionId = action.id;
      }
      if (action.actorProfileId && !state.profiles.has(action.actorProfileId)) getProfile(action.actorProfileId).then(renderGameLog).catch(() => {});
    });
    state.actions = next;
    if (state.ownQueuedActionId && !state.actions.has(state.ownQueuedActionId)) state.ownQueuedActionId = '';
    processResolvedActions(turnInfo().turnNumber);
    renderActionPanel();
    renderGameLog();
    pruneOldActions();
  }, error => {
    console.error(error);
    message(`ACTION FEED ERROR: ${error.code || error.message}`);
  });
}

function setupBattlefieldTargets() {
  document.querySelectorAll('[data-tactical-target]').forEach(el => {
    const select = event => {
      event.stopPropagation();
      state.autoTarget = null;
      setSelectedTarget({
        type: 'object',
        id: el.dataset.tacticalTarget,
        label: el.dataset.targetLabel || el.textContent.trim() || 'OBJECT'
      });
      message(`${el.dataset.targetLabel || 'Object'} selected for interaction.`);
    };
    el.addEventListener('click', select);
    el.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') select(event);
    });
  });

  $('#globalMap')?.addEventListener('click', event => {
    if (!state.identity?.profileId) return;
    if (event.target.closest('.player-token,[data-tactical-target],button,a')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(3, Math.min(97, (event.clientX - rect.left) / rect.width * 100));
    const y = Math.max(5, Math.min(94, (event.clientY - rect.top) / rect.height * 100));
    state.autoTarget = { x, y };
    setSelectedTarget(null);
    publishInputChange();
    renderMovementHud();
    message('Auto-move destination set. Movement pauses at your turn limit and resumes after refresh.');
  });
}

function frame(t) {
  const dt = Math.min(.04, (t - state.lastFrame) / 1000);
  state.lastFrame = t;
  renderTurnClock();
  if (state.identity?.profileId) {
    movementStep(dt);
    flushPresence(false);
    renderRemote(dt);
  }
  requestAnimationFrame(frame);
}

const keyMap = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

window.addEventListener('keydown', event => {
  const key = keyMap[event.key];
  if (!key) return;
  event.preventDefault();
  state.autoTarget = null;
  if (!state.keys.has(key)) {
    state.keys.add(key);
    publishInputChange();
    renderMovementHud();
  }
});

window.addEventListener('keyup', event => {
  const key = keyMap[event.key];
  if (!key) return;
  event.preventDefault();
  if (state.keys.delete(key)) publishInputChange();
});

document.querySelectorAll('[data-move]').forEach(btn => {
  const dir = btn.dataset.move;
  const down = event => {
    event.preventDefault();
    state.autoTarget = null;
    try { btn.setPointerCapture?.(event.pointerId); } catch (_) {}
    if (!state.touch.has(dir)) {
      state.touch.add(dir);
      publishInputChange();
      renderMovementHud();
    }
  };
  const up = event => {
    event.preventDefault();
    if (state.touch.delete(dir)) publishInputChange();
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
  btn.addEventListener('lostpointercapture', up);
});

$('#queueAttack')?.addEventListener('click', () => queueAction('attack'));
$('#queueInteract')?.addEventListener('click', () => queueAction('interact'));
$('#cancelAction')?.addEventListener('click', cancelQueuedAction);
$('#cancelAutoMove')?.addEventListener('click', () => {
  state.autoTarget = null;
  publishInputChange();
  renderMovementHud();
  message('Auto-move cancelled.');
});

window.addEventListener('blur', () => stopAllMovement(false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAllMovement(false);
});
window.addEventListener('pagehide', () => {
  if (state.identity?.profileId) fs.deleteDoc(fs.doc(db, 'gamePresence', presenceId(state.identity.profileId))).catch(() => {});
});

setupBattlefieldTargets();
renderMovementHud();
renderActionPanel();
renderGameLog();
renderTurnClock();
requestAnimationFrame(frame);

watchIdentity(async identity => {
  state.identity = identity;
  if (!identity?.profileId) {
    message('Sign in to materialize your LCS profile token on the battlefield.');
    return;
  }
  state.profiles.set(identity.profileId, identity.profile);
  message('LCS tactical token online. Global turn movement is active.');
  state.turnNumber = turnInfo().turnNumber;
  await restorePosition();
  await loadWorldName();
  await flushPresence(true);
  watchPresence();
  watchActions();
});

loadWorldName();
setInterval(() => pruneOldActions(), 30_000);
