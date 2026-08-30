import { avatarSvg } from '/game/assets/js/eras-data.js?v=1.7.3';
import { itemById, terminalById, deterministic01 } from '/game/config/world-settings.js?v=2.1.0';

export const WORLD_INVENTORY_COLLECTION = 'gameWorldInventories';

function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function docKey(worldId, profileId) { return `${worldId}__${profileId}`.replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 240); }
export function worldInventoryRef(db, fs, worldId, profileId) { return fs.doc(db, WORLD_INVENTORY_COLLECTION, docKey(worldId, profileId)); }

export function emptyWorldInventory(worldId, lobbyId, profileId, settings) {
  return { worldId, lobbyId, profileId, currencyBalance: Math.max(0, Math.floor(Number(settings?.currency?.startingBalance || 0))), items: {}, equippedWeapon: '', lastDeathEventId: '' };
}
export function normalizeWorldInventory(data = {}, worldId = '', lobbyId = '', profileId = '', settings = {}) {
  const base = emptyWorldInventory(worldId, lobbyId, profileId, settings);
  const items = {};
  for (const item of settings?.items || []) items[item.id] = Math.max(0, Math.floor(Number(data?.items?.[item.id] || 0)));
  const equipped = itemById(settings, data.equippedWeapon)?.equipmentSlot === 'weapon' ? data.equippedWeapon : '';
  return { ...base, ...data, worldId, lobbyId, profileId, currencyBalance: Math.max(0, Math.floor(Number(data.currencyBalance ?? base.currencyBalance))), items, equippedWeapon: equipped, lastDeathEventId: String(data.lastDeathEventId || '') };
}
export async function ensureWorldInventory(db, fs, worldId, lobbyId, profileId, settings) {
  const ref = worldInventoryRef(db, fs, worldId, profileId);
  await fs.runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, { ...emptyWorldInventory(worldId, lobbyId, profileId, settings), createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
  });
  return ref;
}
export function worldItemCount(inventory, itemId) { return Math.max(0, Math.floor(Number(inventory?.items?.[itemId] || 0))); }
export function worldDamageRange(inventory, settings) {
  const weapon = itemById(settings, inventory?.equippedWeapon || '');
  if (!weapon || weapon.equipmentSlot !== 'weapon') return { min: 1, max: 1, label: 'Bare Hands' };
  return { min: Math.max(0, Number(weapon.damageMin || 1)), max: Math.max(Number(weapon.damageMin || 1), Number(weapon.damageMax || 1)), label: weapon.name };
}
export function worldAttackDamage(actionId, inventory, settings) {
  const range = worldDamageRange(inventory, settings);
  if (range.max <= range.min) return range.min;
  return range.min + Math.floor(deterministic01(`${actionId}:world-weapon:${inventory?.equippedWeapon || 'bare'}`) * (range.max - range.min + 1));
}
function iconMarkup(item) {
  try { return avatarSvg({ displayName: item?.name || 'Item', avatarJson: item?.iconJson || '' }); }
  catch (_) { return '<span class="game-generic-item-icon" aria-hidden="true">◇</span>'; }
}
function eventId(profileId, kind) { return `${profileId}__${kind}__${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180); }

export function createWorldInventoryController({ db, fs, worldId, lobbyId, getSettings, getProfileId, getHp, getPresenceRef, message = () => {}, onHpChanged = () => {}, onInventoryChanged = () => {} }) {
  let profileId = '';
  let inventory = emptyWorldInventory(worldId, lobbyId, '', getSettings());
  let unsub = null;
  let mode = 'equipment';
  let activeTerminalId = '';
  let overlay = null;
  const settings = () => getSettings();

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('div'); overlay.className = 'game-inventory-overlay'; overlay.hidden = true;
    overlay.innerHTML = `<section class="game-inventory-modal" role="dialog" aria-modal="true" aria-labelledby="gameInventoryTitle"><header class="game-inventory-header"><div><small>CUSTOM WORLD INVENTORY // WORLD-LOCAL</small><h2 id="gameInventoryTitle">INVENTORY</h2></div><div class="game-inventory-wallet"><span data-world-currency-symbol>◆</span> <b data-world-currency-balance>0</b> <span data-world-currency-name>TOKENS</span></div><button type="button" class="game-inventory-close" data-game-inventory-close aria-label="Close inventory">×</button></header><div class="game-inventory-columns"><section class="game-inventory-left" data-game-inventory-left></section><section class="game-inventory-bag" data-game-inventory-bag></section></div><footer>CUSTOM WORLD ITEMS + CURRENCY STAY IN THIS WORLD // E.R.A.S. CREDITS ARE NEVER USED</footer></section>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay || e.target.closest('[data-game-inventory-close]')) close(); });
    overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    overlay.addEventListener('click', e => {
      const node = e.target.closest('[data-game-action]'); if (!node) return;
      const itemId = e.target.closest('[data-game-item]')?.dataset.gameItem || '';
      const action = node.dataset.gameAction;
      if (action === 'use-item') useItem(itemId);
      if (action === 'equip') equip(itemId);
      if (action === 'unequip') unequip();
      if (action === 'terminal-trade') trade(node.dataset.terminalOffer || '');
    });
    return overlay;
  }

  function renderEquipment() {
    const s = settings(); const weapon = itemById(s, inventory.equippedWeapon); const range = worldDamageRange(inventory, s);
    const card = weapon ? `<div class="game-equipment-card"><div class="game-item-icon">${iconMarkup(weapon)}</div><div><small>WEAPON</small><b>${escapeHtml(weapon.name)}</b><span>DAMAGE ${range.min}–${range.max}</span></div><button type="button" data-game-action="unequip">UNEQUIP</button></div>` : `<div class="game-equipment-card is-empty"><div class="game-item-icon"><span class="game-fist-icon">✦</span></div><div><small>WEAPON</small><b>BARE HANDS</b><span>DAMAGE 1–1</span></div></div>`;
    return `<div class="game-pane-heading"><small>LEFT PANE</small><h3>EQUIPMENT</h3></div><div class="game-equipment-slot">${card}</div><div class="game-equipment-stats"><span>ATTACK RANGE</span><b>${range.min}–${range.max}</b><small>${escapeHtml(range.label.toUpperCase())}</small></div><p class="game-pane-note">This equipment belongs only to ${escapeHtml(s.currency.name)} world state and clears on death.</p>`;
  }
  function renderTerminal() {
    const s = settings(); const terminal = terminalById(s, activeTerminalId); if (!terminal) return renderEquipment();
    const rows = (terminal.offers || []).map(offer => { const item = itemById(s, offer.itemId); if (!item) return ''; const buy = offer.direction === 'buy'; const disabled = buy ? inventory.currencyBalance < offer.price : worldItemCount(inventory, item.id) < 1; return `<button class="terminal-trade-row" type="button" data-game-action="terminal-trade" data-terminal-offer="${escapeHtml(offer.id)}" data-game-item="${escapeHtml(item.id)}" ${disabled ? 'disabled' : ''}><span class="game-item-icon">${iconMarkup(item)}</span><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></span><strong>${buy ? `BUY ${offer.price}${escapeHtml(s.currency.symbol)}` : `SELL +${offer.price}${escapeHtml(s.currency.symbol)}`}</strong></button>`; }).join('');
    return `<div class="game-pane-heading"><small>${escapeHtml(terminal.subtitle || terminal.name)}</small><h3>TERMINAL TRADE</h3></div><div class="terminal-trade-list">${rows || '<div class="game-terminal-empty">NO OFFERS AVAILABLE</div>'}</div><div class="game-terminal-rules"><b>WORLD-LOCAL ECONOMY</b><span>No E.R.A.S. Credits can be earned or spent here.</span></div>`;
  }
  function renderBag() {
    const s = settings(); const rows = [];
    for (const item of s.items || []) {
      const count = worldItemCount(inventory, item.id); if (count < 1) continue;
      let action = '';
      if (item.kind === 'consumable' && item.healAmount > 0) action = `<button type="button" data-game-action="use-item" ${Number(getHp?.() || 0) >= s.player.maxHp ? 'disabled' : ''}>USE +${item.healAmount} HP</button>`;
      else if (item.equipmentSlot === 'weapon') action = '<button type="button" data-game-action="equip">EQUIP</button>';
      rows.push(`<article class="game-bag-item" data-game-item="${escapeHtml(item.id)}"><div class="game-item-icon">${iconMarkup(item)}</div><div class="game-bag-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></div><strong>×${count}</strong>${action}</article>`);
    }
    return `<div class="game-pane-heading"><small>RIGHT PANE</small><h3>BAG</h3></div><div class="game-bag-grid">${rows.length ? rows.join('') : '<div class="game-bag-empty"><b>BAG EMPTY</b><span>Zero-count items are removed from this display automatically.</span></div>'}</div>`;
  }
  function render() {
    const root = ensureOverlay(); const s = settings(); const terminal = mode === 'terminal' ? terminalById(s, activeTerminalId) : null;
    root.querySelector('#gameInventoryTitle').textContent = terminal?.name || 'INVENTORY';
    root.querySelector('[data-game-inventory-left]').innerHTML = terminal ? renderTerminal() : renderEquipment(); root.querySelector('[data-game-inventory-bag]').innerHTML = renderBag();
    root.querySelector('[data-world-currency-symbol]').textContent = s.currency.symbol; root.querySelector('[data-world-currency-name]').textContent = s.currency.name; root.querySelector('[data-world-currency-balance]').textContent = inventory.currencyBalance.toLocaleString();
    onInventoryChanged(inventory);
  }
  async function start(nextProfileId) {
    profileId = String(nextProfileId || getProfileId?.() || ''); if (!profileId) return inventory;
    const ref = await ensureWorldInventory(db, fs, worldId, lobbyId, profileId, settings()); const snap = await fs.getDoc(ref); inventory = normalizeWorldInventory(snap.data(), worldId, lobbyId, profileId, settings());
    render(); unsub?.(); unsub = fs.onSnapshot(ref, snap2 => { if (!snap2.exists()) return; inventory = normalizeWorldInventory(snap2.data(), worldId, lobbyId, profileId, settings()); render(); }, e => console.debug('World inventory', e?.code || e)); return inventory;
  }
  function open(nextMode = 'equipment', contextId = '') { const s = settings(); if (nextMode === 'terminal') { if (!terminalById(s, contextId)) return false; mode = 'terminal'; activeTerminalId = contextId; } else { mode = 'equipment'; activeTerminalId = ''; } const root = ensureOverlay(); render(); root.hidden = false; document.body.classList.add('game-inventory-open'); setTimeout(() => root.querySelector('[data-game-inventory-close]')?.focus(), 0); return true; }
  function openTerminal(id) { return open('terminal', id); }
  function close() { const root = ensureOverlay(); root.hidden = true; document.body.classList.remove('game-inventory-open'); mode = 'equipment'; activeTerminalId = ''; }
  async function mutate(mutator) { const ref = worldInventoryRef(db, fs, worldId, profileId); return fs.runTransaction(db, async tx => { const snap = await tx.get(ref); if (!snap.exists()) return { error: 'WORLD INVENTORY UNAVAILABLE' }; const inv = normalizeWorldInventory(snap.data(), worldId, lobbyId, profileId, settings()); const result = await mutator(inv, tx, ref); return result; }); }
  async function useItem(itemId) {
    const s = settings(), item = itemById(s, itemId); if (!item || item.kind !== 'consumable' || item.healAmount <= 0) return;
    const presenceRef = getPresenceRef?.(); if (!presenceRef) return;
    try { const result = await fs.runTransaction(db, async tx => { const invRef = worldInventoryRef(db, fs, worldId, profileId); const [invSnap, presenceSnap] = await Promise.all([tx.get(invRef), tx.get(presenceRef)]); if (!invSnap.exists() || !presenceSnap.exists()) return { error: 'WORLD STATE UNAVAILABLE' }; const inv = normalizeWorldInventory(invSnap.data(), worldId, lobbyId, profileId, s); const hp = Math.max(0, Number(presenceSnap.data().hp || 0)); if (worldItemCount(inv, itemId) < 1) return { error: `NO ${item.name.toUpperCase()}` }; if (hp >= s.player.maxHp) return { error: 'HEALTH ALREADY FULL' }; const items = { ...inv.items, [itemId]: worldItemCount(inv, itemId) - 1 }; const hpAfter = Math.min(s.player.maxHp, hp + item.healAmount); tx.update(invRef, { items, updatedAt: fs.serverTimestamp() }); tx.update(presenceRef, { hp: hpAfter, updatedAt: fs.serverTimestamp() }); return { hp, hpAfter }; }); if (result?.error) return message(result.error); onHpChanged(result.hpAfter); message(`${item.name.toUpperCase()} USED // +${result.hpAfter - result.hp} HP // ENERGY UNCHANGED.`); } catch (e) { console.error(e); message(`ITEM USE FAILED: ${e.code || e.message}`); }
  }
  async function equip(itemId) { const s = settings(), item = itemById(s, itemId); if (!item || item.equipmentSlot !== 'weapon') return; try { const result = await mutate((inv, tx, ref) => { if (worldItemCount(inv, itemId) < 1) return { error: `NO ${item.name.toUpperCase()} IN BAG` }; const items = { ...inv.items, [itemId]: worldItemCount(inv, itemId) - 1 }; if (inv.equippedWeapon) items[inv.equippedWeapon] = worldItemCount(inv, inv.equippedWeapon) + 1; tx.update(ref, { items, equippedWeapon: itemId, updatedAt: fs.serverTimestamp() }); return { ok: true }; }); if (result?.error) return message(result.error); message(`${item.name.toUpperCase()} EQUIPPED.`); } catch (e) { message(`EQUIP FAILED: ${e.code || e.message}`); } }
  async function unequip() { try { const result = await mutate((inv, tx, ref) => { if (!inv.equippedWeapon) return { error: 'NO WEAPON EQUIPPED' }; const items = { ...inv.items, [inv.equippedWeapon]: worldItemCount(inv, inv.equippedWeapon) + 1 }; tx.update(ref, { items, equippedWeapon: '', updatedAt: fs.serverTimestamp() }); return { ok: true }; }); if (result?.error) return message(result.error); message('WEAPON RETURNED TO BAG.'); } catch (e) { message(`UNEQUIP FAILED: ${e.code || e.message}`); } }
  async function trade(offerId) { const s = settings(), terminal = terminalById(s, activeTerminalId), offer = terminal?.offers?.find(o => o.id === offerId), item = itemById(s, offer?.itemId); if (!offer || !item) return; try { const result = await mutate((inv, tx, ref) => { const buy = offer.direction === 'buy'; const count = worldItemCount(inv, item.id); if (buy && inv.currencyBalance < offer.price) return { error: `NEED ${offer.price} ${s.currency.name}` }; if (!buy && count < 1) return { error: `NO ${item.name.toUpperCase()} TO SELL` }; const items = { ...inv.items, [item.id]: count + (buy ? 1 : -1) }; const currencyBalance = inv.currencyBalance + (buy ? -offer.price : offer.price); tx.update(ref, { items, currencyBalance, updatedAt: fs.serverTimestamp() }); return { buy, currencyBalance }; }); if (result?.error) return message(result.error); message(`${result.buy ? 'BOUGHT' : 'SOLD'} ${item.name.toUpperCase()} // WORLD-LOCAL ${s.currency.name}.`); render(); } catch (e) { console.error(e); message(`TERMINAL TRADE FAILED: ${e.code || e.message}`); } }
  async function clearOnDeath(deathId = '') { if (!profileId || !deathId) return; try { await mutate((inv, tx, ref) => { if (inv.lastDeathEventId === deathId) return { ok: true }; const items = {}; for (const item of settings().items || []) items[item.id] = 0; const loss = Math.min(inv.currencyBalance, Math.max(0, Number(settings().currency.deathLossCap || 0))); tx.update(ref, { items, equippedWeapon: '', currencyBalance: inv.currencyBalance - loss, lastDeathEventId: deathId, updatedAt: fs.serverTimestamp() }); return { loss }; }); close(); } catch (e) { console.error('World inventory death reset', e); } }
  function refresh() { render(); }
  function getInventory() { return inventory; }
  function getDamageRange() { return worldDamageRange(inventory, settings()); }
  function attackDamage(actionId) { return worldAttackDamage(actionId, inventory, settings()); }
  function destroy() { unsub?.(); overlay?.remove(); unsub = null; overlay = null; }
  return { start, open, openTerminal, close, refresh, getInventory, getDamageRange, attackDamage, clearOnDeath, destroy };
}
