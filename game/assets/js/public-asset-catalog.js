const STATIC_CATALOG_URL = '/public-assets/catalog.json';
const FOUNDER_CATALOG_URL =
  'https://us-central1-logicalcommunicationservice.cloudfunctions.net/listFounderPublishedAssets';

let cachePromise = null;

function normalizeCatalog(value) {
  const catalog = value && typeof value === 'object' ? value : {};
  return {
    ...catalog,
    categories: Array.isArray(catalog.categories) ? [...catalog.categories] : [],
    assets: Array.isArray(catalog.assets) ? [...catalog.assets] : []
  };
}

function mergeCatalogs(base, dynamic) {
  const staticCatalog = normalizeCatalog(base);
  const dynamicCatalog = normalizeCatalog(dynamic);

  // Static package assets always win on duplicate IDs. Founder-published assets
  // use their own IDs and cannot silently override files shipped with the site.
  const seen = new Set(
    staticCatalog.assets
      .map(asset => String(asset?.id || ''))
      .filter(Boolean)
  );

  const dynamicAssets = dynamicCatalog.assets.filter(asset => {
    const id = String(asset?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const categories = [
    ...new Set([
      ...staticCatalog.categories,
      ...dynamicCatalog.categories
    ].map(value => String(value || '').trim()).filter(Boolean))
  ];

  return {
    ...staticCatalog,
    version: Math.max(
      Number(staticCatalog.version || 0),
      Number(dynamicCatalog.version || 0)
    ),
    updatedAt:
      dynamicCatalog.updatedAt ||
      staticCatalog.updatedAt ||
      new Date().toISOString().slice(0, 10),
    categories,
    assets: [...staticCatalog.assets, ...dynamicAssets],
    founderPublishedCount: dynamicAssets.length
  };
}

async function loadDynamicCatalog() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(FOUNDER_CATALOG_URL, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Founder catalog HTTP ${response.status}`);
    }

    return normalizeCatalog(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function loadPublicAssetCatalog({
  cache = false,
  includeFounderPublished = true
} = {}) {
  if (cache && cachePromise) return cachePromise;

  const work = (async () => {
    const staticResponse = await fetch(STATIC_CATALOG_URL, { cache: 'no-store' });
    if (!staticResponse.ok) {
      throw new Error(`Catalog HTTP ${staticResponse.status}`);
    }

    const staticCatalog = normalizeCatalog(await staticResponse.json());
    if (!includeFounderPublished) return staticCatalog;

    try {
      const dynamicCatalog = await loadDynamicCatalog();
      return mergeCatalogs(staticCatalog, dynamicCatalog);
    } catch (error) {
      // A Functions deployment outage must never take the packaged Asset
      // Library offline. The shipped JSON catalog remains the fallback.
      console.debug(
        'Founder-published Asset Library extension unavailable',
        error?.message || error
      );
      return staticCatalog;
    }
  })();

  if (cache) cachePromise = work;
  return work;
}

export function clearPublicAssetCatalogCache() {
  cachePromise = null;
}
