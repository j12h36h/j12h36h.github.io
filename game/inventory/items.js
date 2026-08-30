/**
 * E.R.A.S. GAME ITEM REGISTRY
 * --------------------------
 * Add item metadata here. The Bag renderer, equipment renderer, inventory
 * normalization, death clearing, and terminal UI all consume this registry.
 *
 * For a new persisted item, give it a unique inventoryField. Firestore rules
 * remain the server-authoritative security boundary and must permit any new
 * persisted/traded fields before public deployment.
 */
const ITEM_DEFINITIONS = {
  health_potion: {
    name: 'Health Potion',
    kind: 'consumable',
    texture: '/public-assets/textures/health_potion.png',
    inventoryField: 'healthPotion',
    bag: true,
    bagOrder: 10,
    use: { type: 'heal', amount: 2, label: 'USE +2 HP' },
    description: 'Restores up to 2 HP.'
  },
  slime_juice: {
    name: 'Slime Juice',
    kind: 'material',
    texture: '/public-assets/textures/slime_juice.png',
    inventoryField: 'slimeJuice',
    bag: true,
    bagOrder: 20,
    description: 'A volatile slime byproduct.'
  },
  hand_wraps: {
    name: 'Hand Wraps',
    kind: 'weapon',
    texture: '/public-assets/textures/hand_wraps.png',
    inventoryField: 'handWraps',
    bag: true,
    bagOrder: 30,
    equipmentSlot: 'weapon',
    damageMin: 1,
    damageMax: 1,
    description: 'Simple fighting wraps. Damage 1–1.'
  },
  stick: {
    name: 'Stick',
    kind: 'weapon',
    texture: '',
    inventoryField: 'stick',
    bag: true,
    bagOrder: 40,
    equipmentSlot: 'weapon',
    damageMin: 1,
    damageMax: 2,
    description: 'A basic weapon. Damage 1–2.'
  }
};

export const GAME_ITEMS = Object.freeze(Object.fromEntries(
  Object.entries(ITEM_DEFINITIONS).map(([id, definition]) => [id, Object.freeze({ id, ...definition })])
));

export const ITEM_IDS = Object.freeze(Object.keys(GAME_ITEMS));
export const BAG_ITEM_IDS = Object.freeze(
  ITEM_IDS.filter(id => GAME_ITEMS[id].bag !== false)
    .sort((a, b) => Number(GAME_ITEMS[a].bagOrder || 0) - Number(GAME_ITEMS[b].bagOrder || 0))
);
export const WEAPON_IDS = Object.freeze(ITEM_IDS.filter(id => GAME_ITEMS[id].equipmentSlot === 'weapon'));

export const GAME_LOOT_TABLES = Object.freeze({
  slime: Object.freeze([
    Object.freeze({ itemId: 'slime_juice', chance: 0.05 }),
    Object.freeze({ itemId: 'health_potion', chance: 0.01 }),
    Object.freeze({ itemId: 'hand_wraps', chance: 0.001 })
  ])
});

export function itemMeta(itemId = '') {
  return GAME_ITEMS[String(itemId || '')] || null;
}

export function itemCount(inventory = {}, itemId = '') {
  const item = itemMeta(itemId);
  if (!item) return 0;
  return Math.max(0, Math.floor(Number(inventory?.[item.inventoryField]) || 0));
}

export function emptyGameInventory(profileId = '') {
  const inventory = {
    profileId,
    equippedWeapon: '',
    lastEventId: '',
    lastEventType: 'init',
    lastDeathEventId: ''
  };
  for (const itemId of ITEM_IDS) inventory[GAME_ITEMS[itemId].inventoryField] = 0;
  return inventory;
}

export function normalizeGameInventory(data = {}, profileId = '') {
  const base = emptyGameInventory(profileId || data.profileId || '');
  const equippedWeapon = WEAPON_IDS.includes(String(data.equippedWeapon || '')) ? String(data.equippedWeapon) : '';
  const normalized = {
    ...base,
    ...data,
    profileId: String(data.profileId || profileId || ''),
    equippedWeapon,
    lastEventId: String(data.lastEventId || ''),
    lastEventType: String(data.lastEventType || 'init'),
    lastDeathEventId: String(data.lastDeathEventId || '')
  };
  for (const itemId of ITEM_IDS) {
    const field = GAME_ITEMS[itemId].inventoryField;
    normalized[field] = Math.max(0, Math.floor(Number(data[field]) || 0));
  }
  return normalized;
}

export function inventoryZeroPatch() {
  const patch = {};
  for (const itemId of ITEM_IDS) patch[GAME_ITEMS[itemId].inventoryField] = 0;
  return patch;
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

export function lootDropsForAction(actionId = '', tableId = '') {
  const table = GAME_LOOT_TABLES[tableId] || [];
  const drops = {};
  for (const entry of table) {
    if (!GAME_ITEMS[entry.itemId]) continue;
    if (deterministicRoll(`${actionId}:${tableId}:${entry.itemId}`) < Number(entry.chance || 0)) {
      drops[entry.itemId] = (drops[entry.itemId] || 0) + 1;
    }
  }
  return drops;
}

// Backward-compatible shape used by the current slime combat transaction.
// The source table above is now modular; the transaction fields are derived
// from item metadata instead of being authored in the drop table itself.
export function slimeDropsForAction(actionId = '') {
  const itemDrops = lootDropsForAction(actionId, 'slime');
  const fieldDrops = {};
  for (const itemId of ITEM_IDS) {
    const field = GAME_ITEMS[itemId].inventoryField;
    fieldDrops[field] = Math.max(0, Math.floor(Number(itemDrops[itemId]) || 0));
  }
  return fieldDrops;
}

export function attackDamageForAction(actionId = '', inventory = {}) {
  const range = damageRange(inventory);
  if (range.max <= range.min) return range.min;
  const span = range.max - range.min + 1;
  return range.min + Math.floor(deterministicRoll(`${actionId}:weapon_damage:${inventory?.equippedWeapon || 'bare'}`) * span);
}

export function describeDrops(drops = {}) {
  const found = [];
  for (const itemId of BAG_ITEM_IDS) {
    const item = GAME_ITEMS[itemId];
    if (Math.max(0, Number(drops[item.inventoryField] || 0)) > 0) found.push(item.name.toUpperCase());
  }
  return found;
}
