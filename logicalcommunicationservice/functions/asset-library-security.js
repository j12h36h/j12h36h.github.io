const crypto = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

if (!getApps().length) initializeApp();
const db = getFirestore();

const PITCH_PRESETS = Object.freeze([
  ['Sub Bass',0.50],['Bass',0.63],['Baritone',0.75],['Tenor',0.89],
  ['Alto',1.00],['Mezzo-Soprano',1.12],['Soprano',1.26],['High Soprano',1.50]
]);
const MODE_RULES = Object.freeze([
  'Highest Score','Longest Alive','Last Alive','Fastest Finish',
  'Most Objectives','First to Target','Best Accuracy','Fewest Mistakes'
]);
const ICON_PRESETS = Object.freeze([
  ['Original','#ffffff','#925cff','#64d9ff'],
  ['Cyan','#dfffff','#64d9ff','#0e7f94'],
  ['Green','#e6fff0','#72e0a1','#287e4e'],
  ['Orange','#fff3dd','#ffb22e','#9c5d00'],
  ['Purple','#f2e8ff','#b98cff','#6330a9']
]);
const COMMON_TINTS = Object.freeze(['#65d67c','#65c8ff','#e07cff','#ff8b67','#e8e8e8']);

const ASSETS = Object.freeze({
  'eras:slime_monochrome': { kind:'Sprite', defaultTint:'#65d67c' },
  'eras:health_potion': { kind:'Sprite', defaultTint:'#ff5b67' },
  'eras:slime_juice': { kind:'Sprite', defaultTint:'#65d67c' },
  'eras:hand_wraps': { kind:'Sprite', defaultTint:'#d7c7a2' },

  'eras:audio_turn_based_theme': { kind:'Audio', defaultPitch:'Alto' },
  'eras:audio_damaged_hit': { kind:'Audio', defaultPitch:'Baritone' },
  'eras:audio_confirm': { kind:'Audio', defaultPitch:'Soprano' },
  'eras:audio_heal_chime': { kind:'Audio', defaultPitch:'Mezzo-Soprano' },

  'eras:mode_turn_based_tactical': { kind:'Mode', modeId:'arcade-topdown' },
  'eras:mode_galactic_dominion': { kind:'Mode', modeId:'galactic-dominion' },
  'eras:mode_surface_discovery': { kind:'Mode', modeId:'surface-discovery' },
  'eras:mode_jeng_stroid': { kind:'Mode', modeId:'jeng-stroid' },
  'eras:mode_sunball': { kind:'Mode', modeId:'sunball' },
  'eras:mode_soldoku': { kind:'Mode', modeId:'soldoku' },
  'eras:mode_escape_pod_dash': { kind:'Mode', modeId:'escape-pod-dash' },

  'eras:world_turn_based_medieval': {
    kind:'World',
    defaultSkin:'Medieval'
  },

  'eras:effect_damaged': {
    kind:'Effect', defaultImpact:{size:1.0,brightness:1.35,tint:'#ff5166'}
  },
  'eras:effect_heal_pulse': {
    kind:'Effect', defaultImpact:{size:1.0,brightness:1.15,tint:'#72e0a1'}
  },
  'eras:effect_spawn_burst': {
    kind:'Effect', defaultImpact:{size:1.1,brightness:1.25,tint:'#b98cff'}
  },
  'eras:effect_movement_trail': {
    kind:'Effect', defaultImpact:{size:0.8,brightness:0.9,tint:'#64d9ff'}
  },

  'eras:icon_attack': { kind:'Icon' },
  'eras:icon_defend': { kind:'Icon' },
  'eras:icon_heal': { kind:'Icon' },
  'eras:icon_move': { kind:'Icon' },
  'eras:icon_interact': { kind:'Icon' },
  'eras:icon_objective': { kind:'Icon' },
  'eras:icon_collection': { kind:'Icon' },
  'eras:icon_chat': { kind:'Icon' }
});

const MODE_RUNTIME = Object.freeze({
  'arcade-topdown': { name:'Turn-Based Tactical', mapId:'global-plaza', maxPlayers:2, runtime:'global' },
  'galactic-dominion': { name:'Galactic Dominion', mapId:'galactic-ring', maxPlayers:2, runtime:'galactic' },
  'surface-discovery': { name:'Surface Discovery', mapId:'surface-grid', maxPlayers:2, runtime:'hosted' },
  'jeng-stroid': { name:'Jeng-stroid', mapId:'stack-bay', maxPlayers:2, runtime:'hosted' },
  'sunball': { name:'Sunball', mapId:'solar-table', maxPlayers:2, runtime:'hosted' },
  'soldoku': { name:'Soldoku', mapId:'logic-grid', maxPlayers:2, runtime:'hosted' },
  'escape-pod-dash': { name:'Escape Pod Dash', mapId:'launch-corridor', maxPlayers:2, runtime:'hosted' }
});

function requireAuth(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated','Sign in through E.R.A.S. first.');
  return uid;
}

async function callerProfile(uid) {
  const account = await db.doc(`privateAccounts/${uid}`).get();
  const profileId = String(account.data()?.publicProfileId || '');
  if (!profileId) throw new HttpsError('failed-precondition','E.R.A.S. profile link is missing.');
  return profileId;
}

function safeHex(value, fallback='#ffffff') {
  const text = String(value || '').toLowerCase();
  return /^#[0-9a-f]{6}$/.test(text) ? text : fallback;
}
function token(value) {
  return String(value || '')
    .trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'_')
    .replace(/^_+|_+$/g,'').slice(0,80) || 'default';
}
function sameNumber(a,b,epsilon=.001) {
  return Math.abs(Number(a)-Number(b)) <= epsilon;
}
function pitchPreset(rate) {
  let best = null;
  let distance = Infinity;
  for (const [name,value] of PITCH_PRESETS) {
    const d = Math.abs(Number(rate)-value);
    if (d < distance) { best={name,value}; distance=d; }
  }
  return { best,distance };
}

function normalizeVariant(assetId, raw={}) {
  const asset = ASSETS[assetId];
  if (!asset) throw new HttpsError('invalid-argument','Unknown E.R.A.S. Asset Library asset.');

  if (asset.kind === 'Sprite') {
    const tint = safeHex(raw.tint,asset.defaultTint);
    const presets = new Set([asset.defaultTint.toLowerCase(),...COMMON_TINTS]);
    const custom = !presets.has(tint);
    return { storage:tint, custom, price:custom?1:0, label:tint.toUpperCase() };
  }

  if (asset.kind === 'Audio') {
    const rate = Math.max(.5,Math.min(1.5,Number(raw.pitchRate ?? 1)));
    const {best,distance} = pitchPreset(rate);
    const custom = !best || distance > .004;
    if (!custom) {
      return {
        storage:`audio|pitch=${token(best.name)}`,
        custom:false, price:0, label:best.name,
        runtime:{pitchRate:best.value}
      };
    }
    return {
      storage:`audio|rate=${rate.toFixed(2)}`,
      custom:true, price:1, label:`${rate.toFixed(2)}x CUSTOM`,
      runtime:{pitchRate:rate}
    };
  }

  if (asset.kind === 'Mode') {
    const requested = String(raw.rule || 'Highest Score');
    const custom = requested === '__custom__' || !MODE_RULES.includes(requested);
    if (!custom) {
      return { storage:`mode|rule=${token(requested)}`, custom:false, price:0, label:requested };
    }
    const customRule = String(raw.customRule || '').trim().slice(0,80);
    if (customRule.length < 2) throw new HttpsError('invalid-argument','Custom Mode Rule must be at least 2 characters.');
    return { storage:`mode|custom_rule=${token(customRule)}`, custom:true, price:1, label:customRule };
  }

  if (asset.kind === 'World') {
    const requested = String(raw.skin || asset.defaultSkin || 'Default');
    const custom = requested === '__custom__' || requested !== asset.defaultSkin;
    if (!custom) {
      return { storage:`world|skin=${token(requested)}`, custom:false, price:0, label:requested };
    }
    const customSkin = String(raw.customSkin || '').trim().slice(0,80);
    if (customSkin.length < 2) throw new HttpsError('invalid-argument','Custom World Skin must be at least 2 characters.');
    return { storage:`world|custom_skin=${token(customSkin)}`, custom:true, price:1, label:customSkin };
  }

  if (asset.kind === 'Effect') {
    const d = asset.defaultImpact;
    const size = Math.max(.25,Math.min(3,Number(raw.size ?? d.size)));
    const brightness = Math.max(0,Math.min(2,Number(raw.brightness ?? d.brightness)));
    const tint = safeHex(raw.tint,d.tint);
    const custom = !(sameNumber(size,d.size) && sameNumber(brightness,d.brightness) && tint===safeHex(d.tint));
    return {
      storage:`effect|size=${size.toFixed(2)}|brightness=${brightness.toFixed(2)}|tint=${tint}`,
      custom, price:custom?1:0,
      label:custom?`Size ${size.toFixed(2)} · Light ${brightness.toFixed(2)} · ${tint.toUpperCase()}`:'Default Impact'
    };
  }

  if (asset.kind === 'Icon') {
    const primary=safeHex(raw.primary,'#ffffff');
    const secondary=safeHex(raw.secondary,'#925cff');
    const accent=safeHex(raw.accent,'#64d9ff');
    const preset=ICON_PRESETS.find(([,p,s,a])=>p===primary&&s===secondary&&a===accent);
    const custom=!preset;
    return {
      storage:`icon|primary=${primary}|secondary=${secondary}|accent=${accent}`,
      custom, price:custom?1:0,
      label:preset?preset[0]:`${primary.toUpperCase()} / ${secondary.toUpperCase()} / ${accent.toUpperCase()}`
    };
  }

  throw new HttpsError('invalid-argument','Unsupported asset category.');
}

function deterministicId(profileId,assetId,storage) {
  const digest = crypto.createHash('sha256').update(storage).digest('hex').slice(0,16);
  return `market__${profileId}__${assetId.replace(/[^a-zA-Z0-9_-]/g,'_')}__${digest}`.slice(0,180);
}

exports.acquireAssetVariant = onCall(async request => {
  const uid = requireAuth(request);
  const profileId = await callerProfile(uid);
  const assetId = String(request.data?.assetId || '');
  const normalized = normalizeVariant(assetId,request.data?.variant || {});
  const holdingId = deterministicId(profileId,assetId,normalized.storage);
  const holdingRef = db.doc(`assetHoldings/${holdingId}`);
  const receiptRef = db.doc(`assetVariantPurchases/${holdingId}`);
  const walletRef = db.doc(`creditWallets/${profileId}`);

  let charged = 0;
  let duplicate = false;

  await db.runTransaction(async tx => {
    const existing = await tx.get(holdingRef);
    if (existing.exists) {
      if (String(existing.data()?.ownerProfileId || '') !== profileId) {
        throw new HttpsError('permission-denied','That asset holding belongs to another profile.');
      }
      duplicate = true;
      return;
    }

    if (normalized.price > 0) {
      const wallet = await tx.get(walletRef);
      const balance = Number(wallet.data()?.balance ?? 0);
      if (!wallet.exists || balance < normalized.price) {
        throw new HttpsError('failed-precondition','Not enough Credits for this custom variation.');
      }

      charged = normalized.price;
      tx.update(walletRef,{
        balance:balance-charged,
        totalLost:Number(wallet.data()?.totalLost ?? 0),
        lastEventId:holdingId,
        lastEventType:'market_purchase',
        updatedAt:FieldValue.serverTimestamp()
      });
    }

    tx.create(holdingRef,{
      ownerProfileId:profileId,
      assetId,
      tint:normalized.storage,
      acquiredAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp(),
      lastEventId:holdingId,
      lastEventType:'market_acquire',
      archived:false,
      archivedAt:null
    });

    tx.create(receiptRef,{
      profileId,
      assetId,
      holdingId,
      variant:normalized.storage,
      custom:normalized.custom,
      priceCredits:normalized.price,
      createdAt:FieldValue.serverTimestamp()
    });
  });

  return {
    ok:true,
    holdingId,
    assetId,
    variant:normalized.storage,
    variantLabel:normalized.label,
    custom:normalized.custom,
    priceCharged:duplicate?0:charged,
    duplicate
  };
});

function activeStatus(data, nowMs) {
  if (!data || data.active !== true) return false;
  const expires = data.expiresAt?.toMillis?.() ?? null;
  return expires == null || expires > nowMs;
}

exports.getModerationCapabilities = onCall(async request => {
  const uid = requireAuth(request);
  const profileId = await callerProfile(uid);
  const now = Date.now();

  const [founderSnap,statusSnap] = await Promise.all([
    db.doc('systemPrivate/founder').get(),
    db.collection('statusAssignments').where('profileId','==',profileId).limit(500).get()
  ]);

  const founder = String(founderSnap.data()?.profileId || '') === profileId;
  const rows = statusSnap.docs.map(doc=>({id:doc.id,...doc.data()})).filter(row=>activeStatus(row,now));
  const timedOutGlobal = !founder && rows.some(row=>row.status==='timeout'&&row.scopeType==='global'&&row.scopeId==='_');

  let globalModerator = founder || rows.some(row=>row.status==='moderator'&&row.scopeType==='global'&&row.scopeId==='_');
  let scopes = rows
    .filter(row=>row.status==='moderator')
    .map(row=>({scopeType:String(row.scopeType||''),scopeId:String(row.scopeId||''),source:'status'}));

  scopes = [...new Map(scopes.map(scope=>[`${scope.scopeType}:${scope.scopeId}`,scope])).values()];

  if (timedOutGlobal) {
    globalModerator=false;
    scopes=[];
  }

  return {
    ok:true,
    profileId,
    verified:true,
    founder,
    globalModerator,
    timedOutGlobal,
    canAccess:founder || globalModerator || scopes.length>0,
    scopes
  };
});

function randomCode() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='';
  for (let i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

function defaultModeSettings(modeId, ruleVariant={}) {
  const modeDefaults = {
    'surface-discovery':{gridSize:15,lives:3,enemyCount:3,powerMoves:12,winCondition:'collect_all'},
    'jeng-stroid':{layers:18,piecesPerLayer:3,turnSeconds:60,gravity:1,collapseThreshold:65},
    'sunball':{balls:3,targetScore:25000,gravity:.22,bumperForce:1.8,multiplayerMode:'alternating'},
    'soldoku':{boardSize:9,difficulty:'normal',hints:3,mistakeLimit:3,playMode:'solo'},
    'escape-pod-dash':{lanes:3,lives:3,startSpeed:4,acceleration:.12,targetDistance:2500,obstacleRate:1}
  };
  return {
    player:{maxWalkDistance:50,maxHp:5,energyPerTurn:1},
    currency:{name:'TOKENS',symbol:'◆',startingBalance:0,deathLossCap:10},
    mode:modeDefaults[modeId] || {},
    testRule:ruleVariant || {},
    areas:[],
    items:[],
    mobs:[],
    terminals:[]
  };
}

exports.createModeTestLobby = onCall(async request => {
  const uid = requireAuth(request);
  const profileId = await callerProfile(uid);
  const modeId = String(request.data?.modeId || '');
  const mode = MODE_RUNTIME[modeId];
  if (!mode) throw new HttpsError('invalid-argument','Unknown E.R.A.S. game Mode.');

  const id = crypto.randomUUID();
  const now = FieldValue.serverTimestamp();
  const lobby = {
    name:`${mode.name} Test`,
    code:randomCode(),
    hostProfileId:profileId,
    visibility:'code',
    maxPlayers:mode.maxPlayers,
    mapId:mode.mapId,
    gameStyle:modeId,
    description:'Quick Asset Library Mode test.',
    settings:defaultModeSettings(modeId,request.data?.ruleVariant || {}),
    hostAssets:[],
    accessOfferId:'',
    status:'open',
    sourceType:'hosted',
    publishedGameId:'',
    createdAt:now,
    updatedAt:now,
    lastHeartbeatAt:now
  };

  const batch = db.batch();
  batch.create(db.doc(`gameLobbies/${id}`),lobby);
  batch.create(db.doc(`gameLobbies/${id}/members/${profileId}`),{
    profileId,
    role:'host',
    accessEntitlementId:'',
    accessStartedAt:now,
    accessLeaseSeconds:600,
    joinedAt:now,
    lastSeenAt:now
  });
  await batch.commit();

  const url = mode.runtime==='global'
    ? `/game/global/?lobby=${encodeURIComponent(id)}`
    : mode.runtime==='galactic'
      ? `/game/galactic-dominion/?lobby=${encodeURIComponent(id)}`
      : `/game/hosted-mode/?lobby=${encodeURIComponent(id)}`;

  return {ok:true,lobbyId:id,url};
});
