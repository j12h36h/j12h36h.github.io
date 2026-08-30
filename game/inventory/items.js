export const GAME_ITEMS = Object.freeze({
  health_potion: Object.freeze({
    id: 'health_potion',
    name: 'Health Potion',
    kind: 'consumable',
    texture: '/public-assets/textures/health_potion.png',
    inventoryField: 'healthPotion',
    heal: 2,
    buyPrice: 3,
    sellPrice: null,
    description: 'Restores up to 2 HP.'
  }),
  slime_juice: Object.freeze({
    id: 'slime_juice',
    name: 'Slime Juice',
    kind: 'material',
    texture: '/public-assets/textures/slime_juice.png',
    inventoryField: 'slimeJuice',
    buyPrice: null,
    sellPrice: 1,
    description: 'A volatile slime byproduct. NORTH TERMINAL buys it for 1 Credit.'
  }),
  hand_wraps: Object.freeze({
    id: 'hand_wraps',
    name: 'Hand Wraps',
    kind: 'weapon',
    texture: '/public-assets/textures/hand_wraps.png',
    inventoryField: 'handWraps',
    damageMin: 1,
    damageMax: 1,
    buyPrice: null,
    sellPrice: null,
    description: 'Simple fighting wraps. Damage 1–1.'
  }),
  stick: Object.freeze({
    id: 'stick',
    name: 'Stick',
    kind: 'weapon',
    texture: '',
    inventoryField: 'stick',
    damageMin: 1,
    damageMax: 2,
    buyPrice: 5,
    sellPrice: null,
    description: 'A basic weapon. Damage 1–2.'
  })
});

export const WEAPON_IDS = Object.freeze(['hand_wraps', 'stick']);

export function emptyGameInventory(profileId = '') {
  return {
    profileId,
    slimeJuice: 0,
    healthPotion: 0,
    handWraps: 0,
    stick: 0,
    equippedWeapon: '',
    lastEventId: '',
    lastEventType: 'init',
    lastDeathEventId: ''
  };
}

export function normalizeGameInventory(data = {}, profileId = '') {
  const base = emptyGameInventory(profileId || data.profileId || '');
  const equippedWeapon = WEAPON_IDS.includes(String(data.equippedWeapon || '')) ? String(data.equippedWeapon) : '';
  return {
    ...base,
    ...data,
    profileId: String(data.profileId || profileId || ''),
    slimeJuice: Math.max(0, Math.floor(Number(data.slimeJuice) || 0)),
    healthPotion: Math.max(0, Math.floor(Number(data.healthPotion) || 0)),
    handWraps: Math.max(0, Math.floor(Number(data.handWraps) || 0)),
    stick: Math.max(0, Math.floor(Number(data.stick) || 0)),
    equippedWeapon,
    lastEventId: String(data.lastEventId || ''),
    lastEventType: String(data.lastEventType || 'init'),
    lastDeathEventId: String(data.lastDeathEventId || '')
  };
}

export function equippedWeaponMeta(inventory = {}) {
  return GAME_ITEMS[inventory?.equippedWeapon] || null;
}

export function damageRange(inventory = {}) {
  const weapon = equippedWeaponMeta(inventory);
  return {
    min: Number(weapon?.damageMin || 1),
    max: Number(weapon?.damageMax || 1),
    label: weapon?.name || 'Bare Hands'
  };
}

function fnv1a32(value = '') {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicRoll(seed = '') {
  return fnv1a32(seed) / 0x100000000;
}

// Each slime-drop chance is independent. The action id seeds the rolls so a
// Firestore transaction retry cannot reroll the same kill.
export function slimeDropsForAction(actionId = '') {
  return {
    slimeJuice: deterministicRoll(`${actionId}:slime_juice`) < 0.05 ? 1 : 0,
    healthPotion: deterministicRoll(`${actionId}:health_potion`) < 0.01 ? 1 : 0,
    handWraps: deterministicRoll(`${actionId}:hand_wraps`) < 0.001 ? 1 : 0
  };
}

export function attackDamageForAction(actionId = '', inventory = {}) {
  const range = damageRange(inventory);
  if (range.max <= range.min) return range.min;
  const span = range.max - range.min + 1;
  return range.min + Math.floor(deterministicRoll(`${actionId}:weapon_damage:${inventory?.equippedWeapon || 'bare'}`) * span);
}

export function describeDrops(drops = {}) {
  const found = [];
  if (Number(drops.slimeJuice || 0) > 0) found.push('SLIME JUICE');
  if (Number(drops.healthPotion || 0) > 0) found.push('HEALTH POTION');
  if (Number(drops.handWraps || 0) > 0) found.push('HAND WRAPS');
  return found;
}
