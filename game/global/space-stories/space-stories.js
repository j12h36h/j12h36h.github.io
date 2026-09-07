import { db, fs, watchIdentity, profileById } from '/game/assets/js/eras-data.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rnd = (min, max) => min + Math.random() * (max - min);
const rndi = (min, max) => Math.floor(rnd(min, max + 1));
const now = () => performance.now() / 1000;
const SAVE_VERSION = 1;
const MAX_CARGO = 30;
const CHAT_TARGET_ID = 'spacestories-world-chat';
const CHAT_TARGET_KEY = `object:${CHAT_TARGET_ID}`;
const GROUND_Y = 510;
const WORLD_WIDTH = 2450;

const ZONES = Object.freeze([
  { name: 'Starlight Dock', short: 'DOCK', sky: '#172a52', glow: '#8de9ff', ground: '#304965', enemy: 'Orbit Slime', boss: 'Dockmaster Bloop', accent: '#86d9ff' },
  { name: 'Moonmallow Fields', short: 'MOON', sky: '#352a5c', glow: '#ffb7e3', ground: '#655477', enemy: 'Moon Puff', boss: 'Mega Moonmallow', accent: '#ffaad9' },
  { name: 'Comet Gardens', short: 'COMET', sky: '#184a55', glow: '#a8ffd0', ground: '#376559', enemy: 'Comet Crab', boss: 'Garden Meteor', accent: '#9df0b8' },
  { name: 'Nebula Arcade', short: 'ARCADE', sky: '#2a2258', glow: '#d7adff', ground: '#55467a', enemy: 'Pixel Jelly', boss: 'High Score Hydra', accent: '#c9a8ff' },
  { name: 'Saturn Ringworks', short: 'RINGS', sky: '#543a2d', glow: '#ffe393', ground: '#755d48', enemy: 'Ring Drone', boss: 'Foreman Pancake', accent: '#ffe58a' },
  { name: 'Tiny Void', short: 'VOID', sky: '#151729', glow: '#aebeff', ground: '#303448', enemy: 'Void Bloop', boss: 'The Smallest Black Hole', accent: '#b8c4ff' }
]);

const ITEM_SLOTS = Object.freeze([
  ['blaster', 'BLASTER'],
  ['suit', 'SPACE SUIT'],
  ['visor', 'VISOR'],
  ['boots', 'BOOTS'],
  ['charm', 'CHARM'],
  ['core', 'SHIP CORE']
]);
const RARITIES = Object.freeze([
  { id: 'common', name: 'Common', mult: 1, color: '#c8d7e1', weight: 52 },
  { id: 'uncommon', name: 'Uncommon', mult: 1.22, color: '#9df0b8', weight: 27 },
  { id: 'rare', name: 'Rare', mult: 1.52, color: '#8de9ff', weight: 14 },
  { id: 'epic', name: 'Epic', mult: 1.95, color: '#d8a8ff', weight: 6 },
  { id: 'cosmic', name: 'Cosmic', mult: 2.55, color: '#ffe58a', weight: 1 }
]);
const SHOP = Object.freeze([
  { id: 'hull', name: 'Marshmallow Hull', desc: '+18 max Hull per level', base: 75 },
  { id: 'core', name: 'Sparkle Reactor', desc: '+4 Attack per level', base: 90 },
  { id: 'shell', name: 'Bubble Plating', desc: '+2 Defense per level', base: 85 },
  { id: 'thrusters', name: 'Tiny Thrusters', desc: '+3% move speed per level', base: 70 },
  { id: 'magnet', name: 'Lucky Magnet', desc: '+2% gear-drop luck per level', base: 110 }
]);

const state = {
  identity: null,
  save: null,
  screen: 'lobby',
  activePanel: null,
  game: null,
  raf: 0,
  lastFrame: 0,
  keys: new Set(),
  touch: { left: false, right: false },
  chatUnsub: null,
  profileCache: new Map(),
  chatRows: [],
  autosaveTimer: 0,
  autoNextTimer: 0
};

function stageInfo(stage) {
  const n = clamp(Math.floor(Number(stage) || 1), 1, 30);
  const zoneIndex = Math.floor((n - 1) / 5);
  const step = (n - 1) % 5 + 1;
  const zone = ZONES[zoneIndex];
  return { stage: n, zoneIndex, step, zone, boss: step === 5, title: step === 5 ? zone.boss : `${zone.short} STORY ${step}` };
}
function xpNeeded(level) { return 80 + Math.floor(level * 42 + Math.pow(level, 1.25) * 8); }
function defaultSave() {
  return {
    version: SAVE_VERSION,
    level: 1,
    xp: 0,
    starbits: 0,
    stardust: 0,
    highestStage: 1,
    currentStage: 1,
    totalKills: 0,
    totalLoot: 0,
    totalClears: 0,
    auto: true,
    upgrades: { hull: 0, core: 0, shell: 0, thrusters: 0, magnet: 0 },
    equipped: { blaster: null, suit: null, visor: null, boots: null, charm: null, core: null },
    inventory: [],
    missionClaims: { kills0: false, clears0: false, loot0: false, bosses0: false },
    bossesDefeated: 0
  };
}
function saveKey() { return `eras:space-stories:v${SAVE_VERSION}:${state.identity?.profileId || 'guest'}`; }
function sanitizeItem(item) {
  if (!item || typeof item !== 'object') return null;
  const slot = ITEM_SLOTS.find(([id]) => id === item.slot)?.[0];
  const rarity = RARITIES.find(r => r.id === item.rarity)?.id;
  if (!slot || !rarity) return null;
  return {
    id: String(item.id || crypto.randomUUID()).slice(0, 80),
    slot,
    rarity,
    name: String(item.name || 'Mystery Gear').slice(0, 80),
    level: clamp(Math.floor(Number(item.level) || 1), 1, 999),
    attack: clamp(Math.floor(Number(item.attack) || 0), 0, 99999),
    defense: clamp(Math.floor(Number(item.defense) || 0), 0, 99999),
    hp: clamp(Math.floor(Number(item.hp) || 0), 0, 99999),
    crit: clamp(Number(item.crit) || 0, 0, 50),
    speed: clamp(Number(item.speed) || 0, 0, 100),
    power: clamp(Math.floor(Number(item.power) || 0), 0, 999999),
    foundStage: clamp(Math.floor(Number(item.foundStage) || 1), 1, 30)
  };
}
function loadSave() {
  const base = defaultSave();
  if (!state.identity?.profileId) { state.save = base; return; }
  try {
    const raw = JSON.parse(localStorage.getItem(saveKey()) || 'null');
    if (!raw || typeof raw !== 'object') { state.save = base; return; }
    state.save = {
      ...base,
      ...raw,
      upgrades: { ...base.upgrades, ...(raw.upgrades || {}) },
      equipped: { ...base.equipped, ...(raw.equipped || {}) },
      missionClaims: { ...base.missionClaims, ...(raw.missionClaims || {}) }
    };
    state.save.inventory = (Array.isArray(raw.inventory) ? raw.inventory : []).map(sanitizeItem).filter(Boolean).slice(0, MAX_CARGO);
    for (const [slot] of ITEM_SLOTS) state.save.equipped[slot] = sanitizeItem(raw.equipped?.[slot]);
    state.save.highestStage = clamp(Math.floor(Number(state.save.highestStage) || 1), 1, 30);
    state.save.currentStage = clamp(Math.floor(Number(state.save.currentStage) || 1), 1, state.save.highestStage);
  } catch (_) {
    state.save = base;
  }
}
function persist() {
  if (!state.identity?.profileId || !state.save) return;
  try { localStorage.setItem(saveKey(), JSON.stringify(state.save)); } catch (_) { }
}
function schedulePersist() {
  clearTimeout(state.autosaveTimer);
  state.autosaveTimer = setTimeout(persist, 120);
}

function rarityByRoll(forceRare = false) {
  if (forceRare) {
    const pool = RARITIES.slice(2);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  const luck = (state.save?.upgrades?.magnet || 0) * 2;
  let roll = Math.random() * 100 - luck;
  for (const rarity of RARITIES) {
    if (roll < rarity.weight) return rarity;
    roll -= rarity.weight;
  }
  return RARITIES[RARITIES.length - 1];
}
function itemName(slot, rarity) {
  const prefixes = {
    common: ['Tiny', 'Soft', 'Pocket'],
    uncommon: ['Bouncy', 'Shiny', 'Happy'],
    rare: ['Starlit', 'Comet', 'Nebula'],
    epic: ['Supernova', 'Dreamwave', 'Prismatic'],
    cosmic: ['Cosmic', 'Impossible', 'Storybook']
  };
  const nouns = {
    blaster: ['Pop Blaster', 'Bubble Cannon', 'Spark Pistol'],
    suit: ['Puff Suit', 'Explorer Coat', 'Orbit Onesie'],
    visor: ['Star Visor', 'Moon Goggles', 'Bubble Helm'],
    boots: ['Rocket Boots', 'Moon Hoppers', 'Comet Sneakers'],
    charm: ['Lucky Satellite', 'Pocket Planet', 'Tiny Friend'],
    core: ['Story Core', 'Mochi Reactor', 'Star Engine']
  };
  const p = prefixes[rarity.id][rndi(0, prefixes[rarity.id].length - 1)];
  const n = nouns[slot][rndi(0, nouns[slot].length - 1)];
  return `${p} ${n}`;
}
function generateItem(stage, forceRare = false) {
  const rarity = rarityByRoll(forceRare);
  const slot = ITEM_SLOTS[rndi(0, ITEM_SLOTS.length - 1)][0];
  const base = 4 + stage * 1.7;
  const mult = rarity.mult;
  const item = { id: crypto.randomUUID(), slot, rarity: rarity.id, name: itemName(slot, rarity), level: Math.max(1, Math.ceil(stage / 2)), attack: 0, defense: 0, hp: 0, crit: 0, speed: 0, foundStage: stage };
  if (slot === 'blaster' || slot === 'core') item.attack = Math.round(base * mult * rnd(0.9, 1.25));
  if (slot === 'suit') item.hp = Math.round(base * 5.3 * mult * rnd(0.9, 1.2));
  if (slot === 'visor' || slot === 'charm') item.crit = Number((rnd(1.2, 3.2) * mult).toFixed(1));
  if (slot === 'boots') item.speed = Number((rnd(2.5, 5.2) * mult).toFixed(1));
  if (slot === 'suit' || slot === 'visor' || slot === 'core') item.defense = Math.round(base * 0.48 * mult * rnd(0.8, 1.2));
  item.power = Math.round(item.attack * 3 + item.defense * 2 + item.hp * 0.22 + item.crit * 7 + item.speed * 4);
  return item;
}
function itemScore(item) { return item ? item.power || 0 : 0; }
function addItem(item) {
  if (!item) return false;
  if (state.save.inventory.length >= MAX_CARGO) {
    state.save.starbits += Math.max(5, Math.floor(item.power * 0.45));
    combatSay(`CARGO FULL // AUTO-SOLD ${item.name}`);
    return false;
  }
  state.save.inventory.unshift(item);
  state.save.totalLoot++;
  checkMissions();
  schedulePersist();
  renderLobby();
  renderInventory();
  return true;
}
function equipItem(itemId) {
  const index = state.save.inventory.findIndex(i => i.id === itemId);
  if (index < 0) return;
  const item = state.save.inventory[index];
  const prior = state.save.equipped[item.slot];
  state.save.inventory.splice(index, 1);
  if (prior) state.save.inventory.unshift(prior);
  state.save.equipped[item.slot] = item;
  schedulePersist();
  renderLobby();
  renderInventory();
  renderRunStats();
}
function equipBest() {
  for (const [slot] of ITEM_SLOTS) {
    const pool = [state.save.equipped[slot], ...state.save.inventory.filter(i => i.slot === slot)].filter(Boolean).sort((a, b) => itemScore(b) - itemScore(a));
    if (!pool.length) continue;
    const best = pool[0];
    if (state.save.equipped[slot]?.id === best.id) continue;
    const idx = state.save.inventory.findIndex(i => i.id === best.id);
    if (idx < 0) continue;
    const prior = state.save.equipped[slot];
    state.save.inventory.splice(idx, 1);
    if (prior) state.save.inventory.unshift(prior);
    state.save.equipped[slot] = best;
  }
  schedulePersist();
  renderLobby();
  renderInventory();
  renderRunStats();
}
function sellJunk() {
  let gained = 0;
  const keep = [];
  for (const item of state.save.inventory) {
    const equipped = state.save.equipped[item.slot];
    if (equipped && itemScore(item) < itemScore(equipped) * 0.9) gained += Math.max(4, Math.floor(item.power * 0.55));
    else keep.push(item);
  }
  state.save.inventory = keep;
  state.save.starbits += gained;
  schedulePersist();
  renderLobby();
  renderInventory();
  combatSay(gained ? `RECYCLED LOWER GEAR // +${gained} STARbits` : 'NO LOWER GEAR TO RECYCLE');
}
function derivedStats() {
  const s = state.save || defaultSave();
  let hp = 100 + (s.level - 1) * 12 + s.upgrades.hull * 18;
  let attack = 12 + (s.level - 1) * 3 + s.upgrades.core * 4;
  let defense = 2 + Math.floor((s.level - 1) * 0.9) + s.upgrades.shell * 2;
  let crit = 5;
  let speed = 185 * (1 + s.upgrades.thrusters * 0.03);
  for (const item of Object.values(s.equipped)) {
    if (!item) continue;
    hp += item.hp || 0;
    attack += item.attack || 0;
    defense += item.defense || 0;
    crit += item.crit || 0;
    speed *= 1 + (item.speed || 0) / 100;
  }
  return { maxHp: Math.round(hp), attack: Math.round(attack), defense: Math.round(defense), crit: clamp(crit, 0, 60), moveSpeed: Math.round(speed) };
}
function grantXp(amount) {
  state.save.xp += Math.max(0, Math.floor(amount));
  let leveled = false;
  while (state.save.xp >= xpNeeded(state.save.level)) {
    state.save.xp -= xpNeeded(state.save.level);
    state.save.level++;
    leveled = true;
  }
  if (leveled) {
    combatSay(`LEVEL UP! // PILOT LEVEL ${state.save.level}`);
    if (state.game) {
      const stats = derivedStats();
      state.game.player.maxHp = stats.maxHp;
      state.game.player.hp = stats.maxHp;
      state.game.player.attack = stats.attack;
      state.game.player.defense = stats.defense;
      state.game.player.crit = stats.crit;
      state.game.player.moveSpeed = stats.moveSpeed;
    }
  }
  schedulePersist();
}
function shopCost(id) {
  const up = SHOP.find(x => x.id === id);
  const lvl = state.save.upgrades[id] || 0;
  return Math.floor(up.base * Math.pow(1.58, lvl));
}
function buyUpgrade(id) {
  const up = SHOP.find(x => x.id === id);
  if (!up) return;
  const cost = shopCost(id);
  if (state.save.starbits < cost) { combatSay('NOT ENOUGH STARbits'); return; }
  state.save.starbits -= cost;
  state.save.upgrades[id]++;
  schedulePersist();
  renderLobby();
  renderRunStats();
}

const MISSIONS = [
  { id: 'kills0', name: 'Friendly Bonking', goal: 25, get: () => state.save.totalKills, reward: 120 },
  { id: 'clears0', name: 'Story Hopper', goal: 5, get: () => state.save.totalClears, reward: 180 },
  { id: 'loot0', name: 'Cargo Gremlin', goal: 12, get: () => state.save.totalLoot, reward: 150 },
  { id: 'bosses0', name: 'Big Bloop Energy', goal: 3, get: () => state.save.bossesDefeated, reward: 260 }
];
function checkMissions() {
  for (const m of MISSIONS) {
    if (state.save.missionClaims[m.id] || m.get() < m.goal) continue;
    state.save.missionClaims[m.id] = true;
    state.save.starbits += m.reward;
    combatSay(`CAPTAIN'S LOG COMPLETE // +${m.reward} STARbits`);
  }
  schedulePersist();
}

function renderLobby() {
  if (!state.save) return;
  const pilot = state.identity?.profile?.displayName || 'SIGNED OUT';
  $('#lobbyPilotName').textContent = pilot;
  $('#lobbyLevel').textContent = state.save.level;
  $('#lobbyBestStage').textContent = String(state.save.highestStage).padStart(2, '0');
  $('#lobbyCoins').textContent = state.save.starbits.toLocaleString();
  $('#modeBadge').textContent = state.screen === 'game' ? 'IN STORY' : 'LOBBY';
  $('#scenePilotName').textContent = pilot;
  $('#sceneLevel').textContent = state.save.level;
  $('#sceneBestStage').textContent = String(state.save.highestStage).padStart(2, '0');
  $('#sceneCoins').textContent = state.save.starbits.toLocaleString();
  $('#mapProgress').textContent = `${String(state.save.highestStage).padStart(2, '0')} / 30`;
  $('#inventoryCount').textContent = `${state.save.inventory.length} / ${MAX_CARGO}`;
  $('#launchStoryButton').disabled = !state.identity?.profileId;
  $('#launchStoryButton').textContent = state.identity?.profileId ? `LAUNCH STORY ${String(state.save.currentStage).padStart(2, '0')}` : 'SIGN IN TO LAUNCH';
  renderStarMap();
  renderShop();
  renderEquipment();
  renderMissions();
  renderInventory();
  renderRunStats();
  renderRecentLoot();
  renderSceneOverlay();
  renderGameHudForMode();
}
function renderSceneOverlay() {
  const overlay = $('#sceneOverlay');
  if (!overlay) return;
  overlay.hidden = state.screen !== 'lobby';
  const info = stageInfo(state.save?.currentStage || 1);
  $('#sceneTagline').textContent = state.identity?.profileId ? 'STORY HUB // ORBITAL WAYSTATION' : 'SIGN IN // SHARED ORBITAL LOBBY';
  $('#sceneTitle').textContent = 'MOCHI-9 WAYSTATION';
  $('#sceneDescription').textContent = state.identity?.profileId
    ? `Current route locked to Story ${String(info.stage).padStart(2, '0')} in ${info.zone.name}. Open a side module to manage gear, route planning, chat, objectives, and upgrades without leaving the viewport.`
    : 'Sign in to save pilot progression, enter stories, and chat live with every SpaceStories pilot.';
}
function renderGameHudForMode() {
  if (!state.save) return;
  if (state.screen === 'game' && state.game) updateGameHud();
  else {
    $('#gameStory').textContent = String(state.save.currentStage).padStart(2, '0');
    $('#gameZone').textContent = 'MOCHI-9 WAYSTATION';
    $('#gameLevel').textContent = state.save.level;
    $('#gameCoins').textContent = state.save.starbits.toLocaleString();
    $('#hpFill').style.width = '100%';
    $('#hpText').textContent = `${derivedStats().maxHp} / ${derivedStats().maxHp}`;
    const need = xpNeeded(state.save.level);
    $('#xpFill').style.width = `${clamp((state.save.xp / need) * 100, 0, 100)}%`;
    $('#xpText').textContent = `${state.save.xp} / ${need}`;
    $('#bossBar').hidden = true;
    $('#objectiveTitle').textContent = 'PREPARE YOUR NEXT STORY';
    $('#objectiveText').textContent = 'Open the route map, inspect your gear, and launch when ready.';
    $('#objectiveCount').textContent = `${String(state.save.currentStage).padStart(2, '0')} / ${String(state.save.highestStage).padStart(2, '0')} UNLOCKED`;
    $('#objectiveFill').style.width = `${clamp((state.save.highestStage / 30) * 100, 0, 100)}%`;
    const button = $('#autoPilotButton');
    button.setAttribute('aria-pressed', String(Boolean(state.save.auto)));
    button.textContent = `AUTO PILOT // ${state.save.auto ? 'ON' : 'OFF'}`;
    renderCooldowns();
  }
}
function renderStarMap() {
  const root = $('#starMap');
  root.innerHTML = '';
  for (let n = 1; n <= 30; n++) {
    const info = stageInfo(n);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `star-node${n === state.save.currentStage ? ' is-current' : ''}${n < state.save.highestStage ? ' is-cleared' : ''}${n > state.save.highestStage ? ' is-locked' : ''}${info.boss ? ' is-boss' : ''}`;
    button.disabled = n > state.save.highestStage;
    button.innerHTML = `<b>${String(n).padStart(2, '0')} // ${info.boss ? 'BOSS' : info.zone.short}</b><span>${info.title}</span>`;
    button.addEventListener('click', () => {
      state.save.currentStage = n;
      schedulePersist();
      renderLobby();
      openPanel('map');
    });
    root.appendChild(button);
  }
}
function renderShop() {
  const root = $('#shopList');
  root.innerHTML = '';
  for (const up of SHOP) {
    const lvl = state.save.upgrades[up.id] || 0;
    const cost = shopCost(up.id);
    const row = document.createElement('div');
    row.className = 'shop-item';
    row.innerHTML = `<div><b>${up.name} // LV ${lvl}</b><small>${up.desc}</small></div><button type="button">${cost.toLocaleString()} ★</button>`;
    const btn = row.querySelector('button');
    btn.disabled = state.save.starbits < cost;
    btn.addEventListener('click', () => buyUpgrade(up.id));
    root.appendChild(row);
  }
}
function renderEquipment() {
  const root = $('#equipmentGrid');
  root.innerHTML = '';
  for (const [slot, label] of ITEM_SLOTS) {
    const item = state.save.equipped[slot];
    const el = document.createElement('div');
    el.className = 'equipment-slot';
    const rarity = item ? RARITIES.find(r => r.id === item.rarity) : null;
    el.innerHTML = `<span>${label}</span><b${rarity ? ` style="color:${rarity.color}"` : ''}>${item ? item.name : 'EMPTY'}</b>`;
    root.appendChild(el);
  }
}
function renderMissions() {
  const root = $('#missionList');
  root.innerHTML = '';
  for (const m of MISSIONS) {
    const value = m.get();
    const claimed = state.save.missionClaims[m.id];
    const pct = claimed ? 100 : clamp((value / m.goal) * 100, 0, 100);
    const el = document.createElement('div');
    el.className = 'mission';
    el.innerHTML = `<div class="mission-top"><b>${m.name}</b><small>${claimed ? 'COMPLETE' : `${Math.min(value, m.goal)} / ${m.goal} // +${m.reward} ★`}</small></div><i><em style="width:${pct}%"></em></i>`;
    root.appendChild(el);
  }
}
function renderInventory() {
  const root = $('#inventoryList');
  if (!root || !state.save) return;
  root.innerHTML = '';
  if (!state.save.inventory.length) {
    root.innerHTML = '<div class="chat-empty">YOUR CARGO HOLD IS EMPTY.<br>GO FIND SOMETHING WEIRD.</div>';
    return;
  }
  for (const item of state.save.inventory) {
    const rarity = RARITIES.find(r => r.id === item.rarity);
    const el = document.createElement('article');
    el.className = 'inventory-item';
    const stats = [];
    if (item.attack) stats.push(`ATK +${item.attack}`);
    if (item.defense) stats.push(`DEF +${item.defense}`);
    if (item.hp) stats.push(`HULL +${item.hp}`);
    if (item.crit) stats.push(`CRIT +${item.crit}%`);
    if (item.speed) stats.push(`SPD +${item.speed}%`);
    el.innerHTML = `<header><h3 style="color:${rarity.color}">${item.name}</h3><span class="rarity-${rarity.id}">${rarity.name}</span></header><p>${ITEM_SLOTS.find(x => x[0] === item.slot)?.[1]} // POWER ${item.power}<br>${stats.join(' // ') || 'COSMETIC ENERGY'}</p><button type="button">EQUIP</button>`;
    el.querySelector('button').addEventListener('click', () => equipItem(item.id));
    root.appendChild(el);
  }
}

function openPanel(name) {
  state.activePanel = name;
  refreshPanels();
}
function closePanels() {
  state.activePanel = null;
  refreshPanels();
}
function togglePanel(name) {
  state.activePanel = state.activePanel === name ? null : name;
  refreshPanels();
}
function refreshPanels() {
  $$('.viewport-panel').forEach(panel => {
    panel.hidden = panel.dataset.panel !== state.activePanel;
  });
  $$('[data-panel-toggle]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.panelToggle === state.activePanel);
    btn.setAttribute('aria-pressed', String(btn.dataset.panelToggle === state.activePanel));
  });
}

function setScreen(screen) {
  state.screen = screen;
  renderLobby();
  if (screen === 'lobby') {
    stopGameLoop();
    drawGame();
    setTimeout(() => $('#worldChatInput')?.blur(), 0);
  } else {
    hideOverlay();
    startGameLoop();
  }
}
function combatSay(text) {
  const el = $('#combatFeed');
  if (el) el.textContent = String(text || '').toUpperCase();
}

function createStage(stage) {
  clearTimeout(state.autoNextTimer);
  const info = stageInfo(stage);
  const stats = derivedStats();
  const player = { x: 150, y: GROUND_Y - 52, w: 34, h: 52, vx: 0, vy: 0, onGround: true, facing: 1, hp: stats.maxHp, maxHp: stats.maxHp, attack: stats.attack, defense: stats.defense, crit: stats.crit, moveSpeed: stats.moveSpeed, invuln: 0, attackCd: 0 };
  const enemies = [];
  const count = info.boss ? 1 : 4 + Math.min(info.step, 3);
  if (info.boss) {
    enemies.push(makeEnemy(info, 1880, true));
    for (let i = 0; i < 2; i++) enemies.push(makeEnemy(info, 1200 + i * 360, false, true));
  } else {
    for (let i = 0; i < count; i++) enemies.push(makeEnemy(info, 520 + i * (WORLD_WIDTH - 800) / Math.max(1, count - 1) + rnd(-60, 60), false));
  }
  state.game = {
    stage,
    info,
    player,
    enemies,
    projectiles: [],
    particles: [],
    cameraX: 0,
    platforms: [
      { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: 70 },
      { x: 380, y: 390, w: 260, h: 18 },
      { x: 820, y: 325, w: 260, h: 18 },
      { x: 1320, y: 405, w: 300, h: 18 },
      { x: 1780, y: 345, w: 260, h: 18 }
    ],
    startedAt: now(),
    kills: 0,
    totalEnemies: enemies.length,
    cleared: false,
    dead: false,
    cooldowns: { nova: 0, dash: 0, heal: 0 },
    recentLoot: []
  };
  updateGameHud();
  renderRunStats();
  renderRecentLoot();
  drawGame();
  combatSay(info.boss ? `BOSS STORY // ${info.title}` : `STORY ${stage} // AUTO PILOT ${state.save.auto ? 'ON' : 'OFF'}`);
}
function makeEnemy(info, x, boss = false, minion = false) {
  const hpBase = 34 + info.stage * 14;
  const maxHp = Math.round(hpBase * (boss ? 7.5 : 1) * (minion ? 0.75 : 1));
  return { id: crypto.randomUUID(), x, y: GROUND_Y - (boss ? 76 : 40), w: boss ? 72 : 42, h: boss ? 76 : 40, vx: 0, hp: maxHp, maxHp, attack: Math.round((7 + info.stage * 1.7) * (boss ? 1.75 : 1)), defense: Math.floor(info.stage * 0.45), speed: boss ? 48 : 55 + rnd(-8, 12), attackCd: rnd(0.2, 0.8), boss, dead: false, flash: 0, bob: rnd(0, Math.PI * 2), name: boss ? info.boss : info.zone.enemy, color: info.zone.accent };
}
function startStage() {
  if (!state.identity?.profileId) { combatSay('SIGN IN REQUIRED'); return; }
  state.save.currentStage = clamp(state.save.currentStage, 1, state.save.highestStage);
  createStage(state.save.currentStage);
  closePanels();
  setScreen('game');
}
function stopGameLoop() { cancelAnimationFrame(state.raf); state.raf = 0; state.lastFrame = 0; }
function startGameLoop() {
  if (state.raf) return;
  state.lastFrame = performance.now();
  state.raf = requestAnimationFrame(frame);
}
function frame(ts) {
  state.raf = 0;
  if (state.screen !== 'game' || !state.game) return;
  const dt = clamp((ts - state.lastFrame) / 1000, 0, 0.034);
  state.lastFrame = ts;
  updateGame(dt);
  drawGame();
  state.raf = requestAnimationFrame(frame);
}
function nearestEnemy() {
  const g = state.game, p = g.player;
  return g.enemies.filter(e => !e.dead).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0] || null;
}
function doBasicAttack() {
  const g = state.game;
  if (!g || g.cleared || g.dead) return;
  const p = g.player;
  if (p.attackCd > 0) return;
  const target = nearestEnemy();
  if (state.save.auto && target) p.facing = target.x >= p.x ? 1 : -1;
  p.attackCd = 0.34;
  const crit = Math.random() * 100 < p.crit;
  const damage = Math.round(p.attack * (crit ? 1.75 : 1));
  g.projectiles.push({ x: p.x + p.w / 2, y: p.y + 19, vx: p.facing * 650, vy: 0, r: 7, damage, crit, life: 0.8, kind: 'pulse' });
  combatSay(crit ? 'CRITICAL PULSE POP!' : 'PULSE POP!');
}
function useNova() {
  const g = state.game;
  if (!g || g.cooldowns.nova > 0 || g.cleared || g.dead) return;
  g.cooldowns.nova = 7;
  let hits = 0;
  for (const e of g.enemies) {
    if (e.dead || Math.abs((e.x + e.w / 2) - (g.player.x + g.player.w / 2)) > 360) continue;
    damageEnemy(e, Math.round(g.player.attack * 1.65), false);
    hits++;
  }
  spawnBurst(g.player.x + g.player.w / 2, g.player.y + 22, '#ffb1e3', 28);
  combatSay(`NOVA BUBBLE // ${hits} HIT${hits === 1 ? '' : 'S'}`);
}
function useDash() {
  const g = state.game;
  if (!g || g.cooldowns.dash > 0 || g.cleared || g.dead) return;
  g.cooldowns.dash = 5;
  const p = g.player;
  const start = p.x;
  p.x = clamp(p.x + p.facing * 240, 20, WORLD_WIDTH - p.w - 20);
  p.invuln = 0.4;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const min = Math.min(start, p.x) - 60;
    const max = Math.max(start, p.x) + p.w + 60;
    if (e.x > min && e.x < max) damageEnemy(e, Math.round(p.attack * 1.15), false);
  }
  spawnBurst(p.x, p.y + 25, '#9eeeff', 18);
  combatSay('COMET DASH!');
}
function useHeal() {
  const g = state.game;
  if (!g || g.cooldowns.heal > 0 || g.cleared || g.dead) return;
  g.cooldowns.heal = 13;
  const healed = Math.round(g.player.maxHp * 0.34);
  g.player.hp = Math.min(g.player.maxHp, g.player.hp + healed);
  spawnBurst(g.player.x, g.player.y, '#9df0b8', 16);
  combatSay(`PATCH POD // +${healed} HULL`);
}
function useSkill(name) {
  if (name === 'basic') doBasicAttack();
  if (name === 'nova') useNova();
  if (name === 'dash') useDash();
  if (name === 'heal') useHeal();
}
function damageEnemy(e, raw, crit = false) {
  if (e.dead) return;
  const dmg = Math.max(1, Math.round(raw - e.defense * 0.5));
  e.hp = Math.max(0, e.hp - dmg);
  e.flash = 0.1;
  spawnBurst(e.x + e.w / 2, e.y + e.h / 2, crit ? '#ffe58a' : '#d8f7ff', crit ? 10 : 5);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const g = state.game;
  g.kills++;
  state.save.totalKills++;
  const info = g.info;
  const coins = rndi(5 + info.stage, 12 + info.stage * 2) * (e.boss ? 6 : 1);
  state.save.starbits += coins;
  grantXp(Math.round((18 + info.stage * 5) * (e.boss ? 5 : 1)));
  if (e.boss) state.save.bossesDefeated++;
  const dropChance = 0.22 + (state.save.upgrades.magnet || 0) * 0.02 + (e.boss ? 0.8 : 0);
  if (Math.random() < dropChance) {
    const item = generateItem(info.stage, e.boss);
    if (addItem(item)) {
      g.recentLoot.unshift(item);
      g.recentLoot = g.recentLoot.slice(0, 4);
      renderRecentLoot();
      combatSay(`${e.name} POPPED // ${item.name} FOUND!`);
    }
  } else {
    combatSay(`${e.name} POPPED // +${coins} STARbits`);
  }
  checkMissions();
  schedulePersist();
  updateGameHud();
  if (g.enemies.every(x => x.dead)) clearStage();
}
function hitPlayer(raw) {
  const g = state.game, p = g.player;
  if (p.invuln > 0 || g.dead) return;
  const dmg = Math.max(1, Math.round(raw - p.defense * 0.55));
  p.hp = Math.max(0, p.hp - dmg);
  p.invuln = 0.65;
  spawnBurst(p.x + p.w / 2, p.y + p.h / 2, '#ff8d9d', 10);
  combatSay(`BONKED // -${dmg} HULL`);
  if (p.hp <= 0) playerDown();
}
function playerDown() {
  const g = state.game;
  if (g.dead) return;
  g.dead = true;
  state.save.currentStage = g.stage;
  schedulePersist();
  showOverlay('RESCUE POD', 'SHIP NEEDS A HUG', `Story ${g.stage} was too spicy. Your gear and progression are safe.`, 'RETRY STORY', () => { hideOverlay(); createStage(g.stage); }, 'RETURN TO LOBBY', () => setScreen('lobby'));
}
function clearStage() {
  const g = state.game;
  if (g.cleared) return;
  g.cleared = true;
  state.save.totalClears++;
  const first = g.stage >= state.save.highestStage;
  if (g.info.boss) state.save.stardust += 3;
  else state.save.stardust += 1;
  if (first && g.stage < 30) state.save.highestStage = g.stage + 1;
  state.save.currentStage = Math.min(30, g.stage + 1);
  state.save.starbits += 30 + g.stage * 5;
  checkMissions();
  schedulePersist();
  renderLobby();
  const final = g.stage === 30;
  showOverlay(final ? 'SEASON COMPLETE' : 'STORY CLEAR', final ? 'THE TINY VOID SMILES BACK' : 'NEXT STOP!', final ? 'You cleared all 30 SpaceStories. Story 30 remains replayable for better loot.' : `Story ${g.stage} is complete. Story ${g.stage + 1} is now on the route.`, final ? 'REPLAY STORY 30' : 'NEXT STORY', () => { hideOverlay(); createStage(final ? 30 : g.stage + 1); }, 'RETURN TO LOBBY', () => setScreen('lobby'));
  combatSay(`STORY CLEAR // +${30 + g.stage * 5} STARbits`);
  if (state.save.auto && !final) {
    clearTimeout(state.autoNextTimer);
    state.autoNextTimer = setTimeout(() => {
      if (state.screen === 'game' && state.game?.cleared) { hideOverlay(); createStage(g.stage + 1); }
    }, 2200);
  }
}
function showOverlay(kicker, title, text, nextLabel, nextFn, lobbyLabel, lobbyFn) {
  const root = $('#storyOverlay');
  root.hidden = false;
  $('#overlayKicker').textContent = kicker;
  $('#overlayTitle').textContent = title;
  $('#overlayText').textContent = text;
  const next = $('#overlayNext');
  const lobby = $('#overlayLobby');
  next.textContent = nextLabel;
  next.onclick = nextFn;
  lobby.textContent = lobbyLabel;
  lobby.onclick = lobbyFn;
}
function hideOverlay() { $('#storyOverlay').hidden = true; }
function spawnBurst(x, y, color, count = 8) {
  const g = state.game;
  if (!g) return;
  for (let i = 0; i < count; i++) g.particles.push({ x, y, vx: rnd(-130, 130), vy: rnd(-150, 45), life: rnd(0.25, 0.65), maxLife: 0.65, r: rnd(2, 5), color });
}

function updateGame(dt) {
  const g = state.game;
  if (!g) return;
  const p = g.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.attackCd = Math.max(0, p.attackCd - dt);
  for (const k of Object.keys(g.cooldowns)) g.cooldowns[k] = Math.max(0, g.cooldowns[k] - dt);
  if (!g.cleared && !g.dead) {
    const left = state.keys.has('ArrowLeft') || state.keys.has('a') || state.touch.left;
    const right = state.keys.has('ArrowRight') || state.keys.has('d') || state.touch.right;
    let dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (state.save.auto) {
      const target = nearestEnemy();
      if (target) {
        const dist = target.x - p.x;
        if (Math.abs(dist) > 180) dir = Math.sign(dist);
        else dir = 0;
        p.facing = dist >= 0 ? 1 : -1;
        if (Math.abs(dist) < 310 && p.attackCd <= 0) doBasicAttack();
        if (g.cooldowns.nova <= 0 && g.enemies.filter(e => !e.dead && Math.abs(e.x - p.x) < 330).length >= 3) useNova();
        if (p.hp < p.maxHp * 0.42 && g.cooldowns.heal <= 0) useHeal();
      }
    }
    p.vx = dir * p.moveSpeed;
    if (dir) p.facing = dir;
    p.x = clamp(p.x + p.vx * dt, 0, WORLD_WIDTH - p.w);
    p.vy += 1350 * dt;
    p.y += p.vy * dt;
    resolvePlatforms(p, g.platforms);
    for (const e of g.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.attackCd = Math.max(0, e.attackCd - dt);
      const dist = p.x - e.x;
      if (Math.abs(dist) > 55) e.x += Math.sign(dist) * e.speed * dt;
      if (Math.abs(dist) < 68 && e.attackCd <= 0) {
        e.attackCd = e.boss ? 1.05 : 1.4;
        hitPlayer(e.attack);
      }
    }
  }
  for (const pr of g.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    if (pr.life <= 0) continue;
    for (const e of g.enemies) {
      if (e.dead || pr.life <= 0) continue;
      if (pr.x > e.x && pr.x < e.x + e.w && pr.y > e.y && pr.y < e.y + e.h) {
        damageEnemy(e, pr.damage, pr.crit);
        pr.life = 0;
        break;
      }
    }
  }
  g.projectiles = g.projectiles.filter(pj => pj.life > 0 && pj.x > -100 && pj.x < WORLD_WIDTH + 100);
  for (const pa of g.particles) {
    pa.life -= dt;
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vy += 380 * dt;
  }
  g.particles = g.particles.filter(pa => pa.life > 0);
  g.cameraX = clamp(p.x - 380, 0, WORLD_WIDTH - 1100);
  updateGameHud();
  renderRunStats();
}
function resolvePlatforms(p, platforms) {
  const oldBottom = p.y + p.h - p.vy / 60;
  let landed = false;
  if (p.vy >= 0) {
    for (const pl of platforms) {
      const nextBottom = p.y + p.h;
      if (p.x + p.w * 0.72 < pl.x || p.x + p.w * 0.28 > pl.x + pl.w) continue;
      if (oldBottom <= pl.y + 8 && nextBottom >= pl.y) {
        p.y = pl.y - p.h;
        p.vy = 0;
        p.onGround = true;
        landed = true;
        break;
      }
    }
  }
  if (!landed) p.onGround = false;
  if (p.y > 620) {
    p.y = GROUND_Y - p.h;
    p.vy = 0;
    hitPlayer(Math.round(p.maxHp * 0.25));
  }
}
function jump() {
  const g = state.game;
  if (!g || g.cleared || g.dead) return;
  if (g.player.onGround) {
    g.player.vy = -520;
    g.player.onGround = false;
    spawnBurst(g.player.x + 18, g.player.y + 52, '#a7e9ff', 5);
  }
}

function updateGameHud() {
  const g = state.game;
  if (!g) return;
  const p = g.player;
  const need = xpNeeded(state.save.level);
  $('#gameStory').textContent = String(g.stage).padStart(2, '0');
  $('#gameZone').textContent = g.info.zone.name.toUpperCase();
  $('#gameLevel').textContent = state.save.level;
  $('#gameCoins').textContent = state.save.starbits.toLocaleString();
  $('#hpFill').style.width = `${clamp((p.hp / p.maxHp) * 100, 0, 100)}%`;
  $('#hpText').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('#xpFill').style.width = `${clamp((state.save.xp / need) * 100, 0, 100)}%`;
  $('#xpText').textContent = `${state.save.xp} / ${need}`;
  const boss = g.enemies.find(e => e.boss && !e.dead);
  const bar = $('#bossBar');
  bar.hidden = !boss;
  if (boss) {
    $('#bossFill').style.width = `${(boss.hp / boss.maxHp) * 100}%`;
    $('#bossText').textContent = `${boss.name} // ${boss.hp}/${boss.maxHp}`;
  }
  $('#objectiveTitle').textContent = g.info.boss ? 'DEFEAT THE BIG BLOOP' : 'CLEAR THE AREA';
  $('#objectiveText').textContent = g.info.boss ? `Defeat ${g.info.boss} and its tiny helpers.` : `Defeat every ${g.info.zone.enemy} in this story.`;
  $('#objectiveCount').textContent = `${g.kills} / ${g.totalEnemies}`;
  $('#objectiveFill').style.width = `${clamp((g.kills / g.totalEnemies) * 100, 0, 100)}%`;
  const button = $('#autoPilotButton');
  button.setAttribute('aria-pressed', String(Boolean(state.save.auto)));
  button.textContent = `AUTO PILOT // ${state.save.auto ? 'ON' : 'OFF'}`;
  renderCooldowns();
}
function renderCooldowns() {
  const g = state.game;
  if (!g) return;
  for (const [key, id] of [['nova', 'novaCd'], ['dash', 'dashCd'], ['heal', 'healCd']]) {
    const left = g.cooldowns[key];
    const el = $(`#${id}`);
    if (el) el.textContent = left > 0 ? `${left.toFixed(1)}s` : 'Ready';
    const btn = $(`[data-skill="${key}"]`);
    btn?.classList.toggle('on-cooldown', left > 0);
  }
}
function renderRunStats() {
  const root = $('#runStats');
  if (!root || !state.save) return;
  const stats = derivedStats();
  const pairs = [
    ['ATTACK', stats.attack],
    ['DEFENSE', stats.defense],
    ['MAX HULL', stats.maxHp],
    ['CRIT', `${stats.crit.toFixed(1)}%`],
    ['SPEED', stats.moveSpeed],
    ['STARDUST', state.save.stardust]
  ];
  root.innerHTML = pairs.map(([k, v]) => `<div class="run-stat"><span>${k}</span><b>${v}</b></div>`).join('');
}
function renderRecentLoot() {
  const root = $('#recentLoot');
  if (!root) return;
  const list = state.game?.recentLoot || [];
  root.innerHTML = list.length ? '' : '<p>No cargo yet.</p>';
  for (const item of list) {
    const rarity = RARITIES.find(r => r.id === item.rarity);
    const el = document.createElement('div');
    el.className = 'loot-chip';
    el.style.borderLeftColor = rarity.color;
    el.innerHTML = `<b style="color:${rarity.color}">${item.name}</b><small>POWER ${item.power}</small>`;
    root.appendChild(el);
  }
}

function drawGame() {
  const canvas = $('#spaceCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(700, Math.round(rect.width * dpr));
  const h = Math.max(420, Math.round(rect.height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  const sx = w / 1100;
  const sy = h / 580;
  ctx.save();
  ctx.scale(sx, sy);
  if (state.screen === 'game' && state.game) drawWorld(ctx, state.game);
  else drawLobbyScene(ctx);
  ctx.restore();
}
function drawLobbyScene(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, 580);
  grad.addColorStop(0, '#13284a');
  grad.addColorStop(0.55, '#0d1d35');
  grad.addColorStop(1, '#070f1b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1100, 580);
  for (let i = 0; i < 85; i++) {
    const x = (i * 137) % 1150;
    const y = 20 + (i * 71) % 340;
    const r = 1 + (i % 4 === 0 ? 1 : 0);
    ctx.fillStyle = i % 8 === 0 ? 'rgba(141,233,255,.9)' : 'rgba(255,255,255,.72)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(141,233,255,.13)';
  ctx.beginPath();
  ctx.arc(860, 115, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8de9ff';
  ctx.beginPath();
  ctx.arc(860, 115, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(141,233,255,.32)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(860, 115, 124, 36, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath();
  ctx.arc(165, 205, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#304965';
  roundRect(ctx, 0, GROUND_Y, 1100, 70, 10);
  ctx.fill();
  ctx.fillStyle = '#8de9ff';
  ctx.globalAlpha = 0.26;
  ctx.fillRect(0, GROUND_Y, 1100, 6);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(141,233,255,.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(545, 275, 175, 62, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(545, 275, 250, 110, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#16304a';
  ctx.beginPath();
  ctx.arc(545, 275, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c5f7ff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(545, 275, 55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffe8a5';
  ctx.font = 'bold 38px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★', 545, 288);
  const pods = [
    [415, 275, '#9df0b8'],
    [675, 275, '#ff9bd4'],
    [545, 165, '#8de9ff'],
    [545, 385, '#ffe58a']
  ];
  for (const [x, y, color] of pods) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
}
function drawWorld(ctx, g) {
  const z = g.info.zone, cam = g.cameraX;
  const grad = ctx.createLinearGradient(0, 0, 0, 580);
  grad.addColorStop(0, z.sky);
  grad.addColorStop(1, '#08101d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1100, 580);
  for (let i = 0; i < 80; i++) {
    const x = ((i * 173 - cam * 0.08) % 1300 + 1300) % 1300 - 100;
    const y = 35 + (i * 83) % 330;
    const r = 1 + (i % 4 === 0 ? 1 : 0);
    ctx.fillStyle = i % 7 === 0 ? z.glow : 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.17;
  ctx.fillStyle = z.glow;
  ctx.beginPath();
  ctx.arc(870 - cam * 0.03, 110, 85, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawDistantPlanets(ctx, g, cam);
  for (const pl of g.platforms) {
    const x = pl.x - cam;
    if (x + pl.w < 0 || x > 1100) continue;
    ctx.fillStyle = z.ground;
    roundRect(ctx, x, pl.y, pl.w, pl.h, 10);
    ctx.fill();
    ctx.fillStyle = z.glow;
    ctx.globalAlpha = 0.32;
    ctx.fillRect(x, pl.y, pl.w, 5);
    ctx.globalAlpha = 1;
    if (pl.y === GROUND_Y) {
      for (let k = 0; k < pl.w; k += 80) {
        ctx.fillStyle = 'rgba(255,255,255,.04)';
        ctx.fillRect(x + k, pl.y + 15, 2, pl.h - 15);
      }
    }
  }
  for (const e of g.enemies) if (!e.dead) drawEnemy(ctx, e, cam);
  for (const pj of g.projectiles) {
    ctx.fillStyle = pj.crit ? '#ffe58a' : '#9feaff';
    ctx.shadowBlur = 16;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(pj.x - cam, pj.y, pj.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  drawPlayer(ctx, g.player, cam, g.info.zone);
  for (const p of g.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cam, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawDistantPlanets(ctx, g, cam) {
  const z = g.info.zone;
  ctx.save();
  ctx.translate(-cam * 0.04, 0);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.beginPath();
  ctx.arc(160, 190, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = z.glow;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(560, 180, 120, 32, -0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = z.glow;
  ctx.beginPath();
  ctx.arc(560, 180, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}
function drawPlayer(ctx, p, cam, zone) {
  const x = p.x - cam, y = p.y;
  ctx.save();
  if (p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.translate(x + p.w / 2, y + p.h / 2);
  ctx.scale(p.facing, 1);
  ctx.fillStyle = '#f5fbff';
  ctx.strokeStyle = '#86d9ff';
  ctx.lineWidth = 3;
  roundRect(ctx, -15, -17, 30, 34, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1a3451';
  roundRect(ctx, -11, -12, 22, 14, 7);
  ctx.fill();
  ctx.fillStyle = '#8de9ff';
  ctx.beginPath();
  ctx.arc(5, -6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5fbff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-10, 6); ctx.lineTo(-18, 14);
  ctx.moveTo(10, 6); ctx.lineTo(17, 11);
  ctx.stroke();
  ctx.strokeStyle = '#a9dfff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-7, 17); ctx.lineTo(-8, 24);
  ctx.moveTo(7, 17); ctx.lineTo(8, 24);
  ctx.stroke();
  ctx.strokeStyle = '#dff8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -17); ctx.lineTo(3, -26);
  ctx.stroke();
  ctx.fillStyle = zone.glow;
  ctx.beginPath();
  ctx.arc(3, -28, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function drawEnemy(ctx, e, cam) {
  const x = e.x - cam, y = e.y + Math.sin(now() * 3 + e.bob) * 2;
  ctx.save();
  ctx.translate(x + e.w / 2, y + e.h / 2);
  if (e.flash > 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = e.color;
  ctx.strokeStyle = 'rgba(255,255,255,.72)';
  ctx.lineWidth = e.boss ? 4 : 2;
  ctx.beginPath();
  ctx.moveTo(-e.w * 0.46, e.h * 0.26);
  ctx.bezierCurveTo(-e.w * 0.52, -e.h * 0.16, -e.w * 0.23, -e.h * 0.5, 0, -e.h * 0.46);
  ctx.bezierCurveTo(e.w * 0.28, -e.h * 0.5, e.w * 0.53, -e.h * 0.1, e.w * 0.46, e.h * 0.26);
  ctx.quadraticCurveTo(e.w * 0.18, e.h * 0.43, 0, e.h * 0.30);
  ctx.quadraticCurveTo(-e.w * 0.2, e.h * 0.44, -e.w * 0.46, e.h * 0.26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#102038';
  ctx.beginPath();
  ctx.arc(-e.w * 0.12, -e.h * 0.06, e.boss ? 5 : 3, 0, Math.PI * 2);
  ctx.arc(e.w * 0.12, -e.h * 0.06, e.boss ? 5 : 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#102038';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, e.h * 0.08, e.w * 0.11, 0, Math.PI);
  ctx.stroke();
  if (e.boss) {
    ctx.fillStyle = '#ffe58a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, -e.h * 0.5 - 8);
  }
  ctx.restore();
  const hpW = e.boss ? 96 : 48;
  ctx.fillStyle = 'rgba(2,8,16,.75)';
  ctx.fillRect(x + e.w / 2 - hpW / 2, y - 12, hpW, 5);
  ctx.fillStyle = e.boss ? '#ff9bd4' : '#9df0b8';
  ctx.fillRect(x + e.w / 2 - hpW / 2, y - 12, hpW * (e.hp / e.maxHp), 5);
}
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toggleAuto() {
  state.save.auto = !state.save.auto;
  schedulePersist();
  renderGameHudForMode();
  renderLobby();
  combatSay(`AUTO PILOT ${state.save.auto ? 'ON' : 'OFF'}`);
}

async function profileFor(id) {
  if (!id) return null;
  if (state.profileCache.has(id)) return state.profileCache.get(id);
  try {
    const p = await profileById(id);
    state.profileCache.set(id, p);
    return p;
  } catch (_) {
    return null;
  }
}
function startWorldChat() {
  try { state.chatUnsub?.(); } catch (_) { }
  state.chatUnsub = null;
  const input = $('#worldChatInput');
  const send = $('#worldChatSend');
  input.disabled = !state.identity?.profileId;
  send.disabled = !state.identity?.profileId;
  $('#worldChatStatus').textContent = state.identity?.profileId ? 'CONNECTED // 500 CHAR MAX' : 'SIGN IN TO CHAT';
  const q = fs.query(fs.collection(db, 'publicComments'), fs.where('targetKey', '==', CHAT_TARGET_KEY), fs.where('deleted', '==', false), fs.limit(100));
  state.chatUnsub = fs.onSnapshot(q, async snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0))
      .slice(-60);
    const ids = [...new Set(docs.map(d => d.authorProfileId).filter(Boolean))];
    await Promise.all(ids.map(profileFor));
    state.chatRows = docs;
    renderWorldChat();
  }, error => {
    console.error('SpaceStories world chat', error);
    $('#worldChatMessages').innerHTML = '<div class="chat-empty">WORLD CHAT TEMPORARILY UNAVAILABLE.</div>';
    $('#worldChatStatus').textContent = 'CHAT CONNECTION ERROR';
  });
}
function renderWorldChat() {
  const root = $('#worldChatMessages');
  root.innerHTML = '';
  if (!state.chatRows.length) {
    root.innerHTML = '<div class="chat-empty">NO BROADCASTS YET.<br>BE THE FIRST LITTLE ASTRONAUT.</div>';
    return;
  }
  for (const row of state.chatRows) {
    const p = state.profileCache.get(row.authorProfileId);
    const el = document.createElement('article');
    el.className = `chat-message${row.authorProfileId === state.identity?.profileId ? ' is-you' : ''}`;
    const head = document.createElement('div');
    head.className = 'chat-message-head';
    const b = document.createElement('b');
    b.textContent = p?.displayName || `Pilot-${String(row.authorProfileId || '').slice(0, 6)}`;
    const t = document.createElement('time');
    const date = row.createdAt?.toDate?.();
    t.textContent = date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'NOW';
    head.append(b, t);
    const body = document.createElement('p');
    body.textContent = String(row.text || '').slice(0, 500);
    el.append(head, body);
    root.appendChild(el);
  }
  root.scrollTop = root.scrollHeight;
}
async function sendWorldChat(event) {
  event.preventDefault();
  if (!state.identity?.profileId) return;
  const input = $('#worldChatInput');
  const text = String(input.value || '').trim().slice(0, 500);
  if (!text) return;
  const send = $('#worldChatSend');
  send.disabled = true;
  $('#worldChatStatus').textContent = 'SENDING…';
  try {
    const ref = fs.doc(fs.collection(db, 'publicComments'));
    await fs.setDoc(ref, {
      targetKey: CHAT_TARGET_KEY,
      targetType: 'object',
      targetId: CHAT_TARGET_ID,
      text,
      reasoningType: 'observation',
      authorProfileId: state.identity.profileId,
      createdAt: fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp(),
      deleted: false,
      deletedAt: null,
      deletedByProfileId: '',
      deleteReason: '',
      moderationActionId: ''
    });
    input.value = '';
    $('#worldChatStatus').textContent = 'CONNECTED // 500 CHAR MAX';
  } catch (error) {
    console.error('SpaceStories chat send', error);
    $('#worldChatStatus').textContent = 'MESSAGE NOT SENT';
  } finally {
    send.disabled = !state.identity?.profileId;
  }
}

function bindEvents() {
  $('#launchStoryButton').addEventListener('click', startStage);
  $('#sceneQuickRoute').addEventListener('click', () => openPanel('map'));
  $('#spaceLobbyButton').addEventListener('click', () => setScreen('lobby'));
  $('#equipBestButton').addEventListener('click', equipBest);
  $('#sellJunkButton').addEventListener('click', sellJunk);
  $('#autoPilotButton').addEventListener('click', toggleAuto);
  $('#worldChatForm').addEventListener('submit', sendWorldChat);
  $$('[data-panel-toggle]').forEach(btn => btn.addEventListener('click', () => togglePanel(btn.dataset.panelToggle)));
  $$('[data-close-panels]').forEach(btn => btn.addEventListener('click', closePanels));
  $$('.skill-bar [data-skill]').forEach(btn => btn.addEventListener('click', () => useSkill(btn.dataset.skill)));
  document.addEventListener('keydown', e => {
    if (e.target.matches('textarea,input')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    state.keys.add(k);
    if ([' ', 'ArrowUp', 'w'].includes(k)) { e.preventDefault(); jump(); }
    if (k === 'j') { e.preventDefault(); doBasicAttack(); }
    if (k === '1') useNova();
    if (k === '2') useDash();
    if (k === '3') useHeal();
    if (k === 'e') toggleAuto();
    if (k === 'Escape') { hideOverlay(); closePanels(); }
  });
  document.addEventListener('keyup', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    state.keys.delete(k);
  });
  $$('.mobile-controls [data-move]').forEach(btn => {
    const key = btn.dataset.move;
    const on = e => { e.preventDefault(); state.touch[key] = true; };
    const off = e => { e.preventDefault(); state.touch[key] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('pointerleave', off);
  });
  $('[data-action="jump"]').addEventListener('pointerdown', e => { e.preventDefault(); jump(); });
  $('[data-action="attack"]').addEventListener('pointerdown', e => { e.preventDefault(); doBasicAttack(); });
  window.addEventListener('resize', drawGame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('beforeunload', persist);
}

state.save = defaultSave();
bindEvents();
refreshPanels();
renderLobby();
setScreen('lobby');
watchIdentity(identity => {
  state.identity = identity?.profileId ? identity : null;
  loadSave();
  renderLobby();
  startWorldChat();
  if (!state.identity && state.screen === 'game') setScreen('lobby');
  else drawGame();
});
