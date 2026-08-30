const ICON_JSON_MAX = 32000;
const MAX_AREAS = 12;
const MAX_ITEMS = 32;
const MAX_MOBS = 16;
const MAX_TERMINALS = 16;
const MAX_DROPS_PER_MOB = 16;
const MAX_OFFERS_PER_TERMINAL = 32;

const clamp = (value, fallback, min, max, integer = false) => {
  let n = Number(value);
  if (!Number.isFinite(n)) n = fallback;
  n = Math.max(min, Math.min(max, n));
  return integer ? Math.round(n) : n;
};
const text = (value, fallback = '', max = 40) => String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max) || fallback;
const slug = (value, fallback = 'entry') => {
  const v = String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return v || fallback;
};

export const DEFAULT_ICON_JSON = JSON.stringify({
  version: 1,
  background: '#10191b',
  layers: [{ char: '?', x: 64, y: 66, fontSize: 56, color: '#d9eeee', fontFamily: 'Arial', fontWeight: 900, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1, align: 'middle' }]
});

export const DEFAULT_SLIME_ICON_JSON = JSON.stringify({
  version: 1,
  background: '#0b1710',
  layers: [
    { char: '●', x: 64, y: 70, fontSize: 88, color: '#62d776', fontFamily: 'Arial', fontWeight: 900, rotation: 0, scaleX: 1.05, scaleY: 0.78, skewX: 0, skewY: 0, opacity: 1, align: 'middle' },
    { char: '••', x: 64, y: 62, fontSize: 20, color: '#07100a', fontFamily: 'Arial', fontWeight: 900, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1, align: 'middle' }
  ]
});

function normalizeIconJson(value, fallback = DEFAULT_ICON_JSON) {
  const raw = typeof value === 'string' ? value.trim() : value ? JSON.stringify(value) : '';
  if (!raw || raw.length > ICON_JSON_MAX) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.layers) || parsed.layers.length < 1 || parsed.layers.length > 96) return fallback;
    return JSON.stringify(parsed);
  } catch (_) {
    return fallback;
  }
}

export const GLOBAL_WORLD_SETTINGS = Object.freeze({
  version: 2,
  player: Object.freeze({ maxHp: 5, energyPerTurn: 1, maxWalkDistance: 50 }),
  currency: Object.freeze({ mode: 'credits', name: 'CREDITS', symbol: '◈', startingBalance: 0, deathLossCap: 10 }),
  areas: Object.freeze([
    Object.freeze({ id: 'north-platform', name: 'NORTH PLATFORM', minX: 11, maxX: 32, minY: 11, maxY: 28 }),
    Object.freeze({ id: 'cache-yard', name: 'CACHE YARD', minX: 76, maxX: 91, minY: 68, maxY: 84 })
  ]),
  items: Object.freeze([]),
  mobs: Object.freeze([]),
  terminals: Object.freeze([])
});

export const HOSTED_WORLD_DEFAULTS = Object.freeze({
  version: 2,
  player: Object.freeze({ maxHp: 5, energyPerTurn: 1, maxWalkDistance: 50 }),
  currency: Object.freeze({ mode: 'local', name: 'TOKENS', symbol: '◆', startingBalance: 0, deathLossCap: 10 }),
  areas: Object.freeze([
    Object.freeze({ id: 'north-platform', name: 'NORTH PLATFORM', minX: 11, maxX: 32, minY: 11, maxY: 28 }),
    Object.freeze({ id: 'cache-yard', name: 'CACHE YARD', minX: 76, maxX: 91, minY: 68, maxY: 84 })
  ]),
  items: Object.freeze([
    Object.freeze({ id: 'health_potion', name: 'Health Potion', kind: 'consumable', description: 'Restores 2 HP.', healAmount: 2, equipmentSlot: '', damageMin: 0, damageMax: 0, iconJson: DEFAULT_ICON_JSON }),
    Object.freeze({ id: 'slime_juice', name: 'Slime Juice', kind: 'material', description: 'A volatile slime byproduct.', healAmount: 0, equipmentSlot: '', damageMin: 0, damageMax: 0, iconJson: DEFAULT_ICON_JSON }),
    Object.freeze({ id: 'hand_wraps', name: 'Hand Wraps', kind: 'equipment', description: 'Fighting wraps. Damage 2–2.', healAmount: 0, equipmentSlot: 'weapon', damageMin: 2, damageMax: 2, iconJson: DEFAULT_ICON_JSON }),
    Object.freeze({ id: 'stick', name: 'Stick', kind: 'equipment', description: 'A basic weapon. Damage 1–2.', healAmount: 0, equipmentSlot: 'weapon', damageMin: 1, damageMax: 2, iconJson: DEFAULT_ICON_JSON })
  ]),
  mobs: Object.freeze([
    Object.freeze({ id: 'slime', name: 'CACHE SLIME', maxHp: 2, damage: 1, attackRange: 13, areaId: 'cache-yard', spawnCount: 3, respawnTurns: 1, killReward: 1, iconJson: DEFAULT_SLIME_ICON_JSON, drops: Object.freeze([
      Object.freeze({ itemId: 'slime_juice', chance: 0.05, quantity: 1 }),
      Object.freeze({ itemId: 'health_potion', chance: 0.01, quantity: 1 }),
      Object.freeze({ itemId: 'hand_wraps', chance: 0.001, quantity: 1 })
    ]) })
  ]),
  terminals: Object.freeze([
    Object.freeze({ id: 'north-terminal', name: 'NORTH TERMINAL', subtitle: 'NORTH PLATFORM', offers: Object.freeze([
      Object.freeze({ id: 'buy-health-potion', direction: 'buy', itemId: 'health_potion', price: 3 }),
      Object.freeze({ id: 'buy-stick', direction: 'buy', itemId: 'stick', price: 5 }),
      Object.freeze({ id: 'sell-slime-juice', direction: 'sell', itemId: 'slime_juice', price: 1 })
    ]) })
  ])
});

function normalizeArea(raw = {}, index = 0) {
  const id = slug(raw.id, `area-${index + 1}`);
  let minX = clamp(raw.minX, 10, 0, 100);
  let maxX = clamp(raw.maxX, 90, 0, 100);
  let minY = clamp(raw.minY, 10, 0, 100);
  let maxY = clamp(raw.maxY, 90, 0, 100);
  if (maxX < minX) [minX, maxX] = [maxX, minX];
  if (maxY < minY) [minY, maxY] = [maxY, minY];
  return { id, name: text(raw.name, id.toUpperCase(), 36).toUpperCase(), minX, maxX, minY, maxY };
}

function normalizeItem(raw = {}, index = 0) {
  const kind = ['material', 'consumable', 'equipment'].includes(raw.kind) ? raw.kind : 'material';
  const slot = kind === 'equipment' && raw.equipmentSlot === 'weapon' ? 'weapon' : '';
  const min = slot ? clamp(raw.damageMin, 1, 0, 99, true) : 0;
  const max = slot ? Math.max(min, clamp(raw.damageMax, min, 0, 99, true)) : 0;
  return {
    id: slug(raw.id, `item-${index + 1}`), name: text(raw.name, `Item ${index + 1}`, 40), kind,
    description: text(raw.description, '', 120), healAmount: kind === 'consumable' ? clamp(raw.healAmount, 0, 0, 50, true) : 0,
    equipmentSlot: slot, damageMin: min, damageMax: max,
    iconJson: normalizeIconJson(raw.iconJson)
  };
}

function normalizeMob(raw = {}, index = 0, areaIds = new Set(), itemIds = new Set()) {
  const drops = (Array.isArray(raw.drops) ? raw.drops : []).slice(0, MAX_DROPS_PER_MOB).map((drop, dropIndex) => ({
    itemId: slug(drop?.itemId, `item-${dropIndex + 1}`),
    chance: clamp(drop?.chance, 0, 0, 1),
    quantity: clamp(drop?.quantity, 1, 1, 99, true)
  })).filter(drop => itemIds.has(drop.itemId));
  const areaId = areaIds.has(String(raw.areaId)) ? String(raw.areaId) : [...areaIds][0] || 'cache-yard';
  return {
    id: slug(raw.id, `mob-${index + 1}`), name: text(raw.name, `Mob ${index + 1}`, 40),
    maxHp: clamp(raw.maxHp, 1, 1, 100, true), damage: clamp(raw.damage, 1, 0, 50, true),
    attackRange: clamp(raw.attackRange, 13, 1, 40), areaId,
    spawnCount: clamp(raw.spawnCount, 1, 0, 24, true), respawnTurns: clamp(raw.respawnTurns, 1, 1, 30, true),
    killReward: clamp(raw.killReward, 0, 0, 10000, true),
    iconJson: normalizeIconJson(raw.iconJson, DEFAULT_SLIME_ICON_JSON), drops
  };
}

function normalizeTerminal(raw = {}, index = 0, itemIds = new Set()) {
  const offers = (Array.isArray(raw.offers) ? raw.offers : []).slice(0, MAX_OFFERS_PER_TERMINAL).map((offer, offerIndex) => ({
    id: slug(offer?.id, `offer-${offerIndex + 1}`), direction: offer?.direction === 'sell' ? 'sell' : 'buy',
    itemId: slug(offer?.itemId, ''), price: clamp(offer?.price, 1, 1, 100000, true)
  })).filter(offer => itemIds.has(offer.itemId));
  return { id: slug(raw.id, `terminal-${index + 1}`), name: text(raw.name, `Terminal ${index + 1}`, 40).toUpperCase(), subtitle: text(raw.subtitle, 'WORLD TERMINAL', 40).toUpperCase(), offers };
}

export function normalizeWorldSettings(input = {}, hosted = false) {
  const base = hosted ? HOSTED_WORLD_DEFAULTS : GLOBAL_WORLD_SETTINGS;
  const player = input.player || {};
  const currency = input.currency || {};
  const rawAreas = Array.isArray(input.areas) && input.areas.length ? input.areas : base.areas;
  const areas = rawAreas.slice(0, MAX_AREAS).map(normalizeArea);
  const areaIds = new Set(areas.map(a => a.id));
  const rawItems = hosted && Array.isArray(input.items) ? input.items : base.items;
  const items = rawItems.slice(0, MAX_ITEMS).map(normalizeItem);
  const itemIds = new Set(items.map(i => i.id));
  const rawMobs = hosted && Array.isArray(input.mobs) ? input.mobs : base.mobs;
  const mobs = rawMobs.slice(0, MAX_MOBS).map((mob, i) => normalizeMob(mob, i, areaIds, itemIds));
  const rawTerminals = hosted && Array.isArray(input.terminals) ? input.terminals : base.terminals;
  const terminals = rawTerminals.slice(0, MAX_TERMINALS).map((terminal, i) => normalizeTerminal(terminal, i, itemIds));
  return {
    version: 2,
    player: {
      maxHp: clamp(player.maxHp, base.player.maxHp, 1, 50, true),
      energyPerTurn: clamp(player.energyPerTurn, base.player.energyPerTurn, 1, 20, true),
      maxWalkDistance: clamp(player.maxWalkDistance, base.player.maxWalkDistance, 1, 100)
    },
    currency: {
      mode: hosted ? 'local' : 'credits', name: text(currency.name, base.currency.name, 18).toUpperCase(),
      symbol: text(currency.symbol, base.currency.symbol, 3), startingBalance: clamp(currency.startingBalance, base.currency.startingBalance, 0, 1000000, true),
      deathLossCap: clamp(currency.deathLossCap, base.currency.deathLossCap, 0, 100000, true)
    },
    areas, items, mobs, terminals
  };
}

export function defaultHostedWorldSettings() {
  return normalizeWorldSettings(HOSTED_WORLD_DEFAULTS, true);
}

export function settingsFromHostForm(root = document, content = {}) {
  const value = id => root.querySelector(`#${id}`)?.value;
  return normalizeWorldSettings({
    player: { maxHp: value('playerMaxHp'), energyPerTurn: value('energyPerTurn'), maxWalkDistance: value('maxWalkDistance') },
    currency: { name: value('worldCurrencyName'), symbol: value('worldCurrencySymbol'), startingBalance: value('worldCurrencyStartingBalance'), deathLossCap: value('worldCurrencyDeathLossCap') },
    areas: content.areas,
    items: content.items,
    mobs: content.mobs,
    terminals: content.terminals
  }, true);
}

export function areaById(settings, id) { return settings?.areas?.find(area => area.id === id) || settings?.areas?.[0] || null; }
export function itemById(settings, id) { return settings?.items?.find(item => item.id === id) || null; }
export function mobById(settings, id) { return settings?.mobs?.find(mob => mob.id === id) || null; }
export function terminalById(settings, id) { return settings?.terminals?.find(terminal => terminal.id === id) || null; }

export function expandedMobSpawns(settings) {
  const out = [];
  for (const mob of settings?.mobs || []) {
    const area = areaById(settings, mob.areaId);
    if (!area) continue;
    for (let i = 0; i < mob.spawnCount; i += 1) {
      out.push({ key: `${mob.id}-${String(i + 1).padStart(2, '0')}`, mobId: mob.id, label: `${mob.name}${mob.spawnCount > 1 ? ` ${i + 1}` : ''}`, ...area, maxHp: mob.maxHp, damage: mob.damage, attackRange: mob.attackRange, respawnTurns: mob.respawnTurns, iconJson: mob.iconJson });
    }
  }
  return out;
}

function hash32(value = '') {
  let hash = 0x811c9dc5;
  for (const char of String(value)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}
export function deterministic01(seed = '') { return hash32(seed) / 0x100000000; }
export function rollMobDrops(actionId, mob) {
  const drops = {};
  for (const drop of mob?.drops || []) {
    if (deterministic01(`${actionId}:${mob.id}:${drop.itemId}`) < Number(drop.chance || 0)) drops[drop.itemId] = (drops[drop.itemId] || 0) + Math.max(1, Number(drop.quantity || 1));
  }
  return drops;
}
