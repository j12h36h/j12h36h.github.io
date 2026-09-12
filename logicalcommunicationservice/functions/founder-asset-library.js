const crypto = require('node:crypto');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

if (!getApps().length) initializeApp();

const db = getFirestore();
const storage = getStorage();

const REGION = 'us-central1';
const COLLECTION = 'founderPublicAssets';

const CATEGORY_META = Object.freeze({
  Sprite: Object.freeze({ type: 'sprite', category: 'sprites' }),
  Audio: Object.freeze({ type: 'audio', category: 'audio' }),
  Mode: Object.freeze({ type: 'mode', category: 'game-mode-icons' }),
  World: Object.freeze({ type: 'world', category: 'worlds' }),
  Effect: Object.freeze({ type: 'effect', category: 'effects' }),
  Icon: Object.freeze({ type: 'icon', category: 'icons' }),
  Supplies: Object.freeze({ type: 'supplies', category: 'supplies' })
});

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'application/json',
  'text/plain'
]);

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 16;

function founderAssetDocId(assetId) {
  return crypto
    .createHash('sha256')
    .update(String(assetId || ''))
    .digest('hex')
    .slice(0, 40);
}

function safeToken(value, max = 80) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max) || 'asset';
}

function safeAssetId(value, name) {
  const requested = String(value || '').trim().toLowerCase();
  if (/^[a-z0-9._-]+:[a-z0-9._-]{2,90}$/.test(requested)) {
    return requested.slice(0, 110);
  }
  return `eras:${safeToken(name, 78)}`;
}

function cleanString(value, max = 800) {
  return String(value || '').trim().slice(0, max);
}

function cleanTags(value) {
  const tags = Array.isArray(value) ? value : [];
  const out = [];
  for (const tag of tags) {
    const text = cleanString(tag, 40).toLowerCase();
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= 24) break;
  }
  return out;
}

function finiteInt(value, min, max, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function cleanJson(value, depth = 0) {
  if (depth > 8) return null;
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return typeof value === 'string' ? value.slice(0, 5000) : value;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  if (Array.isArray(value)) {
    return value.slice(0, 250).map(item => cleanJson(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const out = {};
    let count = 0;
    for (const [key, child] of Object.entries(value)) {
      if (count >= 120) break;
      const safeKey = String(key || '').slice(0, 80);
      if (!safeKey || ['__proto__', 'prototype', 'constructor'].includes(safeKey)) {
        continue;
      }
      out[safeKey] = cleanJson(child, depth + 1);
      count += 1;
    }
    return out;
  }
  return null;
}

async function requireFounder(request) {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in through E.R.A.S. first.');
  }

  const accountSnap = await db.doc(`privateAccounts/${uid}`).get();
  const profileId = String(accountSnap.data()?.publicProfileId || '');
  if (!profileId) {
    throw new HttpsError(
      'failed-precondition',
      'The signed-in account is not linked to an E.R.A.S. profile.'
    );
  }

  const founderSnap = await db.doc('systemPrivate/founder').get();
  const founderProfileId = String(founderSnap.data()?.profileId || '');

  if (!founderProfileId || founderProfileId !== profileId) {
    throw new HttpsError(
      'permission-denied',
      'This screen is restricted to the configured E.R.A.S. Founder.'
    );
  }

  return { uid, profileId };
}

function decodeFile(raw, totalState) {
  if (!raw || typeof raw !== 'object') {
    throw new HttpsError('invalid-argument', 'Upload file payload is invalid.');
  }

  const name = cleanString(raw.name, 140) || 'asset.bin';
  const mimeType = cleanString(raw.mimeType, 100).toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new HttpsError(
      'invalid-argument',
      `Unsupported file type: ${mimeType || 'unknown'}.`
    );
  }

  const dataBase64 = String(raw.dataBase64 || '');
  if (!dataBase64 || dataBase64.length > MAX_FILE_BYTES * 1.38 + 32) {
    throw new HttpsError(
      'invalid-argument',
      `${name} is missing or exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB file limit.`
    );
  }

  let buffer;
  try {
    buffer = Buffer.from(dataBase64, 'base64');
  } catch (_) {
    throw new HttpsError('invalid-argument', `${name} is not valid base64 data.`);
  }

  if (!buffer.length || buffer.length > MAX_FILE_BYTES) {
    throw new HttpsError(
      'invalid-argument',
      `${name} exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB file limit.`
    );
  }

  totalState.bytes += buffer.length;
  totalState.count += 1;
  if (totalState.count > MAX_FILES || totalState.bytes > MAX_TOTAL_FILE_BYTES) {
    throw new HttpsError(
      'invalid-argument',
      'This publication exceeds the total upload limit.'
    );
  }

  return { name, mimeType, buffer };
}

function extensionFor(file) {
  const fromName = file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  if (fromName) return fromName;

  const byMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
    'application/json': 'json',
    'text/plain': 'txt'
  };
  return byMime[file.mimeType] || 'bin';
}

async function savePublicTokenFile(bucket, prefix, slot, file) {
  const token = crypto.randomUUID();
  const objectPath =
    `${prefix}/${safeToken(slot, 64)}.${extensionFor(file)}`;

  const object = bucket.file(objectPath);
  await object.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimeType,
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: {
        firebaseStorageDownloadTokens: token
      }
    }
  });

  return {
    objectPath,
    url:
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}` +
      `/o/${encodeURIComponent(objectPath)}?alt=media&token=${encodeURIComponent(token)}`
  };
}

function categoryLabelFromAsset(asset) {
  const raw = String(asset?.type || asset?.category || '').toLowerCase();
  if (raw.includes('suppl')) return 'Supplies';
  if (raw.includes('audio') || raw.includes('music') || raw.includes('sound')) return 'Audio';
  if (raw.includes('mode')) return 'Mode';
  if (raw.includes('world') || raw.includes('map')) return 'World';
  if (raw.includes('effect') || raw.includes('vfx')) return 'Effect';
  if (raw.includes('icon')) return 'Icon';
  return 'Sprite';
}

exports.getFounderAssetUploadAccess = onCall(
  { region: REGION, timeoutSeconds: 20, memory: '256MiB' },
  async request => {
    const founder = await requireFounder(request);
    return {
      ok: true,
      founder: true,
      profileId: founder.profileId,
      limits: {
        maxFileBytes: MAX_FILE_BYTES,
        maxTotalFileBytes: MAX_TOTAL_FILE_BYTES,
        maxFiles: MAX_FILES
      },
      categories: Object.keys(CATEGORY_META)
    };
  }
);

exports.listFounderAssetAdmin = onCall(
  { region: REGION, timeoutSeconds: 20, memory: '256MiB' },
  async request => {
    await requireFounder(request);

    const snap = await db
      .collection(COLLECTION)
      .orderBy('updatedAt', 'desc')
      .limit(250)
      .get();

    return {
      ok: true,
      assets: snap.docs.map(doc => {
        const data = doc.data() || {};
        return {
          docId: doc.id,
          assetId: String(data.assetId || data.catalogAsset?.id || ''),
          name: String(data.catalogAsset?.name || ''),
          category: categoryLabelFromAsset(data.catalogAsset || {}),
          published: data.published === true,
          revision: Number(data.revision || 0),
          updatedAt: data.updatedAt?.toMillis?.() || 0,
          createdAt: data.createdAt?.toMillis?.() || 0
        };
      })
    };
  }
);

exports.publishFounderAsset = onCall(
  {
    region: REGION,
    timeoutSeconds: 120,
    memory: '1GiB'
  },
  async request => {
    const founder = await requireFounder(request);
    const data = request.data || {};

    const name = cleanString(data.name, 100);
    if (name.length < 2) {
      throw new HttpsError('invalid-argument', 'Asset name is required.');
    }

    const category = cleanString(data.category, 30);
    const categoryMeta = CATEGORY_META[category];
    if (!categoryMeta) {
      throw new HttpsError('invalid-argument', 'Unknown Asset Library category.');
    }

    const assetId = safeAssetId(data.assetId, name);
    const docId = founderAssetDocId(assetId);
    const docRef = db.doc(`${COLLECTION}/${docId}`);
    const existingSnap = await docRef.get();
    const existing = existingSnap.exists ? existingSnap.data() || {} : {};

    const totalState = { bytes: 0, count: 0 };
    const mainRaw = data.mainFile || null;
    const thumbnailRaw = data.thumbnailFile || null;
    const supplyRaw = Array.isArray(data.supplyFiles)
      ? data.supplyFiles.slice(0, MAX_FILES)
      : [];

    if (category !== 'Supplies' && !mainRaw) {
      const extraCheck = cleanJson(data.extra || {});
      if (!(category === 'Icon' && extraCheck?.iconJson)) {
        throw new HttpsError(
          'invalid-argument',
          'A main asset file is required for this category.'
        );
      }
    }

    const revision = Date.now();
    const storagePrefix = `founder-assets/${docId}/${revision}`;
    const bucket = storage.bucket();

    const uploaded = [];
    try {
      let sourceUrl = '';
      let thumbnailUrl = '';
      let mainMimeType = '';

      if (mainRaw) {
        const file = decodeFile(mainRaw, totalState);
        mainMimeType = file.mimeType;
        const saved = await savePublicTokenFile(
          bucket,
          storagePrefix,
          'source',
          file
        );
        uploaded.push(saved.objectPath);
        sourceUrl = saved.url;
      }

      if (thumbnailRaw) {
        const file = decodeFile(thumbnailRaw, totalState);
        if (!file.mimeType.startsWith('image/')) {
          throw new HttpsError(
            'invalid-argument',
            'The thumbnail must be an image.'
          );
        }
        const saved = await savePublicTokenFile(
          bucket,
          storagePrefix,
          'thumbnail',
          file
        );
        uploaded.push(saved.objectPath);
        thumbnailUrl = saved.url;
      }

      const supplyItems = [];
      if (category === 'Supplies') {
        if (!supplyRaw.length) {
          throw new HttpsError(
            'invalid-argument',
            'A Supplies pack must contain at least one uploaded item.'
          );
        }

        for (let i = 0; i < supplyRaw.length; i += 1) {
          const entry = supplyRaw[i] || {};
          const file = decodeFile(entry.file, totalState);
          if (!file.mimeType.startsWith('image/')) {
            throw new HttpsError(
              'invalid-argument',
              'DRAW Supplies currently accept image files only.'
            );
          }

          const kindRaw = cleanString(entry.kind, 20).toLowerCase();
          const kind = ['brush', 'sprite', 'image'].includes(kindRaw)
            ? kindRaw
            : 'image';
          const itemName =
            cleanString(entry.name, 100) ||
            file.name.replace(/\.[^.]+$/, '') ||
            `Supply ${i + 1}`;

          const saved = await savePublicTokenFile(
            bucket,
            storagePrefix,
            `supply_${i}_${safeToken(itemName, 38)}`,
            file
          );
          uploaded.push(saved.objectPath);

          supplyItems.push({
            id: safeToken(entry.id || itemName, 80),
            name: itemName,
            kind,
            source: saved.url
          });

          if (!thumbnailUrl && i === 0) thumbnailUrl = saved.url;
        }
      }

      const extra = cleanJson(data.extra || {});
      if (JSON.stringify(extra).length > 24000) {
        throw new HttpsError(
          'invalid-argument',
          'Advanced JSON metadata is too large.'
        );
      }

      // Founder-controlled advanced metadata can add normal catalog fields,
      // but these protected keys are always derived server-side.
      for (const key of [
        'id', 'name', 'displayName', 'type', 'category',
        'source', 'thumbnail', 'price', 'priceCredits',
        'currency', 'licenseLabel', 'tags', 'supplyData',
        'founderPublished'
      ]) {
        if (extra && typeof extra === 'object') delete extra[key];
      }

      const priceCredits = finiteInt(data.priceCredits, 0, 100000, 0);
      const tags = cleanTags(data.tags);
      const description = cleanString(data.description, 1200);
      const licenseLabel =
        cleanString(data.licenseLabel, 120) ||
        'E.R.A.S. Founder-Published Asset';

      const catalogAsset = {
        ...(extra || {}),
        id: assetId,
        name,
        displayName: name,
        type: categoryMeta.type,
        category: categoryMeta.category,
        description,
        source: sourceUrl || thumbnailUrl || '',
        thumbnail:
          thumbnailUrl ||
          (mainMimeType.startsWith('image/') ? sourceUrl : ''),
        price: priceCredits,
        priceCredits,
        currency: priceCredits > 0 ? 'CREDITS' : 'FREE',
        licenseLabel,
        tags,
        founderPublished: true,
        founderPublishedRevision: revision
      };

      if (category === 'Supplies') {
        catalogAsset.supplyData = { items: supplyItems };
      }

      const record = {
        assetId,
        catalogAsset,
        category,
        published: data.published !== false,
        storagePrefix,
        revision,
        createdByProfileId:
          existing.createdByProfileId || founder.profileId,
        updatedByProfileId: founder.profileId,
        createdAt:
          existingSnap.exists
            ? existing.createdAt || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        publishedAt:
          data.published === false
            ? existing.publishedAt || null
            : FieldValue.serverTimestamp()
      };

      await docRef.set(record, { merge: false });

      const priorPrefix = String(existing.storagePrefix || '');
      if (priorPrefix && priorPrefix !== storagePrefix) {
        bucket.deleteFiles({ prefix: `${priorPrefix}/` }).catch(error => {
          console.warn(
            'Old Founder Asset Library storage cleanup failed',
            priorPrefix,
            error?.message || error
          );
        });
      }

      return {
        ok: true,
        assetId,
        docId,
        published: record.published,
        revision,
        catalogAsset
      };
    } catch (error) {
      // Remove only the newly staged revision if publishing failed.
      if (uploaded.length) {
        bucket.deleteFiles({ prefix: `${storagePrefix}/` }).catch(() => {});
      }
      if (error instanceof HttpsError) throw error;
      console.error('Founder Asset Library publish failed', error);
      throw new HttpsError(
        'internal',
        `Could not publish asset: ${error?.message || error}`
      );
    }
  }
);

exports.setFounderAssetPublished = onCall(
  { region: REGION, timeoutSeconds: 30, memory: '256MiB' },
  async request => {
    await requireFounder(request);

    const assetId = cleanString(request.data?.assetId, 110).toLowerCase();
    if (!assetId) {
      throw new HttpsError('invalid-argument', 'Asset ID is required.');
    }

    const docRef = db.doc(`${COLLECTION}/${founderAssetDocId(assetId)}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Founder-published asset was not found.');
    }

    const published = request.data?.published === true;
    await docRef.update({
      published,
      updatedAt: FieldValue.serverTimestamp(),
      publishedAt: published ? FieldValue.serverTimestamp() : null
    });

    return { ok: true, assetId, published };
  }
);

exports.deleteFounderAsset = onCall(
  { region: REGION, timeoutSeconds: 60, memory: '512MiB' },
  async request => {
    await requireFounder(request);

    const assetId = cleanString(request.data?.assetId, 110).toLowerCase();
    if (!assetId) {
      throw new HttpsError('invalid-argument', 'Asset ID is required.');
    }

    const docRef = db.doc(`${COLLECTION}/${founderAssetDocId(assetId)}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { ok: true, assetId, deleted: false };
    }

    const data = snap.data() || {};
    const prefix = String(data.storagePrefix || '');
    await docRef.delete();

    if (prefix) {
      await storage.bucket().deleteFiles({ prefix: `${prefix}/` }).catch(error => {
        console.warn('Founder asset storage deletion failed', error?.message || error);
      });
    }

    return { ok: true, assetId, deleted: true };
  }
);

exports.listFounderPublishedAssets = onRequest(
  {
    region: REGION,
    timeoutSeconds: 30,
    memory: '256MiB',
    cors: true
  },
  async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    try {
      const snap = await db
        .collection(COLLECTION)
        .where('published', '==', true)
        .limit(500)
        .get();

      const assets = snap.docs
        .map(doc => doc.data()?.catalogAsset)
        .filter(asset => asset && typeof asset === 'object' && asset.id)
        .sort((a, b) =>
          String(a.name || a.id).localeCompare(
            String(b.name || b.id),
            undefined,
            { numeric: true, sensitivity: 'base' }
          )
        );

      const categories = [
        ...new Set(
          assets.map(asset => categoryLabelFromAsset(asset)).filter(Boolean)
        )
      ];

      response.set(
        'Cache-Control',
        'public,max-age=45,s-maxage=180,stale-while-revalidate=300'
      );
      response.status(200).json({
        version: 1,
        updatedAt: new Date().toISOString(),
        categories,
        assets
      });
    } catch (error) {
      console.error('Founder public asset list failed', error);
      response.status(500).json({
        version: 1,
        updatedAt: new Date().toISOString(),
        categories: [],
        assets: [],
        error: 'Founder-published assets are temporarily unavailable.'
      });
    }
  }
);

exports.founderAssetDocId = founderAssetDocId;
