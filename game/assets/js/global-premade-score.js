import { db, fs, profileById, safeText } from '/game/assets/js/eras-data.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const functions = getFunctions(getApp('site-account'));
const claimCall = httpsCallable(functions, 'claimGlobalPremadeMilestones');
const esc = safeText;

export const GLOBAL_PREMADE_TRACKS = Object.freeze({
  'surface-discovery': Object.freeze({
    id:'surface-discovery', prefix:'SUR', worldId:'global-surface-discovery',
    targetId:'surface-discovery-global-score', metric:'DISCOVERIES'
  }),
  'jeng-stroid': Object.freeze({
    id:'jeng-stroid', prefix:'JNG', worldId:'global-jeng-stroid',
    targetId:'jeng-stroid-global-score', metric:'BLOCKS'
  }),
  'sunball': Object.freeze({
    id:'sunball', prefix:'SUN', worldId:'global-sunball',
    targetId:'sunball-global-score', metric:'BUMPERS'
  }),
  'soldoku': Object.freeze({
    id:'soldoku', prefix:'SDK', worldId:'global-soldoku',
    targetId:'soldoku-global-score', metric:'CORRECT'
  }),
  'galactic-dominion': Object.freeze({
    id:'galactic-dominion', prefix:'GAL', worldId:'global-galactic-dominion',
    targetId:'galactic-dominion-global-score', metric:'NET WORTH'
  })
});

const token = profileId => String(profileId || '').replace(/[^0-9a-zA-Z-]/g,'').slice(0,64);
const docId = (gameId, profileId) => `${gameId}-best__${token(profileId)}`;

function encodePayload(gameId, score, meta = {}) {
  const s = Math.max(0, Math.min(2000000000, Math.floor(Number(score) || 0)));
  if (gameId === 'surface-discovery') {
    const discoveries = Math.max(0, Math.min(10000, Math.floor(Number(meta.discoveries) || 0)));
    const completed = meta.completed ? 1 : 0;
    if (s !== discoveries * 100 + completed * 5000) return null;
    return `SUR:${s}:${discoveries}:${completed}`;
  }
  if (gameId === 'jeng-stroid') {
    const removed = Math.max(0, Math.min(1000, Math.floor(Number(meta.removed) || 0)));
    if (s !== removed * 500) return null;
    return `JNG:${s}:${removed}`;
  }
  if (gameId === 'sunball') {
    const bumpers = Math.max(0, Math.min(8000000, Math.floor(Number(meta.bumpers) || 0)));
    if (s !== bumpers * 250) return null;
    return `SUN:${s}:${bumpers}`;
  }
  if (gameId === 'soldoku') {
    const correct = Math.max(0, Math.min(1000, Math.floor(Number(meta.correct) || 0)));
    const mistakes = Math.max(0, Math.min(1000, Math.floor(Number(meta.mistakes) || 0)));
    const completed = meta.completed ? 1 : 0;
    const expected = Math.max(0, correct * 100 - mistakes * 100 + completed * 5000);
    if (s !== expected) return null;
    return `SDK:${s}:${correct}:${mistakes}:${completed}`;
  }
  if (gameId === 'galactic-dominion') {
    const netWorth = Math.max(0, Math.min(1000000000, Math.floor(Number(meta.netWorth) || 0)));
    const turns = Math.max(0, Math.min(200, Math.floor(Number(meta.turns) || 0)));
    if (turns !== 40 || s !== netWorth * 2) return null;
    return `GAL:${s}:${netWorth}:${turns}`;
  }
  return null;
}

function decodePayload(gameId, action) {
  const cfg = GLOBAL_PREMADE_TRACKS[gameId];
  if (!cfg || !action || action.worldId !== cfg.worldId ||
      action.actionType !== 'interact' || action.targetType !== 'object' ||
      action.targetId !== cfg.targetId || action.status !== 'resolved') return null;
  const label = String(action.targetLabel || '');

  let m;
  if (gameId === 'surface-discovery') {
    m = label.match(/^SUR:(\d+):(\d+):([01])$/); if (!m) return null;
    const score=Number(m[1]), discoveries=Number(m[2]), completed=Number(m[3]);
    if (score !== discoveries*100 + completed*5000) return null;
    return {score, metric:discoveries, meta:{discoveries,completed:Boolean(completed)}};
  }
  if (gameId === 'jeng-stroid') {
    m = label.match(/^JNG:(\d+):(\d+)$/); if (!m) return null;
    const score=Number(m[1]), removed=Number(m[2]);
    if (score !== removed*500) return null;
    return {score, metric:removed, meta:{removed}};
  }
  if (gameId === 'sunball') {
    m = label.match(/^SUN:(\d+):(\d+)$/); if (!m) return null;
    const score=Number(m[1]), bumpers=Number(m[2]);
    if (score !== bumpers*250) return null;
    return {score, metric:bumpers, meta:{bumpers}};
  }
  if (gameId === 'soldoku') {
    m = label.match(/^SDK:(\d+):(\d+):(\d+):([01])$/); if (!m) return null;
    const score=Number(m[1]), correct=Number(m[2]), mistakes=Number(m[3]), completed=Number(m[4]);
    if (score !== Math.max(0,correct*100-mistakes*100+completed*5000)) return null;
    return {score, metric:correct, meta:{correct,mistakes,completed:Boolean(completed)}};
  }
  if (gameId === 'galactic-dominion') {
    m = label.match(/^GAL:(\d+):(\d+):(\d+)$/); if (!m) return null;
    const score=Number(m[1]), netWorth=Number(m[2]), turns=Number(m[3]);
    if (turns !== 40 || score !== netWorth*2) return null;
    return {score, metric:netWorth, meta:{netWorth,turns}};
  }
  return null;
}

function rewardMessage(data) {
  const awarded = Math.max(0, Math.floor(Number(data?.creditsAwarded) || 0));
  if (!awarded) return '';
  const reached = Math.max(0, Math.floor(Number(data?.milestoneScore) || 0));
  const next = Math.max(0, Math.floor(Number(data?.nextMilestoneScore) || 0));
  const nextReward = Math.max(1, Math.floor(Number(data?.nextMilestoneReward) || 1));
  return `GLOBAL MILESTONES THROUGH ${reached.toLocaleString()} // +${awarded} CREDIT${awarded===1?'':'S'} // NEXT ${next.toLocaleString()} = +${nextReward}`;
}

export function createGlobalPremadeTrack({
  gameId,
  getProfileId,
  leaderboard,
  personalBest,
  feedback
}) {
  const cfg = GLOBAL_PREMADE_TRACKS[gameId];
  if (!cfg) throw new Error(`Unsupported Global premade track: ${gameId}`);

  const localKey = profileId => `eras.global.${gameId}.best.${profileId || 'guest'}`;
  const say = (text,tone='') => {
    if (!feedback || !text) return;
    feedback.textContent = String(text).toUpperCase();
    feedback.dataset.tone = tone;
  };
  const localBest = () => {
    try { return Math.max(0, Number(localStorage.getItem(localKey(getProfileId()))) || 0); }
    catch (_) { return 0; }
  };
  const storeLocalBest = score => {
    const best = Math.max(localBest(), Math.max(0, Math.floor(Number(score)||0)));
    try { localStorage.setItem(localKey(getProfileId()), String(best)); } catch (_) {}
    if (personalBest) personalBest.textContent = best.toLocaleString();
    return best;
  };

  async function refresh() {
    const pid = getProfileId();
    if (!leaderboard) return;
    try {
      const q = fs.query(fs.collection(db,'gameActions'),fs.where('worldId','==',cfg.worldId),fs.limit(500));
      const snap = await fs.getDocs(q);
      const byProfile = new Map();
      snap.forEach(ds => {
        const action = ds.data();
        const parsed = decodePayload(gameId, action);
        const profileId = String(action.actorProfileId || '');
        if (!parsed || !profileId) return;
        const prior = byProfile.get(profileId);
        if (!prior || parsed.score > prior.score ||
            (parsed.score === prior.score && parsed.metric > prior.metric)) {
          byProfile.set(profileId,{profileId,...parsed});
        }
      });
      const top = [...byProfile.values()]
        .sort((a,b)=>b.score-a.score||b.metric-a.metric||a.profileId.localeCompare(b.profileId))
        .slice(0,20);
      const entries = await Promise.all(top.map(async row => {
        try {
          const p = await profileById(row.profileId);
          return {...row,displayName:p?.displayName||'Member'};
        } catch (_) { return {...row,displayName:'Member'}; }
      }));
      const serverBest = byProfile.get(pid || '')?.score || 0;
      if (personalBest) personalBest.textContent = Math.max(serverBest,localBest()).toLocaleString();
      if (!entries.length) {
        leaderboard.innerHTML = '<li class="is-empty">NO GLOBAL SCORES YET.</li>';
        return;
      }
      leaderboard.innerHTML = entries.map((row,index)=>`
        <li ${row.profileId===pid?'class="is-you"':''}>
          <i>${String(index+1).padStart(2,'0')}</i>
          <b>${esc(row.displayName||'Member')}</b>
          <span>${Math.max(0,Math.floor(row.metric||0)).toLocaleString()}</span>
          <strong>${Math.max(0,Math.floor(row.score||0)).toLocaleString()}</strong>
        </li>`).join('');
    } catch (error) {
      console.error(`Global ${gameId} leaderboard`,error);
      leaderboard.innerHTML = '<li class="is-empty">GLOBAL SCOREBOARD TEMPORARILY UNAVAILABLE.</li>';
      if (personalBest) personalBest.textContent = localBest().toLocaleString();
    }
  }

  async function claim() {
    if (!getProfileId()) return null;
    try {
      const result = await claimCall({gameId});
      const data = result?.data || {};
      if (!data.ok) throw new Error(data.error || 'Global milestone check failed.');
      const text = rewardMessage(data);
      if (text) say(text,'ok');
      return data;
    } catch (error) {
      console.error(`Global ${gameId} milestone reward`,error);
      return null;
    }
  }

  async function submit(score, meta = {}) {
    const profileId = getProfileId();
    if (!profileId) return null;
    const payload = encodePayload(gameId,score,meta);
    if (!payload) throw new Error('Global score payload did not match the fixed ruleset.');
    const parsedScore = Math.max(0,Math.floor(Number(score)||0));
    storeLocalBest(parsedScore);

    const ref = fs.doc(db,'gameActions',docId(gameId,profileId));
    try {
      const existing = await fs.getDoc(ref);
      if (existing.exists()) {
        const prior = decodePayload(gameId,existing.data());
        if (prior && prior.score >= parsedScore) {
          await refresh();
          await claim();
          return prior.score;
        }
        await fs.deleteDoc(ref);
      }
      const turn = Math.max(1, Math.floor(Date.now()/60000));
      await fs.setDoc(ref,{
        worldId:cfg.worldId,
        actorProfileId:profileId,
        actionType:'interact',
        targetType:'object',
        targetId:cfg.targetId,
        targetLabel:payload,
        declaredTurn:turn,
        resolveTurn:turn+1,
        status:'queued',
        outcome:'',
        createdAt:fs.serverTimestamp(),
        updatedAt:fs.serverTimestamp(),
        resolvedAt:null
      });
      await fs.updateDoc(ref,{
        status:'resolved',
        outcome:'resolved',
        updatedAt:fs.serverTimestamp(),
        resolvedAt:fs.serverTimestamp()
      });
      await refresh();
      await claim();
      return parsedScore;
    } catch (error) {
      console.error(`Global ${gameId} score submit`,error);
      say(`Score saved locally // global scoreboard write failed: ${error?.code||error?.message||'unavailable'}`,'error');
      return null;
    }
  }

  return { cfg, refresh, submit, claim, localBest, storeLocalBest };
}
