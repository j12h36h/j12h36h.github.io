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
  return asset?.tintable === true && !assetAvatarJson(asset);
}

export function assetDefaultTint(asset) {
  const value = String(asset?.defaultTint || FALLBACK.defaultTint);
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : FALLBACK.defaultTint;
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
