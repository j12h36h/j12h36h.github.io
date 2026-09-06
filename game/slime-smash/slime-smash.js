import { db, fs, watchIdentity, safeText, profileById } from '/game/assets/js/eras-data.js';
import { hostedMode, hostedModeRuntimeHref } from '/game/config/hosted-modes.js?v=1.3.0';
import { obtainLobbyEntitlement, createLobbyMembership, maintainLobbyMembership } from '/game/assets/js/hosted-join-compat.js?v=1.1.0';

const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const lobbyId=params.get('lobby')||'';
const globalMode=document.body?.dataset?.slimeSmashGlobal==='true';
const state={identity:null,lobby:null,mode:null,game:null,raf:0,accessLeaseStop:null,hostHeartbeat:0,leaderboardTimer:0};
const slimeImage='/public-assets/textures/slime_monochrome.png';
const esc=safeText;
const GLOBAL_RULES=Object.freeze({startingSeconds:15,timeGainSeconds:.35,scorePerSlime:100});
const GLOBAL_SCORE_WORLD='global-slime-smash';
const GLOBAL_SCORE_TARGET='slime-smash-global-score';
const GLOBAL_SCORE_PREFIX='SS';

function say(message,tone=''){
  const el=$('#gameFeedback');
  if(!el)return;
  el.textContent=String(message).toUpperCase();
  el.dataset.tone=tone;
}

function buildGrid(){
  const root=$('#slimeGrid');
  root.innerHTML=Array.from({length:9},(_,i)=>`<button class="slime-slot" type="button" data-slime-slot="${i}" aria-label="Leaf ${i+1}"><span class="slime-leaf" aria-hidden="true"></span><img class="slime-sprite" src="${esc(slimeImage)}" alt="Slime"></button>`).join('');
}

function updateHud(){
  const g=state.game;
  $('#scoreValue').textContent=Math.max(0,Math.floor(g?.score||0)).toLocaleString();
  $('#timeValue').textContent=Math.max(0,Number(g?.timeRemaining||0)).toFixed(1);
  $('#waveValue').textContent=Math.max(0,Math.floor(g?.wave||0)).toLocaleString();
}

function renderActiveSlot(previous=-1){
  const g=state.game;
  document.querySelectorAll('[data-slime-slot]').forEach((slot,i)=>{
    slot.classList.toggle('is-active',g?.running&&i===g.activeSlot);
    slot.classList.toggle('is-hit',i===previous);
  });
  if(previous>=0)setTimeout(()=>document.querySelector(`[data-slime-slot="${previous}"]`)?.classList.remove('is-hit'),75);
}

function nextSlot(previous=-1){
  let next=Math.floor(Math.random()*9);
  if(previous>=0&&next===previous)next=(next+1+Math.floor(Math.random()*8))%9;
  return next;
}

function scoreKey(){return `eras:slime-smash:best:${globalMode?'global':lobbyId}:${state.identity?.profileId||'guest'}`;}
function localBest(){try{return Math.max(0,Number(localStorage.getItem(scoreKey()))||0);}catch(_){return 0;}}
function saveLocalBest(){
  if(!state.game)return 0;
  const score=Math.max(0,Math.floor(state.game.score||0));
  const best=Math.max(score,localBest());
  try{localStorage.setItem(scoreKey(),String(best));}catch(_){}
  const personal=$('#slimePersonalBest');if(personal)personal.textContent=best.toLocaleString();
  return best;
}

function renderLeaderboard(payload={}){
  const list=$('#slimeLeaderboard');
  if(!list)return;
  const entries=Array.isArray(payload.entries)?payload.entries:[];
  const serverBest=Math.max(0,Math.floor(Number(payload.personalBest)||0));
  const best=Math.max(serverBest,localBest());
  const personal=$('#slimePersonalBest');if(personal)personal.textContent=best.toLocaleString();
  if(!entries.length){list.innerHTML='<li class="is-empty">NO GLOBAL SCORES YET.</li>';return;}
  list.innerHTML=entries.map((entry,index)=>`<li ${entry.profileId===state.identity?.profileId?'class="is-you"':''}><i>${String(index+1).padStart(2,'0')}</i><b>${esc(entry.displayName||'Member')}</b><span>${Math.max(1,Math.floor(Number(entry.bestWave)||1)).toLocaleString()}</span><strong>${Math.max(0,Math.floor(Number(entry.bestScore)||0)).toLocaleString()}</strong></li>`).join('');
}

function globalScoreDocId(profileId=''){
  return `slime-smash-best__${String(profileId||'').replace(/[^0-9a-zA-Z-]/g,'').slice(0,64)}`;
}

function encodeGlobalScore(game){
  const score=Math.max(0,Math.min(2000000000,Math.floor(Number(game?.score)||0)));
  const hits=Math.max(0,Math.min(20000000,Math.floor(Number(game?.hits)||0)));
  const wave=Math.max(1,Math.min(20000001,Math.floor(Number(game?.wave)||1)));
  const durationMs=Math.max(0,Math.min(3600000,Math.floor(Date.now()-Number(game?.startedAt||Date.now()))));
  if(wave!==hits+1||score!==hits*100)return null;
  return {score,hits,wave,durationMs,label:`${GLOBAL_SCORE_PREFIX}:${score}:${wave}:${hits}:${durationMs}`};
}

function decodeGlobalScore(action){
  if(!action||action.worldId!==GLOBAL_SCORE_WORLD||action.actionType!=='interact'||action.targetType!=='object'||action.targetId!==GLOBAL_SCORE_TARGET||action.status!=='resolved')return null;
  const match=String(action.targetLabel||'').match(/^SS:(\d+):(\d+):(\d+):(\d+)$/);
  if(!match)return null;
  const score=Number(match[1]),wave=Number(match[2]),hits=Number(match[3]),durationMs=Number(match[4]);
  if(!Number.isInteger(score)||score<0||score>2000000000)return null;
  if(!Number.isInteger(hits)||hits<0||hits>20000000)return null;
  if(!Number.isInteger(wave)||wave!==hits+1||wave<1||wave>20000001)return null;
  if(score!==hits*100||!Number.isInteger(durationMs)||durationMs<0||durationMs>3600000)return null;
  return {profileId:String(action.actorProfileId||''),bestScore:score,bestWave:wave,hits,durationMs};
}

async function loadGlobalLeaderboard(){
  if(!globalMode)return;
  try{
    const q=fs.query(fs.collection(db,'gameActions'),fs.where('worldId','==',GLOBAL_SCORE_WORLD),fs.limit(500));
    const snap=await fs.getDocs(q);
    const bestByProfile=new Map();
    snap.forEach(docSnap=>{
      const parsed=decodeGlobalScore(docSnap.data());
      if(!parsed?.profileId)return;
      const current=bestByProfile.get(parsed.profileId);
      if(!current||parsed.bestScore>current.bestScore||(parsed.bestScore===current.bestScore&&parsed.bestWave>current.bestWave))bestByProfile.set(parsed.profileId,parsed);
    });
    const top=[...bestByProfile.values()].sort((a,b)=>b.bestScore-a.bestScore||b.bestWave-a.bestWave||a.profileId.localeCompare(b.profileId)).slice(0,20);
    const entries=await Promise.all(top.map(async row=>{
      try{const profile=await profileById(row.profileId);return {...row,displayName:profile?.displayName||'Member'};}
      catch(_){return {...row,displayName:'Member'};}
    }));
    const personalBest=bestByProfile.get(state.identity?.profileId||'')?.bestScore||0;
    renderLeaderboard({entries,personalBest});
  }catch(error){
    console.error('Global Slime Smash leaderboard',error);
    const list=$('#slimeLeaderboard');
    if(list)list.innerHTML='<li class="is-empty">GLOBAL SCOREBOARD TEMPORARILY UNAVAILABLE.</li>';
    const personal=$('#slimePersonalBest');if(personal)personal.textContent=localBest().toLocaleString();
  }
}

async function submitGlobalScore(game){
  if(!globalMode||!state.identity?.profileId||!game)return;
  const encoded=encodeGlobalScore(game);
  if(!encoded)return;
  const id=globalScoreDocId(state.identity.profileId);
  const ref=fs.doc(db,'gameActions',id);
  try{
    const existing=await fs.getDoc(ref);
    if(existing.exists()){
      const prior=decodeGlobalScore(existing.data());
      if(prior&&prior.bestScore>=encoded.score){await loadGlobalLeaderboard();return;}
      await fs.deleteDoc(ref);
    }
    const turn=Math.max(1,encoded.wave);
    await fs.setDoc(ref,{
      worldId:GLOBAL_SCORE_WORLD,
      actorProfileId:state.identity.profileId,
      actionType:'interact',
      targetType:'object',
      targetId:GLOBAL_SCORE_TARGET,
      targetLabel:encoded.label,
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
    await loadGlobalLeaderboard();
  }catch(error){
    console.error('Global Slime Smash score submit',error);
    say(`Score saved locally // global scoreboard write failed: ${error?.code||error?.message||'unavailable'}`,'error');
  }
}

function finishRun(){
  const g=state.game;
  if(!g?.running)return;
  g.running=false;
  g.timeRemaining=0;
  cancelAnimationFrame(state.raf);
  state.raf=0;
  renderActiveSlot();
  updateHud();
  $('#startRun').disabled=false;
  $('#startRun').textContent='PLAY AGAIN';
  const best=saveLocalBest();
  say(`Time out // final score ${g.score.toLocaleString()} // best ${best.toLocaleString()} // wave ${g.wave.toLocaleString()}`,'ok');
  if(globalMode)submitGlobalScore({...g}).catch(()=>{});
}

function timerFrame(now){
  const g=state.game;
  if(!g?.running)return;
  if(!g.lastFrame)g.lastFrame=now;
  const dt=Math.min(.25,(now-g.lastFrame)/1000);
  g.lastFrame=now;
  g.timeRemaining-=dt;
  if(g.timeRemaining<=0){finishRun();return;}
  updateHud();
  state.raf=requestAnimationFrame(timerFrame);
}

function startRun(){
  if(!state.identity?.profileId||!state.lobby)return;
  cancelAnimationFrame(state.raf);
  const cfg=state.lobby.settings?.modeSettings||GLOBAL_RULES;
  const startingSeconds=Number(cfg.startingSeconds)||15;
  const timeGainSeconds=Number(cfg.timeGainSeconds)||.35;
  const scorePerSlime=Math.max(1,Math.floor(Number(cfg.scorePerSlime)||100));
  state.game={running:true,score:0,wave:1,activeSlot:nextSlot(),timeRemaining:startingSeconds,timeGainSeconds,scorePerSlime,hits:0,lastFrame:0,startedAt:Date.now()};
  $('#startRun').textContent='RUNNING';
  $('#startRun').disabled=true;
  renderActiveSlot();
  updateHud();
  say('Smash the green slime before the timer reaches zero.','ok');
  state.raf=requestAnimationFrame(timerFrame);
}

function smash(slotIndex){
  const g=state.game;
  if(!g?.running||slotIndex!==g.activeSlot)return;
  const previous=g.activeSlot;
  g.score+=g.scorePerSlime;
  g.timeRemaining+=g.timeGainSeconds;
  g.hits++;
  g.wave++;
  g.activeSlot=nextSlot(previous);
  renderActiveSlot(previous);
  updateHud();
}

function renderLobby(){
  const cfg=state.lobby.settings?.modeSettings||GLOBAL_RULES;
  $('#lobbyTitle').textContent=(state.lobby.name||'SLIME SMASH').toUpperCase();
  $('#lobbyDescription').textContent=state.lobby.description||state.mode.description;
  $('#ruleStart').textContent=`${Number(cfg.startingSeconds||15).toFixed(1)} SEC`;
  $('#ruleGain').textContent=`+${Number(cfg.timeGainSeconds||.35).toFixed(2)} SEC`;
  $('#ruleScore').textContent=`+${Math.max(1,Math.floor(Number(cfg.scorePerSlime)||100)).toLocaleString()}`;
}

function initGlobal(){
  state.mode=hostedMode('slime-smash');
  state.lobby={id:'global-slime-smash',name:'Slime Smash Global',description:'Smash the green slime, gain time, and climb the permanent Global leaderboard.',settings:{modeId:'slime-smash',modeSettings:{...GLOBAL_RULES}}};
  renderLobby();
  loadGlobalLeaderboard();
  clearInterval(state.leaderboardTimer);
  state.leaderboardTimer=setInterval(loadGlobalLeaderboard,30000);
  watchIdentity(identity=>{
    state.identity=identity;
    $('#startRun').disabled=!identity?.profileId;
    if(!identity?.profileId){say('Sign in to play Slime Smash Global.','error');return;}
    const personal=$('#slimePersonalBest');if(personal)personal.textContent=localBest().toLocaleString();
    say(`Global ready // personal best ${localBest().toLocaleString()} // press Start Run.`,'ok');
    loadGlobalLeaderboard();
  });
}

async function initHosted(){
  if(!lobbyId){say('Missing lobby id.','error');return;}
  const snap=await fs.getDoc(fs.doc(db,'gameLobbies',lobbyId));
  if(!snap.exists()){say('Lobby not found.','error');return;}
  state.lobby={id:snap.id,...snap.data()};
  state.mode=hostedMode(state.lobby.settings?.modeId||state.lobby.gameStyle);
  if(state.mode.id!=='slime-smash'){
    location.replace(hostedModeRuntimeHref(state.lobby,matchMedia('(max-width: 680px)').matches));
    return;
  }
  renderLobby();
  watchIdentity(async identity=>{
    state.identity=identity;
    $('#startRun').disabled=true;
    if(!identity?.profileId){say('Sign in to play.','error');return;}
    try{
      const entitlementId=await obtainLobbyEntitlement(state.lobby,identity.profileId);
      await createLobbyMembership(state.lobby,identity.profileId,entitlementId);
      state.accessLeaseStop?.();
      state.accessLeaseStop=maintainLobbyMembership(state.lobby,identity.profileId,{
        onExpired:()=>{cancelAnimationFrame(state.raf);say('Hosted access expired. Returning to Join.','error');setTimeout(()=>location.replace(`/game/join/?code=${encodeURIComponent(state.lobby.code||'')}`),500);},
        onError:e=>console.debug('Slime Smash access lease',e?.code||e)
      });
      if(identity.profileId===state.lobby.hostProfileId){
        clearInterval(state.hostHeartbeat);
        state.hostHeartbeat=setInterval(()=>fs.updateDoc(fs.doc(db,'gameLobbies',lobbyId),{lastHeartbeatAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()}).catch(()=>{}),20000);
      }
      $('#startRun').disabled=false;
      say(`Ready // personal best ${localBest().toLocaleString()} // press Start Run.`,'ok');
    }catch(e){
      console.error(e);
      say(e?.message||e?.code||'Could not authorize hosted access.','error');
      setTimeout(()=>location.replace(`/game/join/?code=${encodeURIComponent(state.lobby.code||'')}`),800);
    }
  });
}

function init(){
  buildGrid();
  updateHud();
  if(globalMode){initGlobal();return;}
  initHosted().catch(e=>{console.error(e);say(e?.message||'Could not load Slime Smash.','error');});
}

document.addEventListener('click',e=>{
  const slot=e.target.closest('[data-slime-slot]');
  if(slot){smash(Number(slot.dataset.slimeSlot));return;}
  if(e.target.closest('#startRun'))startRun();
});

document.addEventListener('keydown',e=>{
  if(!state.game?.running)return;
  const n=Number(e.key);
  if(n>=1&&n<=9){e.preventDefault();smash(n-1);}
});

window.addEventListener('pagehide',()=>{
  cancelAnimationFrame(state.raf);
  state.accessLeaseStop?.();
  clearInterval(state.hostHeartbeat);
  clearInterval(state.leaderboardTimer);
});

init();
