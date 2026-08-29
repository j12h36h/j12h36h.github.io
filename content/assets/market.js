import { auth, db, fs, watchIdentity } from '/game/assets/js/eras-data.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';

const $ = s => document.querySelector(s);
const state = { identity: null, catalog: null, asset: null, inventoryUnsub: null, creditUnsub: null, creditBalance: 0, image: null };

function say(message, tone='') {
  const el = $('#assetFeedback');
  if (!el) return;
  el.textContent = String(message).toUpperCase();
  el.dataset.tone = tone;
}

async function loadCatalog() {
  const response = await fetch('/public-assets/catalog.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  state.catalog = await response.json();
  state.asset = state.catalog.assets?.[0] || null;
  $('#catalogCount').textContent = String(state.catalog.assets?.length || 0).padStart(2, '0');
  if (!state.asset) throw new Error('No public assets are available.');
  $('#assetName').textContent = state.asset.name;
  $('#assetDescription').textContent = state.asset.description;
  $('#assetTint').value = state.asset.defaultTint;
  state.image = new Image();
  state.image.src = state.asset.source;
  await state.image.decode();
  renderTint($('#assetTint').value, $('#assetCanvas'));
  if (state.identity?.profileId) watchInventory();
}

function renderTint(tint, canvas) {
  if (!state.image || !canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(state.image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
}

function inventoryCanvas(tint) {
  const canvas = document.createElement('canvas');
  canvas.width = 96; canvas.height = 96;
  requestAnimationFrame(() => renderTint(tint, canvas));
  return canvas;
}


function watchCredits() {
  state.creditUnsub?.();
  state.creditBalance = 0;
  const el = $('#marketCreditBalance');
  if (!state.identity?.profileId) {
    if (el) el.textContent = '00';
    return;
  }
  state.creditUnsub = watchCreditWallet(db, fs, state.identity.profileId, balance => {
    state.creditBalance = balance;
    if (el) el.textContent = formatCredits(balance);
  }, error => console.debug('Marketplace credit wallet', error?.code || error));
}

function watchInventory() {
  state.inventoryUnsub?.();
  const list = $('#inventoryList');
  if (!state.identity?.profileId) {
    list.innerHTML = '<p class="inventory-empty">SIGN IN TO LOAD YOUR ASSETS.</p>';
    $('#ownedCount').textContent = '00';
    $('#obtainAsset').disabled = true;
    say('Sign in to save ownership to your profile.');
    return;
  }
  $('#obtainAsset').disabled = false;
  const inventoryRef = fs.collection(db, 'assetInventory', state.identity.profileId, 'items');
  state.inventoryUnsub = fs.onSnapshot(inventoryRef, snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    $('#ownedCount').textContent = String(items.length).padStart(2, '0');
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<p class="inventory-empty">NO ASSETS OBTAINED YET.</p>';
      $('#obtainAsset').textContent = 'ADD TO ASSET INVENTORY';
      return;
    }
    for (const item of items) {
      const asset = state.catalog?.assets?.find(a => a.id === item.assetId) || state.asset;
      const row = document.createElement('article');
      row.className = 'inventory-item';
      const preview = inventoryCanvas(item.tint || asset?.defaultTint || '#ffffff');
      const copy = document.createElement('div');
      copy.className = 'inventory-copy';
      copy.innerHTML = `<strong>${asset?.name || item.assetId}</strong><small>OWNED // ${asset?.type?.toUpperCase() || 'ASSET'}</small><label>TINT <input type="color" value="${item.tint || asset?.defaultTint || '#ffffff'}" aria-label="Inventory tint"></label>`;
      const input = copy.querySelector('input');
      input.addEventListener('input', () => renderTint(input.value, preview));
      input.addEventListener('change', async () => {
        try {
          await fs.updateDoc(fs.doc(db, 'assetInventory', state.identity.profileId, 'items', item.id), { tint: input.value, updatedAt: fs.serverTimestamp() });
          say('Inventory tint saved.', 'ok');
        } catch (error) {
          console.error(error); say('Could not save tint.', 'error');
        }
      });
      row.append(preview, copy); list.appendChild(row);
    }
    const ownsSelected = items.some(item => item.assetId === state.asset?.id);
    $('#obtainAsset').textContent = ownsSelected ? 'ASSET IN INVENTORY' : 'ADD TO ASSET INVENTORY';
  }, error => {
    console.error('Inventory subscription', error);
    list.innerHTML = '<p class="inventory-empty">INVENTORY COULD NOT BE LOADED.</p>';
    say(`Inventory error: ${error.code || error.message}`, 'error');
  });
}

async function obtainAsset() {
  if (!state.identity?.profileId || !auth.currentUser) {
    say('Sign in with Google first.', 'error'); return;
  }
  const asset = state.asset;
  if (!asset) return;
  const tint = $('#assetTint').value;
  const ref = fs.doc(db, 'assetInventory', state.identity.profileId, 'items', asset.id.replace(/[^a-zA-Z0-9_-]/g, '_'));
  try {
    const existing = await fs.getDoc(ref);
    if (existing.exists()) {
      await fs.updateDoc(ref, { tint, updatedAt: fs.serverTimestamp() });
      say('Asset already owned. Tint updated.', 'ok');
    } else {
      await fs.setDoc(ref, {
        assetId: asset.id,
        profileId: state.identity.profileId,
        tint,
        acquiredAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp()
      });
      say('Monochrome Slime added to your asset inventory.', 'ok');
    }
  } catch (error) {
    console.error('Obtain asset', error);
    say(`Could not obtain asset: ${error.code || error.message}`, 'error');
  }
}

$('#assetTint').addEventListener('input', event => renderTint(event.target.value, $('#assetCanvas')));
document.querySelectorAll('[data-tint]').forEach(button => button.addEventListener('click', () => {
  $('#assetTint').value = button.dataset.tint;
  renderTint(button.dataset.tint, $('#assetCanvas'));
}));
$('#obtainAsset').addEventListener('click', obtainAsset);

watchIdentity(identity => { state.identity = identity; watchInventory(); watchCredits(); });
loadCatalog().catch(error => { console.error(error); say(`Marketplace failed to load: ${error.message}`, 'error'); });
