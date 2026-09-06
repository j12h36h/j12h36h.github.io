import { db, fs, watchIdentity, profileById, safeText } from '/game/assets/js/eras-data.js';

const $=s=>document.querySelector(s);
const isGlobalDash=location.pathname.startsWith('/game/global/escape-pod-dash');
const esc=safeText;

// ---------------------------------------------------------------------------
// Escape Pod Dash direct 3x3 slot input
// Tap/click a visible slot to move one adjacent step. Diagonals count.
// Keyboard direct-slot shortcuts follow the same adjacency rule.
// ---------------------------------------------------------------------------
const dashInput={row:1,col:1};
const DIRECT_KEYS=Object.freeze({
  '7':[0,0],'8':[0,1],'9':[0,2],
  '4':[1,0],'5':[1,1],'6':[1,2],
  '1':[2,0],'2':[2,1],'3':[2,2],
  'q':[0,0],'e':[0,2],'z':[2,0],'c':[2,2]
});
const DIRECTION_KEYS=Object.freeze({
  arrowup:[-1,0],w:[-1,0],
  arrowdown:[1,0],s:[1,0],
  arrowleft:[0,-1],a:[0,-1],
  arrowright:[0,1],d:[0,1]
});

function activeDashCanvas(){
  const canvas=$('.dash-canvas');
  return canvas&&document.body.contains(canvas)?canvas:null;
}
function resetDashInput(){dashInput.row=1;dashInput.col=1;}
function adjacent(row,col){
  const dr=Math.abs(row-dashInput.row),dc=Math.abs(col-dashInput.col);
  return dr<=1&&dc<=1&&(dr!==0||dc!==0);
}
function parseSlotAction(value=''){
  const m=String(value).match(/^pos-([0-2])-([0-2])$/);
  return m?[Number(m[1]),Number(m[2])]:null;
}
function nearestCanvasSlot(canvas,clientX,clientY){
  const rect=canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  const x=(clientX-rect.left)/rect.width*canvas.width;
  const y=(clientY-rect.top)/rect.height*canvas.height;
  const xs=[.22,.5,.78].map(v=>canvas.width*v);
  const ys=[.34,.59,.82].map(v=>canvas.height*v);
  let best=null,bestD=Infinity;
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const dx=x-xs[col],dy=y-ys[row],d=dx*dx+dy*dy;
    if(d<bestD){bestD=d;best=[row,col];}
  }
  return best;
}
function clickSlot(row,col){
  const button=document.querySelector(`[data-game-action="pos-${row}-${col}"]`);
  if(button)button.click();
}

// Enforce adjacency for the existing 3x3 buttons too.
document.addEventListener('click',e=>{
  const button=e.target.closest?.('[data-game-action^="pos-"]');
  if(!button||!activeDashCanvas())return;
  const slot=parseSlotAction(button.dataset.gameAction);
  if(!slot)return;
  const [row,col]=slot;
  if(!adjacent(row,col)){
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  dashInput.row=row;dashInput.col=col;
},true);

// Tap/click the actual rendered grid. Mouse and touch use the same pointer path.
document.addEventListener('pointerdown',e=>{
  const canvas=e.target.closest?.('.dash-canvas');
  if(!canvas||!document.body.contains(canvas))return;
  const slot=nearestCanvasSlot(canvas,e.clientX,e.clientY);
  if(!slot)return;
  e.preventDefault();
  const [row,col]=slot;
  if(adjacent(row,col))clickSlot(row,col);
},{passive:false});

// Keep the input tracker synchronized with keyboard movement and prevent
// number/QEZC shortcuts from teleporting across non-adjacent cells.
document.addEventListener('keydown',e=>{
  if(!activeDashCanvas()||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  const key=String(e.key||'').toLowerCase();
  const direct=DIRECT_KEYS[key];
  if(direct){
    const [row,col]=direct;
    if(!adjacent(row,col)){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    dashInput.row=row;dashInput.col=col;
    return;
  }
  const delta=DIRECTION_KEYS[key];
  if(delta){
    dashInput.row=Math.max(0,Math.min(2,dashInput.row+delta[0]));
    dashInput.col=Math.max(0,Math.min(2,dashInput.col+delta[1]));
  }
},true);

const stage=$('#gameStage');
if(stage)new MutationObserver(()=>{if(activeDashCanvas())resetDashInput();}).observe(stage,{childList:true,subtree:true});

// ---------------------------------------------------------------------------
// Escape Pod Dash Global scoreboard
// Uses the same already-authorized gameActions pattern as Slime Smash Global.
// No new Firestore collection, rules deployment, or Cloud Function required.
// ---------------------------------------------------------------------------
const SCORE_WORLD='global-escape-pod-dash';
const SCORE_TARGET='escape-pod-dash-global-score';
const SCORE_PREFIX='EPD';
const scoreState={identity:null,maxSpeed:0,runSubmitted:false,timer:0};

function scoreDocId(profileId=''){
  return `escape-pod-dash-best__${String(profileId||'').replace(/[^0-9a-zA-Z-]/g,'').slice(0,64)}`;
}
function localBest(){
  if(!scoreState.identity?.profileId)return 0;
  try{return Math.max(0,Math.floor(Number(localStorage.getItem(`eras.escape-pod-dash.global.best.${scoreState.identity.profileId}`))||0));}
  catch(_){return 0;}
}
function currentDistance(){return Math.max(0,Math.floor(Number($('#runScore')?.textContent?.replace(/,/g,'')||0)));}
function currentSpeed(){
  const text=$('#gameHud')?.textContent||'';
  const m=text.match(/SPEED\s+([0-9]+(?:\.[0-9]+)?)/i);
  return m?Math.max(0,Number(m[1])||0):0;
}
function encodeScore(distance,maxSpeed){
  const d=Math.max(0,Math.min(2000000000,Math.floor(Number(distance)||0)));
  const speed100=Math.max(0,Math.min(2000000000,Math.round((Number(maxSpeed)||0)*100)));
  return {distance:d,speed100,label:`${SCORE_PREFIX}:${d}:${speed100}`};
}
function decodeScore(action){
  if(!action||action.worldId!==SCORE_WORLD||action.actionType!=='interact'||action.targetType!=='object'||action.targetId!==SCORE_TARGET||action.status!=='resolved')return null;
  const m=String(action.targetLabel||'').match(/^EPD:(\d+):(\d+)$/);
  if(!m)return null;
  const distance=Number(m[1]),speed100=Number(m[2]);
  if(!Number.isInteger(distance)||distance<0||distance>2000000000)return null;
  if(!Number.isInteger(speed100)||speed100<0||speed100>2000000000)return null;
  return {profileId:String(action.actorProfileId||''),bestDistance:distance,maxSpeed:speed100/100};
}
function scoreboardStatus(message,tone=''){
  const el=$('#dashScoreboardStatus');
  if(!el)return;
  el.textContent=String(message||'').toUpperCase();
  el.dataset.tone=tone;
}
function renderLeaderboard(entries=[],personalBest=0){
  const list=$('#dashLeaderboard');
  if(!list)return;
  const best=Math.max(localBest(),Math.max(0,Math.floor(Number(personalBest)||0)));
  const personal=$('#dashPersonalBest');if(personal)personal.textContent=best.toLocaleString();
  if(!entries.length){list.innerHTML='<li class="is-empty">NO GLOBAL RUNS YET.</li>';return;}
  list.innerHTML=entries.map((entry,index)=>`<li ${entry.profileId===scoreState.identity?.profileId?'class="is-you"':''}><i>${String(index+1).padStart(2,'0')}</i><b>${esc(entry.displayName||'Member')}</b><span>${Number(entry.maxSpeed||0).toFixed(2)}</span><strong>${Math.max(0,Math.floor(Number(entry.bestDistance)||0)).toLocaleString()}</strong></li>`).join('');
}
async function loadLeaderboard(){
  if(!isGlobalDash||!$('#dashLeaderboard'))return;
  try{
    const q=fs.query(fs.collection(db,'gameActions'),fs.where('worldId','==',SCORE_WORLD),fs.limit(500));
    const snap=await fs.getDocs(q);
    const bestByProfile=new Map();
    snap.forEach(docSnap=>{
      const parsed=decodeScore(docSnap.data());
      if(!parsed?.profileId)return;
      const prior=bestByProfile.get(parsed.profileId);
      if(!prior||parsed.bestDistance>prior.bestDistance||(parsed.bestDistance===prior.bestDistance&&parsed.maxSpeed>prior.maxSpeed))bestByProfile.set(parsed.profileId,parsed);
    });
    const top=[...bestByProfile.values()].sort((a,b)=>b.bestDistance-a.bestDistance||b.maxSpeed-a.maxSpeed||a.profileId.localeCompare(b.profileId)).slice(0,20);
    const entries=await Promise.all(top.map(async row=>{
      try{const p=await profileById(row.profileId);return {...row,displayName:p?.displayName||'Member'};}
      catch(_){return {...row,displayName:'Member'};}
    }));
    renderLeaderboard(entries,bestByProfile.get(scoreState.identity?.profileId||'')?.bestDistance||0);
    scoreboardStatus('GLOBAL SCOREBOARD ONLINE','ok');
  }catch(error){
    console.error('Escape Pod Dash leaderboard',error);
    const list=$('#dashLeaderboard');if(list)list.innerHTML='<li class="is-empty">GLOBAL SCOREBOARD TEMPORARILY UNAVAILABLE.</li>';
    const personal=$('#dashPersonalBest');if(personal)personal.textContent=localBest().toLocaleString();
    scoreboardStatus(error?.code||error?.message||'SCOREBOARD UNAVAILABLE','error');
  }
}
async function submitScore(distance,maxSpeed){
  if(!isGlobalDash||!scoreState.identity?.profileId)return;
  const encoded=encodeScore(distance,maxSpeed);
  const ref=fs.doc(db,'gameActions',scoreDocId(scoreState.identity.profileId));
  try{
    const existing=await fs.getDoc(ref);
    if(existing.exists()){
      const prior=decodeScore(existing.data());
      if(prior&&(prior.bestDistance>encoded.distance||(prior.bestDistance===encoded.distance&&prior.maxSpeed>=encoded.speed100/100))){await loadLeaderboard();return;}
      await fs.deleteDoc(ref);
    }
    const turn=Math.max(1,Math.min(1999999998,encoded.distance+1));
    await fs.setDoc(ref,{
      worldId:SCORE_WORLD,
      actorProfileId:scoreState.identity.profileId,
      actionType:'interact',
      targetType:'object',
      targetId:SCORE_TARGET,
      targetLabel:encoded.label,
      declaredTurn:turn,
      resolveTurn:turn+1,
      status:'queued',
      outcome:'',
      createdAt:fs.serverTimestamp(),
      updatedAt:fs.serverTimestamp(),
      resolvedAt:null
    });
    await fs.updateDoc(ref,{status:'resolved',outcome:'resolved',updatedAt:fs.serverTimestamp(),resolvedAt:fs.serverTimestamp()});
    scoreboardStatus('NEW GLOBAL BEST SAVED','ok');
    await loadLeaderboard();
  }catch(error){
    console.error('Escape Pod Dash score submit',error);
    scoreboardStatus(`SCORE SAVED LOCALLY // GLOBAL WRITE FAILED: ${error?.code||error?.message||'UNAVAILABLE'}`,'error');
  }
}

if(isGlobalDash){
  const hud=$('#gameHud');
  if(hud)new MutationObserver(()=>{scoreState.maxSpeed=Math.max(scoreState.maxSpeed,currentSpeed());}).observe(hud,{childList:true,subtree:true,characterData:true});
  const feedback=$('#gameFeedback');
  if(feedback)new MutationObserver(()=>{
    const text=String(feedback.textContent||'').toUpperCase();
    if(text.startsWith('LAUNCHED ')){scoreState.maxSpeed=0;scoreState.runSubmitted=false;resetDashInput();return;}
    if(text.includes('ESCAPE POD CRASHED')&&!scoreState.runSubmitted){
      scoreState.runSubmitted=true;
      scoreState.maxSpeed=Math.max(scoreState.maxSpeed,currentSpeed());
      submitScore(currentDistance(),scoreState.maxSpeed).catch(()=>{});
    }
  }).observe(feedback,{childList:true,subtree:true,characterData:true});
  watchIdentity(identity=>{
    scoreState.identity=identity;
    const personal=$('#dashPersonalBest');if(personal)personal.textContent=localBest().toLocaleString();
    loadLeaderboard();
  });
  loadLeaderboard();
  scoreState.timer=setInterval(loadLeaderboard,30000);
  window.addEventListener('pagehide',()=>clearInterval(scoreState.timer));
}
