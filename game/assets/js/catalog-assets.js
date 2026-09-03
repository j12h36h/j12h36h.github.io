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
  return catalog?.assets?.find?.(asset => asset?.id === assetId)
    || { ...FALLBACK, id: assetId || FALLBACK.id, name: assetId || FALLBACK.name };
}

export function assetCategory(asset) {
  const rawType = String(asset?.type || '').trim().toLowerCase();
  const rawCategory = String(asset?.category || '').trim().toLowerCase();
  const id = String(asset?.id || '').trim().toLowerCase();

  if (rawCategory === 'game-mode-icons' || id.includes('mode_') || rawType === 'mode') return 'Mode';
  if (['audio','sound','music'].includes(rawType) || ['audio','sounds','music'].includes(rawCategory)) return 'Audio';
  if (['world','map'].includes(rawType) || ['world','worlds','maps'].includes(rawCategory)) return 'World';
  if (['effect','vfx','particle','particles'].includes(rawType) || ['effects','vfx','particles'].includes(rawCategory)) return 'Effect';
  if (rawType === 'icon' || rawCategory === 'icons') return 'Icon';

  return 'Sprite';
}

export function assetBaseName(asset) {
  let name = String(asset?.displayName || asset?.name || asset?.id || 'Asset').trim();
  if (name.startsWith('Monochrome ')) name = name.slice('Monochrome '.length);

  const kind = assetCategory(asset);
  if (kind === 'Mode') {
    for (const suffix of [' Emblem',' Crest',' Scanner',' Stack',' Orb',' Logic Grid',' Icon']) {
      if (name.endsWith(suffix)) {
        name = name.slice(0, -suffix.length);
        break;
      }
    }
  }
  if (kind === 'Sprite' && name.endsWith(' Texture')) name = name.slice(0, -' Texture'.length);
  return name.trim() || 'Asset';
}

export function assetCatalogVariantLabel(asset) {
  const kind = assetCategory(asset);

  if (kind === 'Sprite' || kind === 'Icon') {
    const value = String(asset?.colorName || asset?.color || asset?.variantColor || '').trim();
    return value ? titleWords(value) : 'Undefined';
  }
  if (kind === 'Audio') return String(asset?.pitchName || '').trim() || 'Undefined';
  if (kind === 'Mode') return String(asset?.ruleName || '').trim() || 'Undefined';
  if (kind === 'World') return String(asset?.skinName || '').trim() || 'Undefined';
  if (kind === 'Effect') return String(asset?.impactName || '').trim() || 'Undefined';
  return 'Undefined';
}

export function assetDisplayLabel(asset, variant='') {
  const label = String(variant || '').trim() || assetCatalogVariantLabel(asset);
  return `[${assetCategory(asset)}] ${assetBaseName(asset)} (${label})`;
}

export function assetCanFillRole(asset, requiredRole='') {
  const kind = assetCategory(asset);
  const role = String(requiredRole || '').trim().toLowerCase();

  if (role === 'sprite') return kind === 'Sprite' || kind === 'Icon';
  if (role === 'icon') return kind === 'Icon';
  return kind.toLowerCase() === role;
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
  // Slime Juice is a single source image, but only the green liquid is tintable.
  // Use the original colored sprite and a selective liquid tint instead of tinting
  // the whole monochrome sprite.
  if (String(asset?.id || '') === 'eras:slime_juice') {
    return [{
      source: '/public-assets/textures/slime_juice.png',
      tintable: true,
      tintMode: 'green-dominant'
    }];
  }

  if (Array.isArray(asset?.layers) && asset.layers.length) {
    return asset.layers
      .filter(layer => layer && layer.source)
      .map(layer => ({
        source:String(layer.source),
        tintable:layer.tintable === true,
        tintMode:String(layer.tintMode || 'full')
      }));
  }
  return [{
    source:String(asset?.source || asset?.thumbnail || FALLBACK.source),
    tintable:assetIsTintable(asset),
    tintMode:String(asset?.tintMode || 'full')
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

function tintRgb(hex) {
  const value = safeAssetTint(hex, '#ffffff').slice(1);
  return [
    parseInt(value.slice(0,2), 16),
    parseInt(value.slice(2,4), 16),
    parseInt(value.slice(4,6), 16)
  ];
}

function drawTintedLayer(ctx, image, tint, width, height) {
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
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

function drawGreenDominantTint(ctx, image, tint, width, height) {
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const octx = off.getContext('2d', { willReadFrequently:true });
  octx.clearRect(0, 0, width, height);
  octx.drawImage(image, 0, 0, width, height);

  const pixels = octx.getImageData(0, 0, width, height);
  const data = pixels.data;
  const [tr,tg,tb] = tintRgb(tint);

  for (let i=0; i<data.length; i+=4) {
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    if (!a) continue;

    // Select the actual green juice while protecting the bottle/outline/highlights.
    const greenLead = g - Math.max(r,b);
    const saturation = Math.max(r,g,b) - Math.min(r,g,b);
    if (g > r && g > b && greenLead >= 7 && saturation >= 10) {
      const brightness = Math.max(0.18, Math.min(1.25, (0.20*r + 0.70*g + 0.10*b) / 185));
      data[i]   = Math.max(0, Math.min(255, Math.round(tr * brightness)));
      data[i+1] = Math.max(0, Math.min(255, Math.round(tg * brightness)));
      data[i+2] = Math.max(0, Math.min(255, Math.round(tb * brightness)));
    }
  }

  octx.putImageData(pixels, 0, 0);
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
    if (layer.tintable && layer.tintMode === 'green-dominant') {
      drawGreenDominantTint(ctx, image, resolvedTint, width, height);
    } else if (layer.tintable) {
      drawTintedLayer(ctx, image, resolvedTint, width, height);
    } else {
      ctx.drawImage(image, 0, 0, width, height);
    }
  }
  return canvas;
}

export async function assetVariantPreviewUrl(asset, tint=assetDefaultTint(asset), size=128) {
  if (!assetIsTintable(asset) && !Array.isArray(asset?.layers)) return assetPreviewUrl(asset);
  const px = Math.max(32, Math.min(512, Math.floor(Number(size) || 128)));
  const resolvedTint = safeAssetTint(tint, assetDefaultTint(asset));
  const layerKey = assetLayers(asset).map(layer => `${layer.tintable?'t':'f'}:${layer.tintMode}:${layer.source}`).join('|');
  const key = `${asset?.id || ''}|${resolvedTint}|${px}|${layerKey}`;

  if (VARIANT_PREVIEW_CACHE.has(key)) return VARIANT_PREVIEW_CACHE.get(key);

  const promise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    await renderAssetCanvas(canvas, asset, resolvedTint);
    return canvas.toDataURL('image/png');
  })();

  VARIANT_PREVIEW_CACHE.set(key, promise);
  try { return await promise; }
  catch (error) {
    VARIANT_PREVIEW_CACHE.delete(key);
    throw error;
  }
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
    name: assetDisplayLabel(asset),
    description: asset.description || '',
    image: assetPreviewUrl(asset),
    tags: Array.isArray(extraTags) ? extraTags.slice(0, 6) : []
  };
}

function titleWords(value) {
  return String(value || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
