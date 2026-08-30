import { db, fs, watchIdentity, profileById, avatarSvg } from '/game/assets/js/eras-data.js?v=1.7.3';
import { ensureCreditWallet, watchCreditWallet, formatCredits } from '/assets/js/credit-system.js?v=1.7.3';
import { runTransaction as firestoreRunTransaction, orderBy as firestoreOrderBy, limit as firestoreLimit, getDocFromServer, getDocsFromServer } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { createGameInventoryController, ensureGameInventory, gameInventoryRef } from '/game/inventory/inventory.js?v=1.9.0';
import { normalizeGameInventory, slimeDropsForAction, describeDrops, attackDamageForAction, damageRange } from '/game/inventory/items.js?v=1.9.0';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const lobbyId = params.get('lobby') || '';
const worldId = lobbyId ? `lobby:${lobbyId}` : 'global';

// Every E.R.A.S. battlefield shares the same sixty-second world turn.
// Turn 1 begins at the public E.R.A.S. tactical baseline epoch.
const TURN_LENGTH_MS = 60_000;
const TURN_EPOCH_MS = Date.UTC(2026, 7, 29, 0, 0, 0);
const CLOCK_RESYNC_MS = 5 * 60_000;
const CLOCK_CLIENT_ID = (crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
const MOVE_BUDGET = 40;
const MOVE_SPEED = 10;
const GAME_LOG_TURNS = 10;
const PLAYER_MAX_HP = 3;
const PLAYER_ATTACK_RANGE = 14;
const SLIME_ATTACK_RANGE = 13;
const SLIME_MAX_HP = 1;
const SLIME_WANDER_INTERVAL_MS = 15_000;
const SLIME_WANDER_STEP = 3.2;
const SLIME_WANDER_STOP_RANGE = 16;
const GLOBAL_STATS_COLLECTION = 'globalGameStats';
const NORTH_PLATFORM_SPAWN = Object.freeze({ minX: 11, maxX: 32, minY: 11, maxY: 28 });
const SLIME_CACHE_SPAWN = Object.freeze({ minX: 76, maxX: 91, minY: 68, maxY: 84 });
const SLIME_DEFS = Object.freeze([
  { key: 'cache-slime-a', label: 'CACHE SLIME A', tint: '#62d776', ...SLIME_CACHE_SPAWN },
  { key: 'cache-slime-b', label: 'CACHE SLIME B', tint: '#8ee767', ...SLIME_CACHE_SPAWN }
]);

// Camera follows the local token through a small central soft zone instead
// of pinning every movement pixel directly to screen center. This keeps
// movement readable while preventing the player from drifting off-screen.
const CAMERA_SOFT_ZONE_X = 0.12;
const CAMERA_SOFT_ZONE_Y = 0.14;
const CAMERA_FOLLOW_STRENGTH = 11;

const state = {
  identity: null,
  x: 21.5,
  y: 19.5,
  vx: 0,
  vy: 0,
  moveUsed: 0,
  hp: PLAYER_MAX_HP,
  deaths: 0,
  lastDeathEventId: '',
  lastCombatTurn: 0,
  restedTurn: 0,
  movedTurn: 0,
  actionTurn: 0,
  lastPvpEventId: '',
  turnNumber: 0,
  lastFrame: performance.now(),
  lastWrite: 0,
  lastHeartbeat: 0,
  dirty: false,
  velocityDirty: false,
  presenceUnsub: null,
  actionUnsub: null,
  enemyUnsub: null,
  creditUnsub: null,
  statsUnsub: null,
  creditBalance: 0,
  gameInventory: normalizeGameInventory({}, ''),
  profiles: new Map(),
  remote: new Map(),
  keys: new Set(),
  touch: new Set(),
  tokenMap: new Map(),
  enemies: new Map(),
  enemyElements: new Map(),
  globalStats: new Map(),
  autoTarget: null,
  selectedTarget: null,
  actions: new Map(),
  ownQueuedActionId: '',
  resolvedSeen: new Set(),
  serverOffsetMs: 0,
  clockSynced: false,
  clockSyncInFlight: null,
  clockLastSyncAt: 0,
  pendingClockSentAt: 0,
  pruningActions: new Set(),
  resolvingActions: new Set(),
  combatMarkerInFlight: new Set(),
  autoRestInFlight: new Set(),
  lastPruneAt: 0,
  lastWanderAt: 0,
  lastEnemyVisualAt: 0,
  cameraX: 0,
  cameraY: 0,
  cameraTargetX: 0,
  cameraTargetY: 0,
  cameraInitialized: false
};

const message = text => {
  const el = $('#globalMessage');
  if (el) el.textContent = String(text).toUpperCase();
};

const gameInventoryController = createGameInventoryController({
  db,
  fs,
  getProfileId: () => state.identity?.profileId || '',
  getCreditBalance: () => state.creditBalance,
  getHp: () => state.hp,
  maxHp: PLAYER_MAX_HP,
  getPresenceRef: () => state.identity?.profileId ? fs.doc(db, 'gamePresence', presenceId(state.identity.profileId)) : null,
  message,
  onHpChanged: hp => {
    state.hp = Math.max(0, Math.min(PLAYER_MAX_HP, Number(hp || 0)));
    renderLocalBase();
    renderMovementHud();
  },
  onInventoryChanged: inventory => {
    state.gameInventory = normalizeGameInventory(inventory, state.identity?.profileId || '');
    renderMovementHud();
  }
});

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

function applyClockEstimate(estimate, hard = false) {
  if (!Number.isFinite(estimate)) return;
  if (!state.clockSynced || hard) {
    state.serverOffsetMs = estimate;
    state.clockSynced = true;
    return;
  }
  const delta = estimate - state.serverOffsetMs;
  // Keep the visible timer steady for tiny network jitter, but correct meaningful
  // drift aggressively so desktop and mobile share the same marker boundary.
  if (Math.abs(delta) > 1000) state.serverOffsetMs = estimate;
  else if (Math.abs(delta) > 150) state.serverOffsetMs += delta * 0.7;
  else state.serverOffsetMs += delta * 0.3;
}

function sampleServerClock(serverMillis) {
  if (!state.pendingClockSentAt || !Number.isFinite(serverMillis)) return;
  // Presence is only a fallback clock source. A single profile may be open on
  // desktop and mobile simultaneously, so another client can legitimately write
  // the same presence document and make its timestamp unsuitable for calibration.
  if (state.clockSynced) {
    state.pendingClockSentAt = 0;
    return;
  }
  const receivedAt = Date.now();
  const rtt = receivedAt - state.pendingClockSentAt;
  if (rtt < 0 || rtt > 6000) return;
  const midpoint = state.pendingClockSentAt + rtt / 2;
  applyClockEstimate(serverMillis - midpoint, true);
  state.pendingClockSentAt = 0;
}

async function syncServerClock(force = false) {
  if (!state.identity?.profileId) return false;
  if (!force && state.clockSynced && Date.now() - state.clockLastSyncAt < CLOCK_RESYNC_MS) return true;
  if (state.clockSyncInFlight) return state.clockSyncInFlight;

  state.clockSyncInFlight = (async () => {
    const profileId = state.identity.profileId;
    const probeId = `${profileId}__${CLOCK_CLIENT_ID}`;
    const ref = fs.doc(db, 'gameClockProbes', probeId);
    const sentAt = Date.now();
    try {
      await fs.setDoc(ref, {
        profileId,
        clientId: CLOCK_CLIENT_ID,
        worldId,
        requestedAt: fs.serverTimestamp()
      });
      const acknowledgedAt = Date.now();
      const snap = await getDocFromServer(ref);
      const serverMillis = snap.data()?.requestedAt?.toMillis?.();
      if (!Number.isFinite(serverMillis)) throw new Error('Clock probe did not return a server timestamp.');
      const rtt = acknowledgedAt - sentAt;
      if (rtt < 0 || rtt > 10_000) throw new Error('Clock probe round-trip was outside the accepted window.');
      const midpoint = sentAt + rtt / 2;
      applyClockEstimate(serverMillis - midpoint, !state.clockSynced);
      state.clockLastSyncAt = Date.now();
      return true;
    } catch (error) {
      console.warn('E.R.A.S. global clock sync', error);
      return false;
    } finally {
      fs.deleteDoc(ref).catch(() => {});
    }
  })();

  try {
    return await state.clockSyncInFlight;
  } finally {
    state.clockSyncInFlight = null;
  }
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

function isRestedThisTurn() {
  return state.restedTurn === turnInfo().turnNumber;
}

function isQueuedAttackAgainstLocal() {
  const profileId = state.identity?.profileId;
  if (!profileId) return false;
  return [...state.actions.values()].some(action =>
    action.status === 'queued'
    && action.actionType === 'attack'
    && action.targetType === 'profile'
    && action.targetId === profileId
    && Number(action.resolveTurn || 0) > turnInfo().turnNumber
  );
}

function incomingPlayerAttackForTurn(resolveTurn, actions = state.actions.values()) {
  const profileId = state.identity?.profileId;
  if (!profileId) return false;
  for (const action of actions) {
    if (action.actionType !== 'attack' || action.targetType !== 'profile' || action.targetId !== profileId) continue;
    if (Number(action.resolveTurn || 0) !== Number(resolveTurn || 0)) continue;
    if (action.status === 'queued' || action.status === 'resolved') return true;
  }
  return false;
}

async function incomingPlayerAttackFromServer(resolveTurn) {
  if (!state.identity?.profileId) return false;
  try {
    const q = fs.query(fs.collection(db, 'gameActions'), fs.where('worldId', '==', worldId));
    const snap = await Promise.race([
      getDocsFromServer(q),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Threat check timeout')), 1200))
    ]);
    const actions = [];
    snap.forEach(docSnap => actions.push({ id: docSnap.id, ...docSnap.data() }));
    return incomingPlayerAttackForTurn(resolveTurn, actions);
  } catch (error) {
    console.debug('Auto-rest threat check', error?.code || error);
    // Fail closed: if the authoritative threat check cannot complete, do not auto-rest.
    return true;
  }
}

function isActiveActionCombat(currentTurn = turnInfo().turnNumber) {
  const profileId = state.identity?.profileId;
  if (!profileId) return false;
  return [...state.actions.values()].some(action => {
    if (action.actionType !== 'attack') return false;
    const involvesLocal = action.actorProfileId === profileId
      || (action.targetType === 'profile' && action.targetId === profileId);
    if (!involvesLocal) return false;
    const resolveTurn = Number(action.resolveTurn || 0);
    return (action.status === 'queued' && resolveTurn > currentTurn)
      || (action.status === 'resolved' && resolveTurn === currentTurn);
  });
}

function enemyIsInCombat(enemy) {
  if (!enemy?.alive) return false;
  if ([...state.actions.values()].some(action => action.status === 'queued' && action.actionType === 'attack' && action.targetType === 'enemy' && action.targetId === enemy.id)) return true;
  if (state.identity?.profileId && distanceBetween(state.x, state.y, enemy.x, enemy.y) <= SLIME_WANDER_STOP_RANGE) return true;
  for (const remote of state.remote.values()) {
    if (distanceBetween(remote.x, remote.y, enemy.x, enemy.y) <= SLIME_WANDER_STOP_RANGE) return true;
  }
  return false;
}

function restBlockReason() {
  const currentTurn = turnInfo().turnNumber;
  if (!state.identity?.profileId) return 'SIGN IN FIRST';
  if (state.hp >= PLAYER_MAX_HP) return 'ALREADY FULL HEALTH';
  if (state.restedTurn === currentTurn) return 'ALREADY RESTED THIS REFRESH';
  if (state.movedTurn === currentTurn || state.moveUsed > .001) return 'YOU MOVED THIS REFRESH';
  if (state.actionTurn === currentTurn || state.ownQueuedActionId) return 'YOU DECLARED AN ACTION THIS REFRESH';
  if (state.combatMarkerInFlight.has(currentTurn)) return 'GLOBAL MARKER RESOLVING';
  if (isQueuedAttackAgainstLocal()) return 'PVP ATTACK INCOMING';
  if (isActiveActionCombat(currentTurn) || state.lastCombatTurn === currentTurn) return 'YOU ARE IN ACTIVE COMBAT';
  if ([...state.enemies.values()].some(enemy => enemy?.alive && distanceBetween(state.x, state.y, enemy.x, enemy.y) <= SLIME_WANDER_STOP_RANGE)) return 'YOU ARE IN ACTIVE COMBAT';
  return '';
}

function statsDocRef(profileId) {
  return fs.doc(db, GLOBAL_STATS_COLLECTION, profileId);
}

async function ensureGlobalStats(profileId = state.identity?.profileId) {
  if (!profileId) return;
  const ref = statsDocRef(profileId);
  const snap = await fs.getDoc(ref);
  if (snap.exists()) return;
  try {
    await fs.setDoc(ref, {
      profileId,
      pveKills: 0,
      pvpKills: 0,
      lastPveKillActionId: '',
      lastPvpKillActionId: '',
      lastResetDeathEventId: '',
      createdAt: fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp()
    });
  } catch (error) {
    const retry = await fs.getDoc(ref).catch(() => null);
    if (!retry?.exists?.()) console.debug('Global stats init', error?.code || error);
  }
}

function setSelectedTarget(target) {
  state.selectedTarget = target;
  document.querySelectorAll('.player-token.is-selected').forEach(el => el.classList.remove('is-selected'));
  document.querySelectorAll('.battle-object.is-selected').forEach(el => el.classList.remove('is-selected'));
  document.querySelectorAll('.enemy-token.is-selected').forEach(el => el.classList.remove('is-selected'));
  if (target?.type === 'profile') state.tokenMap.get(target.id)?.classList.add('is-selected');
  if (target?.type === 'object') document.querySelector(`[data-tactical-target="${CSS.escape(target.id)}"]`)?.classList.add('is-selected');
  if (target?.type === 'enemy') state.enemyElements.get(target.id)?.classList.add('is-selected');
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

function cameraElements() {
  const viewport = $('#globalViewport');
  const map = $('#globalMap');
  return viewport && map ? { viewport, map } : null;
}

function clampCamera(value, viewportSize, worldSize) {
  const minimum = Math.min(0, viewportSize - worldSize);
  return Math.max(minimum, Math.min(0, value));
}

function resetCamera(snap = true) {
  state.cameraInitialized = false;
  if (snap) updateCamera(1 / 60, true);
}

function updateCamera(dt, snap = false) {
  const els = cameraElements();
  if (!els) return;
  const { viewport, map } = els;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const mw = map.offsetWidth;
  const mh = map.offsetHeight;
  if (!vw || !vh || !mw || !mh) return;

  const playerWorldX = Math.max(0, Math.min(1, state.x / 100)) * mw;
  const playerWorldY = Math.max(0, Math.min(1, state.y / 100)) * mh;

  if (!state.cameraInitialized) {
    state.cameraX = clampCamera(vw * .5 - playerWorldX, vw, mw);
    state.cameraY = clampCamera(vh * .5 - playerWorldY, vh, mh);
    state.cameraTargetX = state.cameraX;
    state.cameraTargetY = state.cameraY;
    state.cameraInitialized = true;
  } else {
    const screenX = playerWorldX + state.cameraTargetX;
    const screenY = playerWorldY + state.cameraTargetY;
    const zoneLeft = vw * (.5 - CAMERA_SOFT_ZONE_X);
    const zoneRight = vw * (.5 + CAMERA_SOFT_ZONE_X);
    const zoneTop = vh * (.5 - CAMERA_SOFT_ZONE_Y);
    const zoneBottom = vh * (.5 + CAMERA_SOFT_ZONE_Y);

    if (screenX < zoneLeft) state.cameraTargetX += zoneLeft - screenX;
    else if (screenX > zoneRight) state.cameraTargetX -= screenX - zoneRight;
    if (screenY < zoneTop) state.cameraTargetY += zoneTop - screenY;
    else if (screenY > zoneBottom) state.cameraTargetY -= screenY - zoneBottom;

    state.cameraTargetX = clampCamera(state.cameraTargetX, vw, mw);
    state.cameraTargetY = clampCamera(state.cameraTargetY, vh, mh);
  }

  if (snap) {
    state.cameraX = state.cameraTargetX;
    state.cameraY = state.cameraTargetY;
  } else {
    const blend = 1 - Math.exp(-CAMERA_FOLLOW_STRENGTH * Math.max(0, dt));
    state.cameraX += (state.cameraTargetX - state.cameraX) * blend;
    state.cameraY += (state.cameraTargetY - state.cameraY) * blend;
  }
  map.style.transform = `translate3d(${state.cameraX.toFixed(2)}px, ${state.cameraY.toFixed(2)}px, 0)`;
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
  if (label) label.textContent = `${isRestedThisTurn() ? 'RESTED' : ratio >= 0.999 ? 'MOVE SPENT' : 'YOU'} // HP ${state.hp}/${PLAYER_MAX_HP}`;
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
  const hp = Math.max(0, Number(data.hp ?? PLAYER_MAX_HP));
  if (prev) {
    Object.assign(prev, { x, y, vx, vy, ts, receivedAt: Date.now(), stopped, turnNumber, moveUsed, hp });
    if (!Number.isFinite(prev.renderX)) prev.renderX = x;
    if (!Number.isFinite(prev.renderY)) prev.renderY = y;
  } else {
    state.remote.set(id, { x, y, vx, vy, ts, receivedAt: Date.now(), stopped, turnNumber, moveUsed, hp, renderX: x, renderY: y });
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
    const stateLabel = el.querySelector('.player-token-state');
    if (stateLabel) stateLabel.textContent = `PLAYER // HP ${Math.max(0, Number(remote.hp ?? PLAYER_MAX_HP))}/${PLAYER_MAX_HP}`;
  }
}


function enemyDocId(key) {
  return `${worldId}__${key}`.replace(/\//g, '_');
}

function distanceBetween(ax, ay, bx, by) {
  return Math.hypot(Number(ax) - Number(bx), Number(ay) - Number(by));
}

function slimeDefinitionByDocId(id) {
  return SLIME_DEFS.find(def => enemyDocId(def.key) === id) || null;
}

function ensureEnemyElement(enemy) {
  let el = state.enemyElements.get(enemy.id);
  if (el) return el;
  el = document.createElement('button');
  el.type = 'button';
  el.className = 'enemy-token';
  el.dataset.enemyId = enemy.id;
  el.setAttribute('aria-label', enemy.label || 'Slime');
  el.innerHTML = `<span class="enemy-base"><span class="enemy-sprite"><img src="/public-assets/textures/slime_monochrome.png" alt=""></span><i class="enemy-health"></i></span><strong></strong><small></small>`;
  const def = slimeDefinitionByDocId(enemy.id);
  el.style.setProperty('--slime-tint', def?.tint || '#65d67c');
  el.addEventListener('click', event => {
    event.stopPropagation();
    state.autoTarget = null;
    const current = state.enemies.get(enemy.id);
    setSelectedTarget({ type: 'enemy', id: enemy.id, label: current?.label || enemy.label || 'SLIME' });
    if (current?.alive) message(`${current.label || 'Slime'} selected. Attack declarations resolve at the next marker.`);
    else message(`${current?.label || 'Slime'} is down and will respawn at a global marker.`);
  });
  $('#globalMap').appendChild(el);
  state.enemyElements.set(enemy.id, el);
  return el;
}

function renderEnemy(enemy) {
  const el = ensureEnemyElement(enemy);
  const inCombat = enemyIsInCombat(enemy);
  el.style.left = `${enemy.x}%`;
  el.style.top = `${enemy.y}%`;
  el.classList.toggle('is-dead', !enemy.alive);
  el.classList.toggle('is-combat', inCombat);
  el.classList.toggle('is-wandering', enemy.alive && !inCombat);
  el.classList.toggle('is-selected', state.selectedTarget?.type === 'enemy' && state.selectedTarget.id === enemy.id);
  el.querySelector('strong').textContent = enemy.label || 'CACHE SLIME';
  el.querySelector('small').textContent = enemy.alive ? `${inCombat ? 'COMBAT' : 'WANDERING'} // HP ${enemy.hp} / ${enemy.maxHp}` : 'DOWN // RESPAWNING';
  el.querySelector('.enemy-health')?.style.setProperty('--enemy-hp', `${Math.max(0, Math.min(100, (Number(enemy.hp || 0) / Math.max(1, Number(enemy.maxHp || 1))) * 100))}%`);
}

async function ensureSlimePopulation() {
  if (!state.identity?.profileId) return;
  await Promise.all(SLIME_DEFS.map(async def => {
    const id = enemyDocId(def.key);
    const ref = fs.doc(db, 'gameEnemies', id);
    const snap = await fs.getDoc(ref);
    if (snap.exists()) {
      const live = snap.data();
      if (!Number.isInteger(live.wanderStep) || !live.lastWanderAt) {
        await fs.updateDoc(ref, {
          wanderStep: Math.max(0, Number(live.wanderStep || 0)),
          lastWanderAt: fs.serverTimestamp(),
          updatedAt: fs.serverTimestamp()
        }).catch(error => console.debug('Slime wander migration', error?.code || error));
      }
      return;
    }
    try {
      const spawn = slimeSpawnPoint(def, turnInfo().turnNumber, 'initial');
      await fs.setDoc(ref, {
        worldId,
        enemyKey: def.key,
        type: 'slime',
        label: def.label,
        x: spawn.x,
        y: spawn.y,
        hp: SLIME_MAX_HP,
        maxHp: SLIME_MAX_HP,
        alive: true,
        respawnTurn: 0,
        lastHitActionId: '',
        lastHitByProfileId: '',
        lastKillActionId: '',
        killerProfileId: '',
        wanderStep: 0,
        lastWanderAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp()
      });
    } catch (error) {
      const retry = await fs.getDoc(ref).catch(() => null);
      if (!retry?.exists?.()) console.error('Slime spawn failed', error);
    }
  }));
}

function watchEnemies() {
  state.enemyUnsub?.();
  const q = fs.query(fs.collection(db, 'gameEnemies'), fs.where('worldId', '==', worldId));
  state.enemyUnsub = fs.onSnapshot(q, snap => {
    const next = new Map();
    snap.forEach(docSnap => {
      const enemy = { id: docSnap.id, ...docSnap.data() };
      next.set(enemy.id, enemy);
      renderEnemy(enemy);
    });
    state.enemies = next;
    for (const [id, el] of [...state.enemyElements]) {
      if (!next.has(id)) { el.remove(); state.enemyElements.delete(id); }
    }
    renderActionPanel();
    renderMovementHud();
  }, error => {
    console.error('Enemy feed', error);
    message(`SLIME STATE ERROR: ${error.code || error.message}`);
  });
}

async function refreshEnemyState() {
  const q = fs.query(fs.collection(db, 'gameEnemies'), fs.where('worldId', '==', worldId));
  const snap = await fs.getDocs(q);
  const next = new Map();
  snap.forEach(docSnap => next.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
  state.enemies = next;
  next.forEach(renderEnemy);
  return next;
}

async function respawnDeadSlimes(currentTurn) {
  await ensureSlimePopulation();
  const enemies = await refreshEnemyState();
  await Promise.all([...enemies.values()].map(async enemy => {
    if (enemy.alive || Number(enemy.respawnTurn || 0) > currentTurn) return;
    const ref = fs.doc(db, 'gameEnemies', enemy.id);
    try {
      await firestoreRunTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const live = snap.data();
        if (live.alive || Number(live.respawnTurn || 0) > currentTurn) return;
        const def = slimeDefinitionByDocId(enemy.id);
        const spawn = def ? slimeSpawnPoint(def, currentTurn, 'respawn') : { x: Number(live.x || 83), y: Number(live.y || 76) };
        tx.update(ref, {
          x: spawn.x,
          y: spawn.y,
          hp: Number(live.maxHp || SLIME_MAX_HP),
          alive: true,
          respawnTurn: 0,
          lastHitActionId: '',
          lastHitByProfileId: '',
          killerProfileId: '',
          wanderStep: Math.max(0, Number(live.wanderStep || 0)),
          lastWanderAt: fs.serverTimestamp(),
          updatedAt: fs.serverTimestamp()
        });
      });
    } catch (error) {
      console.debug('Slime respawn race', error?.code || error);
    }
  }));
}


function worldLeaderProfileId() {
  const ids = [];
  if (state.identity?.profileId) ids.push(state.identity.profileId);
  for (const [id, remote] of state.remote) {
    if (!remote.ts || clockNow() - remote.ts <= 25_000) ids.push(id);
  }
  ids.sort();
  return ids[0] || '';
}

function seeded01(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function random01() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return value[0] / 4294967295;
  }
  return Math.random();
}

function pointInBounds(bounds, seed = '') {
  const rx = seed ? seeded01(`${seed}:x`) : random01();
  const ry = seed ? seeded01(`${seed}:y`) : random01();
  return {
    x: bounds.minX + (bounds.maxX - bounds.minX) * rx,
    y: bounds.minY + (bounds.maxY - bounds.minY) * ry
  };
}

function playerSpawnPoint(seed = '') {
  return pointInBounds(NORTH_PLATFORM_SPAWN, seed);
}

function slimeSpawnPoint(def, turn, phase = 'spawn') {
  return pointInBounds(def, `${worldId}:${def.key}:${phase}:${turn}`);
}

function wanderDestination(def, step) {
  const phase = Math.max(0, step);
  const rx = seeded01(`${def.key}:${phase}:x`);
  const ry = seeded01(`${def.key}:${phase}:y`);
  return {
    x: def.minX + (def.maxX - def.minX) * rx,
    y: def.minY + (def.maxY - def.minY) * ry
  };
}

async function advanceSlimeWander() {
  if (!state.identity?.profileId || worldLeaderProfileId() !== state.identity.profileId) return;
  const now = Date.now();
  if (now - state.lastWanderAt < 850) return;
  state.lastWanderAt = now;
  for (const def of SLIME_DEFS) {
    const id = enemyDocId(def.key);
    const observed = state.enemies.get(id);
    if (!observed?.alive || enemyIsInCombat(observed)) continue;
    const observedLast = observed.lastWanderAt?.toMillis?.() || 0;
    if (clockNow() - observedLast < SLIME_WANDER_INTERVAL_MS) continue;
    const ref = fs.doc(db, 'gameEnemies', id);
    try {
      await firestoreRunTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const live = { id, ...snap.data() };
        if (!live.alive || enemyIsInCombat(live)) return;
        const last = live.lastWanderAt?.toMillis?.() || 0;
        if (clockNow() - last < SLIME_WANDER_INTERVAL_MS) return;
        const step = Math.max(0, Number(live.wanderStep || 0));
        const target = wanderDestination(def, step);
        const fallbackX = (def.minX + def.maxX) / 2;
        const fallbackY = (def.minY + def.maxY) / 2;
        const dx = target.x - Number(live.x ?? fallbackX);
        const dy = target.y - Number(live.y ?? fallbackY);
        const distance = Math.hypot(dx, dy);
        let nx = Number(live.x ?? fallbackX);
        let ny = Number(live.y ?? fallbackY);
        if (distance > .08) {
          const stride = Math.min(SLIME_WANDER_STEP, distance);
          nx += dx / distance * stride;
          ny += dy / distance * stride;
        }
        nx = Math.max(def.minX, Math.min(def.maxX, nx));
        ny = Math.max(def.minY, Math.min(def.maxY, ny));
        tx.update(ref, {
          x: nx,
          y: ny,
          wanderStep: step + 1,
          lastWanderAt: fs.serverTimestamp(),
          updatedAt: fs.serverTimestamp()
        });
      });
    } catch (error) {
      if (!['aborted','failed-precondition'].includes(error?.code)) console.debug('Slime wander', error?.code || error);
    }
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

function reconcileOwnPresence(data, hasPendingWrites) {
  if (hasPendingWrites) return;
  sampleServerClock(data.updatedAt?.toMillis?.());
  const externalPvpId = String(data.lastPvpEventId || '');
  if (!externalPvpId || externalPvpId === state.lastPvpEventId) return;

  const previousDeaths = state.deaths;
  const nextDeaths = Math.max(0, Number(data.deaths || 0));
  const wasKnockout = nextDeaths > previousDeaths || String(data.lastDeathEventId || '') === `pvp_${externalPvpId}`.slice(0, 180);
  state.lastPvpEventId = externalPvpId;
  state.hp = Math.max(0, Math.min(PLAYER_MAX_HP, Number(data.hp ?? state.hp)));
  state.deaths = nextDeaths;
  state.lastDeathEventId = String(data.lastDeathEventId || state.lastDeathEventId || '');
  state.lastCombatTurn = Math.max(state.lastCombatTurn, Number(data.lastCombatTurn || 0));
  state.restedTurn = Math.max(0, Number(data.restedTurn || state.restedTurn || 0));
  state.movedTurn = Math.max(0, Number(data.movedTurn || state.movedTurn || 0));
  state.actionTurn = Math.max(0, Number(data.actionTurn || state.actionTurn || 0));

  if (wasKnockout) {
    state.x = Number(data.x ?? 21.5);
    state.y = Number(data.y ?? 19.5);
    state.vx = 0;
    state.vy = 0;
    state.moveUsed = Math.max(0, Number(data.moveUsed || 0));
    state.autoTarget = null;
    state.keys.clear();
    state.touch.clear();
    const token = state.tokenMap.get(state.identity?.profileId);
    if (token) {
      updateToken(token, state.x, state.y);
      token.classList.add('player-death-pulse');
      setTimeout(() => token.classList.remove('player-death-pulse'), 1200);
    }
    resetCamera(true);
    gameInventoryController.clearOnDeath(state.lastDeathEventId).catch(() => {});
    message('PVP KO // GAME INVENTORY CLEARED // RESPAWNED ON NORTH PLATFORM // NO CREDITS LOST.');
  } else {
    message(`PVP HIT RECEIVED // HP ${state.hp}/${PLAYER_MAX_HP}.`);
  }
  renderLocalBase();
  renderMovementHud();
  renderActionPanel();
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
        reconcileOwnPresence(data, d.metadata.hasPendingWrites);
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
      state.x = Number(snap.data().x ?? 21.5);
      state.y = Number(snap.data().y ?? 19.5);
      const currentTurn = turnInfo().turnNumber;
      if (Number(snap.data().turnNumber || 0) === currentTurn) {
        state.moveUsed = Math.max(0, Number(snap.data().moveUsed || 0));
      }
      state.hp = Math.max(0, Math.min(PLAYER_MAX_HP, Number(snap.data().hp ?? PLAYER_MAX_HP)));
      state.deaths = Math.max(0, Number(snap.data().deaths || 0));
      state.lastDeathEventId = String(snap.data().lastDeathEventId || '');
      state.lastCombatTurn = Math.max(0, Number(snap.data().lastCombatTurn || 0));
      state.restedTurn = Math.max(0, Number(snap.data().restedTurn || 0));
      state.movedTurn = Math.max(0, Number(snap.data().movedTurn || 0));
      state.actionTurn = Math.max(0, Number(snap.data().actionTurn || 0));
      state.lastPvpEventId = String(snap.data().lastPvpEventId || '');
    } else {
      const spawn = playerSpawnPoint();
      state.x = spawn.x;
      state.y = spawn.y;
      state.vx = 0;
      state.vy = 0;
      state.moveUsed = 0;
    }
    updateToken(ensureToken(state.identity.profileId, state.identity.profile, true), state.x, state.y);
    resetCamera(true);
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
      hp: state.hp,
      maxHp: PLAYER_MAX_HP,
      deaths: state.deaths,
      lastDeathEventId: state.lastDeathEventId,
      lastCombatTurn: state.lastCombatTurn,
      restedTurn: state.restedTurn,
      movedTurn: state.movedTurn,
      actionTurn: state.actionTurn,
      lastPvpEventId: state.lastPvpEventId,
      updatedAt: fs.serverTimestamp()
    });
    if (lobbyId) {
      fs.updateDoc(fs.doc(db, 'gameLobbies', lobbyId, 'members', state.identity.profileId), {
        lastSeenAt: fs.serverTimestamp()
      }).catch(() => {});
    }
  } catch (error) {
    if (error?.code === 'permission-denied') {
      try {
        const snap = await fs.getDoc(fs.doc(db, 'gamePresence', presenceId(state.identity.profileId)));
        if (snap.exists() && String(snap.data().lastPvpEventId || '') !== state.lastPvpEventId) {
          reconcileOwnPresence(snap.data(), false);
          return;
        }
      } catch (_) {}
    }
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
  const allowed = remaining > .001 && !isRestedThisTurn() && !state.combatMarkerInFlight.has(state.turnNumber);
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
  state.movedTurn = state.turnNumber || turnInfo().turnNumber;
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

function watchCredits() {
  state.creditUnsub?.();
  state.creditUnsub = watchCreditWallet(db, fs, state.identity?.profileId, balance => {
    state.creditBalance = balance;
    renderMovementHud();
    gameInventoryController.refresh();
  }, error => console.debug('Game credit wallet', error?.code || error));
}

function renderMovementHud() {
  const remaining = Math.max(0, MOVE_BUDGET - state.moveUsed);
  const remainingEl = $('#moveRemaining');
  const bar = $('#moveBudgetBar');
  if (remainingEl) remainingEl.textContent = `${remaining.toFixed(1)} / ${MOVE_BUDGET}`;
  if (bar) bar.style.setProperty('--budget-left', `${Math.max(0, Math.min(100, remaining / MOVE_BUDGET * 100))}%`);
  const auto = $('#autoMoveState');
  if (auto) auto.textContent = state.autoTarget ? `AUTO → ${state.autoTarget.x.toFixed(0)}, ${state.autoTarget.y.toFixed(0)}` : 'CLICK / TAP BOARD TO AUTO-MOVE';
  const hp = $('#playerHealth');
  if (hp) hp.textContent = `${state.hp} / ${PLAYER_MAX_HP}`;
  const credits = $('#creditBalance');
  if (credits) credits.textContent = formatCredits(state.creditBalance);
  const attackStat = $('#playerAttack');
  if (attackStat) {
    const range = damageRange(state.gameInventory);
    attackStat.textContent = `${range.min}–${range.max} // ${range.label.toUpperCase()}`;
  }
  const rest = $('#restAction');
  const restState = $('#restState');
  const reason = restBlockReason();
  if (rest) rest.disabled = Boolean(reason);
  if (restState) restState.textContent = reason || 'AUTO REST ARMED // IF IDLE + SAFE AT MARKER';
}

function markerWindowLabel(turn, currentTurn) {
  const age = Math.max(0, currentTurn - turn);
  if (age === 0) return 'CURRENT WINDOW';
  if (age === 1) return 'LAST MARKER';
  return `${age} MARKERS AGO`;
}

function actionStatusLabel(action) {
  if (action.status === 'cancelled') return 'CANCELLED';
  if (action.status === 'resolved') {
    if (action.outcome === 'kill') return action.targetType === 'enemy' ? 'KILL +1C' : 'PVP KO';
    if (action.outcome === 'hit') return 'HIT';
    if (action.outcome === 'miss') return 'MISS';
    return 'RESOLVED';
  }
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


function renderPvpRecord() {
  const host = $('#pvpRecord');
  if (!host) return;
  const currentTurn = turnInfo().turnNumber;
  const groups = [];
  for (let age = 0; age < GAME_LOG_TURNS; age += 1) {
    const turn = currentTurn - age;
    if (turn < 1) break;
    const actions = [...state.actions.values()]
      .filter(action => Number(action.declaredTurn || 0) === turn && action.actionType === 'attack' && action.targetType === 'profile')
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    if (!actions.length && age > 1) continue;
    const rows = actions.map(action => {
      const actor = state.profiles.get(action.actorProfileId)?.displayName || (action.actorProfileId === state.identity?.profileId ? 'YOU' : 'PLAYER');
      const status = action.outcome === 'kill' ? 'KO' : action.outcome === 'hit' ? 'HIT' : action.outcome === 'miss' ? 'MISS' : action.status.toUpperCase();
      return `<li><b>${escapeLog(actor)}</b><span>VS ${escapeLog(action.targetLabel || 'PLAYER')}</span><em data-status="${action.status}">${status}</em></li>`;
    }).join('');
    groups.push(`<section class="game-log-turn${age === 0 ? ' is-current' : ''}"><h3>${markerWindowLabel(turn, currentTurn)}</h3>${rows ? `<ul>${rows}</ul>` : '<p>NO PVP EVENTS</p>'}</section>`);
  }
  host.innerHTML = groups.join('') || '<section class="game-log-turn is-current"><h3>CURRENT WINDOW</h3><p>NO PVP EVENTS</p></section>';
}

function renderScoreboard() {
  const host = $('#globalScoreboard');
  if (!host) return;
  const entries = [...state.globalStats.values()];
  // A death clears that player's current Global scoreboard run. Keep zeroed
  // records out of the visible top-five lists so a respawn actually removes
  // the player until they earn another kill.
  const pve = [...entries].filter(entry => Number(entry.pveKills || 0) > 0).sort((a, b) => Number(b.pveKills || 0) - Number(a.pveKills || 0) || String(a.profileId).localeCompare(String(b.profileId))).slice(0, 5);
  const pvp = [...entries].filter(entry => Number(entry.pvpKills || 0) > 0).sort((a, b) => Number(b.pvpKills || 0) - Number(a.pvpKills || 0) || String(a.profileId).localeCompare(String(b.profileId))).slice(0, 5);
  const rows = (list, key) => list.length ? list.map((entry, index) => {
    const name = state.profiles.get(entry.profileId)?.displayName || (entry.profileId === state.identity?.profileId ? state.identity?.profile?.displayName || 'YOU' : 'PLAYER');
    return `<li><i>${index + 1}</i><b>${escapeLog(name)}</b><strong>${Math.max(0, Number(entry[key] || 0))}</strong></li>`;
  }).join('') : '<li class="is-empty">NO KILLS RECORDED</li>';
  host.innerHTML = `<div><h3>PVE KILLS</h3><ol>${rows(pve, 'pveKills')}</ol></div><div><h3>PVP KILLS</h3><ol>${rows(pvp, 'pvpKills')}</ol></div>`;
}

function watchGlobalStats() {
  if (worldId !== 'global') {
    const panel = $('#scoreboardPanel');
    if (panel) panel.hidden = true;
    return;
  }
  state.statsUnsub?.();
  const buckets = { pve: new Map(), pvp: new Map() };
  const mergeAndRender = () => {
    const next = new Map([...buckets.pve, ...buckets.pvp]);
    state.globalStats = next;
    for (const entry of next.values()) {
      const id = entry.profileId || entry.id;
      if (id && !state.profiles.has(id)) getProfile(id).then(() => renderScoreboard()).catch(() => {});
    }
    renderScoreboard();
  };
  const bind = (field, bucket) => {
    const q = fs.query(fs.collection(db, GLOBAL_STATS_COLLECTION), firestoreOrderBy(field, 'desc'), firestoreLimit(5));
    return fs.onSnapshot(q, snap => {
      const next = new Map();
      snap.forEach(docSnap => {
        const entry = { id: docSnap.id, ...docSnap.data() };
        next.set(entry.profileId || docSnap.id, entry);
      });
      buckets[bucket] = next;
      mergeAndRender();
    }, error => console.debug(`Global ${bucket} scoreboard`, error?.code || error));
  };
  const unsubPve = bind('pveKills', 'pve');
  const unsubPvp = bind('pvpKills', 'pvp');
  state.statsUnsub = () => { unsubPve?.(); unsubPvp?.(); };
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
  syncVelocity();
  state.dirty = true;
  state.velocityDirty = true;
  flushPresence(true);
  if (previous) message('GLOBAL MARKER // refreshed. Movement and actions restored.');
  renderGameLog();
  renderPvpRecord();
  renderActionPanel();
  renderMovementHud();
  pruneOldActions(true);
  runCombatMarker(nextTurn).catch(error => {
    console.error('Combat marker', error);
    message(`COMBAT MARKER ERROR: ${error.code || error.message}`);
  });
}

function renderTurnClock() {
  const countdown = $('#turnCountdown');
  const ring = $('#turnProgress');
  const stateEl = $('#turnState');
  if (state.identity?.profileId && !state.clockSynced) {
    if (countdown) countdown.textContent = '--:--';
    if (ring) ring.style.setProperty('--turn-angle', '0deg');
    if (stateEl) stateEl.textContent = 'SYNCING GLOBAL CLOCK';
    return;
  }

  const info = turnInfo();
  if (state.clockSynced && info.turnNumber !== state.turnNumber) applyTurnChange(info.turnNumber);

  const seconds = Math.max(0, Math.ceil(info.remainingMs / 1000));
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (countdown) countdown.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (ring) ring.style.setProperty('--turn-angle', `${info.progress * 360}deg`);
  if (stateEl) {
    stateEl.textContent = isRestedThisTurn()
      ? 'RESTED // FULL HEAL // NEXT REFRESH'
      : state.moveUsed >= MOVE_BUDGET - .001
        ? 'MOVEMENT SPENT // NEXT REFRESH AT MARKER'
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
    outcome: '',
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
  if (isRestedThisTurn()) {
    message('You rested this refresh. Movement and declarations return at the next marker.');
    return;
  }
  if (state.combatMarkerInFlight.has(state.turnNumber)) {
    message('GLOBAL MARKER RESOLVING // DECLARATIONS OPEN WHEN RESOLUTION COMPLETES.');
    return;
  }
  if (state.ownQueuedActionId) {
    message('Cancel your current declaration before replacing it.');
    return;
  }
  if (actionType === 'attack' && !['profile','enemy'].includes(state.selectedTarget.type)) {
    message('Attack requires a player or enemy target.');
    return;
  }
  if (actionType === 'attack' && state.selectedTarget.type === 'enemy' && !state.enemies.get(state.selectedTarget.id)?.alive) {
    message('That slime is already down. It will respawn at a global marker.');
    return;
  }
  if (actionType === 'interact' && state.selectedTarget.type === 'enemy') {
    message('Use ATTACK for hostile slime targets.');
    return;
  }

  const id = crypto.randomUUID();
  const payload = actionDocPayload(actionType);
  try {
    await fs.setDoc(fs.doc(db, 'gameActions', id), payload);
    state.ownQueuedActionId = id;
    state.actionTurn = turnInfo().turnNumber;
    state.dirty = true;
    flushPresence(true);
    message(`${actionType} declared. It resolves at the next global turn marker and may be cancelled until then.`);
    renderActionPanel();
    renderMovementHud();
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
      outcome: 'cancelled',
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
  if (action.targetType === 'enemy') el = state.enemyElements.get(action.targetId);
  if (!el) return;
  el.classList.remove('action-resolved');
  void el.offsetWidth;
  el.classList.add('action-resolved');
  setTimeout(() => el.classList.remove('action-resolved'), 1200);
}

async function resolveOwnEnemyAttack(id, action, currentTurn) {
  if (state.resolvingActions.has(id) || !state.identity?.profileId) return;
  state.resolvingActions.add(id);
  try {
    await ensureCreditWallet(db, fs, state.identity.profileId);
    await ensureGameInventory(db, fs, state.identity.profileId);
    const actionRef = fs.doc(db, 'gameActions', id);
    const enemyRef = fs.doc(db, 'gameEnemies', action.targetId);
    const presenceRef = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
    const walletRef = fs.doc(db, 'creditWallets', state.identity.profileId);
    const inventoryRef = gameInventoryRef(db, fs, state.identity.profileId);
    const statsRef = statsDocRef(state.identity.profileId);
    const dropRoll = slimeDropsForAction(id);

    const result = await firestoreRunTransaction(db, async tx => {
      const [actionSnap, enemySnap, presenceSnap, walletSnap, inventorySnap, statsSnap] = await Promise.all([
        tx.get(actionRef), tx.get(enemyRef), tx.get(presenceRef), tx.get(walletRef), tx.get(inventoryRef), tx.get(statsRef)
      ]);
      if (!actionSnap.exists() || !enemySnap.exists() || !presenceSnap.exists() || !walletSnap.exists() || !inventorySnap.exists()) return { skipped: true };
      const liveAction = actionSnap.data();
      const enemy = enemySnap.data();
      const presence = presenceSnap.data();
      const inventory = normalizeGameInventory(inventorySnap.data(), state.identity.profileId);
      if (liveAction.status !== 'queued' || Number(liveAction.resolveTurn || 0) > currentTurn) return { skipped: true };

      const inRange = enemy.alive && distanceBetween(presence.x, presence.y, enemy.x, enemy.y) <= PLAYER_ATTACK_RANGE;
      if (!inRange) {
        tx.update(actionRef, {
          status: 'resolved', outcome: 'miss', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp()
        });
        return { miss: true, label: enemy.label || action.targetLabel || 'SLIME' };
      }

      const attackDamage = attackDamageForAction(id, inventory);
      const nextHp = Math.max(0, Number(enemy.hp || 0) - attackDamage);
      const killed = nextHp <= 0;
      const enemyPatch = {
        hp: nextHp,
        alive: !killed,
        respawnTurn: killed ? currentTurn + 1 : Number(enemy.respawnTurn || 0),
        lastHitActionId: id,
        lastHitByProfileId: state.identity.profileId,
        updatedAt: fs.serverTimestamp()
      };
      if (killed) {
        enemyPatch.lastKillActionId = id;
        enemyPatch.killerProfileId = state.identity.profileId;
      }
      tx.update(enemyRef, enemyPatch);
      tx.update(actionRef, {
        status: 'resolved', outcome: killed ? 'kill' : 'hit', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp()
      });
      if (killed) {
        const wallet = walletSnap.data();
        tx.update(walletRef, {
          balance: Math.max(0, Number(wallet.balance || 0)) + 1,
          totalEarned: Math.max(0, Number(wallet.totalEarned || 0)) + 1,
          totalLost: Math.max(0, Number(wallet.totalLost || 0)),
          lastEventId: id,
          lastEventType: 'slime_kill',
          updatedAt: fs.serverTimestamp()
        });
        const droppedAnything = dropRoll.slimeJuice || dropRoll.healthPotion || dropRoll.handWraps;
        if (droppedAnything) {
          tx.update(inventoryRef, {
            slimeJuice: inventory.slimeJuice + dropRoll.slimeJuice,
            healthPotion: inventory.healthPotion + dropRoll.healthPotion,
            handWraps: inventory.handWraps + dropRoll.handWraps,
            lastEventId: id,
            lastEventType: 'slime_drop',
            updatedAt: fs.serverTimestamp()
          });
        }
        if (worldId === 'global' && statsSnap.exists()) {
          const stats = statsSnap.data();
          tx.update(statsRef, {
            pveKills: Math.max(0, Number(stats.pveKills || 0)) + 1,
            pvpKills: Math.max(0, Number(stats.pvpKills || 0)),
            lastPveKillActionId: id,
            lastPvpKillActionId: String(stats.lastPvpKillActionId || ''),
            lastResetDeathEventId: String(stats.lastResetDeathEventId || ''),
            updatedAt: fs.serverTimestamp()
          });
        }
      }
      return { killed, hit: true, damage: attackDamage, drops: killed ? dropRoll : null, label: enemy.label || action.targetLabel || 'SLIME' };
    });

    if (result?.killed) {
      const drops = describeDrops(result.drops || {});
      message(`${result.label} DEFEATED // +1 CREDIT${drops.length ? ` // DROP: ${drops.join(' + ')}` : ''}.`);
    } else if (result?.hit) message(`${result.label} HIT // ${result.damage || 1} DAMAGE.`);
    else if (result?.miss) message(`${result.label} attack missed // target was down or outside ${PLAYER_ATTACK_RANGE} range.`);
  } catch (error) {
    console.error('Enemy attack resolution', error);
    message(`ATTACK RESOLUTION FAILED: ${error.code || error.message}`);
  } finally {
    state.resolvingActions.delete(id);
  }
}

async function resolveOwnPlayerAttack(id, action, currentTurn) {
  if (state.resolvingActions.has(id) || !state.identity?.profileId) return;
  state.resolvingActions.add(id);
  try {
    await ensureGameInventory(db, fs, state.identity.profileId);
    const actionRef = fs.doc(db, 'gameActions', id);
    const attackerRef = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
    const inventoryRef = gameInventoryRef(db, fs, state.identity.profileId);
    const targetRef = fs.doc(db, 'gamePresence', presenceId(action.targetId));
    const statsRef = statsDocRef(state.identity.profileId);
    const targetStatsRef = statsDocRef(action.targetId);
    const pvpRespawn = playerSpawnPoint(`pvp:${worldId}:${action.targetId}:${id}`);
    const result = await firestoreRunTransaction(db, async tx => {
      const [actionSnap, attackerSnap, targetSnap, inventorySnap, statsSnap, targetStatsSnap] = await Promise.all([
        tx.get(actionRef), tx.get(attackerRef), tx.get(targetRef), tx.get(inventoryRef), tx.get(statsRef), tx.get(targetStatsRef)
      ]);
      if (!actionSnap.exists() || !attackerSnap.exists() || !targetSnap.exists() || !inventorySnap.exists()) return { skipped: true };
      const liveAction = actionSnap.data();
      const attacker = attackerSnap.data();
      const target = targetSnap.data();
      const inventory = normalizeGameInventory(inventorySnap.data(), state.identity.profileId);
      if (liveAction.status !== 'queued' || Number(liveAction.resolveTurn || 0) > currentTurn) return { skipped: true };
      const inRange = attacker.worldId === worldId && target.worldId === worldId
        && distanceBetween(attacker.x, attacker.y, target.x, target.y) <= PLAYER_ATTACK_RANGE;
      if (!inRange) {
        tx.update(actionRef, { status: 'resolved', outcome: 'miss', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp() });
        return { miss: true };
      }
      const attackDamage = attackDamageForAction(id, inventory);
      const hpBefore = Math.max(1, Number(target.hp ?? PLAYER_MAX_HP));
      const hpAfter = hpBefore - attackDamage;
      const killed = hpAfter <= 0;
      const targetPatch = {
        hp: killed ? PLAYER_MAX_HP : hpAfter,
        maxHp: PLAYER_MAX_HP,
        lastPvpEventId: id,
        restedTurn: Math.max(0, Number(target.restedTurn || 0)),
        movedTurn: Math.max(0, Number(target.movedTurn || 0)),
        actionTurn: Math.max(0, Number(target.actionTurn || 0)),
        updatedAt: fs.serverTimestamp()
      };
      const deathEventId = killed ? `pvp_${id}`.slice(0, 180) : '';
      if (killed) {
        Object.assign(targetPatch, {
          x: pvpRespawn.x, y: pvpRespawn.y, vx: 0, vy: 0,
          moveUsed: 0,
          deaths: Math.max(0, Number(target.deaths || 0)) + 1,
          lastDeathEventId: deathEventId
        });
      }
      tx.update(targetRef, targetPatch);
      tx.update(actionRef, { status: 'resolved', outcome: killed ? 'kill' : 'hit', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp() });
      if (killed && worldId === 'global' && statsSnap.exists()) {
        const stats = statsSnap.data();
        tx.update(statsRef, {
          pveKills: Math.max(0, Number(stats.pveKills || 0)),
          pvpKills: Math.max(0, Number(stats.pvpKills || 0)) + 1,
          lastPveKillActionId: String(stats.lastPveKillActionId || ''),
          lastPvpKillActionId: id,
          lastResetDeathEventId: String(stats.lastResetDeathEventId || ''),
          updatedAt: fs.serverTimestamp()
        });
      }
      if (killed && worldId === 'global' && targetStatsSnap.exists()) {
        const targetStats = targetStatsSnap.data();
        tx.update(targetStatsRef, {
          pveKills: 0,
          pvpKills: 0,
          lastPveKillActionId: String(targetStats.lastPveKillActionId || ''),
          lastPvpKillActionId: String(targetStats.lastPvpKillActionId || ''),
          lastResetDeathEventId: deathEventId,
          updatedAt: fs.serverTimestamp()
        });
      }
      return { hit: true, killed, damage: attackDamage };
    });
    if (result?.killed) message(`${action.targetLabel || 'PLAYER'} DOWNED // ${result.damage || 1} DAMAGE // PVP KO // NO CREDITS LOST.`);
    else if (result?.hit) message(`${action.targetLabel || 'PLAYER'} HIT // PVP DAMAGE ${result.damage || 1}.`);
    else if (result?.miss) message(`${action.targetLabel || 'PLAYER'} PVP ATTACK MISSED // OUTSIDE ${PLAYER_ATTACK_RANGE} RANGE.`);
  } catch (error) {
    console.error('PVP attack resolution', error);
    message(`PVP RESOLUTION FAILED: ${error.code || error.message}`);
  } finally {
    state.resolvingActions.delete(id);
  }
}

async function resolveOwnStandardAction(id, action, currentTurn) {
  if (state.resolvingActions.has(id)) return;
  state.resolvingActions.add(id);
  try {
    const ref = fs.doc(db, 'gameActions', id);
    const resolved = await firestoreRunTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return false;
      const live = snap.data();
      if (live.status !== 'queued' || Number(live.resolveTurn || 0) > currentTurn) return false;
      tx.update(ref, {
        status: 'resolved', outcome: action.actionType === 'interact' ? 'interact' : 'resolved', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp()
      });
      return true;
    });
    if (resolved && action.actionType === 'interact' && action.targetType === 'object' && action.targetId === 'north-terminal') {
      gameInventoryController.open('terminal');
      message('NORTH TERMINAL OPEN // LEFT PANE SWITCHED TO TERMINAL TRADE.');
    }
  } catch (error) {
    console.error('Action resolution', error);
  } finally {
    state.resolvingActions.delete(id);
  }
}

async function processResolvedActions(currentTurn) {
  const due = [...state.actions.entries()].filter(([, action]) =>
    action.status === 'queued'
    && action.actorProfileId === state.identity?.profileId
    && Number(action.resolveTurn || 0) <= currentTurn
  );
  for (const [id, action] of due) {
    if (action.actionType === 'attack' && action.targetType === 'enemy') await resolveOwnEnemyAttack(id, action, currentTurn);
    else if (action.actionType === 'attack' && action.targetType === 'profile') await resolveOwnPlayerAttack(id, action, currentTurn);
    else await resolveOwnStandardAction(id, action, currentTurn);
  }

  for (const [id, action] of state.actions) {
    const resolveTurn = Number(action.resolveTurn || 0);
    if (action.status !== 'resolved' || resolveTurn > currentTurn || resolveTurn < currentTurn - 1 || state.resolvedSeen.has(id)) continue;
    state.resolvedSeen.add(id);
    pulseTarget(action);
    const actorName = state.profiles.get(action.actorProfileId)?.displayName || (action.actorProfileId === state.identity?.profileId ? 'YOU' : 'PLAYER');
    const suffix = action.outcome === 'kill'
      ? (action.targetType === 'enemy' ? ' // KILL +1 CREDIT' : ' // PVP KO // CREDITS SAFE')
      : action.outcome === 'miss' ? ' // MISS' : '';
    message(`${actorName} ${action.actionType === 'attack' ? 'ATTACK' : 'INTERACTION'} RESOLVED → ${action.targetLabel || 'TARGET'}${suffix}.`);
    if (action.actorProfileId === state.identity?.profileId && state.ownQueuedActionId === id) state.ownQueuedActionId = '';
  }
  renderActionPanel();
}

async function autoRestCompletedTurn(completedTurn, resolveTurn, markerAttackers = []) {
  if (!state.identity?.profileId || completedTurn < 1 || state.autoRestInFlight.has(completedTurn)) return false;
  state.autoRestInFlight.add(completedTurn);
  try {
    // Give last-moment declarations a brief chance to reach Firestore, then verify
    // the completed turn against the server rather than trusting only the local feed.
    await new Promise(resolve => setTimeout(resolve, 250));

    if (markerAttackers.length > 0) return false;
    if (incomingPlayerAttackForTurn(resolveTurn)) return false;
    if (await incomingPlayerAttackFromServer(resolveTurn)) return false;
    if (isActiveActionCombat(completedTurn) || state.lastCombatTurn >= completedTurn) return false;

    const ref = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
    const result = await firestoreRunTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { ok: false, reason: 'NO PRESENCE' };
      const live = snap.data();
      const hp = Math.max(0, Math.min(PLAYER_MAX_HP, Number(live.hp ?? PLAYER_MAX_HP)));

      // Auto-rest is the default completed-turn action only when the player did
      // nothing that turn. It intentionally preserves the same movement/action
      // restrictions as manual REST.
      if (hp >= PLAYER_MAX_HP) return { ok: false, reason: 'FULL' };
      if (Number(live.restedTurn || 0) >= completedTurn) return { ok: false, reason: 'RESTED' };
      if (Number(live.movedTurn || 0) === completedTurn || Number(live.moveUsed || 0) > .001) return { ok: false, reason: 'MOVED' };
      if (Number(live.actionTurn || 0) === completedTurn) return { ok: false, reason: 'ACTION' };
      if (Number(live.lastCombatTurn || 0) >= completedTurn) return { ok: false, reason: 'COMBAT' };

      tx.update(ref, {
        hp: PLAYER_MAX_HP,
        vx: 0,
        vy: 0,
        // Security rules validate a rest against the turn that was actually
        // rested. The next presence heartbeat immediately advances turnNumber.
        turnNumber: completedTurn,
        restedTurn: completedTurn,
        updatedAt: fs.serverTimestamp()
      });
      return { ok: true };
    });

    if (!result?.ok) return false;
    state.hp = PLAYER_MAX_HP;
    state.restedTurn = completedTurn;
    state.dirty = true;
    state.velocityDirty = true;
    renderLocalBase();
    renderMovementHud();
    renderActionPanel();
    await flushPresence(true);
    message('AUTO REST // NO ACTION SELECTED + NO COMBAT // FULL HEALTH.');
    return true;
  } catch (error) {
    console.error('Auto rest', error);
    return false;
  } finally {
    state.autoRestInFlight.delete(completedTurn);
  }
}

async function restToFullHealth() {
  const reason = restBlockReason();
  if (reason) {
    message(`REST BLOCKED // ${reason}.`);
    renderMovementHud();
    return;
  }
  const currentTurn = turnInfo().turnNumber;
  const ref = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
  try {
    const result = await firestoreRunTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return { error: 'NO PRESENCE' };
      const live = snap.data();
      if (Number(live.movedTurn || 0) === currentTurn || Number(live.moveUsed || 0) > .001) return { error: 'YOU MOVED THIS REFRESH' };
      if (Number(live.actionTurn || 0) === currentTurn) return { error: 'YOU DECLARED AN ACTION THIS REFRESH' };
      if (Number(live.restedTurn || 0) === currentTurn) return { error: 'ALREADY RESTED' };
      tx.update(ref, {
        hp: PLAYER_MAX_HP,
        vx: 0,
        vy: 0,
        turnNumber: currentTurn,
        restedTurn: currentTurn,
        updatedAt: fs.serverTimestamp()
      });
      return { ok: true };
    });
    if (!result?.ok) {
      message(`REST BLOCKED // ${result?.error || 'STATE CHANGED'}.`);
      return;
    }
    state.hp = PLAYER_MAX_HP;
    state.restedTurn = currentTurn;
    state.vx = 0;
    state.vy = 0;
    state.autoTarget = null;
    state.keys.clear();
    state.touch.clear();
    state.dirty = false;
    state.velocityDirty = false;
    renderLocalBase();
    renderMovementHud();
    renderActionPanel();
    message('REST COMPLETE // FULL HEALTH // MOVEMENT AND ACTIONS LOCKED UNTIL NEXT GLOBAL REFRESH.');
  } catch (error) {
    console.error('Rest', error);
    message(`REST FAILED: ${error.code || error.message}`);
  }
}

async function applySlimeRetaliation(currentTurn, markerAttackers = []) {
  if (!state.identity?.profileId) return;
  await ensureCreditWallet(db, fs, state.identity.profileId);
  const presenceRef = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
  const walletRef = fs.doc(db, 'creditWallets', state.identity.profileId);
  const statsRef = statsDocRef(state.identity.profileId);
  // Retaliation is captured at the exact global marker before player attacks
  // resolve. That makes the marker simultaneous: a one-HP slime that was alive
  // and in range when the marker fired still gets its strike even if the queued
  // player attack defeats it during the same marker.
  const attackerIds = [...new Set(markerAttackers.map(enemy => String(enemy?.id || '')).filter(Boolean))];
  const deathEventId = `death_${presenceId(state.identity.profileId)}_${currentTurn}`.slice(0, 180);
  const pveRespawn = playerSpawnPoint(`pve:${worldId}:${state.identity.profileId}:${deathEventId}`);

  const result = await firestoreRunTransaction(db, async tx => {
    const [presenceSnap, walletSnap, statsSnap] = await Promise.all([
      tx.get(presenceRef), tx.get(walletRef), tx.get(statsRef)
    ]);
    if (!presenceSnap.exists()) return { skipped: true };
    const presence = presenceSnap.data();
    if (Number(presence.lastCombatTurn || 0) >= currentTurn) return { skipped: true };

    const damage = attackerIds.length;
    if (!damage) {
      // No attacker was actually in range at this marker. Do not stamp
      // lastCombatTurn: doing so made every quiet refresh count as active
      // combat and permanently blocked REST even after the player disengaged.
      return { damage: 0, hp: Number(presence.hp ?? PLAYER_MAX_HP), combatTurn: Number(presence.lastCombatTurn || 0) };
    }

    const hpBefore = Math.max(1, Number(presence.hp ?? PLAYER_MAX_HP));
    const hpAfter = hpBefore - damage;
    if (hpAfter > 0) {
      tx.update(presenceRef, { hp: hpAfter, lastCombatTurn: currentTurn, updatedAt: fs.serverTimestamp() });
      return { damage, hp: hpAfter, combatTurn: currentTurn, attackers: attackerIds };
    }

    const eventId = deathEventId;
    const wallet = walletSnap.exists() ? walletSnap.data() : { balance: 0, totalEarned: 0, totalLost: 0 };
    const before = Math.max(0, Number(wallet.balance || 0));
    const lost = Math.min(10, before);
    tx.update(presenceRef, {
      x: pveRespawn.x, y: pveRespawn.y, vx: 0, vy: 0,
      moveUsed: 0,
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      deaths: Math.max(0, Number(presence.deaths || 0)) + 1,
      lastDeathEventId: eventId,
      lastCombatTurn: currentTurn,
      updatedAt: fs.serverTimestamp()
    });
    if (walletSnap.exists()) {
      tx.update(walletRef, {
        balance: before - lost,
        totalEarned: Math.max(0, Number(wallet.totalEarned || 0)),
        totalLost: Math.max(0, Number(wallet.totalLost || 0)) + lost,
        lastEventId: eventId,
        lastEventType: 'death',
        updatedAt: fs.serverTimestamp()
      });
    }
    if (worldId === 'global' && statsSnap.exists()) {
      const stats = statsSnap.data();
      tx.update(statsRef, {
        pveKills: 0,
        pvpKills: 0,
        lastPveKillActionId: String(stats.lastPveKillActionId || ''),
        lastPvpKillActionId: String(stats.lastPvpKillActionId || ''),
        lastResetDeathEventId: eventId,
        updatedAt: fs.serverTimestamp()
      });
    }
    return { damage, died: true, hp: PLAYER_MAX_HP, deaths: Math.max(0, Number(presence.deaths || 0)) + 1, eventId, lost, balance: before - lost, combatTurn: currentTurn, attackers: attackerIds, spawnX: pveRespawn.x, spawnY: pveRespawn.y };
  });

  if (result?.skipped) return;
  if (Number(result?.damage || 0) > 0 || result?.died) state.lastCombatTurn = currentTurn;
  if (result?.died) {
    state.hp = PLAYER_MAX_HP;
    state.deaths = Math.max(0, Number(result.deaths || state.deaths + 1));
    state.lastDeathEventId = String(result.eventId || deathEventId);
    state.x = Number(result.spawnX ?? pveRespawn.x); state.y = Number(result.spawnY ?? pveRespawn.y); state.vx = 0; state.vy = 0; state.moveUsed = 0; state.autoTarget = null;
    const token = state.tokenMap.get(state.identity.profileId);
    if (token) { updateToken(token, state.x, state.y); token.classList.add('player-death-pulse'); setTimeout(() => token.classList.remove('player-death-pulse'), 1200); }
    resetCamera(true);
    gameInventoryController.clearOnDeath(state.lastDeathEventId).catch(() => {});
    message(`YOU WERE DOWNED BY THE CACHE SLIMES // GAME INVENTORY CLEARED // -${result.lost || 0} CREDITS // RESPAWNED ON NORTH PLATFORM.`);
  } else {
    state.hp = Math.max(0, Number(result?.hp ?? state.hp));
    if (result?.damage) message(`CACHE SLIME${result.damage > 1 ? 'S' : ''} STRUCK BACK // -${result.damage} HP.`);
  }
  renderLocalBase();
  renderMovementHud();
}

async function runCombatMarker(currentTurn) {
  if (!state.identity?.profileId || state.combatMarkerInFlight.has(currentTurn)) return;
  state.combatMarkerInFlight.add(currentTurn);
  syncVelocity();
  renderActionPanel();
  renderMovementHud();
  try {
    await respawnDeadSlimes(currentTurn);
    const markerEnemies = await refreshEnemyState();
    const markerAttackers = [...markerEnemies.values()].filter(enemy =>
      enemy.alive && distanceBetween(state.x, state.y, enemy.x, enemy.y) <= SLIME_ATTACK_RANGE
    );

    // If the completed turn had no movement/action and no hostile commitment,
    // REST becomes its default action. The exact marker snapshot is passed in so
    // a slime that is attacking this marker always suppresses auto-rest.
    await autoRestCompletedTurn(currentTurn - 1, currentTurn, markerAttackers);

    // Player declarations and hostile retaliation belong to the same marker.
    // We resolve player actions first for clean kill/reward transactions, while
    // retaliation uses the pre-resolution snapshot above so defeating a slime
    // does not erase an attack it had already committed at the marker.
    await processResolvedActions(currentTurn);
    await refreshEnemyState();
    await applySlimeRetaliation(currentTurn, markerAttackers);
  } finally {
    state.combatMarkerInFlight.delete(currentTurn);
    syncVelocity();
    renderActionPanel();
    renderMovementHud();
  }
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
  const targetType = state.selectedTarget?.type;
  const enemyAlive = targetType !== 'enemy' || Boolean(state.enemies.get(state.selectedTarget?.id)?.alive);
  const rested = isRestedThisTurn();
  const markerResolving = state.combatMarkerInFlight.has(state.turnNumber);
  if (attack) attack.disabled = markerResolving || rested || !hasTarget || !['profile','enemy'].includes(targetType) || !enemyAlive || locked;
  if (interact) interact.disabled = markerResolving || rested || !hasTarget || targetType === 'enemy' || locked;
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
      if (action.actorProfileId && !state.profiles.has(action.actorProfileId)) getProfile(action.actorProfileId).then(() => { renderGameLog(); renderPvpRecord(); }).catch(() => {});
    });
    state.actions = next;
    if (state.ownQueuedActionId && !state.actions.has(state.ownQueuedActionId)) state.ownQueuedActionId = '';
    processResolvedActions(turnInfo().turnNumber).catch(error => console.error('Action processing', error));
    renderActionPanel();
    renderMovementHud();
    renderGameLog();
    renderPvpRecord();
    state.enemies.forEach(renderEnemy);
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
    if (isRestedThisTurn()) {
      message('You rested this refresh. Movement returns at the next marker.');
      return;
    }
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
    if (t - state.lastEnemyVisualAt > 220) {
      state.lastEnemyVisualAt = t;
      state.enemies.forEach(renderEnemy);
    }
    advanceSlimeWander().catch(() => {});
  }
  updateCamera(dt);
  requestAnimationFrame(frame);
}

const keyMap = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right'
};

window.addEventListener('keydown', event => {
  if (event.key === 'i' || event.key === 'I') {
    event.preventDefault();
    if (state.identity?.profileId) gameInventoryController.open('equipment');
    return;
  }
  if (document.body.classList.contains('game-inventory-open')) return;
  const key = keyMap[event.key];
  if (!key) return;
  event.preventDefault();
  if (isRestedThisTurn()) {
    message('You rested this refresh. Movement returns at the next marker.');
    return;
  }
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
    if (isRestedThisTurn()) {
      message('You rested this refresh. Movement returns at the next marker.');
      return;
    }
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
$('#gameInventoryButton')?.addEventListener('click', () => gameInventoryController.open('equipment'));
$('#cancelAction')?.addEventListener('click', cancelQueuedAction);
$('#restAction')?.addEventListener('click', restToFullHealth);
$('#cancelAutoMove')?.addEventListener('click', () => {
  state.autoTarget = null;
  publishInputChange();
  renderMovementHud();
  message('Auto-move cancelled.');
});

window.addEventListener('blur', () => stopAllMovement(false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAllMovement(false);
  else syncServerClock(true).catch(() => {});
});
window.addEventListener('pagehide', () => {
  if (state.identity?.profileId) fs.deleteDoc(fs.doc(db, 'gamePresence', presenceId(state.identity.profileId))).catch(() => {});
});

window.addEventListener('resize', () => resetCamera(true));
window.addEventListener('orientationchange', () => setTimeout(() => resetCamera(true), 80));

setupBattlefieldTargets();
renderMovementHud();
renderActionPanel();
renderGameLog();
renderPvpRecord();
renderScoreboard();
renderTurnClock();
requestAnimationFrame(frame);

watchIdentity(async identity => {
  state.identity = identity;
  if (!identity?.profileId) {
    message('Sign in to materialize your LCS profile token on the battlefield.');
    return;
  }
  state.profiles.set(identity.profileId, identity.profile);
  message('Synchronizing the shared global refresh clock…');
  const clockReady = await syncServerClock(true);
  if (!clockReady && !state.clockSynced) {
    // Keep the game usable if the clock-probe rules have not been deployed yet.
    // The client will retry periodically and on focus until server sync succeeds.
    state.serverOffsetMs = 0;
    state.clockSynced = true;
    message('Global clock is using local fallback time; server resync will retry automatically.');
  } else {
    message('LCS tactical token online. Global clock synchronized.');
  }
  state.turnNumber = turnInfo().turnNumber;

  // Presence is the critical path for materializing the player's map token.
  // Optional economy/inventory failures must never prevent the battlefield from
  // coming online.
  await restorePosition();
  await loadWorldName();
  await flushPresence(true);
  watchPresence();
  watchActions();

  try {
    await ensureCreditWallet(db, fs, identity.profileId);
    await ensureGameInventory(db, fs, identity.profileId);
    await gameInventoryController.start(identity.profileId);
    await ensureGlobalStats(identity.profileId);
    watchCredits();
    watchGlobalStats();
    if (state.lastDeathEventId) await gameInventoryController.clearOnDeath(state.lastDeathEventId);
  } catch (error) {
    console.error('Optional game inventory/economy init', error);
    message('BATTLEFIELD ONLINE // INVENTORY OR CREDIT SYSTEM NEEDS FIRESTORE RULES.');
  }

  try {
    await ensureSlimePopulation();
    await respawnDeadSlimes(state.turnNumber);
    watchEnemies();
  } catch (error) {
    console.error('Enemy population init', error);
  }
});

loadWorldName();
setInterval(() => pruneOldActions(), 30_000);
setInterval(() => syncServerClock(false).catch(() => {}), CLOCK_RESYNC_MS);
