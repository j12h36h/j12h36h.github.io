import { auth, db, fs, watchIdentity } from '/game/assets/js/eras-data.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';

const $ = s => document.querySelector(s);
const escapeHtml = (value='') => String(value).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const safeTint = value => /^#[0-9a-fA-F]{6}$/.test(String(value||'')) ? String(value) : '#ffffff';
const state = { identity: null, catalog: null, asset: null, inventoryUnsub: null, creditUnsub: null, creditBalance: 0, image: null, holdings: [] };

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

async function migrateLegacyInventory() {
  if (!state.identity?.profileId) return;
  try {
    const legacy = await fs.getDocs(fs.collection(db, 'assetInventory', state.identity.profileId, 'items'));
    for (const d of legacy.docs) {
      const item = d.data();
      const holdingRef = fs.doc(db, 'assetHoldings', `legacy_${state.identity.profileId}_${d.id}`);
      const existing = await fs.getDoc(holdingRef);
      if (existing.exists()) continue;
      await fs.setDoc(holdingRef, {
        ownerProfileId: state.identity.profileId,
        assetId: item.assetId,
        tint: item.tint || '#ffffff',
        acquiredAt: item.acquiredAt || fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
        lastEventId: 'legacy-migration',
        lastEventType: 'migration'
      });
    }
  } catch (error) {
    console.debug('Legacy asset migration', error?.code || error);
  }
}

function watchInventory() {
  state.inventoryUnsub?.();
  const list = $('#inventoryList');
  state.holdings = [];
  if (!state.identity?.profileId) {
    list.innerHTML = '<p class="inventory-empty">SIGN IN TO LOAD YOUR ASSETS.</p>';
    $('#ownedCount').textContent = '00';
    $('#obtainAsset').disabled = true;
    say('Sign in to save ownership to your profile.');
    return;
  }
  $('#obtainAsset').disabled = false;
  const inventoryRef = fs.query(fs.collection(db, 'assetHoldings'), fs.where('ownerProfileId', '==', state.identity.profileId), fs.limit(200));
  state.inventoryUnsub = fs.onSnapshot(inventoryRef, snapshot => {
    const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    state.holdings = items;
    $('#ownedCount').textContent = String(items.length).padStart(2, '0');
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<p class="inventory-empty">NO ASSETS OBTAINED YET.</p>';
      $('#obtainAsset').textContent = 'ADD TO ASSET INVENTORY';
    }
    for (const item of items) {
      const asset = state.catalog?.assets?.find(a => a.id === item.assetId) || state.asset;
      const row = document.createElement('article');
      row.className = 'inventory-item';
      const preview = inventoryCanvas(item.tint || asset?.defaultTint || '#ffffff');
      const copy = document.createElement('div');
      copy.className = 'inventory-copy';
      copy.innerHTML = `<strong>${escapeHtml(asset?.name || item.assetId)}</strong><small>OWNED // ${escapeHtml(asset?.type?.toUpperCase() || 'ASSET')} // TRADEABLE</small><label>TINT <input type="color" value="${safeTint(item.tint || asset?.defaultTint)}" aria-label="Inventory tint"></label>`;
      const input = copy.querySelector('input');
      input.addEventListener('input', () => renderTint(input.value, preview));
      input.addEventListener('change', async () => {
        try {
          await fs.updateDoc(fs.doc(db, 'assetHoldings', item.id), { tint: input.value, updatedAt: fs.serverTimestamp() });
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
  migrateLegacyInventory().catch(console.debug);
}

async function obtainAsset() {
  if (!state.identity?.profileId || !auth.currentUser) {
    say('Sign in with Google first.', 'error'); return;
  }
  const asset = state.asset;
  if (!asset) return;
  const tint = $('#assetTint').value;
  try {
    const existing = state.holdings.find(item => item.assetId === asset.id);
    if (existing) {
      await fs.updateDoc(fs.doc(db, 'assetHoldings', existing.id), { tint, updatedAt: fs.serverTimestamp() });
      say('Asset already owned. Tint updated.', 'ok');
    } else {
      const holdingRef = fs.doc(db, 'assetHoldings', crypto.randomUUID());
      await fs.setDoc(holdingRef, {
        ownerProfileId: state.identity.profileId,
        assetId: asset.id,
        tint,
        acquiredAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
        lastEventId: '',
        lastEventType: 'market_acquire'
      });
      say('Monochrome Slime added to your tradeable asset inventory.', 'ok');
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
