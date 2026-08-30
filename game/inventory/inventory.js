import {
  GAME_ITEMS,
  BAG_ITEM_IDS,
  WEAPON_IDS,
  emptyGameInventory,
  normalizeGameInventory,
  inventoryZeroPatch,
  itemCount,
  damageRange
} from './items.js?v=1.9.2';
import { terminalMeta, terminalOffer } from './terminals.js?v=1.9.2';

export const GAME_INVENTORY_COLLECTION = 'gameInventories';
export const GAME_ITEM_TRANSACTION_COLLECTION = 'gameItemTransactions';

export function gameInventoryRef(db, fs, profileId) {
  return fs.doc(db, GAME_INVENTORY_COLLECTION, profileId);
}

export async function ensureGameInventory(db, fs, profileId) {
  if (!profileId) return null;
  const ref = gameInventoryRef(db, fs, profileId);
  await fs.runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, {
      ...emptyGameInventory(profileId),
      createdAt: fs.serverTimestamp(),
      updatedAt: fs.serverTimestamp()
    });
  });
  return ref;
}

export async function readGameInventory(db, fs, profileId) {
  const ref = await ensureGameInventory(db, fs, profileId);
  if (!ref) return emptyGameInventory(profileId);
  const snap = await fs.getDoc(ref);
  return normalizeGameInventory(snap.exists() ? snap.data() : {}, profileId);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
}

function itemIcon(item) {
  if (item?.texture) return `<img src="${escapeHtml(item.texture)}" alt="" draggable="false">`;
  if (item?.id === 'stick') return '<span class="game-stick-icon" aria-hidden="true"></span>';
  return '<span class="game-generic-item-icon" aria-hidden="true">◇</span>';
}

function transactionId(profileId, kind) {
  const random = crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return `${profileId}__${kind}__${random}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
}

export function createGameInventoryController({
  db,
  fs,
  getProfileId,
  getCreditBalance,
  getHp,
  maxHp,
  getPresenceRef,
  message = () => {},
  onHpChanged = () => {},
  onInventoryChanged = () => {}
}) {
  let profileId = '';
  let inventory = emptyGameInventory('');
  let unsub = null;
  let mode = 'equipment';
  let activeTerminalId = '';
  let overlay = null;

  function ensureOverlay() {
    if (overlay?.isConnected) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'game-inventory-overlay';
    overlay.id = 'gameInventoryOverlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <section class="game-inventory-modal" role="dialog" aria-modal="true" aria-labelledby="gameInventoryTitle">
        <header class="game-inventory-header">
          <div><small>GAME INVENTORY // DEATH-CLEARED</small><h2 id="gameInventoryTitle">INVENTORY</h2></div>
          <div class="game-inventory-wallet">◈ <b data-game-inventory-credits>0</b> CREDITS</div>
          <button type="button" class="game-inventory-close" data-game-inventory-close aria-label="Close inventory">×</button>
        </header>
        <div class="game-inventory-columns">
          <section class="game-inventory-left" data-game-inventory-left></section>
          <section class="game-inventory-bag" data-game-inventory-bag></section>
        </div>
        <footer>GAME ITEMS NEVER ENTER ASSET INVENTORY // ALL GAME ITEMS AND EQUIPMENT CLEAR ON DEATH</footer>
      </section>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay || event.target.closest('[data-game-inventory-close]')) close();
    });
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });
    overlay.addEventListener('click', event => {
      const actionNode = event.target.closest('[data-game-action]');
      const action = actionNode?.dataset.gameAction || '';
      const itemId = event.target.closest('[data-game-item]')?.dataset.gameItem || '';
      if (!action) return;
      if (action === 'use-item') useItem(itemId);
      if (action === 'equip') equipWeapon(itemId);
      if (action === 'unequip') unequipWeapon();
      if (action === 'terminal-trade') terminalTrade(actionNode?.dataset.terminalOffer || '');
    });
    return overlay;
  }

  function renderEquipment() {
    const weapon = GAME_ITEMS[inventory.equippedWeapon] || null;
    const range = damageRange(inventory);
    const weaponCopy = weapon
      ? `<div class="game-equipment-card"><div class="game-item-icon">${itemIcon(weapon)}</div><div><small>WEAPON</small><b>${escapeHtml(weapon.name)}</b><span>DAMAGE ${range.min}–${range.max}</span></div><button type="button" data-game-action="unequip">UNEQUIP</button></div>`
      : `<div class="game-equipment-card is-empty"><div class="game-item-icon"><span class="game-fist-icon">✦</span></div><div><small>WEAPON</small><b>BARE HANDS</b><span>DAMAGE 1–1</span></div></div>`;
    return `
      <div class="game-pane-heading"><small>LEFT PANE</small><h3>EQUIPMENT</h3></div>
      <div class="game-equipment-slot">${weaponCopy}</div>
      <div class="game-equipment-stats"><span>ATTACK RANGE</span><b>${range.min}–${range.max}</b><small>${escapeHtml(range.label.toUpperCase())}</small></div>
      <p class="game-pane-note">Equip weapons from the Bag. Equipped gear is part of the game inventory and is lost on death.</p>`;
  }

  function terminalButton(offer, credits) {
    const item = GAME_ITEMS[offer.itemId];
    if (!item) return '';
    const price = Math.max(1, Math.floor(Number(offer.price) || 0));
    const isBuy = offer.direction === 'buy';
    const disabled = isBuy ? credits < price : itemCount(inventory, offer.itemId) < 1;
    const priceText = isBuy ? `BUY ${price}C` : `SELL +${price}C`;
    return `<button class="terminal-trade-row" type="button" data-game-action="terminal-trade" data-terminal-offer="${escapeHtml(offer.id)}" data-game-item="${escapeHtml(offer.itemId)}" ${disabled ? 'disabled' : ''}>
      <span class="game-item-icon">${itemIcon(item)}</span><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></span><strong>${priceText}</strong>
    </button>`;
  }

  function renderTerminal() {
    const terminal = terminalMeta(activeTerminalId);
    if (!terminal) return renderEquipment();
    const credits = Math.max(0, Math.floor(Number(getCreditBalance?.()) || 0));
    const offers = terminal.offers.map(offer => terminalButton(offer, credits)).filter(Boolean).join('');
    const rules = terminal.offers.map(offer => {
      const item = GAME_ITEMS[offer.itemId];
      if (!item) return '';
      const verb = offer.direction === 'buy' ? 'buy' : 'sell';
      const sign = offer.direction === 'sell' ? '+' : '';
      return `<span>${escapeHtml(item.name)}: ${verb} ${sign}${offer.price}C</span>`;
    }).join('');
    return `
      <div class="game-pane-heading"><small>${escapeHtml(terminal.subtitle || terminal.name)}</small><h3>TERMINAL TRADE</h3></div>
      <div class="terminal-trade-list">${offers || '<div class="game-terminal-empty">NO OFFERS AVAILABLE</div>'}</div>
      <div class="game-terminal-rules"><b>GAME ECONOMY ONLY</b>${rules}</div>`;
  }

  function renderBagItem(itemId) {
    const item = GAME_ITEMS[itemId];
    if (!item) return '';
    const count = itemCount(inventory, itemId);
    if (count < 1) return '';
    let action = '';
    if (item.use?.type) {
      const blocked = item.use.type === 'heal' && Number(getHp?.() || 0) >= maxHp;
      action = `<button type="button" data-game-action="use-item" ${blocked ? 'disabled' : ''}>${escapeHtml(item.use.label || 'USE')}</button>`;
    } else if (WEAPON_IDS.includes(itemId)) {
      action = '<button type="button" data-game-action="equip">EQUIP</button>';
    }
    return `<article class="game-bag-item" data-game-item="${escapeHtml(itemId)}">
      <div class="game-item-icon">${itemIcon(item)}</div>
      <div class="game-bag-copy"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.description)}</small></div>
      <strong>×${count}</strong>${action}
    </article>`;
  }

  function renderBag() {
    const rows = BAG_ITEM_IDS.map(renderBagItem).filter(Boolean);
    return `
      <div class="game-pane-heading"><small>RIGHT PANE</small><h3>BAG</h3></div>
      <div class="game-bag-grid">${rows.length ? rows.join('') : '<div class="game-bag-empty"><b>BAG EMPTY</b><span>Items appear here when acquired.</span></div>'}</div>`;
  }

  function render() {
    const root = ensureOverlay();
    const terminal = mode === 'terminal' ? terminalMeta(activeTerminalId) : null;
    root.querySelector('#gameInventoryTitle').textContent = terminal?.name || 'INVENTORY';
    root.querySelector('[data-game-inventory-left]').innerHTML = terminal ? renderTerminal() : renderEquipment();
    root.querySelector('[data-game-inventory-bag]').innerHTML = renderBag();
    const creditNode = root.querySelector('[data-game-inventory-credits]');
    if (creditNode) creditNode.textContent = Math.max(0, Math.floor(Number(getCreditBalance?.()) || 0)).toLocaleString();
    onInventoryChanged(inventory);
  }

  async function start(nextProfileId) {
    profileId = String(nextProfileId || getProfileId?.() || '');
    if (!profileId) return inventory;
    const ref = await ensureGameInventory(db, fs, profileId);
    const snap = await fs.getDoc(ref);
    inventory = normalizeGameInventory(snap.exists() ? snap.data() : {}, profileId);
    render();
    unsub?.();
    unsub = fs.onSnapshot(ref, snap2 => {
      if (!snap2.exists()) return;
      inventory = normalizeGameInventory(snap2.data(), profileId);
      render();
    }, error => console.debug('Game inventory', error?.code || error));
    return inventory;
  }

  function open(nextMode = 'equipment', contextId = '') {
    if (nextMode === 'terminal') {
      const terminal = terminalMeta(contextId);
      if (!terminal) return false;
      mode = 'terminal';
      activeTerminalId = terminal.id;
    } else {
      mode = 'equipment';
      activeTerminalId = '';
    }
    const root = ensureOverlay();
    render();
    root.hidden = false;
    document.body.classList.add('game-inventory-open');
    setTimeout(() => root.querySelector('[data-game-inventory-close]')?.focus(), 0);
    return true;
  }

  function openTerminal(terminalId = '') {
    return open('terminal', terminalId);
  }

  function close() {
    const root = ensureOverlay();
    root.hidden = true;
    document.body.classList.remove('game-inventory-open');
    mode = 'equipment';
    activeTerminalId = '';
  }

  async function useItem(itemId) {
    const item = GAME_ITEMS[itemId];
    if (!profileId || !item?.use) return;
    if (item.use.type !== 'heal') return message(`${item.name.toUpperCase()} CANNOT BE USED YET.`);
    const invRef = gameInventoryRef(db, fs, profileId);
    const presenceRef = getPresenceRef?.();
    if (!presenceRef) return;
    const eventId = transactionId(profileId, `use_${itemId}`);
    const healAmount = Math.max(1, Math.floor(Number(item.use.amount) || 0));
    try {
      const result = await fs.runTransaction(db, async tx => {
        const [invSnap, presenceSnap] = await Promise.all([tx.get(invRef), tx.get(presenceRef)]);
        if (!invSnap.exists() || !presenceSnap.exists()) return { error: 'GAME STATE UNAVAILABLE' };
        const inv = normalizeGameInventory(invSnap.data(), profileId);
        const presence = presenceSnap.data();
        const hpBefore = Math.max(0, Math.min(maxHp, Number(presence.hp || 0)));
        if (itemCount(inv, itemId) < 1) return { error: `NO ${item.name.toUpperCase()}` };
        if (hpBefore >= maxHp) return { error: 'HEALTH ALREADY FULL' };
        const hpAfter = Math.min(maxHp, hpBefore + healAmount);
        tx.update(invRef, {
          [item.inventoryField]: itemCount(inv, itemId) - 1,
          lastEventId: eventId,
          lastEventType: 'consume_potion',
          updatedAt: fs.serverTimestamp()
        });
        tx.update(presenceRef, { hp: hpAfter, updatedAt: fs.serverTimestamp() });
        return { hpBefore, hpAfter };
      });
      if (result?.error) return message(result.error);
      onHpChanged(result.hpAfter);
      message(`${item.name.toUpperCase()} USED // +${result.hpAfter - result.hpBefore} HP.`);
    } catch (error) {
      console.error('Use game item', error);
      message(`ITEM USE FAILED: ${error.code || error.message}`);
    }
  }

  async function equipWeapon(itemId) {
    if (!profileId || !WEAPON_IDS.includes(itemId)) return;
    const invRef = gameInventoryRef(db, fs, profileId);
    const eventId = transactionId(profileId, 'equip');
    try {
      const result = await fs.runTransaction(db, async tx => {
        const snap = await tx.get(invRef);
        if (!snap.exists()) return { error: 'INVENTORY UNAVAILABLE' };
        const inv = normalizeGameInventory(snap.data(), profileId);
        if (inv.equippedWeapon === itemId) return { error: `${GAME_ITEMS[itemId].name.toUpperCase()} ALREADY EQUIPPED` };
        const selected = GAME_ITEMS[itemId];
        if (itemCount(inv, itemId) < 1) return { error: `NO ${selected.name.toUpperCase()} IN BAG` };
        const patch = {
          [selected.inventoryField]: itemCount(inv, itemId) - 1,
          equippedWeapon: itemId,
          lastEventId: eventId,
          lastEventType: 'equip',
          updatedAt: fs.serverTimestamp()
        };
        if (inv.equippedWeapon) {
          const previous = GAME_ITEMS[inv.equippedWeapon];
          if (previous) patch[previous.inventoryField] = itemCount(inv, previous.id) + 1;
        }
        tx.update(invRef, patch);
        return { ok: true, name: selected.name };
      });
      if (result?.error) return message(result.error);
      message(`${result.name.toUpperCase()} EQUIPPED.`);
    } catch (error) {
      console.error('Equip weapon', error);
      message(`EQUIP FAILED: ${error.code || error.message}`);
    }
  }

  async function unequipWeapon() {
    if (!profileId) return;
    const invRef = gameInventoryRef(db, fs, profileId);
    const eventId = transactionId(profileId, 'unequip');
    try {
      const result = await fs.runTransaction(db, async tx => {
        const snap = await tx.get(invRef);
        if (!snap.exists()) return { error: 'INVENTORY UNAVAILABLE' };
        const inv = normalizeGameInventory(snap.data(), profileId);
        if (!inv.equippedWeapon) return { error: 'NO WEAPON EQUIPPED' };
        const previous = GAME_ITEMS[inv.equippedWeapon];
        if (!previous) return { error: 'EQUIPPED ITEM UNAVAILABLE' };
        tx.update(invRef, {
          [previous.inventoryField]: itemCount(inv, previous.id) + 1,
          equippedWeapon: '',
          lastEventId: eventId,
          lastEventType: 'equip',
          updatedAt: fs.serverTimestamp()
        });
        return { ok: true, name: previous.name };
      });
      if (result?.error) return message(result.error);
      message(`${result.name.toUpperCase()} RETURNED TO BAG.`);
    } catch (error) {
      console.error('Unequip weapon', error);
      message(`UNEQUIP FAILED: ${error.code || error.message}`);
    }
  }

  async function terminalTrade(offerId) {
    if (!profileId || mode !== 'terminal' || !activeTerminalId) return;
    const offer = terminalOffer(activeTerminalId, offerId);
    const item = GAME_ITEMS[offer?.itemId];
    const isBuy = offer?.direction === 'buy';
    const price = Math.max(0, Math.floor(Number(offer?.price) || 0));
    if (!offer || !item || !['buy', 'sell'].includes(offer.direction) || price < 1) return;
    const invRef = gameInventoryRef(db, fs, profileId);
    const walletRef = fs.doc(db, 'creditWallets', profileId);
    const tradeId = transactionId(profileId, `${activeTerminalId}_${offer.direction}_${offer.itemId}`);
    const receiptRef = fs.doc(db, GAME_ITEM_TRANSACTION_COLLECTION, tradeId);
    try {
      const result = await fs.runTransaction(db, async tx => {
        const [invSnap, walletSnap, receiptSnap] = await Promise.all([tx.get(invRef), tx.get(walletRef), tx.get(receiptRef)]);
        if (!invSnap.exists() || !walletSnap.exists() || receiptSnap.exists()) return { error: 'TRADE STATE UNAVAILABLE' };
        const inv = normalizeGameInventory(invSnap.data(), profileId);
        const wallet = walletSnap.data();
        const balance = Math.max(0, Math.floor(Number(wallet.balance || 0)));
        if (isBuy && balance < price) return { error: `NEED ${price} CREDITS` };
        if (!isBuy && itemCount(inv, item.id) < 1) return { error: `NO ${item.name.toUpperCase()} TO SELL` };
        const nextBalance = isBuy ? balance - price : balance + price;
        const nextCount = itemCount(inv, item.id) + (isBuy ? 1 : -1);
        tx.set(receiptRef, {
          profileId,
          direction: offer.direction,
          itemId: item.id,
          quantity: 1,
          credits: price,
          createdAt: fs.serverTimestamp()
        });
        tx.update(walletRef, {
          balance: nextBalance,
          totalEarned: Math.max(0, Number(wallet.totalEarned || 0)),
          totalLost: Math.max(0, Number(wallet.totalLost || 0)),
          lastEventId: tradeId,
          lastEventType: 'game_item_trade',
          updatedAt: fs.serverTimestamp()
        });
        tx.update(invRef, {
          [item.inventoryField]: nextCount,
          lastEventId: tradeId,
          lastEventType: isBuy ? 'terminal_buy' : 'terminal_sell',
          updatedAt: fs.serverTimestamp()
        });
        return { ok: true, nextBalance };
      });
      if (result?.error) return message(result.error);
      message(`${isBuy ? 'BOUGHT' : 'SOLD'} ${item.name.toUpperCase()} // ${isBuy ? '-' : '+'}${price} CREDIT${price === 1 ? '' : 'S'}.`);
      render();
    } catch (error) {
      console.error('Terminal trade', error);
      message(`TERMINAL TRADE FAILED: ${error.code || error.message}`);
    }
  }

  async function clearOnDeath(eventId = '') {
    if (!profileId || !eventId) return;
    const invRef = gameInventoryRef(db, fs, profileId);
    try {
      await fs.runTransaction(db, async tx => {
        const snap = await tx.get(invRef);
        if (!snap.exists()) return;
        const inv = normalizeGameInventory(snap.data(), profileId);
        if (inv.lastDeathEventId === eventId) return;
        tx.update(invRef, {
          ...inventoryZeroPatch(),
          equippedWeapon: '',
          lastEventId: eventId,
          lastEventType: 'death',
          lastDeathEventId: eventId,
          updatedAt: fs.serverTimestamp()
        });
      });
      close();
    } catch (error) {
      console.error('Game inventory death reset', error);
    }
  }

  function refresh() { render(); }
  function getInventory() { return inventory; }
  function destroy() { unsub?.(); unsub = null; overlay?.remove(); overlay = null; }

  return { start, open, openTerminal, close, refresh, getInventory, clearOnDeath, destroy };
}
