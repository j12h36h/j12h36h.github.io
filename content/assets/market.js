import { auth, db, fs, watchIdentity } from '/game/assets/js/eras-data.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';
import { openOptionPicker } from '/game/assets/js/hosted-option-picker.js?v=1.0.0';
import {
  assetPreviewUrl,
  assetIsTintable,
  assetDefaultTint,
  assetPriceCredits,
  renderAssetCanvas,
  safeAssetTint,
  assetCategory,
  assetDisplayLabel,
  assetCatalogVariantLabel
} from '/game/assets/js/catalog-assets.js?v=1.2.0';

const $ = selector => document.querySelector(selector);
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const safeTint = value => safeAssetTint(value, '#ffffff');

const state = {
  identity: null,
  catalog: { assets: [] },
  asset: null,
  selectedHolding: null,
  inventoryUnsub: null,
  creditUnsub: null,
  creditBalance: 0,
  holdings: [],
  archiveView: false
};

function say(message, tone='') {
  const el = $('#assetFeedback');
  if (!el) return;
  el.textContent = String(message).toUpperCase();
  el.dataset.tone = tone;
}

function assetById(id) {
  return state.catalog.assets.find(asset => asset.id === id) || null;
}

function holdingArchived(holding) {
  return holding?.archived === true;
}

function selectedTint(asset=state.asset) {
  if (!asset) return '#ffffff';
  return assetIsTintable(asset)
    ? safeTint($('#assetTint')?.value || assetDefaultTint(asset))
    : safeTint(assetDefaultTint(asset));
}

function serializedVariantLabel(asset, holding) {
  const stored = String(holding?.tint || '').trim();
  if (!stored) return assetCatalogVariantLabel(asset);

  const kind = assetCategory(asset);

  if (kind === 'Sprite') return stored.toUpperCase();

  if (stored.startsWith('audio|pitch=')) {
    return titleToken(stored.slice('audio|pitch='.length));
  }

  if (stored.startsWith('mode|rule=')) {
    return titleToken(stored.slice('mode|rule='.length));
  }

  if (stored.startsWith('world|skin=')) {
    return titleToken(stored.slice('world|skin='.length));
  }

  if (stored.startsWith('effect|')) {
    const values = parseSerializedVariant(stored);
    return `Size ${values.size || '1.00'} · Light ${values.brightness || '1.00'} · ${String(values.tint || '#ffffff').toUpperCase()}`;
  }

  if (stored.startsWith('icon|')) {
    const values = parseSerializedVariant(stored);
    return `${String(values.primary || '').toUpperCase()} / ${String(values.secondary || '').toUpperCase()} / ${String(values.accent || '').toUpperCase()}`;
  }

  return stored;
}

function parseSerializedVariant(value) {
  const out = {};
  for (const piece of String(value || '').split('|').slice(1)) {
    const index = piece.indexOf('=');
    if (index < 1) continue;
    out[piece.slice(0,index)] = piece.slice(index+1);
  }
  return out;
}

function titleToken(value) {
  return String(value || '')
    .replace(/_/g,' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function currentDisplayLabel() {
  if (!state.asset) return 'Asset';
  if (state.selectedHolding) {
    return assetDisplayLabel(
      state.asset,
      serializedVariantLabel(state.asset, state.selectedHolding)
    );
  }
  return assetDisplayLabel(state.asset);
}

function sameVariant(holding, asset, tint=selectedTint(asset)) {
  if (!holding || !asset || holding.assetId !== asset.id) return false;

  const kind = assetCategory(asset);
  if (kind === 'Sprite' && assetIsTintable(asset)) {
    return safeTint(holding.tint) === safeTint(tint);
  }

  // Website currently edits Sprite tint directly. Other category variants are
  // immutable catalog/default variants until their specialized editor is opened.
  if (kind !== 'Sprite') {
    return String(holding.tint || '') === defaultStorageVariant(asset);
  }

  return true;
}

function defaultStorageVariant(asset) {
  const kind = assetCategory(asset);

  if (kind === 'Audio') {
    return `audio|pitch=${String(asset.pitchName || 'Alto').toLowerCase().replace(/\s+/g,'_')}`;
  }
  if (kind === 'Mode') {
    return `mode|rule=${String(asset.ruleName || 'Highest Score').toLowerCase().replace(/\s+/g,'_')}`;
  }
  if (kind === 'World') {
    return `world|skin=${String(asset.skinName || 'Default').toLowerCase().replace(/\s+/g,'_')}`;
  }
  if (kind === 'Effect') {
    const data = asset.effectData || {};
    return `effect|size=${Number(data.size ?? 1).toFixed(2)}|brightness=${Number(data.brightness ?? 1).toFixed(2)}|tint=${safeTint(data.tint || '#ffffff')}`;
  }
  if (kind === 'Icon') {
    return `icon|primary=${safeTint(asset.primary || '#ffffff')}|secondary=${safeTint(asset.secondary || '#925cff')}|accent=${safeTint(asset.accent || '#64d9ff')}`;
  }

  return assetIsTintable(asset) ? selectedTint(asset) : safeTint(assetDefaultTint(asset));
}

function existingVariant(asset=state.asset, tint=selectedTint(asset)) {
  if (!asset) return null;
  const matches = state.holdings.filter(holding => sameVariant(holding, asset, tint));
  return matches.find(holding => !holdingArchived(holding)) || matches[0] || null;
}

function marketHoldingId(asset, storageValue) {
  const digest = stringHash(storageValue).toString(36);
  return `market__${state.identity.profileId}__${asset.id}__${digest}`.replace(/[^a-zA-Z0-9_.:-]/g,'_');
}

function stringHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function updateObtainState() {
  const asset = state.asset;
  const button = $('#obtainAsset');
  if (!asset || !button) return;

  if (state.selectedHolding) {
    button.disabled = true;
    button.textContent = 'COLLECTION ASSET SELECTED';
    say('This immutable Collection asset is selected in the shared Asset Display.','ok');
    return;
  }

  const price = assetPriceCredits(asset);

  if (!state.identity?.profileId) {
    button.disabled = true;
    button.textContent = 'ADD TO COLLECTION';
    say('Sign in to save ownership to your profile.');
    return;
  }

  if (price > 0) {
    button.disabled = true;
    button.textContent = `◈ ${formatCredits(price)} CREDITS — PRICING LOCKED`;
    say('Paid Asset Library pricing is reserved for a later signed price release.');
    return;
  }

  const existing = existingVariant(asset);
  if (existing) {
    button.disabled = true;
    button.textContent = holdingArchived(existing) ? 'ASSET IN ARCHIVE' : 'ASSET IN COLLECTION';
    say(
      holdingArchived(existing)
        ? 'This exact asset is archived. Restore it from Archive.'
        : 'This exact asset already belongs to your Collection.',
      'ok'
    );
    return;
  }

  button.disabled = false;
  button.textContent = 'ADD TO COLLECTION';
  say(
    assetIsTintable(asset)
      ? 'This tint will be locked permanently when collected.'
      : 'Asset ready to collect.',
    'ok'
  );
}

async function renderSelectedAsset() {
  const asset = state.asset;
  if (!asset) return;

  $('#assetName').textContent = currentDisplayLabel();
  $('#assetDescription').textContent = asset.description || '';
  $('#assetType').textContent = assetCategory(asset).toUpperCase();
  $('#assetTags').innerHTML = (asset.tags || [])
    .slice(0,8)
    .map(tag => `<span>${escapeHtml(String(tag).toUpperCase())}</span>`)
    .join('');

  const price = assetPriceCredits(asset);
  const tag = $('#assetPriceTag');
  tag.textContent = price ? `◈ ${formatCredits(price)} CREDITS` : 'FREE';
  tag.classList.toggle('is-paid', price > 0);

  const tintable = assetIsTintable(asset);
  const tint = state.selectedHolding && assetCategory(asset) === 'Sprite'
    ? safeTint(state.selectedHolding.tint || assetDefaultTint(asset))
    : safeTint(assetDefaultTint(asset));

  $('#assetTint').value = tint;
  $('#assetTintControls').hidden = !tintable || Boolean(state.selectedHolding);

  const canvas = $('#assetCanvas');
  const img = $('#assetImagePreview');

  if (tintable) {
    canvas.hidden = false;
    img.hidden = true;
    await renderAssetCanvas(canvas, asset, tint);
  } else {
    canvas.hidden = true;
    img.hidden = false;
    img.src = assetPreviewUrl(asset);
    img.alt = `${assetDisplayLabel(asset)} preview`;
  }

  updateObtainState();
}

function chooseAsset() {
  openOptionPicker({
    title: 'Select Asset Library asset',
    options: state.catalog.assets.map(asset => ({
      id: asset.id,
      name: assetDisplayLabel(asset),
      description: asset.description || '',
      image: assetPreviewUrl(asset),
      tags: []
    })),
    selected: state.selectedHolding ? '' : (state.asset?.id || ''),
    onSelect: id => {
      const next = assetById(id);
      if (!next) return;
      state.selectedHolding = null;
      state.asset = next;
      renderSelectedAsset().catch(console.error);
      renderCollectionList();
    }
  });
}

async function loadCatalog() {
  const response = await fetch('/public-assets/catalog.json', { cache:'no-store' });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);

  state.catalog = await response.json();
  state.asset = state.catalog.assets?.[0] || null;
  state.selectedHolding = null;

  const assets = state.catalog.assets || [];
  $('#catalogCount').textContent = String(assets.length).padStart(2,'0');

  const counts = { Sprite:0, Audio:0, Mode:0, World:0, Effect:0, Icon:0 };
  for (const asset of assets) {
    const kind = assetCategory(asset);
    if (kind in counts) counts[kind]++;
  }

  $('#spriteAssetCount').textContent = String(counts.Sprite).padStart(2,'0');
  $('#audioAssetCount').textContent = String(counts.Audio).padStart(2,'0');
  $('#modeAssetCount').textContent = String(counts.Mode).padStart(2,'0');
  $('#worldAssetCount').textContent = String(counts.World).padStart(2,'0');
  $('#effectAssetCount').textContent = String(counts.Effect).padStart(2,'0');
  $('#iconAssetCount').textContent = String(counts.Icon).padStart(2,'0');
  $('#gameAssetCount').textContent = String(counts.Mode).padStart(2,'0');

  if (!state.asset) throw new Error('No public assets are available.');

  await renderSelectedAsset();
  if (state.identity?.profileId) watchCollection();
}

function collectionPreview(asset, holding) {
  const wrap = document.createElement('div');
  wrap.className = 'inventory-preview';

  const tint = assetCategory(asset) === 'Sprite'
    ? safeTint(holding.tint || assetDefaultTint(asset))
    : assetDefaultTint(asset);

  if (assetIsTintable(asset)) {
    const canvas = document.createElement('canvas');
    canvas.width = 96;
    canvas.height = 96;
    wrap.appendChild(canvas);
    renderAssetCanvas(canvas, asset, tint).catch(() => {});
  } else {
    const img = document.createElement('img');
    img.src = assetPreviewUrl(asset);
    img.alt = '';
    wrap.appendChild(img);
  }

  return wrap;
}

function updateStorageHeader() {
  const active = state.holdings.filter(item => !holdingArchived(item));
  const archived = state.holdings.filter(holdingArchived);

  $('#ownedCount').textContent = String(active.length).padStart(2,'0');
  $('#inventoryViewCount').textContent = String(active.length).padStart(2,'0');
  $('#archiveCount').textContent = String(archived.length).padStart(2,'0');
  $('#inventoryPanelTitle').textContent = state.archiveView ? 'ASSET ARCHIVE' : 'YOUR COLLECTION';

  $('#inventoryViewButton')?.classList.toggle('is-active', !state.archiveView);
  $('#archiveViewButton')?.classList.toggle('is-active', state.archiveView);
  $('#inventoryViewButton')?.setAttribute('aria-selected', String(!state.archiveView));
  $('#archiveViewButton')?.setAttribute('aria-selected', String(state.archiveView));

  const note = $('#inventoryArchiveNote');
  if (note) {
    note.textContent = state.archiveView
      ? 'ARCHIVED ASSETS ARE RECOVERABLE BUT CANNOT BE USED OR TRADED.'
      : 'ARCHIVING HIDES AN ASSET WITHOUT DESTROYING IT.';
  }
}

async function setHoldingArchived(item, archived) {
  if (!state.identity?.profileId || item.ownerProfileId !== state.identity.profileId) {
    return say('That holding does not belong to this profile.','error');
  }

  try {
    await fs.updateDoc(fs.doc(db,'assetHoldings',item.id), {
      archived,
      archivedAt: archived ? fs.serverTimestamp() : null,
      updatedAt: fs.serverTimestamp()
    });
    say(archived ? 'Asset moved to your recoverable Archive.' : 'Asset restored to your Collection.','ok');
  } catch (error) {
    console.error('Asset archive', error);
    say(`Could not ${archived ? 'archive' : 'restore'} asset: ${error.code || error.message}`,'error');
  }
}

function selectCollectionHolding(item, asset) {
  state.selectedHolding = item;
  state.asset = asset;
  renderSelectedAsset().catch(console.error);
  renderCollectionList();
  say(`${assetDisplayLabel(asset, serializedVariantLabel(asset,item))} selected from Collection.`,'ok');
}

function renderCollectionList() {
  const list = $('#inventoryList');
  if (!list) return;

  updateStorageHeader();
  list.innerHTML = '';

  if (!state.identity?.profileId) {
    list.innerHTML = '<p class="inventory-empty">SIGN IN TO LOAD YOUR COLLECTION.</p>';
    return;
  }

  const items = state.holdings.filter(item => holdingArchived(item) === state.archiveView);

  if (!items.length) {
    list.innerHTML = `<p class="inventory-empty">${state.archiveView ? 'NO ARCHIVED ASSETS.' : 'NO ASSETS COLLECTED YET.'}</p>`;
    return;
  }

  for (const item of items) {
    const asset = assetById(item.assetId) || {
      id:item.assetId,
      name:item.assetId,
      type:'sprite',
      category:'sprites',
      defaultTint:'#ffffff',
      tintable:false
    };

    const selected = state.selectedHolding?.id === item.id;
    const row = document.createElement('article');
    row.className = `inventory-item${holdingArchived(item) ? ' is-archived' : ''}${selected ? ' is-selected' : ''}`;

    const preview = collectionPreview(asset, item);
    const copy = document.createElement('div');
    copy.className = 'inventory-copy';

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'inventory-select';
    select.textContent = assetDisplayLabel(asset, serializedVariantLabel(asset,item));
    select.addEventListener('click', () => selectCollectionHolding(item, asset));

    const meta = document.createElement('small');
    meta.textContent = holdingArchived(item)
      ? 'ARCHIVED // RECOVERABLE'
      : 'OWNED // TRADEABLE';

    const action = document.createElement('button');
    action.type = 'button';
    action.className = holdingArchived(item) ? 'inventory-restore' : 'inventory-archive';
    action.textContent = holdingArchived(item) ? 'RESTORE' : 'ARCHIVE';
    action.addEventListener('click', event => {
      event.stopPropagation();
      setHoldingArchived(item, !holdingArchived(item));
    });

    copy.append(select, meta, action);
    row.append(preview, copy);
    list.appendChild(row);
  }
}

function watchCollection() {
  state.inventoryUnsub?.();
  state.holdings = [];
  renderCollectionList();

  if (!state.identity?.profileId) {
    $('#obtainAsset').disabled = true;
    say('Sign in to save ownership to your profile.');
    return;
  }

  const ref = fs.query(
    fs.collection(db,'assetHoldings'),
    fs.where('ownerProfileId','==',state.identity.profileId),
    fs.limit(200)
  );

  state.inventoryUnsub = fs.onSnapshot(ref, snapshot => {
    state.holdings = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() }));

    if (state.selectedHolding) {
      state.selectedHolding = state.holdings.find(item => item.id === state.selectedHolding.id) || null;
    }

    renderCollectionList();
    updateObtainState();
  }, error => {
    console.error('Collection subscription', error);
    const list = $('#inventoryList');
    if (list) list.innerHTML = '<p class="inventory-empty">COLLECTION COULD NOT BE LOADED.</p>';
    say(`Collection error: ${error.code || error.message}`,'error');
  });
}

function watchCredits() {
  state.creditUnsub?.();
  state.creditBalance = 0;
  const el = $('#marketCreditBalance');

  if (!state.identity?.profileId) {
    if (el) el.textContent = '00';
    return;
  }

  state.creditUnsub = watchCreditWallet(
    db,
    fs,
    state.identity.profileId,
    balance => {
      state.creditBalance = balance;
      if (el) el.textContent = formatCredits(balance);
    },
    error => console.debug('Asset Library credit wallet', error?.code || error)
  );
}

async function obtainAsset() {
  if (!state.identity?.profileId || !auth.currentUser) {
    return say('Sign in with Google first.','error');
  }

  if (state.selectedHolding) {
    return say('A Collection holding is selected. Choose a Browse asset first.','error');
  }

  const asset = state.asset;
  if (!asset) return;

  if (assetPriceCredits(asset) > 0) {
    return say('Paid Asset Library pricing is not enabled for this release.','error');
  }

  const storageValue = assetCategory(asset) === 'Sprite'
    ? (assetIsTintable(asset) ? selectedTint(asset) : safeTint(assetDefaultTint(asset)))
    : defaultStorageVariant(asset);

  const existing = existingVariant(asset);
  if (existing) {
    return say(
      holdingArchived(existing)
        ? 'This exact asset is archived. Restore it instead of collecting a duplicate.'
        : 'This exact asset variant is already in your Collection.',
      'ok'
    );
  }

  try {
    const ref = fs.doc(db,'assetHoldings',marketHoldingId(asset,storageValue));
    await fs.setDoc(ref, {
      ownerProfileId:state.identity.profileId,
      assetId:asset.id,
      tint:storageValue,
      acquiredAt:fs.serverTimestamp(),
      updatedAt:fs.serverTimestamp(),
      lastEventId:'',
      lastEventType:'market_acquire',
      archived:false,
      archivedAt:null
    });

    say(`${assetDisplayLabel(asset)} added to your Collection as an immutable tradeable holding.`,'ok');
  } catch (error) {
    console.error('Collect asset', error);
    say(`Could not collect asset: ${error.code || error.message}`,'error');
  }
}

function setArchiveView(archive) {
  state.archiveView = archive === true;
  renderCollectionList();
}

$('#chooseAsset')?.addEventListener('click', chooseAsset);

$('#assetTint')?.addEventListener('input', event => {
  if (state.selectedHolding) return;
  renderAssetCanvas($('#assetCanvas'), state.asset, event.target.value).catch(console.error);
  $('#assetName').textContent = assetDisplayLabel(state.asset, String(event.target.value).toUpperCase());
  updateObtainState();
});

document.querySelectorAll('[data-tint]').forEach(button => {
  button.addEventListener('click', () => {
    if (state.selectedHolding) return;
    $('#assetTint').value = button.dataset.tint;
    renderAssetCanvas($('#assetCanvas'), state.asset, button.dataset.tint).catch(console.error);
    $('#assetName').textContent = assetDisplayLabel(state.asset, String(button.dataset.tint).toUpperCase());
    updateObtainState();
  });
});

$('#obtainAsset')?.addEventListener('click', obtainAsset);
$('#inventoryViewButton')?.addEventListener('click', () => setArchiveView(false));
$('#archiveViewButton')?.addEventListener('click', () => setArchiveView(true));

watchIdentity(identity => {
  state.identity = identity;
  watchCollection();
  watchCredits();
});

loadCatalog().catch(error => {
  console.error(error);
  say(`Asset Library failed to load: ${error.message}`,'error');
});
