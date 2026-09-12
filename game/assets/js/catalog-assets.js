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

  if (['supplies','supply','supply-pack','brush-pack','sprite-pack'].includes(rawType) || ['supplies','drawing-supplies','canvas-supplies'].includes(rawCategory)) return 'Supplies';
  if (rawCategory === 'game-mode-icons' || id.includes('mode_') || rawType === 'mode') return 'Mode';
  if (['audio','sound','music'].includes(rawType) || ['audio','sounds','music'].includes(rawCategory)) return 'Audio';

  // E.R.A.S. 3D asset hierarchy: Object -> Structure -> Scene -> World.
  // Material and Ruleset are reusable supporting assets beside that hierarchy.
  if (['object','3d-object','model'].includes(rawType) || ['3d-objects','objects','models'].includes(rawCategory)) return 'Object';
  if (['structure','3d-structure'].includes(rawType) || ['3d-structures','structures'].includes(rawCategory)) return 'Structure';
  if (['material','surface'].includes(rawType) || ['3d-materials','materials','surfaces'].includes(rawCategory)) return 'Material';
  if (['scene','map-chunk','scene-chunk'].includes(rawType) || ['3d-scenes','scenes','scene-chunks'].includes(rawCategory)) return 'Scene';
  if (['ruleset','rules'].includes(rawType) || ['rulesets','rules'].includes(rawCategory)) return 'Ruleset';

  if (['world','map','open-world'].includes(rawType) || ['world','worlds','maps'].includes(rawCategory)) return 'World';
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

  if (kind === 'Sprite') {
    const styles = Array.isArray(asset?.variantPolicy?.stylePresets) ? asset.variantPolicy.stylePresets : [];
    if (styles.length) {
      const wanted = String(asset?.defaultStyle || asset?.variantPolicy?.defaultStyle || styles[0]?.id || 'standard');
      const preset = styles.find(item => String(item?.id) === wanted) || styles[0];
      return String(preset?.name || wanted || 'Default');
    }
    const value = String(asset?.colorName || asset?.color || asset?.variantColor || '').trim();
    return value ? titleWords(value) : 'Undefined';
  }
  if (kind === 'Supplies') {
    const count=Array.isArray(asset?.supplyData?.items) ? asset.supplyData.items.length : 0;
    return count ? `${count} Item${count===1?'':'s'}` : 'Pack';
  }
  if (kind === 'Icon') {
    const value = String(asset?.colorName || asset?.color || asset?.variantColor || '').trim();
    return value ? titleWords(value) : 'Undefined';
  }
  if (kind === 'Audio') return String(asset?.pitchName || '').trim() || 'Undefined';
  if (kind === 'Mode') return String(asset?.ruleName || '').trim() || 'Undefined';
  if (kind === 'World') return String(asset?.skinName || asset?.worldName || '').trim() || 'Undefined';
  if (kind === 'Effect') return String(asset?.impactName || '').trim() || 'Undefined';
  if (kind === 'Object') return String(asset?.modelName || asset?.primitive || 'Default Model').trim();
  if (kind === 'Structure') return String(asset?.moduleName || 'Assembly').trim();
  if (kind === 'Material') return String(asset?.materialName || 'Surface').trim();
  if (kind === 'Scene') {
    const size = Array.isArray(asset?.chunkSize) ? asset.chunkSize : null;
    return String(asset?.sceneName || (size ? `${size[0]} × ${size[2]} Chunk` : 'Scene Chunk')).trim();
  }
  if (kind === 'Ruleset') return String(asset?.ruleName || asset?.rulesetName || 'Standard').trim();
  return 'Undefined';
}

export function assetDisplayLabel(asset, variant='') {
  const label = String(variant || '').trim() || assetCatalogVariantLabel(asset);
  return `[${assetCategory(asset)}] ${assetBaseName(asset)} (${label})`;
}

export function assetCanFillRole(asset, requiredRole='') {
  const kind = assetCategory(asset);
  const role = String(requiredRole || '').trim().toLowerCase();

  if (role === 'supplies' || role === 'supply') return kind === 'Supplies';
  if (role === 'sprite') return kind === 'Sprite' || kind === 'Icon';
  if (role === 'icon') return kind === 'Icon';
  if (role === 'model' || role === '3d-object') return kind === 'Object' || kind === 'Structure';
  if (role === 'map' || role === 'scene') return kind === 'Scene' || kind === 'World';
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

export function assetStyleId(asset, variant='') {
  const presets = Array.isArray(asset?.variantPolicy?.stylePresets) ? asset.variantPolicy.stylePresets : [];
  if (!presets.length && !Array.isArray(asset?.styles)) return '';
  let requested = '';
  if (variant && typeof variant === 'object') requested = String(variant.style || '');
  else {
    const raw = String(variant || '');
    requested = raw.startsWith('sprite|style=') ? raw.slice('sprite|style='.length) : raw;
  }
  const fallback = String(asset?.defaultStyle || asset?.variantPolicy?.defaultStyle || presets[0]?.id || asset?.styles?.[0]?.id || 'standard');
  const known = new Set([...(presets||[]).map(item=>String(item?.id||'')), ...(asset?.styles||[]).map(item=>String(item?.id||''))]);
  return known.has(requested) ? requested : fallback;
}

export function assetStylePreset(asset, variant='') {
  const id = assetStyleId(asset, variant);
  const presets = Array.isArray(asset?.variantPolicy?.stylePresets) ? asset.variantPolicy.stylePresets : [];
  return presets.find(item => String(item?.id) === id) || null;
}

export function assetLayers(asset, variant='') {
  const styleId = assetStyleId(asset, variant);
  if (styleId && Array.isArray(asset?.styles)) {
    const style = asset.styles.find(item => String(item?.id) === styleId) || asset.styles[0];
    if (Array.isArray(style?.layers) && style.layers.length) {
      return style.layers
        .filter(layer => layer && layer.source)
        .map(layer => ({
          source:String(layer.source),
          tintable:layer.tintable === true,
          tintMode:String(layer.tintMode || 'full'),
          tint:layer.tint ? safeAssetTint(layer.tint) : ''
        }));
    }
  }

  if (String(asset?.id || '') === 'eras:slime_juice') {
    return [{
      source: '/public-assets/textures/slime_juice.png',
      tintable: true,
      tintMode: 'green-dominant',
      tint: ''
    }];
  }

  if (Array.isArray(asset?.layers) && asset.layers.length) {
    return asset.layers
      .filter(layer => layer && layer.source)
      .map(layer => ({
        source:String(layer.source),
        tintable:layer.tintable === true,
        tintMode:String(layer.tintMode || 'full'),
        tint:layer.tint ? safeAssetTint(layer.tint) : ''
      }));
  }
  return [{
    source:String(asset?.source || asset?.thumbnail || FALLBACK.source),
    tintable:assetIsTintable(asset),
    tintMode:String(asset?.tintMode || 'full'),
    tint:''
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

export async function renderAssetCanvas(canvas, asset, variant=assetDefaultTint(asset)) {
  if (!canvas || !asset) return canvas;
  const width = Math.max(1, Math.floor(Number(canvas.width) || 128));
  const height = Math.max(1, Math.floor(Number(canvas.height) || width));
  const ctx = canvas.getContext('2d');
  const rawTint = variant && typeof variant === 'object' ? variant.tint : variant;
  const resolvedTint = safeAssetTint(rawTint, assetDefaultTint(asset));
  ctx.clearRect(0, 0, width, height);

  for (const layer of assetLayers(asset, variant)) {
    const image = await loadAssetImage(layer.source);
    const layerTint = safeAssetTint(layer.tint || resolvedTint, resolvedTint);
    if (layer.tintable && layer.tintMode === 'green-dominant') {
      drawGreenDominantTint(ctx, image, layerTint, width, height);
    } else if (layer.tintable) {
      drawTintedLayer(ctx, image, layerTint, width, height);
    } else {
      ctx.drawImage(image, 0, 0, width, height);
    }
  }
  return canvas;
}

export async function assetVariantPreviewUrl(asset, variant=assetDefaultTint(asset), size=128) {
  const hasStyles = Boolean(assetStyleId(asset, variant));
  if (!hasStyles && !assetIsTintable(asset) && !Array.isArray(asset?.layers)) return assetPreviewUrl(asset);
  const px = Math.max(32, Math.min(512, Math.floor(Number(size) || 128)));
  const rawTint = variant && typeof variant === 'object' ? variant.tint : variant;
  const resolvedTint = safeAssetTint(rawTint, assetDefaultTint(asset));
  const styleId = assetStyleId(asset, variant);
  const layerKey = assetLayers(asset, variant).map(layer => `${layer.tintable?'t':'f'}:${layer.tintMode}:${layer.tint||''}:${layer.source}`).join('|');
  const key = `${asset?.id || ''}|${styleId}|${resolvedTint}|${px}|${layerKey}`;

  if (VARIANT_PREVIEW_CACHE.has(key)) return VARIANT_PREVIEW_CACHE.get(key);

  const promise = (async () => {
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    await renderAssetCanvas(canvas, asset, variant);
    return canvas.toDataURL('image/png');
  })();

  VARIANT_PREVIEW_CACHE.set(key, promise);
  try { return await promise; }
  catch (error) {
    VARIANT_PREVIEW_CACHE.delete(key);
    throw error;
  }
}

export function hydrateVariantPreviewImage(image, asset, variant=assetDefaultTint(asset), size=128) {
  if (!image || !asset) return;
  image.src = assetPreviewUrl(asset);
  assetVariantPreviewUrl(asset, variant, size).then(url => {
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
