import { db, fs, watchIdentity, safeText } from '/game/assets/js/eras-data.js';
import { hostedMode, hostedModeRuntimeHref } from '/game/config/hosted-modes.js?v=1.0.0';
import { obtainLobbyEntitlement, createLobbyMembership, maintainLobbyMembership } from '/game/assets/js/hosted-join.js?v=1.2.0';

const $=s=>document.querySelector(s);
const params=new URLSearchParams(location.search);
const lobbyId=params.get('lobby')||'';
const state={identity:null,lobby:null,mode:null,game:null,raf:0,accessLeaseStop:null};
const slimeImage='/public-assets/textures/slime_monochrome.png';
const esc=safeText;

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

async function saveRun(status='playing'){
  if(!state.identity?.profileId||!lobbyId||!state.game)return;
  const g=state.game;
  try{
    await fs.setDoc(fs.doc(db,'hostedModeRuns',lobbyId,'players',state.identity.profileId),{
      profileId:state.identity.profileId,
      modeId:'slime-smash',
      score:Math.max(0,Math.floor(g.score||0)),
      status,
      lives:0,
      progress:Math.max(0,Math.floor(g.wave||0)),
      updatedAt:fs.serverTimestamp()
    },{merge:true});
  }catch(e){console.debug('Slime Smash score save',e?.code||e);}
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
  say(`Time out // final score ${g.score.toLocaleString()} // wave ${g.wave.toLocaleString()}`,'ok');
  saveRun('finished');
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
  const cfg=state.lobby.settings?.modeSettings||{};
  const startingSeconds=Number(cfg.startingSeconds)||15;
  const timeGainSeconds=Number(cfg.timeGainSeconds)||.35;
  const scorePerSlime=Math.max(1,Math.floor(Number(cfg.scorePerSlime)||100));
  state.game={
    running:true,
    score:0,
    wave:1,
    activeSlot:nextSlot(),
    timeRemaining:startingSeconds,
    timeGainSeconds,
    scorePerSlime,
    hits:0,
    lastFrame:0
  };
  $('#startRun').textContent='RUNNING';
  $('#startRun').disabled=true;
  renderActiveSlot();
  updateHud();
  say('Smash the slime before the timer reaches zero.','ok');
  saveRun('playing');
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
  if(g.hits%10===0)saveRun('playing');
}

function renderLobby(){
  const cfg=state.lobby.settings?.modeSettings||{};
  $('#lobbyTitle').textContent=(state.lobby.name||'SLIME SMASH').toUpperCase();
  $('#lobbyDescription').textContent=state.lobby.description||state.mode.description;
  $('#ruleStart').textContent=`${Number(cfg.startingSeconds||15).toFixed(1)} SEC`;
  $('#ruleGain').textContent=`+${Number(cfg.timeGainSeconds||.35).toFixed(2)} SEC`;
  $('#ruleScore').textContent=`+${Math.max(1,Math.floor(Number(cfg.scorePerSlime)||100)).toLocaleString()}`;
}

async function init(){
  buildGrid();
  updateHud();
  if(!lobbyId){say('Missing lobby id.','error');return;}
  const snap=await fs.getDoc(fs.doc(db,'gameLobbies',lobbyId));
  if(!snap.exists()){say('Lobby not found.','error');return;}
  state.lobby={id:snap.id,...snap.data()};
  state.mode=hostedMode(state.lobby.gameStyle);
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
        onExpired:()=>{
          cancelAnimationFrame(state.raf);
          say('Hosted access expired. Returning to Join.','error');
          setTimeout(()=>location.replace(`/game/join/?code=${encodeURIComponent(state.lobby.code||'')}`),500);
        },
        onError:e=>console.debug('Slime Smash access lease',e?.code||e)
      });
      $('#startRun').disabled=false;
      say('Ready // press Start Run.','ok');
    }catch(e){
      console.error(e);
      say(e?.message||e?.code||'Could not authorize hosted access.','error');
      setTimeout(()=>location.replace(`/game/join/?code=${encodeURIComponent(state.lobby.code||'')}`),800);
    }
  });
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
});

init().catch(e=>{console.error(e);say(e?.message||'Could not load Slime Smash.','error');});
