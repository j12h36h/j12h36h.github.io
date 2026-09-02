const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();
const PRICE_PER_MINUTE = 1;

function incrementPatch(fields) {
  const patch = { updatedAt: FieldValue.serverTimestamp() };
  for (const field of fields) patch[field] = FieldValue.increment(1);
  return patch;
}
async function bumpGlobal(fields) {
  if (!fields.length) return;
  await db.doc('desktopSyncGlobal/state').set(incrementPatch([...new Set(fields)]), { merge: true });
}
async function bumpUser(profileId, fields) {
  if (!profileId || !fields.length) return;
  await db.doc(`desktopSyncUsers/${profileId}`).set({ profileId, ...incrementPatch([...new Set(fields)]) }, { merge: true });
}
function documentData(event) {
  const after = event.data?.after;
  const before = event.data?.before;
  return after?.exists ? after.data() : (before?.exists ? before.data() : {});
}

// One tiny version-vector update replaces repeated full Desktop snapshots.
exports.desktopSyncTopLevel = onDocumentWritten('{collectionId}/{documentId}', async event => {
  const c = event.params.collectionId;
  if (c === 'desktopSyncGlobal' || c === 'desktopSyncUsers') return;
  const data = documentData(event);
  const jobs = [];
  if (['publicPosts','publicObjects','publicComments','publicSpaces','publicChannels','publicCommunityMembers','publicLfg','publicReactions','publicFollows','publicConnections','publicPostLinks'].includes(c)) {
    jobs.push(bumpGlobal(['socialRevision','eventsRevision']));
  } else if (c === 'publicProfiles') {
    jobs.push(bumpGlobal(['profilesRevision','eventsRevision']));
  } else if (c === 'gameLobbies') {
    jobs.push(bumpGlobal(['gamesRevision','eventsRevision']));
  } else if (c === 'statusAssignments') {
    jobs.push(bumpGlobal(['profilesRevision','eventsRevision']));
    jobs.push(bumpUser(data.profileId, ['identityRevision','eventsRevision']));
  } else if (c === 'creditWallets') {
    jobs.push(bumpUser(event.params.documentId, ['walletRevision']));
  } else if (c === 'assetHoldings') {
    jobs.push(bumpUser(data.ownerProfileId, ['inventoryRevision']));
  } else if (c === 'directMessageThreads') {
    for (const profileId of (data.members || [])) jobs.push(bumpUser(profileId, ['chatRevision','eventsRevision']));
  } else if (c === 'creditTransfers') {
    jobs.push(bumpUser(data.fromProfileId, ['eventsRevision']));
    jobs.push(bumpUser(data.toProfileId, ['eventsRevision']));
  } else if (c === 'publishedGames') {
    const beforeStatus = event.data?.before?.exists ? event.data.before.data()?.status : '';
    const afterStatus = event.data?.after?.exists ? event.data.after.data()?.status : '';
    if (beforeStatus !== afterStatus) jobs.push(bumpUser(data.ownerProfileId, ['gamesRevision','eventsRevision']));
  }
  await Promise.all(jobs);
});

async function callerProfileId(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');
  const account = await db.doc(`privateAccounts/${uid}`).get();
  const profileId = account.data()?.publicProfileId;
  if (!profileId) throw new HttpsError('failed-precondition', 'E.R.A.S. public profile is not linked.');
  return profileId;
}

// Native E.R.A.S. Desktop already owns the authenticated Firebase session.
// Verify its Firebase ID token through callable auth, then mint a short-lived
// custom token for the exact same UID so embedded website modules never need
// their own account picker/sign-in flow.
exports.desktopWebSession = onCall(async request => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'A valid E.R.A.S. Desktop Firebase session is required.');
  const customToken = await getAuth().createCustomToken(uid, { erasDesktop: true });
  return { customToken };
});

async function communityAuthority(profileId, spaceId) {
  const [spaceSnap, founderSnap, memberSnap] = await Promise.all([
    db.doc(`publicSpaces/${spaceId}`).get(),
    db.doc('systemPrivate/founder').get(),
    db.doc(`publicCommunityMembers/${spaceId}__${profileId}`).get()
  ]);
  if (!spaceSnap.exists) throw new HttpsError('not-found', 'Community not found.');
  const space = spaceSnap.data();
  const isFounder = founderSnap.exists && founderSnap.data()?.profileId === profileId;
  const isOwner = space.ownerProfileId === profileId;
  const role = memberSnap.exists ? String(memberSnap.data()?.role || '') : '';
  return {
    space, isFounder, isOwner, role,
    canModerate: isFounder || isOwner || role === 'moderator',
    canOwn: isFounder || isOwner
  };
}
function normalizedCommunityChannelType(value) {
  return ['discussion','ideas','problems','projects','research','releases','announcements'].includes(value)
    ? value : 'discussion';
}
function normalizedCommunityChannelId(value = '') {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 180);
  return cleaned || crypto.randomUUID();
}

exports.manageCommunity = onCall(async request => {
  const actorProfileId = await callerProfileId(request);
  const action = cleanString(request.data?.action, 40);
  const spaceId = cleanString(request.data?.spaceId, 128);
  if (!spaceId) throw new HttpsError('invalid-argument', 'Community is required.');

  const authority = await communityAuthority(actorProfileId, spaceId);
  if (!authority.canModerate) {
    throw new HttpsError('permission-denied', 'Community moderator authority is required.');
  }
  const now = Timestamp.now();

  if (action === 'create_channel') {
    const channelId = normalizedCommunityChannelId(request.data?.channelId);
    const ref = db.doc(`publicChannels/${channelId}`);
    if ((await ref.get()).exists) throw new HttpsError('already-exists', 'That channel already exists.');
    const name = cleanString(request.data?.name || 'general', 40);
    if (name.length < 2) throw new HttpsError('invalid-argument', 'Channel name must be at least 2 characters.');
    await ref.create({
      spaceId,
      name,
      description: cleanString(request.data?.description, 240),
      type: normalizedCommunityChannelType(request.data?.type),
      ownerProfileId: authority.space.ownerProfileId,
      deleted: false,
      deletedAt: null,
      deletedByProfileId: '',
      createdAt: now,
      updatedAt: now
    });
    return { ok: true, channelId };
  }

  const channelId = cleanString(request.data?.channelId, 180);
  if (action === 'update_channel' || action === 'delete_channel') {
    if (!channelId) throw new HttpsError('invalid-argument', 'Channel is required.');
    const ref = db.doc(`publicChannels/${channelId}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.spaceId !== spaceId) {
      throw new HttpsError('not-found', 'Channel not found in this community.');
    }

    if (action === 'update_channel') {
      if (snap.data()?.deleted === true) throw new HttpsError('failed-precondition', 'Deleted channels cannot be edited.');
      const name = cleanString(request.data?.name, 40);
      if (name.length < 2) throw new HttpsError('invalid-argument', 'Channel name must be at least 2 characters.');
      await ref.update({
        name,
        description: cleanString(request.data?.description, 240),
        type: normalizedCommunityChannelType(request.data?.type),
        updatedAt: now
      });
      return { ok: true, channelId };
    }

    const channels = await db.collection('publicChannels').where('spaceId', '==', spaceId).limit(250).get();
    const activeCount = channels.docs.filter(doc => doc.data()?.deleted !== true).length;
    if (activeCount <= 1) throw new HttpsError('failed-precondition', 'A community must keep at least one channel.');

    await ref.update({
      deleted: true,
      deletedAt: now,
      deletedByProfileId: actorProfileId,
      updatedAt: now
    });
    return { ok: true, channelId };
  }

  const targetProfileId = cleanString(request.data?.profileId, 36);

  if (action === 'set_role') {
    if (!authority.canOwn) {
      throw new HttpsError('permission-denied', 'Only the community owner or Founder can change moderator roles.');
    }
    if (!targetProfileId) throw new HttpsError('invalid-argument', 'Participant is required.');
    const role = cleanString(request.data?.role, 20);
    if (!['member','moderator'].includes(role)) {
      throw new HttpsError('invalid-argument', 'Role must be member or moderator.');
    }
    const ref = db.doc(`publicCommunityMembers/${spaceId}__${targetProfileId}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.spaceId !== spaceId || snap.data()?.role === 'owner') {
      throw new HttpsError('failed-precondition', 'That participant role cannot be changed.');
    }
    await ref.update({ role, updatedAt: now });
    return { ok: true, profileId: targetProfileId, role };
  }

  if (action === 'remove_member') {
    if (!targetProfileId) throw new HttpsError('invalid-argument', 'Participant is required.');
    const ref = db.doc(`publicCommunityMembers/${spaceId}__${targetProfileId}`);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.spaceId !== spaceId) {
      throw new HttpsError('not-found', 'Participant not found.');
    }
    const targetRole = String(snap.data()?.role || 'member');
    if (targetRole === 'owner') throw new HttpsError('failed-precondition', 'The community owner cannot be removed.');
    if (!authority.canOwn && !(authority.role === 'moderator' && targetRole === 'member')) {
      throw new HttpsError(
        'permission-denied',
        'A moderator can remove members, but only the owner or Founder can remove another moderator.'
      );
    }
    await ref.delete();
    return { ok: true, profileId: targetProfileId };
  }

  throw new HttpsError('invalid-argument', 'Unsupported community action.');
});

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
  return out;
}
function cleanString(value, max) { return String(value || '').trim().slice(0, max); }
function validateDraft(raw) {
  const gameStyle = cleanString(raw.gameStyle, 40);
  const allowedMaps = {
    'arcade-topdown': ['global-plaza','slime-yard'],
    'galactic-dominion': ['galactic-ring'],
    'surface-discovery': ['surface-grid'],
    'jeng-stroid': ['stack-bay'],
    'sunball': ['solar-table'],
    'soldoku': ['logic-grid'],
    'escape-pod-dash': ['launch-corridor']
  };
  if (!allowedMaps[gameStyle]) throw new HttpsError('invalid-argument', 'Unsupported game mode.');
  const mapId = cleanString(raw.mapId, 80);
  if (!allowedMaps[gameStyle].includes(mapId)) throw new HttpsError('invalid-argument', 'Unsupported map for this game mode.');
  const maxPlayers = Math.max(2, Math.min(32, Number(raw.maxPlayers) || 8));
  const settings = raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings) ? raw.settings : {};
  if (JSON.stringify(settings).length > 700000) throw new HttpsError('invalid-argument', 'World definition is too large.');
  return {
    name: cleanString(raw.name || 'E.R.A.S. Game', 50),
    visibility: ['public','friends','code'].includes(raw.visibility) ? raw.visibility : 'public',
    maxPlayers,
    mapId,
    gameStyle,
    description: cleanString(raw.description, 240),
    settings,
    hostAssets: Array.isArray(raw.hostAssets) ? raw.hostAssets.slice(0, 8) : []
  };
}
async function validateHostAssets(ownerProfileId, hostAssets) {
  for (const asset of hostAssets) {
    if (!asset || !asset.holdingId || !asset.assetId) throw new HttpsError('invalid-argument', 'Invalid host asset reference.');
    const holding = await db.doc(`assetHoldings/${asset.holdingId}`).get();
    const data = holding.data();
    if (!holding.exists || data.ownerProfileId !== ownerProfileId || data.assetId !== asset.assetId || String(data.tint || '#ffffff') !== String(asset.tint || '#ffffff')) {
      throw new HttpsError('permission-denied', 'A referenced host asset is no longer owned by the publisher.');
    }
  }
}
function clampInt(value, min, max, fallback = min) {
  let n = Number(value);
  if (!Number.isFinite(n)) n = fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function normalizeBillingModel(value) {
  return ['free','per_play','per_life','playtime','permanent'].includes(value) ? value : 'free';
}
function paidOfferAccess(raw = {}) {
  const billing = normalizeBillingModel(raw.model);
  if (billing === 'free') return null;
  return {
    billing,
    priceCredits: clampInt(raw.priceCredits, 1, 1000000, 1),
    playCount: billing === 'per_play' ? clampInt(raw.playCount, 1, 9999, 1) : 0,
    lifeCount: billing === 'per_life' ? clampInt(raw.lifeCount, 1, 9999, 1) : 0,
    minutes: billing === 'playtime' ? clampInt(raw.minutes, 1, 100000, 30) : 0,
    permanent: billing === 'permanent'
  };
}
function normalizePublishedCommerce(raw, draft) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const selectedHoldingIds = new Set(draft.hostAssets.map(asset => String(asset.holdingId || '')));
  const access = paidOfferAccess(input.access);
  const asset = paidOfferAccess(input.asset);
  const bundles = Array.isArray(input.bundles) ? input.bundles.slice(0, 20).map(rawBundle => {
    const bundle = rawBundle && typeof rawBundle === 'object' && !Array.isArray(rawBundle) ? rawBundle : {};
    const assetHoldingIds = [...new Set((Array.isArray(bundle.assetHoldingIds) ? bundle.assetHoldingIds : [])
      .map(id => cleanString(id, 180)).filter(id => id && selectedHoldingIds.has(id)))].slice(0, 4);
    const playCount = clampInt(bundle.playCount, 0, 9999, 0);
    const lifeCount = clampInt(bundle.lifeCount, 0, 9999, 0);
    const minutes = clampInt(bundle.minutes, 0, 100000, 0);
    const permanent = bundle.permanent === true;
    if (!assetHoldingIds.length && !playCount && !lifeCount && !minutes && !permanent) return null;
    return {
      name: cleanString(bundle.name || `${draft.name} Bundle`, 60),
      priceCredits: clampInt(bundle.priceCredits, 1, 1000000, 25),
      playCount, lifeCount, minutes, permanent, assetHoldingIds
    };
  }).filter(Boolean) : [];
  return { access, asset, bundles };
}
function hostedOfferDocument({ ownerProfileId, lobbyId, offerType, billing, title, description, priceCredits, playCount = 0, lifeCount = 0, minutes = 0, permanent = false, assetHoldingIds = [], now }) {
  return {
    sellerProfileId: ownerProfileId,
    lobbyId,
    offerType,
    billing,
    title: cleanString(title, 60),
    description: cleanString(description, 180),
    priceCredits: clampInt(priceCredits, 1, 1000000, 1),
    playCount: clampInt(playCount, 0, 9999, 0),
    lifeCount: clampInt(lifeCount, 0, 9999, 0),
    minutes: clampInt(minutes, 0, 100000, 0),
    permanent: permanent === true,
    assetHoldingIds: assetHoldingIds.slice(0, 4),
    active: true,
    createdAt: now,
    updatedAt: now
  };
}
function buildPublishedOffers(ownerProfileId, lobbyId, draft, commerce, now) {
  const offers = [];
  let accessOfferId = '';
  if (commerce.access) {
    accessOfferId = crypto.randomUUID();
    offers.push({ id: accessOfferId, data: hostedOfferDocument({
      ownerProfileId, lobbyId, offerType: 'game_access', ...commerce.access,
      title: `${draft.name} — Access`, description: `${draft.gameStyle} published-game access.`, assetHoldingIds: [], now
    }) });
  }
  if (commerce.asset) {
    for (const asset of draft.hostAssets) {
      offers.push({ id: crypto.randomUUID(), data: hostedOfferDocument({
        ownerProfileId, lobbyId, offerType: 'icon_license', ...commerce.asset,
        title: `${asset.assetId} — Published Icon License`,
        description: `Use this publisher-owned icon in ${draft.name}. Ownership remains with the publisher.`,
        assetHoldingIds: [asset.holdingId], now
      }) });
    }
  }
  for (const bundle of commerce.bundles) {
    offers.push({ id: crypto.randomUUID(), data: hostedOfferDocument({
      ownerProfileId, lobbyId, offerType: 'bundle', billing: 'bundle',
      title: bundle.name, description: `Bundle for ${draft.name}. Exact contents shown before purchase.`,
      priceCredits: bundle.priceCredits, playCount: bundle.playCount, lifeCount: bundle.lifeCount,
      minutes: bundle.minutes, permanent: bundle.permanent, assetHoldingIds: bundle.assetHoldingIds, now
    }) });
  }
  return { offers, accessOfferId };
}
function setPublishedOffersActive(tx, game, active, now) {
  for (const offerId of (Array.isArray(game.offerIds) ? game.offerIds : [])) {
    tx.update(db.doc(`hostedOffers/${offerId}`), { active, updatedAt: now });
  }
}
function walletSpendPatch(wallet, eventId, amount) {
  return {
    profileId: wallet.profileId,
    balance: Number(wallet.balance || 0) - amount,
    totalEarned: Number(wallet.totalEarned || 0),
    totalLost: Number(wallet.totalLost || 0),
    lastEventId: eventId,
    lastEventType: 'published_game_minute',
    createdAt: wallet.createdAt,
    updatedAt: Timestamp.now()
  };
}

exports.publishGame = onCall(async request => {
  const ownerProfileId = await callerProfileId(request);
  const draft = validateDraft(request.data || {});
  await validateHostAssets(ownerProfileId, draft.hostAssets);
  const commerce = normalizePublishedCommerce(request.data?.commerce, draft);
  const publishedGameId = crypto.randomUUID();
  const lobbyId = publishedGameId;
  const code = makeCode();
  const now = Timestamp.now();
  const nextBillingAt = Timestamp.fromMillis(now.toMillis() + 60000);
  const walletRef = db.doc(`creditWallets/${ownerProfileId}`);
  const publishedRef = db.doc(`publishedGames/${publishedGameId}`);
  const lobbyRef = db.doc(`gameLobbies/${lobbyId}`);
  const memberRef = lobbyRef.collection('members').doc(ownerProfileId);
  const { offers, accessOfferId } = buildPublishedOffers(ownerProfileId, lobbyId, draft, commerce, now);
  const offerIds = offers.map(offer => offer.id);

  // Publication, first-minute billing, lobby projection, host membership, and all
  // paid-access offers are created atomically. A paid game is never briefly joinable
  // as a free game while its access offer is being attached.
  await db.runTransaction(async tx => {
    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists || Number(walletSnap.data().balance || 0) < PRICE_PER_MINUTE) {
      throw new HttpsError('failed-precondition', 'At least 1 Credit is required to publish the first minute.');
    }
    const wallet = walletSnap.data();
    const lobby = { ...draft, code, hostProfileId: ownerProfileId, accessOfferId, status: 'open', sourceType: 'published', publishedGameId, createdAt: now, updatedAt: now, lastHeartbeatAt: now };
    const published = { ...draft, code, ownerProfileId, lobbyId, accessOfferId, offerIds, status: 'published', priceCreditsPerMinute: PRICE_PER_MINUTE, totalMinutesBilled: 1, createdAt: now, updatedAt: now, lastBilledAt: now, nextBillingAt };
    tx.set(walletRef, walletSpendPatch(wallet, `published_${publishedGameId}_${now.toMillis()}`, PRICE_PER_MINUTE));
    for (const offer of offers) tx.create(db.doc(`hostedOffers/${offer.id}`), offer.data);
    tx.create(publishedRef, published);
    tx.create(lobbyRef, lobby);
    tx.create(memberRef, { profileId: ownerProfileId, role: 'host', accessEntitlementId: '', accessStartedAt: now, accessLeaseSeconds: 600, joinedAt: now, lastSeenAt: now });
  });
  return { ok: true, publishedGameId, lobbyId, code, accessOfferId, offerCount: offerIds.length, status: 'published', nextBillingAt: nextBillingAt.toMillis() };
});

exports.pausePublishedGame = onCall(async request => {
  const ownerProfileId = await callerProfileId(request);
  const id = cleanString(request.data?.publishedGameId, 180);
  const ref = db.doc(`publishedGames/${id}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().ownerProfileId !== ownerProfileId) throw new HttpsError('permission-denied', 'Published game not owned by this profile.');
    const now = Timestamp.now();
    const game = snap.data();
    tx.update(ref, { status: 'paused', updatedAt: now });
    tx.update(db.doc(`gameLobbies/${game.lobbyId}`), { status: 'closed', updatedAt: now, lastHeartbeatAt: now });
    setPublishedOffersActive(tx, game, false, now);
  });
  return { ok: true, status: 'paused' };
});

exports.restorePublishedGame = onCall(async request => {
  const ownerProfileId = await callerProfileId(request);
  const id = cleanString(request.data?.publishedGameId, 180);
  const ref = db.doc(`publishedGames/${id}`);
  const walletRef = db.doc(`creditWallets/${ownerProfileId}`);
  await db.runTransaction(async tx => {
    const [gameSnap, walletSnap] = await Promise.all([tx.get(ref), tx.get(walletRef)]);
    if (!gameSnap.exists || gameSnap.data().ownerProfileId !== ownerProfileId) throw new HttpsError('permission-denied', 'Published game not owned by this profile.');
    if (gameSnap.data().status === 'published') return;
    if (!walletSnap.exists || Number(walletSnap.data().balance || 0) < PRICE_PER_MINUTE) throw new HttpsError('failed-precondition', 'At least 1 Credit is required to restore publishing.');
    const now = Timestamp.now(), nextBillingAt = Timestamp.fromMillis(now.toMillis() + 60000), game = gameSnap.data(), wallet = walletSnap.data();
    tx.set(walletRef, walletSpendPatch(wallet, `published_restore_${id}_${now.toMillis()}`, PRICE_PER_MINUTE));
    tx.update(ref, { status: 'published', updatedAt: now, lastBilledAt: now, nextBillingAt, totalMinutesBilled: Number(game.totalMinutesBilled || 0) + 1 });
    tx.update(db.doc(`gameLobbies/${game.lobbyId}`), { status: 'open', updatedAt: now, lastHeartbeatAt: now });
    setPublishedOffersActive(tx, game, true, now);
  });
  return { ok: true, status: 'published' };
});

async function billOnePublishedGame(doc, now) {
  const publishedRef = doc.ref;
  await db.runTransaction(async tx => {
    const fresh = await tx.get(publishedRef);
    if (!fresh.exists) return;
    const game = fresh.data();
    if (game.status !== 'published' || !game.nextBillingAt || game.nextBillingAt.toMillis() > now.toMillis()) return;
    const walletRef = db.doc(`creditWallets/${game.ownerProfileId}`), walletSnap = await tx.get(walletRef);
    const wallet = walletSnap.exists ? walletSnap.data() : null;
    const balance = Number(wallet?.balance || 0);
    if (!wallet || balance <= 0) {
      tx.update(publishedRef, { status: 'timed_out', updatedAt: now });
      tx.update(db.doc(`gameLobbies/${game.lobbyId}`), { status: 'timed_out', updatedAt: now, lastHeartbeatAt: now });
      setPublishedOffersActive(tx, game, false, now);
      return;
    }
    const due = Math.max(1, Math.floor((now.toMillis() - game.nextBillingAt.toMillis()) / 60000) + 1);
    const charge = Math.min(balance, due);
    const nextBillingAt = Timestamp.fromMillis(game.nextBillingAt.toMillis() + charge * 60000);
    const timedOut = charge < due;
    tx.set(walletRef, walletSpendPatch(wallet, `published_${fresh.id}_${now.toMillis()}`, charge));
    tx.update(publishedRef, { status: timedOut ? 'timed_out' : 'published', updatedAt: now, lastBilledAt: now, nextBillingAt, totalMinutesBilled: Number(game.totalMinutesBilled || 0) + charge });
    if (timedOut) {
      tx.update(db.doc(`gameLobbies/${game.lobbyId}`), { status: 'timed_out', updatedAt: now, lastHeartbeatAt: now });
      setPublishedOffersActive(tx, game, false, now);
    }
  });
}

exports.billPublishedGames = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Etc/UTC' }, async () => {
  const now = Timestamp.now();
  const due = await db.collection('publishedGames').where('status','==','published').where('nextBillingAt','<=',now).limit(500).get();
  const docs = due.docs;
  for (let i = 0; i < docs.length; i += 20) {
    const results = await Promise.allSettled(docs.slice(i, i + 20).map(doc => billOnePublishedGame(doc, now)));
    for (const result of results) if (result.status === 'rejected') console.error('Published-game billing transaction failed', result.reason);
  }
});
