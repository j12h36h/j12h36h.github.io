import { avatarSvg } from '/game/assets/js/eras-data.js';

const FALLBACK = Object.freeze({
  id: 'eras:slime_monochrome',
  name: 'E.R.A.S. Asset',
  source: '/public-assets/textures/slime_monochrome.png',
  thumbnail: '/public-assets/textures/slime_monochrome.png',
  defaultTint: '#65d67c',
  tintable: true,
  tags: []
});

const IMAGE_CACHE = new Map();
const VARIANT_PREVIEW_CACHE = new Map();

export function catalogAsset(catalog, assetId='') {
  return catalog?.assets?.find?.(asset => asset?.id === assetId) || { ...FALLBACK, id: assetId || FALLBACK.id, name: assetId || FALLBACK.name };
}

export function assetAvatarJson(asset) {
  const raw = asset?.iconJson;
  if (!raw) return '';
  try { return typeof raw === 'string' ? raw : JSON.stringify(raw); }
  catch (_) { return ''; }
}

export function assetPreviewUrl(asset) {
  const avatarJson = assetAvatarJson(asset);
  if (avatarJson) {
    try {
      const svg = avatarSvg({ displayName: asset?.name || 'ASSET', avatarJson });
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch (_) {}
  }
  return String(asset?.thumbnail || asset?.source || FALLBACK.thumbnail);
}

export function assetIsTintable(asset) {
  if (assetAvatarJson(asset)) return false;
  if (asset?.tintable === true) return true;
  return Array.isArray(asset?.layers) && asset.layers.some(layer => layer?.tintable === true);
}

export function assetDefaultTint(asset) {
  const value = String(asset?.defaultTint || FALLBACK.defaultTint);
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : FALLBACK.defaultTint;
}

export function safeAssetTint(value, fallback='#ffffff') {
  const text = String(value || '');
  return /^#[0-9a-fA-F]{6}$/.test(text) ? text.toLowerCase() : String(fallback || '#ffffff').toLowerCase();
}

export function assetLayers(asset) {
  if (Array.isArray(asset?.layers) && asset.layers.length) {
    return asset.layers
      .filter(layer => layer && layer.source)
      .map(layer => ({ source:String(layer.source), tintable:layer.tintable === true }));
  }
  return [{
    source:String(asset?.source || asset?.thumbnail || FALLBACK.source),
    tintable:assetIsTintable(asset)
  }];
}

async function loadAssetImage(source) {
  const src = String(source || '');
  if (!src) throw new Error('Asset layer source is missing.');
  if (IMAGE_CACHE.has(src)) return IMAGE_CACHE.get(src);
  const promise = (async () => {
    const image = new Image();
    image.decoding = 'async';
    image.src = src;
    await image.decode();
    return image;
  })();
  IMAGE_CACHE.set(src, promise);
  try { return await promise; }
  catch (error) { IMAGE_CACHE.delete(src); throw error; }
}

function drawTintedLayer(ctx, image, tint, width, height) {
  const off = document.createElement('canvas');
  off.width = width; off.height = height;
  const octx = off.getContext('2d');
  octx.clearRect(0, 0, width, height);
  octx.drawImage(image, 0, 0, width, height);
  octx.globalCompositeOperation = 'multiply';
  octx.fillStyle = tint;
  octx.fillRect(0, 0, width, height);
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(image, 0, 0, width, height);
  octx.globalCompositeOperation = 'source-over';
  ctx.drawImage(off, 0, 0);
}

export async function renderAssetCanvas(canvas, asset, tint=assetDefaultTint(asset)) {
  if (!canvas || !asset) return canvas;
  const width = Math.max(1, Math.floor(Number(canvas.width) || 128));
  const height = Math.max(1, Math.floor(Number(canvas.height) || width));
  const ctx = canvas.getContext('2d');
  const resolvedTint = safeAssetTint(tint, assetDefaultTint(asset));
  ctx.clearRect(0, 0, width, height);
  for (const layer of assetLayers(asset)) {
    const image = await loadAssetImage(layer.source);
    if (layer.tintable) drawTintedLayer(ctx, image, resolvedTint, width, height);
    else ctx.drawImage(image, 0, 0, width, height);
  }
  return canvas;
}

export async function assetVariantPreviewUrl(asset, tint=assetDefaultTint(asset), size=128) {
  if (!assetIsTintable(asset) && !Array.isArray(asset?.layers)) return assetPreviewUrl(asset);
  const px = Math.max(32, Math.min(512, Math.floor(Number(size) || 128)));
  const resolvedTint = safeAssetTint(tint, assetDefaultTint(asset));
  const layerKey = assetLayers(asset).map(layer => `${layer.tintable?'t':'f'}:${layer.source}`).join('|');
  const key = `${asset?.id || ''}|${resolvedTint}|${px}|${layerKey}`;
  if (VARIANT_PREVIEW_CACHE.has(key)) return VARIANT_PREVIEW_CACHE.get(key);
  const promise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = px; canvas.height = px;
    await renderAssetCanvas(canvas, asset, resolvedTint);
    return canvas.toDataURL('image/png');
  })();
  VARIANT_PREVIEW_CACHE.set(key, promise);
  try { return await promise; }
  catch (error) { VARIANT_PREVIEW_CACHE.delete(key); throw error; }
}

export function hydrateVariantPreviewImage(image, asset, tint=assetDefaultTint(asset), size=128) {
  if (!image || !asset) return;
  image.src = assetPreviewUrl(asset);
  assetVariantPreviewUrl(asset, tint, size).then(url => {
    if (image.isConnected) image.src = url;
  }).catch(() => {});
}

export function assetPriceCredits(asset) {
  const raw = asset?.priceCredits ?? asset?.price ?? 0;
  const value = Math.floor(Number(raw) || 0);
  return Math.max(0, Math.min(1000000, value));
}

export function assetIsCurrentlyFree(asset) {
  return assetPriceCredits(asset) === 0;
}

export function assetOption(asset, extraTags=[]) {
  return {
    id: asset.id,
    name: asset.name || asset.id,
    description: asset.description || '',
    image: assetPreviewUrl(asset),
    tags: [...(Array.isArray(asset.tags) ? asset.tags.slice(0, 4) : []), ...extraTags].slice(0, 6)
  };
}
