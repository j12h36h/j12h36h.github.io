import { watchIdentity, safeText } from '/game/assets/js/eras-data.js';
import { modeDefaults, hostedMode } from '/game/config/hosted-modes.js?v=1.4.0';
import { createGlobalPremadeTrack } from '/game/assets/js/global-premade-score.js?v=1.0.0';
import {
  GALACTIC_BOARD, GALACTIC_ANOMALIES, boardGridPosition, boardSpace,
  freshOwnership, canDevelopSpace, playerNetWorth, galacticSettings
} from '/game/config/galactic-dominion.js?v=1.0.0';

const $ = s => document.querySelector(s);
const esc = safeText;
const modeId = String(document.body?.dataset?.globalMode || '').trim();
const mode = hostedMode(modeId);
const cfg = modeDefaults(modeId);
const state = {identity:null,score:0,status:'ready',game:null,raf:0,track:null};

const GLOBAL_COPY = Object.freeze({
  'surface-discovery': {
    kicker:'GLOBAL // SITE-HOSTED 24/7 // DISCOVERY SCORE ATTACK',
    description:'Explore the fixed Global surface, collect discoveries, evade roaming threats, and bank the highest score.',
    rules:[['GRID','15 × 15'],['LIVES','3'],['DISCOVERY','+100'],['COMPLETE','+5,000']]
  },
  'jeng-stroid': {
    kicker:'GLOBAL // SITE-HOSTED 24/7 // PRECISION STACK',
    description:'Pull structural blocks without crossing the collapse threshold. Every legal block is worth 500 Global points.',
    rules:[['LAYERS','18'],['TOP LOCK','2 LAYERS'],['BLOCK','+500'],['COLLAPSE','ENDS RUN']]
  },
  'sunball': {
    kicker:'GLOBAL // SITE-HOSTED 24/7 // ORBITAL SCORE ATTACK',
    description:'Keep the Sunball alive across three balls and hammer the orbital bumpers for a permanent Global score.',
    rules:[['BALLS','3'],['BUMPER','+250'],['GRAVITY','0.22'],['MILESTONES','EVERY 5,000']]
  },
  'soldoku': {
    kicker:'GLOBAL // SITE-HOSTED 24/7 // LOGIC SCORE ATTACK',
    description:'Solve the fixed Global logic grid. Correct manual entries score, mistakes subtract, and completion adds 5,000.',
    rules:[['BOARD','9 × 9'],['CORRECT','+100'],['MISTAKE','-100'],['SOLVE','+5,000']]
  },
  'galactic-dominion': {
    kicker:'GLOBAL // SITE-HOSTED 24/7 // 40-TURN DOMINION TRIAL',
    description:'Build the strongest 40-turn solo dominion on the standard Galactic board. Local Galactic currency stays isolated; leaderboard score is final net worth ×2.',
    rules:[['TURNS','40'],['START','1,500 LOCAL'],['PASS GATE','+200 LOCAL'],['GLOBAL SCORE','NET WORTH ×2']]
  }
});

function say(message,tone='') {
  const el=$('#gameFeedback');
  if (!el) return;
  el.textContent=String(message||'').toUpperCase();
  el.dataset.tone=tone;
}
function setScore(value) {
  state.score=Math.max(0,Math.floor(Number(value)||0));
  const el=$('#runScore'); if(el)el.textContent=state.score.toLocaleString();
}
function hud(items) {
  const el=$('#gameHud'); if(el)el.innerHTML=items.map(x=>`<span>${esc(x)}</span>`).join('');
}
function controls(buttons) {
  const el=$('#gameControls'); if(!el)return;
  el.innerHTML=buttons.map(b=>`<button type="button" data-game-action="${esc(b.id)}" ${b.disabled?'disabled':''}>${esc(b.label)}</button>`).join('');
}
function renderRules() {
  const copy=GLOBAL_COPY[modeId],root=$('#globalRules');
  if(!root)return;
  root.innerHTML=(copy?.rules||[]).map(([k,v])=>`<div class="runtime-status-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')+
    '<div class="runtime-status-row"><span>CREDIT PROGRESSION</span><b>5K +1 // 10K +2 // 15K +3…</b></div>';
}
function seeded(seed) {
  let h=2166136261;
  for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return()=>((h=Math.imul(h^h>>>15,2246822507),((h^h>>>13)>>>0)/4294967296));
}
function finishRun(score,meta,message='RUN COMPLETE') {
  state.status='finished';
  cancelAnimationFrame(state.raf); state.raf=0;
  setScore(score);
  say(`${message} // SCORE ${state.score.toLocaleString()}`,'ok');
  state.track?.submit(state.score,meta).catch(console.error);
}

/* ---------------- Surface Discovery ---------------- */
function startSurface() {
  const n=15,rand=seeded(`global-surface-discovery:${state.identity.profileId}`);
  const cells=Array(n*n).fill(0);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const i=y*n+x;
    if(x===0||y===0||x===n-1||y===n-1||(x%2===0&&y%2===0&&rand()>.18))cells[i]=1;
  }
  cells[n+1]=0;
  const player={x:1,y:1},dots=new Set(),enemies=[];
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++)if(!cells[y*n+x]&&(x!==1||y!==1))dots.add(y*n+x);
  for(let i=0;i<3;i++)enemies.push({x:n-2-i%2,y:n-2-Math.floor(i/2)});
  state.game={type:'surface',n,cells,player,dots,enemies,lives:3,discoveries:0};
  state.status='playing';setScore(0);renderSurface();say('Use Arrow Keys / WASD or the controls below.','ok');
}
function renderSurface(){
  const g=state.game,n=g.n,root=$('#gameStage');
  root.innerHTML=`<div class="hosted-maze" style="grid-template-columns:repeat(${n},1fr)">${g.cells.map((wall,i)=>{
    const x=i%n,y=Math.floor(i/n),cls=['hosted-maze-cell'];
    if(wall)cls.push('wall');else if(g.dots.has(i))cls.push('dot');
    if(g.player.x===x&&g.player.y===y)cls.push('player');
    if(g.enemies.some(e=>e.x===x&&e.y===y))cls.push('enemy');
    return `<i class="${cls.join(' ')}"></i>`;
  }).join('')}</div>`;
  hud([`SCORE ${state.score}`,`DISCOVERIES ${g.discoveries}`,`REMAINING ${g.dots.size}`,`LIVES ${g.lives}`]);
  controls([{id:'up',label:'▲'},{id:'left',label:'◀'},{id:'down',label:'▼'},{id:'right',label:'▶'}]);
}
function surfaceMove(dx,dy){
  const g=state.game;if(g?.type!=='surface'||state.status!=='playing')return;
  const nx=g.player.x+dx,ny=g.player.y+dy;
  if(nx<0||ny<0||nx>=g.n||ny>=g.n||g.cells[ny*g.n+nx])return;
  g.player={x:nx,y:ny};
  const idx=ny*g.n+nx;
  if(g.dots.delete(idx)){g.discoveries++;setScore(g.discoveries*100);}
  for(const e of g.enemies){
    const opts=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:e.x+x,y:e.y+y}))
      .filter(p=>p.x>=0&&p.y>=0&&p.x<g.n&&p.y<g.n&&!g.cells[p.y*g.n+p.x]);
    opts.sort((a,b)=>(Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y))-(Math.abs(b.x-g.player.x)+Math.abs(b.y-g.player.y)));
    if(opts[0])Object.assign(e,opts[Math.random()<.7?0:Math.floor(Math.random()*opts.length)]);
  }
  if(g.enemies.some(e=>e.x===g.player.x&&e.y===g.player.y)){
    g.lives--;g.player={x:1,y:1};
    if(g.lives<=0){renderSurface();finishRun(g.discoveries*100,{discoveries:g.discoveries,completed:false},'SURFACE RUN ENDED');return;}
    say('SURFACE CONTACT // LIFE LOST','error');
  }
  if(!g.dots.size){renderSurface();finishRun(g.discoveries*100+5000,{discoveries:g.discoveries,completed:true},'SURFACE DISCOVERY COMPLETE');return;}
  renderSurface();
}

/* ---------------- Jeng-stroid ---------------- */
function startJeng(){
  state.game={type:'jeng',layers:Array.from({length:18},()=>[1,1,1]),removed:0,stability:100,threshold:65};
  state.status='playing';setScore(0);renderJeng();say('Pull any block below the locked top two layers. Bank before collapse, or keep pushing.','ok');
}
function renderJeng(){
  const g=state.game;
  $('#gameStage').innerHTML=`<div class="jeng-stage">${g.layers.map((row,ri)=>`<div class="jeng-layer">${row.map((v,bi)=>`<button class="jeng-block ${v?'':'removed'}" data-jeng="${ri}:${bi}" type="button" aria-label="Layer ${ri+1}, block ${bi+1}"></button>`).join('')}</div>`).join('')}</div>`;
  hud([`SCORE ${state.score}`,`BLOCKS ${g.removed}`,`STABILITY ${Math.max(0,Math.round(g.stability))}%`]);
  controls([{id:'bank',label:'BANK RUN'}]);
}
function pullJeng(key){
  const g=state.game;if(g?.type!=='jeng'||state.status!=='playing')return;
  const [ri,bi]=String(key).split(':').map(Number);
  if(!g.layers?.[ri]?.[bi]||ri>=g.layers.length-2)return say('Top two layers cannot be pulled.','error');
  g.layers[ri][bi]=0;g.removed++;
  const rowRemaining=g.layers[ri].reduce((a,b)=>a+b,0);
  const penalty=rowRemaining===2?1.7:rowRemaining===1?5.5:15;
  const heightFactor=(g.layers.length-ri)/g.layers.length;
  g.stability-=penalty*heightFactor;
  setScore(g.removed*500);
  renderJeng();
  if(g.stability<g.threshold){finishRun(g.removed*500,{removed:g.removed},'JENG-STROID COLLAPSE');}
}
function bankJeng(){
  const g=state.game;if(g?.type!=='jeng'||state.status!=='playing')return;
  finishRun(g.removed*500,{removed:g.removed},'JENG-STROID SCORE BANKED');
  controls([{id:'restart',label:'REBUILD STACK'}]);
}

/* ---------------- Sunball ---------------- */
function startSunball(){
  const canvas=document.createElement('canvas');canvas.width=760;canvas.height=520;canvas.className='sunball-canvas';
  $('#gameStage').replaceChildren(canvas);
  state.game={type:'sunball',canvas,ctx:canvas.getContext('2d'),x:380,y:110,vx:2.2,vy:0,balls:3,gravity:.22,bumper:1.8,
    bumpers:[{x:240,y:180,r:34,last:0},{x:520,y:200,r:38,last:0},{x:380,y:285,r:30,last:0}],hits:0,lastFrame:0};
  state.status='playing';setScore(0);
  controls([{id:'left',label:'LEFT FLIPPER'},{id:'right',label:'RIGHT FLIPPER'},{id:'launch',label:'LAUNCH'}]);
  cancelAnimationFrame(state.raf);state.raf=requestAnimationFrame(sunballFrame);say('Keep the ball alive. Every bumper hit is +250.','ok');
}
function sunballFrame(ts){
  const g=state.game;if(g?.type!=='sunball'||state.status!=='playing')return;
  const c=g.canvas,ctx=g.ctx;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#030a0d';ctx.fillRect(0,0,c.width,c.height);
  g.vy+=g.gravity;g.x+=g.vx;g.y+=g.vy;
  if(g.x<15||g.x>c.width-15)g.vx*=-1;if(g.y<15){g.y=15;g.vy=Math.abs(g.vy);}
  for(const b of g.bumpers){
    const dx=g.x-b.x,dy=g.y-b.y,d=Math.hypot(dx,dy);
    ctx.strokeStyle='#8adfe0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.stroke();
    if(d<b.r+10 && ts-b.last>180){
      b.last=ts;const f=g.bumper;g.vx+=(dx/(d||1))*f;g.vy+=(dy/(d||1))*f;g.hits++;setScore(g.hits*250);
    }
  }
  if(g.y>c.height+20){
    g.balls--;
    if(g.balls<=0){finishRun(g.hits*250,{bumpers:g.hits},'SUNBALL RUN COMPLETE');controls([{id:'restart',label:'PLAY AGAIN'}]);return;}
    g.x=380;g.y=100;g.vx=2.2;g.vy=0;
  }
  ctx.fillStyle='#ffe087';ctx.beginPath();ctx.arc(g.x,g.y,10,0,Math.PI*2);ctx.fill();
  hud([`SCORE ${state.score}`,`BUMPERS ${g.hits}`,`BALLS ${g.balls}`]);
  state.raf=requestAnimationFrame(sunballFrame);
}

/* ---------------- Soldoku ---------------- */
function startSoldoku(){
  const n=9,boxR=3,boxC=3;
  const base=Array.from({length:n},(_,r)=>Array.from({length:n},(_,c)=>(r*boxC+Math.floor(r/boxR)+c)%n+1));
  const puzzle=base.map(r=>r.slice()),rand=seeded(`global-soldoku:${state.identity.profileId}`);
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(rand()>.46)puzzle[r][c]=0;
  state.game={type:'soldoku',n,solution:base,puzzle,values:puzzle.map(r=>r.slice()),mistakes:0,limit:3,hints:3,correct:new Set(),hinted:new Set()};
  state.status='playing';setScore(0);renderSoldoku();say('Complete the grid. Manual correct entries score; hints do not.','ok');
}
function soldokuScore(g,completed=false){return Math.max(0,g.correct.size*100-g.mistakes*100+(completed?5000:0));}
function renderSoldoku(){
  const g=state.game;
  $('#gameStage').innerHTML=`<div class="soldoku-wrap"><div class="soldoku-grid" style="grid-template-columns:repeat(${g.n},1fr)">${g.values.flatMap((row,r)=>row.map((v,c)=>{
    const key=`${r}:${c}`,given=g.puzzle[r][c]!==0,hinted=g.hinted.has(key);
    return `<input class="soldoku-cell ${given?'given':''} ${hinted?'hinted':''}" data-sudoku="${key}" inputmode="numeric" maxlength="1" value="${v||''}" ${given||hinted?'disabled':''} aria-label="Row ${r+1} column ${c+1}">`;
  })).join('')}</div></div>`;
  hud([`SCORE ${state.score}`,`CORRECT ${g.correct.size}`,`MISTAKES ${g.mistakes}/${g.limit}`,`HINTS ${g.hints}`]);
  controls([{id:'hint',label:'USE HINT',disabled:g.hints<=0},{id:'check',label:'CHECK GRID'}]);
}
function checkSudokuCell(el){
  const g=state.game;if(g?.type!=='soldoku'||state.status!=='playing')return;
  const [r,c]=el.dataset.sudoku.split(':').map(Number),key=`${r}:${c}`,v=Number(el.value);
  if(!v){g.values[r][c]=0;g.correct.delete(key);setScore(soldokuScore(g));renderSoldoku();return;}
  if(v<1||v>g.n||v!==g.solution[r][c]){
    g.mistakes++;g.values[r][c]=v;g.correct.delete(key);setScore(soldokuScore(g));
    if(g.mistakes>=g.limit){renderSoldoku();finishRun(state.score,{correct:g.correct.size,mistakes:g.mistakes,completed:false},'SOLDOKU MISTAKE LIMIT REACHED');return;}
    say('INCORRECT CELL // -100','error');
  }else{
    g.values[r][c]=v;g.correct.add(key);setScore(soldokuScore(g));say('CORRECT // +100','ok');
  }
  renderSoldoku();
}
function soldokuAction(id){
  const g=state.game;if(g?.type!=='soldoku'||state.status!=='playing')return;
  if(id==='hint'&&g.hints>0){
    for(let r=0;r<g.n;r++)for(let c=0;c<g.n;c++){
      const key=`${r}:${c}`;
      if(!g.values[r][c]){g.values[r][c]=g.solution[r][c];g.hinted.add(key);g.correct.delete(key);g.hints--;renderSoldoku();return;}
    }
  }
  if(id==='check'){
    const done=g.values.every((row,r)=>row.every((v,c)=>v===g.solution[r][c]));
    if(!done)return say('GRID IS NOT COMPLETE YET.','error');
    const score=soldokuScore(g,true);renderSoldoku();
    finishRun(score,{correct:g.correct.size,mistakes:g.mistakes,completed:true},'SOLDOKU SOLVED');
  }
}

/* ---------------- Galactic Dominion Global Trial ---------------- */
const GAL_ID='global-player';
function galGameForWorth(g){
  return {players:{[GAL_ID]:{balance:g.balance}},ownership:g.ownership};
}
function galWorth(g){return playerNetWorth(galGameForWorth(g),GAL_ID);}
function galScore(g){return galWorth(g)*2;}
function startGalactic(){
  const settings=galacticSettings({});
  state.game={type:'galactic',position:0,balance:settings.startingBalance,ownership:freshOwnership(),turnsLeft:40,turnsPlayed:0,
    phase:'roll',pending:null,quarantined:0,lastRoll:'—',log:['GLOBAL DOMINION TRIAL STARTED'],settings};
  state.status='playing';setScore(galScore(state.game));renderGalactic();say('Forty turns. Build the strongest dominion you can.','ok');
}
function galLog(g,text){g.log.unshift(String(text));g.log=g.log.slice(0,8);}
function galOwnershipGame(g){return {players:{[GAL_ID]:{balance:g.balance}},ownership:g.ownership};}
function renderGalactic(){
  const g=state.game,board=$('#gameStage');
  const pieces=GALACTIC_BOARD.map((space,index)=>{
    const p=boardGridPosition(index),own=g.ownership[space.id]?.ownerId===GAL_ID,here=index===g.position;
    return `<button type="button" class="gal-space ${own?'is-owned':''} ${here?'is-current':''}" style="grid-row:${p.row};grid-column:${p.col}" disabled>
      <small>${String(index).padStart(2,'0')}</small><b>${esc(space.name)}</b>${space.cost?`<span>${space.cost}</span>`:''}</button>`;
  }).join('');
  board.innerHTML=`<div class="gal-global-board">${pieces}<section class="gal-global-center"><p>DOMINION TRIAL</p><strong>${esc(g.lastRoll)}</strong><span>${g.turnsLeft} TURNS LEFT</span><span>${g.phase==='action'?'DECISION REQUIRED':'ROLL WHEN READY'}</span></section></div>`;
  setScore(galScore(g));
  hud([`GLOBAL SCORE ${state.score}`,`NET WORTH ${galWorth(g)}`,`LOCAL ${g.balance}`,`TURN ${g.turnsPlayed}/40`]);
  const buttons=[];
  if(g.phase==='roll')buttons.push({id:'roll',label:'ROLL 2D6'});
  if(g.phase==='action'){
    const space=g.pending;
    if(space && !g.ownership[space.id]?.ownerId && g.balance>=Number(space.cost||0))buttons.push({id:'buy',label:`BUY ${space.name} // ${space.cost}`});
    if(space && canDevelopSpace(galOwnershipGame(g),GAL_ID,space,g.settings) && g.balance>=Number(space.developmentCost||0))buttons.push({id:'develop',label:`DEVELOP // ${space.developmentCost}`});
    buttons.push({id:'pass',label:'PASS'});
  }
  controls(buttons);
  const log=$('#galacticLog');if(log)log.innerHTML=g.log.map(x=>`<p>${esc(x)}</p>`).join('');
}
function galEndTurn(g){
  g.turnsLeft--;g.turnsPlayed++;
  if(g.turnsLeft<=0){
    renderGalactic();
    finishRun(galScore(g),{netWorth:galWorth(g),turns:40},'GALACTIC DOMINION TRIAL COMPLETE');
    controls([{id:'restart',label:'START NEW TRIAL'}]);return;
  }
  g.phase='roll';g.pending=null;renderGalactic();
}
function galResolve(space){
  const g=state.game;
  if(space.type==='property'||space.type==='warp'){
    const holding=g.ownership[space.id];
    if(!holding.ownerId || (holding.ownerId===GAL_ID&&canDevelopSpace(galOwnershipGame(g),GAL_ID,space,g.settings))){
      g.phase='action';g.pending=space;galLog(g,`${space.name} // DECISION`);renderGalactic();return;
    }
  }
  if(space.type==='tax'){
    const amount=Math.min(g.balance,Number(space.amount||0));g.balance-=amount;galLog(g,`${space.name} // -${amount} LOCAL`);
  }else if(space.type==='anomaly'){
    const e=GALACTIC_ANOMALIES[Math.floor(Math.random()*GALACTIC_ANOMALIES.length)];
    if(e.balanceDelta)g.balance=Math.max(0,g.balance+Number(e.balanceDelta));
    if(Number.isInteger(e.moveTo))g.position=e.moveTo;
    if(e.quarantineTurns)g.quarantined=e.quarantineTurns;
    galLog(g,e.label);
  }else if(space.type==='quarantine'){g.quarantined=1;galLog(g,'QUARANTINE // NEXT ROLL SKIPPED');
  }else galLog(g,space.name);
  galEndTurn(g);
}
function galRoll(){
  const g=state.game;if(g?.type!=='galactic'||state.status!=='playing'||g.phase!=='roll')return;
  if(g.quarantined>0){g.quarantined--;g.lastRoll='QUARANTINED';galLog(g,'TURN SKIPPED // QUARANTINE');galEndTurn(g);return;}
  const a=Math.floor(Math.random()*6)+1,b=Math.floor(Math.random()*6)+1,total=a+b,old=g.position;
  g.position=(g.position+total)%GALACTIC_BOARD.length;
  if(g.position<old){g.balance+=g.settings.startSalary;galLog(g,`DOMINION GATE // +${g.settings.startSalary} LOCAL`);}
  g.lastRoll=`${a} + ${b} = ${total}`;galResolve(boardSpace(g.position));
}
function galAction(id){
  const g=state.game;if(g?.type!=='galactic'||state.status!=='playing')return;
  if(id==='roll')return galRoll();
  if(g.phase!=='action'||!g.pending)return;
  const s=g.pending,h=g.ownership[s.id];
  if(id==='buy'&&!h.ownerId&&g.balance>=Number(s.cost||0)){
    g.balance-=Number(s.cost||0);h.ownerId=GAL_ID;galLog(g,`ACQUIRED ${s.name} // -${s.cost} LOCAL`);
  }else if(id==='develop'&&canDevelopSpace(galOwnershipGame(g),GAL_ID,s,g.settings)&&g.balance>=Number(s.developmentCost||0)){
    g.balance-=Number(s.developmentCost||0);h.level=Math.min(4,Number(h.level||0)+1);galLog(g,`DEVELOPED ${s.name} // LEVEL ${h.level}`);
  }else if(id!=='pass')return;
  if(id==='pass')galLog(g,`PASSED ${s.name}`);
  galEndTurn(g);
}

/* ---------------- Shared dispatch/init ---------------- */
function startGame(){
  cancelAnimationFrame(state.raf);state.raf=0;
  if(modeId==='surface-discovery')startSurface();
  else if(modeId==='jeng-stroid')startJeng();
  else if(modeId==='sunball')startSunball();
  else if(modeId==='soldoku')startSoldoku();
  else if(modeId==='galactic-dominion')startGalactic();
}
function gameAction(id){
  if(id==='restart'){startGame();return;}
  if(state.game?.type==='surface'){
    const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[id];if(d)surfaceMove(...d);return;
  }
  if(state.game?.type==='jeng'){if(id==='bank')bankJeng();return;}
  if(state.game?.type==='sunball'){if(id==='left')state.game.vx-=1.2;if(id==='right')state.game.vx+=1.2;if(id==='launch')state.game.vy=-5;return;}
  if(state.game?.type==='soldoku'){soldokuAction(id);return;}
  if(state.game?.type==='galactic'){galAction(id);}
}
function init(){
  if(!GLOBAL_COPY[modeId]){say('Unsupported Global game.','error');return;}
  const copy=GLOBAL_COPY[modeId];
  $('#modeTitle').textContent=`${mode.name.toUpperCase()} GLOBAL`;
  $('#modeKicker').textContent=copy.kicker;
  $('#modeDescription').textContent=copy.description;
  const metric=modeId==='galactic-dominion'?'NET WORTH':modeId==='surface-discovery'?'DISCOVERIES':modeId==='jeng-stroid'?'BLOCKS':modeId==='sunball'?'BUMPERS':'CORRECT';
  $('#metricHeading').textContent=metric;
  renderRules();
  state.track=createGlobalPremadeTrack({
    gameId:modeId,
    getProfileId:()=>state.identity?.profileId||'',
    leaderboard:$('#globalLeaderboard'),
    personalBest:$('#personalBest'),
    feedback:$('#gameFeedback')
  });
  watchIdentity(identity=>{
    state.identity=identity?.profileId?identity:null;
    const start=$('#startRun');if(start)start.disabled=!state.identity;
    if(!state.identity){say(`Sign in to play ${mode.name} Global.`,'error');return;}
    $('#personalBest').textContent=state.track.localBest().toLocaleString();
    state.track.refresh();
    say(`Global ready // personal best ${state.track.localBest().toLocaleString()} // start a run.`,'ok');
  });
  setInterval(()=>state.track?.refresh(),30000);
}
document.addEventListener('click',e=>{
  if(e.target.closest('#startRun')){if(state.identity)startGame();return;}
  const block=e.target.closest('[data-jeng]');if(block){pullJeng(block.dataset.jeng);return;}
  const action=e.target.closest('[data-game-action]');if(action){gameAction(action.dataset.gameAction);}
});
document.addEventListener('input',e=>{if(e.target.matches('[data-sudoku]'))checkSudokuCell(e.target);});
document.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  if(state.game?.type!=='surface')return;
  const key=e.key.toLowerCase();
  const id=key==='arrowup'||key==='w'?'up':key==='arrowdown'||key==='s'?'down':key==='arrowleft'||key==='a'?'left':key==='arrowright'||key==='d'?'right':'';
  if(id){e.preventDefault();gameAction(id);}
});
init();
