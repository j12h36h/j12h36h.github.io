const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
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
  const publishedGameId = crypto.randomUUID();
  const lobbyId = publishedGameId;
  const code = makeCode();
  const now = Timestamp.now();
  const nextBillingAt = Timestamp.fromMillis(now.toMillis() + 60000);
  const walletRef = db.doc(`creditWallets/${ownerProfileId}`);
  const publishedRef = db.doc(`publishedGames/${publishedGameId}`);
  const lobbyRef = db.doc(`gameLobbies/${lobbyId}`);
  const memberRef = lobbyRef.collection('members').doc(ownerProfileId);
  await db.runTransaction(async tx => {
    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists || Number(walletSnap.data().balance || 0) < PRICE_PER_MINUTE) throw new HttpsError('failed-precondition', 'At least 1 Credit is required to publish the first minute.');
    const wallet = walletSnap.data();
    const lobby = { ...draft, code, hostProfileId: ownerProfileId, accessOfferId: '', status: 'open', sourceType: 'published', publishedGameId, createdAt: now, updatedAt: now, lastHeartbeatAt: now };
    const published = { ...draft, code, ownerProfileId, lobbyId, accessOfferId: '', status: 'published', priceCreditsPerMinute: PRICE_PER_MINUTE, totalMinutesBilled: 1, createdAt: now, updatedAt: now, lastBilledAt: now, nextBillingAt };
    tx.set(walletRef, walletSpendPatch(wallet, `published_${publishedGameId}_${now.toMillis()}`, PRICE_PER_MINUTE));
    tx.create(publishedRef, published);
    tx.create(lobbyRef, lobby);
    tx.create(memberRef, { profileId: ownerProfileId, role: 'host', accessEntitlementId: '', accessStartedAt: now, accessLeaseSeconds: 600, joinedAt: now, lastSeenAt: now });
  });
  return { ok: true, publishedGameId, lobbyId, code, status: 'published', nextBillingAt: nextBillingAt.toMillis() };
});

exports.attachPublishedAccessOffer = onCall(async request => {
  const ownerProfileId = await callerProfileId(request);
  const publishedGameId = cleanString(request.data?.publishedGameId, 180);
  const accessOfferId = cleanString(request.data?.accessOfferId, 180);
  const publishedRef = db.doc(`publishedGames/${publishedGameId}`);
  const published = await publishedRef.get();
  if (!published.exists || published.data().ownerProfileId !== ownerProfileId) throw new HttpsError('permission-denied', 'Published game not owned by this profile.');
  const offer = await db.doc(`hostedOffers/${accessOfferId}`).get();
  if (!offer.exists || offer.data().sellerProfileId !== ownerProfileId || offer.data().lobbyId !== published.data().lobbyId || offer.data().offerType !== 'game_access' || offer.data().active !== true) throw new HttpsError('failed-precondition', 'Invalid published-game access offer.');
  const now = Timestamp.now();
  await Promise.all([
    publishedRef.update({ accessOfferId, updatedAt: now }),
    db.doc(`gameLobbies/${published.data().lobbyId}`).update({ accessOfferId, updatedAt: now })
  ]);
  return { ok: true };
});

exports.pausePublishedGame = onCall(async request => {
  const ownerProfileId = await callerProfileId(request);
  const id = cleanString(request.data?.publishedGameId, 180);
  const ref = db.doc(`publishedGames/${id}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().ownerProfileId !== ownerProfileId) throw new HttpsError('permission-denied', 'Published game not owned by this profile.');
    const now = Timestamp.now();
    tx.update(ref, { status: 'paused', updatedAt: now });
    tx.update(db.doc(`gameLobbies/${snap.data().lobbyId}`), { status: 'closed', updatedAt: now, lastHeartbeatAt: now });
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
      return;
    }
    const due = Math.max(1, Math.floor((now.toMillis() - game.nextBillingAt.toMillis()) / 60000) + 1);
    const charge = Math.min(balance, due);
    const nextBillingAt = Timestamp.fromMillis(game.nextBillingAt.toMillis() + charge * 60000);
    const timedOut = charge < due;
    tx.set(walletRef, walletSpendPatch(wallet, `published_${fresh.id}_${now.toMillis()}`, charge));
    tx.update(publishedRef, { status: timedOut ? 'timed_out' : 'published', updatedAt: now, lastBilledAt: now, nextBillingAt, totalMinutesBilled: Number(game.totalMinutesBilled || 0) + charge });
    if (timedOut) tx.update(db.doc(`gameLobbies/${game.lobbyId}`), { status: 'timed_out', updatedAt: now, lastHeartbeatAt: now });
  });
}

exports.billPublishedGames = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Etc/UTC' }, async () => {
  const now = Timestamp.now();
  const due = await db.collection('publishedGames').where('status','==','published').where('nextBillingAt','<=',now).limit(500).get();
  const docs = due.docs;
  for (let i = 0; i < docs.length; i += 20) await Promise.all(docs.slice(i, i + 20).map(doc => billOnePublishedGame(doc, now)));
});
