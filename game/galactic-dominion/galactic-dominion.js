import { db, fs, watchIdentity, safeText } from '/game/assets/js/eras-data.js';
import { obtainLobbyEntitlement, createLobbyMembership, maintainLobbyMembership } from '/game/assets/js/hosted-join.js?v=1.2.0';
import {
  GALACTIC_MODE_ID,
  GALACTIC_BOARD,
  GALACTIC_BOARD_SIZE,
  GALACTIC_QUARANTINE_INDEX,
  GALACTIC_ANOMALIES,
  galacticSettings,
  boardGridPosition,
  boardSpace,
  freshOwnership,
  rentForSpace,
  canDevelopSpace,
  playerNetWorth
} from '/game/config/galactic-dominion.js?v=1.0.0';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const lobbyId = String(params.get('lobby') || '').trim();
const state = { identity: null, lobby: null, game: null, gameUnsub: null, lobbyUnsub: null, heartbeat: null, accessLeaseStop: null, joining: null, busy: false };
const gameRef = () => fs.doc(db, 'galacticDominionGames', lobbyId);
const lobbyRef = () => fs.doc(db, 'gameLobbies', lobbyId);
const memberRef = profileId => fs.doc(db, 'gameLobbies', lobbyId, 'members', profileId);
const settings = () => galacticSettings(state.lobby?.settings || {});

function say(message, tone = '') {
  const el = $('#gameFeedback');
  if (!el) return;
  el.textContent = String(message || '').toUpperCase();
  el.dataset.tone = tone;
}

function randomInt(max) {
  const limit = Math.max(1, Math.floor(Number(max) || 1));
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % limit;
}
function randomDie() { return randomInt(6) + 1; }
function tokenColor(id) {
  let h = 2166136261;
  for (const char of String(id || 'member')) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `hsl(${Math.abs(h) % 360} 68% 68%)`;
}
function initials(name = 'M') {
  return String(name).trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase().slice(0, 2) || 'M';
}
function tokenMarkup(profileId, player) {
  const asset = profileId === state.identity?.profileId ? window.ERAS_HOSTED_ACTIVE_ASSET : null;
  return asset?.previewUrl ? `<img src="${safeText(asset.previewUrl)}" alt="">` : esc(initials(player?.displayName));
}
function esc(value) { return safeText(value); }
function displayName(profileId, game = state.game) { return game?.players?.[profileId]?.displayName || 'Member'; }
function formatMoney(value) { return Math.max(0, Math.floor(Number(value || 0))).toLocaleString(); }
function activePlayerIds(game) { return (game?.turnOrder || []).filter(id => game?.players?.[id] && !game.players[id].bankrupt); }
function clonedGame(data) {
  return {
    ...data,
    players: Object.fromEntries(Object.entries(data?.players || {}).map(([id, p]) => [id, { ...p }])),
    ownership: Object.fromEntries(Object.entries(data?.ownership || {}).map(([id, h]) => [id, { ...h }])),
    turnOrder: [...(data?.turnOrder || [])],
    log: [...(data?.log || [])]
  };
}
function addLog(game, text) {
  game.actionSeq = Math.max(0, Number(game.actionSeq || 0)) + 1;
  game.log = [{ seq: game.actionSeq, text: String(text || '').slice(0, 180) }, ...(game.log || [])].slice(0, 30);
}
function highestWorthPlayer(game) {
  const ids = activePlayerIds(game).length ? activePlayerIds(game) : (game.turnOrder || []).filter(id => game.players?.[id]);
  return ids.sort((a, b) => playerNetWorth(game, b) - playerNetWorth(game, a))[0] || '';
}
function finishGame(game, reason = '') {
  game.status = 'finished';
  game.phase = 'finished';
  game.pendingSpaceId = '';
  game.winnerId = highestWorthPlayer(game);
  game.currentPlayerId = game.winnerId;
  addLog(game, `${reason || 'MATCH COMPLETE'}${game.winnerId ? ` // ${displayName(game.winnerId, game)} CONTROLS THE GALAXY` : ''}`);
}
function transferOrReleaseAssets(game, fromId, toId = '') {
  for (const holding of Object.values(game.ownership || {})) {
    if (holding.ownerId === fromId) holding.ownerId = toId && !game.players?.[toId]?.bankrupt ? toId : '';
  }
}
function bankrupt(game, profileId, creditorId = '', reason = '') {
  const player = game.players?.[profileId];
  if (!player || player.bankrupt) return;
  player.balance = 0;
  player.bankrupt = true;
  transferOrReleaseAssets(game, profileId, creditorId);
  addLog(game, `${displayName(profileId, game)} IS INSOLVENT${reason ? ` // ${reason}` : ''}`);
}
function advanceTurn(game) {
  const active = activePlayerIds(game);
  if (active.length <= 1) return finishGame(game, 'LAST SOLVENT DOMINION');
  const order = game.turnOrder || [];
  const currentIndex = Math.max(0, order.indexOf(game.currentPlayerId));
  let nextIndex = currentIndex;
  let wrapped = false;
  for (let step = 1; step <= order.length; step += 1) {
    const candidateIndex = (currentIndex + step) % order.length;
    if (candidateIndex <= currentIndex) wrapped = true;
    const candidate = order[candidateIndex];
    if (game.players?.[candidate] && !game.players[candidate].bankrupt) { nextIndex = candidateIndex; break; }
  }
  if (wrapped) game.round = Math.max(1, Number(game.round || 1)) + 1;
  if (game.round > settings().maxRounds) return finishGame(game, 'ROUND LIMIT REACHED');
  game.turnIndex = nextIndex;
  game.currentPlayerId = order[nextIndex];
  game.phase = 'roll';
  game.pendingSpaceId = '';
  game.diceA = 0;
  game.diceB = 0;
}
function handleRent(game, playerId, space) {
  const holding = game.ownership?.[space.id];
  const ownerId = holding?.ownerId || '';
  const player = game.players[playerId];
  if (!ownerId || ownerId === playerId || !game.players?.[ownerId] || game.players[ownerId].bankrupt) return false;
  const rent = Math.max(0, rentForSpace(game, space));
  const paid = Math.min(Math.max(0, player.balance), rent);
  player.balance -= paid;
  game.players[ownerId].balance += paid;
  addLog(game, `${displayName(playerId, game)} PAID ${paid} ${settings().currencyName} TO ${displayName(ownerId, game)} // ${space.name}`);
  if (paid < rent) bankrupt(game, playerId, ownerId, `COULD NOT PAY ${rent}`);
  return true;
}
function applyAnomaly(game, playerId, anomalyIndex) {
  const player = game.players[playerId];
  const event = GALACTIC_ANOMALIES[Math.max(0, Math.min(GALACTIC_ANOMALIES.length - 1, anomalyIndex))];
  if (Number(event.balanceDelta || 0) !== 0) {
    const delta = Number(event.balanceDelta || 0);
    if (delta < 0 && player.balance < Math.abs(delta)) {
      player.balance = 0;
      bankrupt(game, playerId, '', event.label);
    } else player.balance = Math.max(0, player.balance + delta);
  }
  if (Number.isInteger(event.moveTo)) player.position = event.moveTo;
  if (event.quarantineTurns) player.quarantinedTurns = event.quarantineTurns;
  addLog(game, `${displayName(playerId, game)} // ${event.label}`);
}
function resolveLanding(game, playerId, anomalyIndex) {
  const player = game.players[playerId];
  const space = boardSpace(player.position);
  game.lastSpaceId = space.id;
  game.pendingSpaceId = '';

  if (space.type === 'property' || space.type === 'warp') {
    const holding = game.ownership[space.id];
    if (!holding.ownerId) {
      game.phase = 'action';
      game.pendingSpaceId = space.id;
      addLog(game, `${displayName(playerId, game)} LANDED ON ${space.name} // AVAILABLE FOR ${space.cost}`);
      return;
    }
    if (holding.ownerId !== playerId) {
      handleRent(game, playerId, space);
      return advanceTurn(game);
    }
    if (canDevelopSpace(game, playerId, space, settings())) {
      game.phase = 'action';
      game.pendingSpaceId = space.id;
      addLog(game, `${displayName(playerId, game)} LANDED ON OWNED ${space.name} // DEVELOPMENT AVAILABLE`);
      return;
    }
    addLog(game, `${displayName(playerId, game)} LANDED ON OWNED ${space.name}`);
    return advanceTurn(game);
  }

  if (space.type === 'tax') {
    const amount = Math.max(0, Number(space.amount || 0));
    const paid = Math.min(player.balance, amount);
    player.balance -= paid;
    addLog(game, `${displayName(playerId, game)} PAID FEDERATION TARIFF // ${paid}`);
    if (paid < amount) bankrupt(game, playerId, '', `FEDERATION TARIFF ${amount}`);
    return advanceTurn(game);
  }
  if (space.type === 'anomaly') {
    applyAnomaly(game, playerId, anomalyIndex);
    return advanceTurn(game);
  }
  if (space.type === 'quarantine') {
    player.quarantinedTurns = 1;
    addLog(game, `${displayName(playerId, game)} ENTERED QUARANTINE // NEXT TURN SKIPPED`);
    return advanceTurn(game);
  }
  if (space.type === 'start') addLog(game, `${displayName(playerId, game)} ARRIVED AT DOMINION GATE`);
  else addLog(game, `${displayName(playerId, game)} ENTERED ${space.name}`);
  return advanceTurn(game);
}

function initialGameDocument() {
  const profileId = state.identity.profileId;
  const profileName = String(state.identity.profile?.displayName || 'Host').slice(0, 50);
  return {
    version: 1,
    lobbyId,
    hostProfileId: state.lobby.hostProfileId,
    status: 'waiting',
    phase: 'waiting',
    currentPlayerId: '',
    turnOrder: [],
    turnIndex: 0,
    round: 0,
    diceA: 0,
    diceB: 0,
    lastSpaceId: 'dominion-gate',
    pendingSpaceId: '',
    winnerId: '',
    players: { [profileId]: { displayName: profileName, position: 0, balance: settings().startingBalance, quarantinedTurns: 0, bankrupt: false, joinOrder: 1 } },
    ownership: freshOwnership(),
    log: [{ seq: 1, text: `${profileName} CREATED GALACTIC DOMINION` }],
    actionSeq: 1,
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp()
  };
}

async function ensureLobbyMembership() {
  const profileId = state.identity?.profileId;
  if (!profileId || !state.lobby) throw new Error('Identity or lobby unavailable.');
  const existing = await fs.getDoc(memberRef(profileId));
  if (!existing.exists() && state.lobby.status !== 'open') throw new Error('This match has already started.');
  if (!existing.exists()) {
    const members = await fs.getDocs(fs.collection(db, 'gameLobbies', lobbyId, 'members'));
    if (members.size >= Number(state.lobby.maxPlayers || 8)) throw new Error('This lobby is full.');
  }
  const entitlementId = await obtainLobbyEntitlement(state.lobby, profileId);
  await createLobbyMembership(state.lobby, profileId, entitlementId);
  state.accessLeaseStop?.();
  state.accessLeaseStop = maintainLobbyMembership(state.lobby, profileId, {
    onExpired: () => { say('HOSTED ACCESS EXPIRED. RETURNING TO JOIN.', 'error'); setTimeout(() => location.replace(`/game/join/?code=${encodeURIComponent(state.lobby?.code || '')}`), 500); },
    onError: error => console.debug('Galactic access lease', error?.code || error)
  });
}

async function ensureGameDocument() {
  const snap = await fs.getDoc(gameRef());
  if (snap.exists()) return;
  if (state.lobby.hostProfileId !== state.identity.profileId) return;
  await fs.setDoc(gameRef(), initialGameDocument());
}

async function joinGameDocument() {
  const profileId = state.identity.profileId;
  const name = String(state.identity.profile?.displayName || 'Member').slice(0, 50);
  await fs.runTransaction(db, async tx => {
    const snap = await tx.get(gameRef());
    if (!snap.exists()) throw new Error('Waiting for the host to initialize Galactic Dominion.');
    const game = clonedGame(snap.data());
    if (game.players?.[profileId]) return;
    if (game.status !== 'waiting') throw new Error('This Galactic Dominion match has already started.');
    const currentCount = Object.keys(game.players || {}).length;
    if (currentCount >= Math.min(8, Number(state.lobby.maxPlayers || 8))) throw new Error('This Galactic Dominion lobby is full.');
    const joinOrder = Math.max(0, ...Object.values(game.players || {}).map(p => Number(p.joinOrder || 0))) + 1;
    game.players[profileId] = { displayName: name, position: 0, balance: settings().startingBalance, quarantinedTurns: 0, bankrupt: false, joinOrder };
    addLog(game, `${name} JOINED THE GALAXY`);
    tx.update(gameRef(), { ...game, updatedAt: fs.serverTimestamp() });
  });
}

async function readyPlayer() {
  if (state.joining || !state.identity?.profileId || !state.lobby || state.lobby.gameStyle !== GALACTIC_MODE_ID) return state.joining;
  state.joining = (async () => {
    try {
      await ensureLobbyMembership();
      watchGame();
      await ensureGameDocument();
      await joinGameDocument();
      say('Galactic Dominion ready.', 'ok');
    } catch (error) {
      console.error(error);
      say(error.message || error.code || 'Could not join Galactic Dominion.', 'error');
    } finally { state.joining = null; }
  })();
  return state.joining;
}

function watchGame() {
  if (state.gameUnsub) return;
  state.gameUnsub = fs.onSnapshot(gameRef(), snap => {
    state.game = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    render();
    const me = state.identity?.profileId || '';
    if (state.game && me && state.game.status === 'waiting' && !state.game.players?.[me] && !state.joining) readyPlayer();
  }, error => { console.error(error); say(`Game sync failed: ${error.code || error.message}`, 'error'); });
}

function watchLobby() {
  if (!lobbyId) return say('Missing lobby id.', 'error');
  state.lobbyUnsub = fs.onSnapshot(lobbyRef(), snap => {
    if (!snap.exists()) { state.lobby = null; render(); return say('Lobby not found.', 'error'); }
    state.lobby = { id: snap.id, ...snap.data() };
    if (state.lobby.gameStyle !== GALACTIC_MODE_ID) {
      location.replace(`/game/global/?lobby=${encodeURIComponent(lobbyId)}`);
      return;
    }
    renderLobbyMeta();
    manageHeartbeat();
    readyPlayer();
  }, error => { console.error(error); say(`Lobby sync failed: ${error.code || error.message}`, 'error'); });
}

function manageHeartbeat() {
  clearInterval(state.heartbeat);
  state.heartbeat = null;
  if (!state.lobby || state.lobby.hostProfileId !== state.identity?.profileId || state.lobby.status !== 'open' || (state.lobby.sourceType||'hosted')==='published') return;
  state.heartbeat = setInterval(() => {
    fs.updateDoc(lobbyRef(), { lastHeartbeatAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() }).catch(() => {});
  }, 20000);
}

function renderLobbyMeta() {
  if (!state.lobby) return;
  $('#lobbyName').textContent = String(state.lobby.name || 'Galactic Dominion').toUpperCase();
  const s = settings();
  $('#lobbyMeta').textContent = `CODE ${state.lobby.code || '------'} // ${state.lobby.maxPlayers || 8} MAX // ${s.currencySymbol} ${s.currencyName} // START ${formatMoney(s.startingBalance)} // ${s.maxRounds} ROUND LIMIT`;
}

function spaceMeta(space, game) {
  if (space.type === 'property') {
    const level = Math.max(0, Number(game?.ownership?.[space.id]?.level || 0));
    return `${space.sector.toUpperCase()} // ${space.cost} // T${rentForSpace(game, space)}${level ? ` // LV${level}` : ''}`;
  }
  if (space.type === 'warp') return `WARP GATE // ${space.cost} // T${rentForSpace(game, space)}`;
  if (space.type === 'tax') return `PAY ${space.amount}`;
  if (space.type === 'anomaly') return 'RANDOM GALACTIC EVENT';
  if (space.type === 'quarantine') return 'SKIP NEXT TURN';
  if (space.type === 'start') return `PASS +${settings().startSalary}`;
  return 'SAFE ORBIT';
}

function renderBoard() {
  const root = $('#galacticBoard');
  if (!root) return;
  root.querySelectorAll('.galactic-space').forEach(node => node.remove());
  const game = state.game;
  GALACTIC_BOARD.forEach((space, index) => {
    const pos = boardGridPosition(index);
    const holding = game?.ownership?.[space.id];
    const owner = holding?.ownerId || '';
    const playersHere = Object.entries(game?.players || {}).filter(([, player]) => Number(player.position || 0) === index && !player.bankrupt);
    const node = document.createElement('article');
    node.className = `galactic-space${owner ? ' is-owned' : ''}${game?.currentPlayerId && Number(game.players?.[game.currentPlayerId]?.position ?? -1) === index ? ' is-current' : ''}`;
    node.dataset.type = space.type;
    node.style.gridRow = String(pos.row);
    node.style.gridColumn = String(pos.col);
    if (owner) node.style.setProperty('--owner-color', tokenColor(owner));
    const ownerText = owner ? `<div class="galactic-space-owner">${esc(displayName(owner, game))}</div>` : '';
    const level = space.type === 'property' && Number(holding?.level || 0) > 0 ? `<span class="galactic-level">L${Number(holding.level)}</span>` : '';
    const tokens = playersHere.map(([id, player]) => `<span class="galactic-token" title="${esc(player.displayName)}" style="--token-color:${tokenColor(id)}">${tokenMarkup(id, player)}</span>`).join('');
    node.innerHTML = `${level}<div class="galactic-space-name">${esc(space.name)}</div><div class="galactic-space-meta">${esc(spaceMeta(space, game))}</div>${ownerText}<div class="galactic-space-tokens">${tokens}</div>`;
    root.appendChild(node);
  });
}

function renderPlayers() {
  const root = $('#playerList');
  if (!root) return;
  const game = state.game;
  if (!game || !Object.keys(game.players || {}).length) { root.innerHTML = '<p class="runtime-list-empty">WAITING FOR PLAYERS.</p>'; return; }
  const ordered = [...Object.keys(game.players)].sort((a, b) => Number(game.players[a].joinOrder || 0) - Number(game.players[b].joinOrder || 0));
  root.innerHTML = ordered.map(id => {
    const player = game.players[id];
    const worth = playerNetWorth(game, id);
    return `<article class="galactic-player${game.currentPlayerId === id ? ' is-turn' : ''}${player.bankrupt ? ' is-bankrupt' : ''}" style="--token-color:${tokenColor(id)}"><div class="galactic-player-head"><div class="galactic-player-name"><span class="galactic-player-dot"></span><span>${esc(player.displayName)}</span></div><b>${player.bankrupt ? 'INSOLVENT' : `#${Number(player.position || 0)}`}</b></div><div class="galactic-player-balance">${esc(settings().currencySymbol)} ${formatMoney(player.balance)} // NET ${formatMoney(worth)}${player.quarantinedTurns ? ' // QUARANTINED' : ''}</div></article>`;
  }).join('');
}

function renderLog() {
  const root = $('#eventLog');
  if (!root) return;
  const log = state.game?.log || [];
  root.innerHTML = log.length ? log.map(entry => `<div class="galactic-log-entry">${esc(entry.text)}</div>`).join('') : '<p class="runtime-list-empty">NO EVENTS YET.</p>';
}

function setButton(button, visible, disabled = false, text = '') {
  if (!button) return;
  button.hidden = !visible;
  button.disabled = !!disabled || state.busy;
  if (text) button.textContent = text;
}

function renderControls() {
  const game = state.game;
  const me = state.identity?.profileId || '';
  const host = state.lobby?.hostProfileId === me;
  const mine = game?.currentPlayerId === me;
  const current = game?.players?.[game?.currentPlayerId];
  const pending = GALACTIC_BOARD.find(space => space.id === game?.pendingSpaceId);
  const myPlayer = game?.players?.[me];
  const s = settings();

  if (!game) {
    $('#turnLabel').textContent = 'WAITING FOR HOST';
    $('#phaseLabel').textContent = 'THE HOST IS INITIALIZING GALACTIC DOMINION';
    $('#diceDisplay').textContent = '—';
    ['startButton','rollButton','buyButton','developButton','passButton','resetButton'].forEach(id => setButton($(`#${id}`), false));
    return;
  }
  if (game.status === 'waiting') {
    const count = Object.keys(game.players || {}).length;
    $('#turnLabel').textContent = `WAITING FOR PLAYERS // ${count}/${Math.min(8, Number(state.lobby?.maxPlayers || 8))}`;
    $('#phaseLabel').textContent = host ? 'HOST MAY START WITH 2 OR MORE PLAYERS' : 'WAITING FOR HOST TO START';
    $('#diceDisplay').textContent = '—';
    setButton($('#startButton'), host, count < 2, 'START MATCH');
    setButton($('#rollButton'), false); setButton($('#buyButton'), false); setButton($('#developButton'), false); setButton($('#passButton'), false); setButton($('#resetButton'), false);
    return;
  }
  if (game.status === 'finished') {
    $('#turnLabel').textContent = game.winnerId ? `${displayName(game.winnerId, game).toUpperCase()} CONTROLS THE GALAXY` : 'MATCH COMPLETE';
    $('#phaseLabel').textContent = `ROUND ${game.round} // FINAL NET WORTH DECIDES TIES`;
    $('#diceDisplay').textContent = game.diceA && game.diceB ? `${game.diceA} + ${game.diceB}` : '★';
    setButton($('#startButton'), false); setButton($('#rollButton'), false); setButton($('#buyButton'), false); setButton($('#developButton'), false); setButton($('#passButton'), false);
    setButton($('#resetButton'), host, false, 'RESET MATCH');
    return;
  }

  $('#turnLabel').textContent = `${displayName(game.currentPlayerId, game).toUpperCase()}'S TURN // ROUND ${game.round}`;
  $('#diceDisplay').textContent = game.diceA && game.diceB ? `${game.diceA} + ${game.diceB}` : '—';
  $('#phaseLabel').textContent = mine ? (game.phase === 'roll' ? 'ROLL TO MOVE AROUND THE GALACTIC RING' : `DECIDE ON ${pending?.name || 'CURRENT SPACE'}`) : `WAITING FOR ${displayName(game.currentPlayerId, game).toUpperCase()}`;
  setButton($('#startButton'), false); setButton($('#resetButton'), false);
  setButton($('#rollButton'), mine && game.phase === 'roll', false, current?.quarantinedTurns ? 'SERVE QUARANTINE' : 'ROLL');
  const canBuy = mine && game.phase === 'action' && pending && !game.ownership?.[pending.id]?.ownerId && myPlayer && myPlayer.balance >= Number(pending.cost || 0);
  setButton($('#buyButton'), !!canBuy, false, pending ? `BUY ${pending.cost}` : 'BUY');
  const canDevelop = mine && game.phase === 'action' && pending && canDevelopSpace(game, me, pending, s) && myPlayer && myPlayer.balance >= Number(pending.developmentCost || 0);
  setButton($('#developButton'), !!canDevelop, false, pending ? `DEVELOP ${pending.developmentCost}` : 'DEVELOP');
  setButton($('#passButton'), mine && game.phase === 'action', false, 'PASS');
}

function render() {
  renderLobbyMeta();
  renderBoard();
  renderPlayers();
  renderLog();
  renderControls();
}

async function updateGame(mutator) {
  if (state.busy) return;
  state.busy = true;
  renderControls();
  try {
    await fs.runTransaction(db, async tx => {
      const snap = await tx.get(gameRef());
      if (!snap.exists()) throw new Error('Galactic Dominion game state is missing.');
      const game = clonedGame(snap.data());
      await mutator(game, tx);
      tx.update(gameRef(), { ...game, updatedAt: fs.serverTimestamp() });
    });
  } catch (error) {
    console.error(error);
    say(error.message || error.code || 'Game action failed.', 'error');
  } finally {
    state.busy = false;
    renderControls();
  }
}

async function startMatch() {
  const me = state.identity?.profileId || '';
  await updateGame(game => {
    if (me !== game.hostProfileId) throw new Error('Only the host can start the match.');
    if (game.status !== 'waiting') throw new Error('The match has already started.');
    const order = Object.keys(game.players || {}).sort((a, b) => Number(game.players[a].joinOrder || 0) - Number(game.players[b].joinOrder || 0));
    if (order.length < 2) throw new Error('At least two players are required.');
    game.turnOrder = order;
    game.turnIndex = 0;
    game.currentPlayerId = order[0];
    game.status = 'playing';
    game.phase = 'roll';
    game.round = 1;
    game.winnerId = '';
    addLog(game, `MATCH STARTED // ${displayName(order[0], game)} MOVES FIRST`);
  });
  if((state.lobby.sourceType||'hosted')!=='published'){try { await fs.updateDoc(lobbyRef(), { status: 'playing', updatedAt: fs.serverTimestamp(), lastHeartbeatAt: fs.serverTimestamp() }); } catch (error) { console.warn('Lobby status', error); }}
}

async function rollTurn() {
  const me = state.identity?.profileId || '';
  const dieA = randomDie(), dieB = randomDie(), anomalyIndex = randomInt(GALACTIC_ANOMALIES.length);
  await updateGame(game => {
    if (game.status !== 'playing' || game.phase !== 'roll' || game.currentPlayerId !== me) throw new Error('It is not your roll phase.');
    const player = game.players[me];
    if (!player || player.bankrupt) throw new Error('Your dominion is not active.');
    if (player.quarantinedTurns > 0) {
      player.quarantinedTurns = Math.max(0, player.quarantinedTurns - 1);
      game.diceA = 0; game.diceB = 0;
      addLog(game, `${displayName(me, game)} SERVED QUARANTINE // TURN SKIPPED`);
      return advanceTurn(game);
    }
    game.diceA = dieA; game.diceB = dieB;
    const oldPosition = Math.max(0, Number(player.position || 0));
    const total = dieA + dieB;
    const raw = oldPosition + total;
    if (raw >= GALACTIC_BOARD_SIZE) {
      player.balance += settings().startSalary;
      addLog(game, `${displayName(me, game)} PASSED DOMINION GATE // +${settings().startSalary}`);
    }
    player.position = raw % GALACTIC_BOARD_SIZE;
    addLog(game, `${displayName(me, game)} ROLLED ${dieA}+${dieB} // ${boardSpace(player.position).name}`);
    resolveLanding(game, me, anomalyIndex);
  });
}

async function buyPending() {
  const me = state.identity?.profileId || '';
  await updateGame(game => {
    if (game.status !== 'playing' || game.phase !== 'action' || game.currentPlayerId !== me) throw new Error('It is not your action phase.');
    const space = GALACTIC_BOARD.find(item => item.id === game.pendingSpaceId);
    const player = game.players[me], holding = game.ownership?.[space?.id];
    if (!space || !holding || holding.ownerId) throw new Error('That space is no longer available.');
    if (player.balance < Number(space.cost || 0)) throw new Error('Not enough local currency.');
    player.balance -= Number(space.cost || 0);
    holding.ownerId = me; holding.level = 0;
    addLog(game, `${displayName(me, game)} ACQUIRED ${space.name} // ${space.cost}`);
    advanceTurn(game);
  });
}

async function developPending() {
  const me = state.identity?.profileId || '';
  await updateGame(game => {
    if (game.status !== 'playing' || game.phase !== 'action' || game.currentPlayerId !== me) throw new Error('It is not your action phase.');
    const space = GALACTIC_BOARD.find(item => item.id === game.pendingSpaceId);
    const player = game.players[me], holding = game.ownership?.[space?.id];
    if (!space || !holding || !canDevelopSpace(game, me, space, settings())) throw new Error('This planet cannot be developed now.');
    const cost = Number(space.developmentCost || 0);
    if (player.balance < cost) throw new Error('Not enough local currency to develop this planet.');
    player.balance -= cost;
    holding.level = Math.min(4, Number(holding.level || 0) + 1);
    addLog(game, `${displayName(me, game)} DEVELOPED ${space.name} // LEVEL ${holding.level}`);
    advanceTurn(game);
  });
}

async function passPending() {
  const me = state.identity?.profileId || '';
  await updateGame(game => {
    if (game.status !== 'playing' || game.phase !== 'action' || game.currentPlayerId !== me) throw new Error('It is not your action phase.');
    const space = GALACTIC_BOARD.find(item => item.id === game.pendingSpaceId);
    addLog(game, `${displayName(me, game)} PASSED${space ? ` // ${space.name}` : ''}`);
    advanceTurn(game);
  });
}

async function resetMatch() {
  const me = state.identity?.profileId || '';
  await updateGame(game => {
    if (me !== game.hostProfileId) throw new Error('Only the host can reset the match.');
    if (game.status !== 'finished') throw new Error('The current match is not finished.');
    for (const player of Object.values(game.players || {})) {
      player.position = 0;
      player.balance = settings().startingBalance;
      player.quarantinedTurns = 0;
      player.bankrupt = false;
    }
    game.ownership = freshOwnership();
    game.status = 'waiting'; game.phase = 'waiting'; game.currentPlayerId = ''; game.turnOrder = []; game.turnIndex = 0; game.round = 0;
    game.diceA = 0; game.diceB = 0; game.lastSpaceId = 'dominion-gate'; game.pendingSpaceId = ''; game.winnerId = '';
    game.log = []; game.actionSeq = 0;
    addLog(game, 'HOST RESET GALACTIC DOMINION');
  });
  if((state.lobby.sourceType||'hosted')!=='published'){try { await fs.updateDoc(lobbyRef(), { status: 'open', updatedAt: fs.serverTimestamp(), lastHeartbeatAt: fs.serverTimestamp() }); } catch (error) { console.warn('Lobby reset', error); }}
}

$('#startButton')?.addEventListener('click', startMatch);
$('#rollButton')?.addEventListener('click', rollTurn);
$('#buyButton')?.addEventListener('click', buyPending);
$('#developButton')?.addEventListener('click', developPending);
$('#passButton')?.addEventListener('click', passPending);
$('#resetButton')?.addEventListener('click', resetMatch);

if (!lobbyId) say('Missing Galactic Dominion lobby id.', 'error');
else {
  watchIdentity(identity => {
    state.identity = identity;
    manageHeartbeat();
    if (!identity?.profileId) say('Sign in to enter Galactic Dominion.', 'error');
    else readyPlayer();
    render();
  });
  watchLobby();
}


document.addEventListener('eras-hosted-asset-change', () => { renderBoard(); });

window.addEventListener('pagehide', () => { state.accessLeaseStop?.(); clearInterval(state.heartbeat); });
