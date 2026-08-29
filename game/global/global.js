import { db, fs, watchIdentity, profileById, avatarSvg } from '/game/assets/js/eras-data.js';
import { ensureCreditWallet, watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';

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
const PLAYER_MAX_HP = 3;
const PLAYER_ATTACK_RANGE = 14;
const SLIME_ATTACK_RANGE = 13;
const SLIME_MAX_HP = 1;
const SLIME_DEFS = Object.freeze([
  { key: 'cache-slime-a', label: 'CACHE SLIME A', x: 80.5, y: 72.0, tint: '#62d776' },
  { key: 'cache-slime-b', label: 'CACHE SLIME B', x: 85.0, y: 77.0, tint: '#8ee767' }
]);

const state = {
  identity: null,
  x: 50,
  y: 50,
  vx: 0,
  vy: 0,
  moveUsed: 0,
  hp: PLAYER_MAX_HP,
  deaths: 0,
  lastDeathEventId: '',
  lastCombatTurn: 0,
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
  creditBalance: 0,
  profiles: new Map(),
  remote: new Map(),
  keys: new Set(),
  touch: new Set(),
  tokenMap: new Map(),
  enemies: new Map(),
  enemyElements: new Map(),
  autoTarget: null,
  selectedTarget: null,
  actions: new Map(),
  ownQueuedActionId: '',
  resolvedSeen: new Set(),
  serverOffsetMs: 0,
  pendingClockSentAt: 0,
  pruningActions: new Set(),
  resolvingActions: new Set(),
  combatMarkerInFlight: new Set(),
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

function renderLocalBase() {
  const id = state.identity?.profileId;
  if (!id) return;
  const el = state.tokenMap.get(id);
  if (!el) return;
  const ratio = Math.max(0, Math.min(1, state.moveUsed / MOVE_BUDGET));
  el.style.setProperty('--move-angle', `${ratio * 360}deg`);
  el.classList.toggle('is-exhausted', ratio >= 0.999);
  const label = el.querySelector('.player-token-state');
  if (label) label.textContent = `${ratio >= 0.999 ? 'RESTING' : 'YOU'} // HP ${state.hp}/${PLAYER_MAX_HP}`;
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
  el.style.left = `${enemy.x}%`;
  el.style.top = `${enemy.y}%`;
  el.classList.toggle('is-dead', !enemy.alive);
  el.classList.toggle('is-selected', state.selectedTarget?.type === 'enemy' && state.selectedTarget.id === enemy.id);
  el.querySelector('strong').textContent = enemy.label || 'CACHE SLIME';
  el.querySelector('small').textContent = enemy.alive ? `HP ${enemy.hp} / ${enemy.maxHp}` : 'DOWN // RESPAWNING';
  el.querySelector('.enemy-health')?.style.setProperty('--enemy-hp', `${Math.max(0, Math.min(100, (Number(enemy.hp || 0) / Math.max(1, Number(enemy.maxHp || 1))) * 100))}%`);
}

async function ensureSlimePopulation() {
  if (!state.identity?.profileId) return;
  await Promise.all(SLIME_DEFS.map(async def => {
    const id = enemyDocId(def.key);
    const ref = fs.doc(db, 'gameEnemies', id);
    const snap = await fs.getDoc(ref);
    if (snap.exists()) return;
    try {
      await fs.setDoc(ref, {
        worldId,
        enemyKey: def.key,
        type: 'slime',
        label: def.label,
        x: def.x,
        y: def.y,
        hp: SLIME_MAX_HP,
        maxHp: SLIME_MAX_HP,
        alive: true,
        respawnTurn: 0,
        lastHitActionId: '',
        lastHitByProfileId: '',
        lastKillActionId: '',
        killerProfileId: '',
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
      await fs.runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const live = snap.data();
        if (live.alive || Number(live.respawnTurn || 0) > currentTurn) return;
        tx.update(ref, {
          hp: Number(live.maxHp || SLIME_MAX_HP),
          alive: true,
          respawnTurn: 0,
          lastHitActionId: '',
          lastHitByProfileId: '',
          killerProfileId: '',
          updatedAt: fs.serverTimestamp()
        });
      });
    } catch (error) {
      console.debug('Slime respawn race', error?.code || error);
    }
  }));
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
      state.hp = Math.max(0, Math.min(PLAYER_MAX_HP, Number(snap.data().hp ?? PLAYER_MAX_HP)));
      state.deaths = Math.max(0, Number(snap.data().deaths || 0));
      state.lastDeathEventId = String(snap.data().lastDeathEventId || '');
      state.lastCombatTurn = Math.max(0, Number(snap.data().lastCombatTurn || 0));
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
      hp: state.hp,
      maxHp: PLAYER_MAX_HP,
      deaths: state.deaths,
      lastDeathEventId: state.lastDeathEventId,
      lastCombatTurn: state.lastCombatTurn,
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

function watchCredits() {
  state.creditUnsub?.();
  state.creditUnsub = watchCreditWallet(db, fs, state.identity?.profileId, balance => {
    state.creditBalance = balance;
    renderMovementHud();
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
    if (action.outcome === 'kill') return 'KILL +1C';
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
  pruneOldActions(true);
  runCombatMarker(nextTurn).catch(error => {
    console.error('Combat marker', error);
    message(`COMBAT MARKER ERROR: ${error.code || error.message}`);
  });
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
    const actionRef = fs.doc(db, 'gameActions', id);
    const enemyRef = fs.doc(db, 'gameEnemies', action.targetId);
    const presenceRef = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
    const walletRef = fs.doc(db, 'creditWallets', state.identity.profileId);

    const result = await fs.runTransaction(db, async tx => {
      const [actionSnap, enemySnap, presenceSnap, walletSnap] = await Promise.all([
        tx.get(actionRef), tx.get(enemyRef), tx.get(presenceRef), tx.get(walletRef)
      ]);
      if (!actionSnap.exists() || !enemySnap.exists() || !presenceSnap.exists() || !walletSnap.exists()) return { skipped: true };
      const liveAction = actionSnap.data();
      const enemy = enemySnap.data();
      const presence = presenceSnap.data();
      if (liveAction.status !== 'queued' || Number(liveAction.resolveTurn || 0) > currentTurn) return { skipped: true };

      const inRange = enemy.alive && distanceBetween(presence.x, presence.y, enemy.x, enemy.y) <= PLAYER_ATTACK_RANGE;
      if (!inRange) {
        tx.update(actionRef, {
          status: 'resolved', outcome: 'miss', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp()
        });
        return { miss: true, label: enemy.label || action.targetLabel || 'SLIME' };
      }

      const nextHp = Math.max(0, Number(enemy.hp || 0) - 1);
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
      }
      return { killed, hit: true, label: enemy.label || action.targetLabel || 'SLIME' };
    });

    if (result?.killed) message(`${result.label} defeated // +1 CREDIT.`);
    else if (result?.hit) message(`${result.label} hit.`);
    else if (result?.miss) message(`${result.label} attack missed // target was down or outside ${PLAYER_ATTACK_RANGE} range.`);
  } catch (error) {
    console.error('Enemy attack resolution', error);
    message(`ATTACK RESOLUTION FAILED: ${error.code || error.message}`);
  } finally {
    state.resolvingActions.delete(id);
  }
}

async function resolveOwnStandardAction(id, action, currentTurn) {
  if (state.resolvingActions.has(id)) return;
  state.resolvingActions.add(id);
  try {
    const ref = fs.doc(db, 'gameActions', id);
    await fs.runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const live = snap.data();
      if (live.status !== 'queued' || Number(live.resolveTurn || 0) > currentTurn) return;
      tx.update(ref, {
        status: 'resolved', outcome: action.actionType === 'interact' ? 'interact' : 'resolved', updatedAt: fs.serverTimestamp(), resolvedAt: fs.serverTimestamp()
      });
    });
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
    else await resolveOwnStandardAction(id, action, currentTurn);
  }

  for (const [id, action] of state.actions) {
    const resolveTurn = Number(action.resolveTurn || 0);
    if (action.status !== 'resolved' || resolveTurn > currentTurn || resolveTurn < currentTurn - 1 || state.resolvedSeen.has(id)) continue;
    state.resolvedSeen.add(id);
    pulseTarget(action);
    const actorName = state.profiles.get(action.actorProfileId)?.displayName || (action.actorProfileId === state.identity?.profileId ? 'YOU' : 'PLAYER');
    const suffix = action.outcome === 'kill' ? ' // KILL +1 CREDIT' : action.outcome === 'miss' ? ' // MISS' : '';
    message(`${actorName} ${action.actionType === 'attack' ? 'ATTACK' : 'INTERACTION'} RESOLVED → ${action.targetLabel || 'TARGET'}${suffix}.`);
    if (action.actorProfileId === state.identity?.profileId && state.ownQueuedActionId === id) state.ownQueuedActionId = '';
  }
  renderActionPanel();
}

async function applySlimeRetaliation(currentTurn) {
  if (!state.identity?.profileId) return;
  await ensureCreditWallet(db, fs, state.identity.profileId);
  const presenceRef = fs.doc(db, 'gamePresence', presenceId(state.identity.profileId));
  const walletRef = fs.doc(db, 'creditWallets', state.identity.profileId);
  const enemyRefs = SLIME_DEFS.map(def => fs.doc(db, 'gameEnemies', enemyDocId(def.key)));

  const result = await fs.runTransaction(db, async tx => {
    const presenceSnap = await tx.get(presenceRef);
    if (!presenceSnap.exists()) return { skipped: true };
    const enemySnaps = [];
    for (const ref of enemyRefs) enemySnaps.push(await tx.get(ref));
    const walletSnap = await tx.get(walletRef);
    const presence = presenceSnap.data();
    if (Number(presence.lastCombatTurn || 0) >= currentTurn) return { skipped: true };

    const attackers = enemySnaps
      .filter(snap => snap.exists())
      .map(snap => ({ id: snap.id, ...snap.data() }))
      .filter(enemy => enemy.alive && distanceBetween(presence.x, presence.y, enemy.x, enemy.y) <= SLIME_ATTACK_RANGE);
    const damage = attackers.length;
    if (!damage) {
      tx.update(presenceRef, { lastCombatTurn: currentTurn, updatedAt: fs.serverTimestamp() });
      return { damage: 0, hp: Number(presence.hp ?? PLAYER_MAX_HP), combatTurn: currentTurn };
    }

    const hpBefore = Math.max(1, Number(presence.hp ?? PLAYER_MAX_HP));
    const hpAfter = hpBefore - damage;
    if (hpAfter > 0) {
      tx.update(presenceRef, { hp: hpAfter, lastCombatTurn: currentTurn, updatedAt: fs.serverTimestamp() });
      return { damage, hp: hpAfter, combatTurn: currentTurn, attackers: attackers.map(x => x.id) };
    }

    const eventId = `death_${presenceId(state.identity.profileId)}_${currentTurn}`.slice(0, 180);
    const wallet = walletSnap.exists() ? walletSnap.data() : { balance: 0, totalEarned: 0, totalLost: 0 };
    const before = Math.max(0, Number(wallet.balance || 0));
    const lost = Math.min(10, before);
    tx.update(presenceRef, {
      x: 50, y: 50, vx: 0, vy: 0,
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
    return { damage, died: true, hp: PLAYER_MAX_HP, deaths: Math.max(0, Number(presence.deaths || 0)) + 1, eventId, lost, balance: before - lost, combatTurn: currentTurn, attackers: attackers.map(x => x.id) };
  });

  if (result?.skipped) return;
  state.lastCombatTurn = currentTurn;
  if (result?.died) {
    state.hp = PLAYER_MAX_HP;
    state.deaths = Math.max(0, Number(result.deaths || state.deaths + 1));
    state.lastDeathEventId = String(result.eventId || `death_${presenceId(state.identity.profileId)}_${currentTurn}`.slice(0, 180));
    state.x = 50; state.y = 50; state.vx = 0; state.vy = 0; state.moveUsed = 0; state.autoTarget = null;
    const token = state.tokenMap.get(state.identity.profileId);
    if (token) { updateToken(token, state.x, state.y); token.classList.add('player-death-pulse'); setTimeout(() => token.classList.remove('player-death-pulse'), 1200); }
    message(`YOU WERE DOWNED BY THE CACHE SLIMES // -${result.lost || 0} CREDITS // RESPAWNED.`);
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
  try {
    await respawnDeadSlimes(currentTurn);
    await refreshEnemyState();
    await processResolvedActions(currentTurn);
    await refreshEnemyState();
    await applySlimeRetaliation(currentTurn);
  } finally {
    state.combatMarkerInFlight.delete(currentTurn);
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
  if (attack) attack.disabled = !hasTarget || !['profile','enemy'].includes(targetType) || !enemyAlive || locked;
  if (interact) interact.disabled = !hasTarget || targetType === 'enemy' || locked;
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
    processResolvedActions(turnInfo().turnNumber).catch(error => console.error('Action processing', error));
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
  await ensureCreditWallet(db, fs, identity.profileId);
  watchCredits();
  await restorePosition();
  await loadWorldName();
  await flushPresence(true);
  await ensureSlimePopulation();
  await respawnDeadSlimes(state.turnNumber);
  watchPresence();
  watchEnemies();
  watchActions();
});

loadWorldName();
setInterval(() => pruneOldActions(), 30_000);
