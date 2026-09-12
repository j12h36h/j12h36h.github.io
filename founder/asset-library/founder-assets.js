import {
  auth,
  watchIdentity
} from '/game/assets/js/eras-data.js?v=1.7.3';
import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const $ = selector => document.querySelector(selector);
const functions = getFunctions(getApp('site-account'));

const accessCall = httpsCallable(functions, 'getFounderAssetUploadAccess');
const listCall = httpsCallable(functions, 'listFounderAssetAdmin');
const publishCall = httpsCallable(functions, 'publishFounderAsset');
const publishStateCall = httpsCallable(functions, 'setFounderAssetPublished');
const deleteCall = httpsCallable(functions, 'deleteFounderAsset');

const state = {
  founder: false,
  busy: false,
  limits: {
    maxFileBytes: 6 * 1024 * 1024,
    maxTotalFileBytes: 15 * 1024 * 1024,
    maxFiles: 16
  },
  supplyFiles: []
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function status(message, tone = '') {
  const el = $('#founderPublishStatus');
  if (!el) return;
  el.textContent = String(message || '').toUpperCase();
  el.dataset.tone = tone;
}

function gate(message, denied = false) {
  $('#founderGateMessage').textContent = String(message || '').toUpperCase();
  if (denied) {
    $('#founderGate').dataset.denied = 'true';
    setTimeout(() => {
      if (!state.founder) location.replace('/content/');
    }, 1800);
  }
}

function slug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 78);
}

function syncGeneratedId() {
  const name = $('#assetNameInput').value;
  const field = $('#assetIdInput');
  if (field.dataset.edited === '1') return;
  field.value = name.trim() ? `eras:${slug(name)}` : '';
}

function categoryChanged() {
  const supplies = $('#assetCategoryInput').value === 'Supplies';
  $('#standardFilesPanel').hidden = supplies;
  $('#supplyFilesPanel').hidden = !supplies;
}

function setBusy(value) {
  state.busy = Boolean(value);
  $('#publishAssetButton').disabled = state.busy;
  $('#clearAssetButton').disabled = state.busy;
}

function clearForm() {
  $('#founderAssetForm').reset();
  $('#assetLicenseInput').value = 'E.R.A.S. Founder-Published Asset';
  $('#assetPriceInput').value = '0';
  $('#assetExtraJson').value = '{}';
  $('#assetPublishNow').checked = true;
  $('#assetIdInput').dataset.edited = '0';
  state.supplyFiles = [];
  renderSupplyRows();
  categoryChanged();
  status('READY.');
}

function renderSupplyRows() {
  const root = $('#supplyFileRows');
  root.innerHTML = '';

  if (!state.supplyFiles.length) {
    root.innerHTML =
      '<p>SELECT IMAGE FILES TO BUILD THIS SUPPLIES PACKAGE.</p>';
    return;
  }

  state.supplyFiles.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'founder-supply-row';
    row.innerHTML = `
      <input
        data-supply-name="${index}"
        maxlength="100"
        value="${escapeHtml(entry.name)}"
        aria-label="Supply item name"
      >
      <select data-supply-kind="${index}" aria-label="Supply item kind">
        <option value="brush"${entry.kind === 'brush' ? ' selected' : ''}>BRUSH</option>
        <option value="sprite"${entry.kind === 'sprite' ? ' selected' : ''}>SPRITE</option>
        <option value="image"${entry.kind === 'image' ? ' selected' : ''}>IMAGE</option>
      </select>
    `;
    root.append(row);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const data = String(reader.result || '');
      const comma = data.indexOf(',');
      resolve(comma >= 0 ? data.slice(comma + 1) : data);
    };
    reader.readAsDataURL(file);
  });
}

async function filePayload(file) {
  if (!file) return null;
  if (file.size > state.limits.maxFileBytes) {
    throw new Error(
      `${file.name} exceeds the ${(state.limits.maxFileBytes / 1024 / 1024).toFixed(0)} MB file limit.`
    );
  }

  return {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataBase64: await fileToBase64(file)
  };
}

function parseExtraJson() {
  const raw = $('#assetExtraJson').value.trim() || '{}';
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Advanced JSON is invalid: ${error.message}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Advanced JSON must contain one JSON object.');
  }
  return value;
}

async function buildPublishPayload() {
  const category = $('#assetCategoryInput').value;
  const tags = $('#assetTagsInput').value
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

  const files = [];
  let totalBytes = 0;
  const track = file => {
    if (!file) return;
    files.push(file);
    totalBytes += file.size;
  };

  const mainFile = $('#assetMainFile').files?.[0] || null;
  const thumbnailFile =
    (
      category === 'Supplies'
        ? $('#supplyThumbnailFile').files?.[0]
        : $('#assetThumbnailFile').files?.[0]
    ) || null;

  track(mainFile);
  track(thumbnailFile);
  state.supplyFiles.forEach(entry => track(entry.file));

  if (files.length > state.limits.maxFiles) {
    throw new Error(`A publication can contain at most ${state.limits.maxFiles} files.`);
  }
  if (totalBytes > state.limits.maxTotalFileBytes) {
    throw new Error(
      `This publication exceeds the ${(state.limits.maxTotalFileBytes / 1024 / 1024).toFixed(0)} MB total upload limit.`
    );
  }

  const supplyFiles = [];
  if (category === 'Supplies') {
    if (!state.supplyFiles.length) {
      throw new Error('A Supplies package needs at least one image.');
    }

    for (let index = 0; index < state.supplyFiles.length; index += 1) {
      const entry = state.supplyFiles[index];
      const nameInput = document.querySelector(`[data-supply-name="${index}"]`);
      const kindInput = document.querySelector(`[data-supply-kind="${index}"]`);
      supplyFiles.push({
        id: slug(nameInput?.value || entry.name),
        name: String(nameInput?.value || entry.name).trim(),
        kind: kindInput?.value || entry.kind,
        file: await filePayload(entry.file)
      });
    }
  }

  return {
    name: $('#assetNameInput').value.trim(),
    assetId: $('#assetIdInput').value.trim(),
    category,
    priceCredits: Number($('#assetPriceInput').value || 0),
    description: $('#assetDescriptionInput').value.trim(),
    tags,
    licenseLabel: $('#assetLicenseInput').value.trim(),
    published: $('#assetPublishNow').checked,
    extra: parseExtraJson(),
    mainFile: category === 'Supplies' ? null : await filePayload(mainFile),
    thumbnailFile: await filePayload(thumbnailFile),
    supplyFiles
  };
}

async function publishAsset(event) {
  event.preventDefault();
  if (!state.founder || state.busy) return;

  setBusy(true);
  status('PREPARING LOCAL FILES…');

  try {
    const payload = await buildPublishPayload();
    status('UPLOADING TO FOUNDER ASSET LIBRARY…');

    const response = await publishCall(payload);
    const asset = response.data?.catalogAsset || {};

    status(
      `${asset.name || payload.name} ${response.data?.published ? 'PUBLISHED' : 'SAVED UNPUBLISHED'} // ${response.data?.assetId || ''}`,
      'ok'
    );

    await refreshPublishedList();
    clearForm();
  } catch (error) {
    console.error('Founder Asset Library publish', error);
    status(error?.message || 'Could not publish this asset.', 'error');
  } finally {
    setBusy(false);
  }
}

async function refreshPublishedList() {
  const root = $('#founderAssetList');
  root.innerHTML = '<p class="founder-empty">LOADING…</p>';

  try {
    const response = await listCall({});
    const assets = response.data?.assets || [];

    if (!assets.length) {
      root.innerHTML =
        '<p class="founder-empty">NO FOUNDER-PUBLISHED ASSETS YET.</p>';
      return;
    }

    root.innerHTML = assets.map(asset => `
      <article
        class="founder-asset-row${asset.published ? '' : ' is-unpublished'}"
        data-founder-asset="${escapeHtml(asset.assetId)}"
      >
        <span class="founder-asset-row-copy">
          <b>${escapeHtml(asset.name || asset.assetId)}</b>
          <small>
            ${escapeHtml(asset.category || 'ASSET')} //
            ${asset.published ? 'PUBLIC' : 'UNPUBLISHED'} //
            ${escapeHtml(asset.assetId)}
          </small>
        </span>
        <span class="founder-asset-row-actions">
          <button
            type="button"
            data-publish-state="${asset.published ? '0' : '1'}"
          >${asset.published ? 'UNPUBLISH' : 'PUBLISH'}</button>
          <button type="button" data-delete="1">DELETE</button>
        </span>
      </article>
    `).join('');
  } catch (error) {
    console.error('Founder Asset Library list', error);
    root.innerHTML =
      '<p class="founder-empty">COULD NOT LOAD FOUNDER ASSETS.</p>';
  }
}

async function rowAction(event) {
  const row = event.target.closest('[data-founder-asset]');
  if (!row || state.busy || !state.founder) return;

  const assetId = row.dataset.founderAsset;
  const publishButton = event.target.closest('[data-publish-state]');
  const deleteButton = event.target.closest('[data-delete]');

  try {
    if (publishButton) {
      setBusy(true);
      await publishStateCall({
        assetId,
        published: publishButton.dataset.publishState === '1'
      });
      await refreshPublishedList();
      status('PUBLICATION STATE UPDATED.', 'ok');
    } else if (deleteButton) {
      if (!confirm(`PERMANENTLY DELETE ${assetId} AND ITS UPLOADED FILES?`)) {
        return;
      }
      setBusy(true);
      await deleteCall({ assetId });
      await refreshPublishedList();
      status('FOUNDER-PUBLISHED ASSET DELETED.', 'ok');
    }
  } catch (error) {
    console.error('Founder Asset Library action', error);
    status(error?.message || 'Founder asset action failed.', 'error');
  } finally {
    setBusy(false);
  }
}

async function verifyFounder(identity) {
  state.founder = false;
  $('#founderWorkspace').hidden = true;
  $('#founderGate').hidden = false;

  if (!identity?.user) {
    gate('SIGN IN WITH THE CONFIGURED FOUNDER ACCOUNT TO CONTINUE.');
    return;
  }

  gate('VERIFYING ROOT FOUNDER AUTHORITY WITH THE BACKEND…');

  try {
    const response = await accessCall({});
    if (!response.data?.founder) throw new Error('Founder verification failed.');

    state.founder = true;
    state.limits = {
      ...state.limits,
      ...(response.data?.limits || {})
    };

    $('#founderGate').hidden = true;
    $('#founderWorkspace').hidden = false;
    await refreshPublishedList();
  } catch (error) {
    console.warn('Founder publisher access denied', error?.code || error?.message);
    gate('ACCESS DENIED // ROOT FOUNDER AUTHORITY REQUIRED.', true);
  }
}

$('#assetNameInput').addEventListener('input', syncGeneratedId);
$('#assetIdInput').addEventListener('input', () => {
  $('#assetIdInput').dataset.edited = '1';
});
$('#assetCategoryInput').addEventListener('change', categoryChanged);

$('#assetSupplyFiles').addEventListener('change', event => {
  state.supplyFiles = Array.from(event.target.files || []).map(file => ({
    file,
    name: file.name.replace(/\.[^.]+$/, ''),
    kind: 'image'
  }));
  renderSupplyRows();
});

$('#founderAssetForm').addEventListener('submit', publishAsset);
$('#clearAssetButton').addEventListener('click', clearForm);
$('#founderAssetList').addEventListener('click', rowAction);

categoryChanged();
watchIdentity(verifyFounder);
