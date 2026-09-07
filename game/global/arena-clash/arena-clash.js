import { watchIdentity } from '/game/assets/js/eras-data.js';
import { createGlobalPremadeTrack } from '/game/assets/js/global-premade-score.js?v=1.1.0';

const $=s=>document.querySelector(s);
const canvas=$('#clashCanvas'),ctx=canvas.getContext('2d');
const state={identity:null,track:null,running:false,raf:0,last:0,keys:new Set(),touch:new Set(),player:null,cpu:null,projectiles:[],kos:0,damage:0,won:false,respawnTimer:0,playerIconUrl:'',playerIconImage:null,playerBadge:''};
const cpuSlimeImg=new Image();cpuSlimeImg.src='/public-assets/textures/slime_monochrome.png';
const platforms=[
  {x:90,y:430,w:780,h:26},
  {x:170,y:330,w:230,h:16},
  {x:560,y:330,w:230,h:16},
  {x:350,y:235,w:260,h:16}
];

function say(message,tone=''){const e=$('#gameFeedback');if(e){e.textContent=String(message||'').toUpperCase();e.dataset.tone=tone;}}
function score(){return state.kos*1000+Math.max(0,Math.floor(state.damage))*10+(state.won?2000:0);}
function updateHud(){
  $('#playerStocks').textContent='●'.repeat(Math.max(0,state.player?.stocks||0))||'—';
  $('#cpuStocks').textContent='●'.repeat(Math.max(0,state.cpu?.stocks||0))||'—';
  $('#playerPercent').textContent=`${Math.max(0,Math.round(state.player?.percent||0))}%`;
  $('#cpuPercent').textContent=`${Math.max(0,Math.round(state.cpu?.percent||0))}%`;
  $('#runScore').textContent=score().toLocaleString();
  $('#matchStatus').textContent=state.running?`KOS ${state.kos} // DMG ${Math.floor(state.damage)}`:(state.won?'VICTORY':'READY');
}
function fighter(kind,x){
  return {kind,x,y:150,prevY:150,vx:0,vy:0,w:54,h:54,grounded:false,jumps:2,percent:0,stocks:3,face:kind==='player'?1:-1,attackUntil:0,attackCd:0,specialCd:0,invuln:0,dead:false};
}
function resetFighter(f,x){
  f.x=x;f.y=130;f.prevY=130;f.vx=0;f.vy=0;f.percent=0;f.grounded=false;f.jumps=2;f.invuln=900;f.dead=false;
}
function initials(text=''){
  const parts=String(text||'').trim().split(/\s+/).filter(Boolean).slice(0,2);
  return (parts.map(x=>x[0]||'').join('').toUpperCase() || String(text||'P').slice(0,1).toUpperCase() || 'P').slice(0,2);
}
function possibleIconSources(identity){
  const nested = identity?.profile || {};
  return [
    identity?.iconUrl, identity?.iconURL, identity?.avatarUrl, identity?.avatarURL,
    identity?.photoURL, identity?.photoUrl, identity?.imageUrl, identity?.imageURL,
    identity?.icon, identity?.avatar, identity?.photo, identity?.image,
    nested?.iconUrl, nested?.iconURL, nested?.avatarUrl, nested?.avatarURL,
    nested?.photoURL, nested?.photoUrl, nested?.imageUrl, nested?.imageURL,
    nested?.icon, nested?.avatar, nested?.photo, nested?.image
  ].filter(v=>typeof v==='string' && v.trim());
}
function refreshPlayerIcon(identity){
  state.playerBadge = initials(identity?.displayName || identity?.username || identity?.handle || 'Player');
  state.playerIconUrl = possibleIconSources(identity)[0] || '';
  state.playerIconImage = null;
  if(!state.playerIconUrl) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = ()=>{ state.playerIconImage = img; };
  img.onerror = ()=>{ if(state.playerIconUrl === img.src) state.playerIconImage = null; };
  img.src = state.playerIconUrl;
}
function startMatch(){
  cancelAnimationFrame(state.raf);
  state.player=fighter('player',260);state.cpu=fighter('cpu',650);state.projectiles=[];state.kos=0;state.damage=0;state.won=false;state.running=true;state.last=0;
  $('#startRun').textContent='MATCH RUNNING';$('#startRun').disabled=true;updateHud();say('FIGHT // YOU ARE YOUR PROFILE ICON // THE NPC REMAINS THE DEFAULT GREEN SLIME.','ok');
  state.raf=requestAnimationFrame(frame);
}
function finishMatch(won){
  if(!state.running)return;
  state.running=false;state.won=!!won;cancelAnimationFrame(state.raf);state.raf=0;updateHud();
  $('#startRun').disabled=false;$('#startRun').textContent='PLAY AGAIN';
  const finalScore=score();
  say(`${won?'VICTORY':'DEFEAT'} // KOS ${state.kos} // DAMAGE ${Math.floor(state.damage)} // SCORE ${finalScore.toLocaleString()}`,won?'ok':'error');
  state.track?.submit(finalScore,{kos:state.kos,damage:Math.floor(state.damage),won:state.won}).catch(console.error);
}
function pressed(id){return state.keys.has(id)||state.touch.has(id);}
function jump(f){
  if(!f || f.jumps<=0||f.dead)return;
  f.vy=-12.5;f.grounded=false;f.jumps--;
}
function attack(attacker,target,now,damage=10,push=1){
  if(!attacker || !target || attacker.dead||target.dead||now<attacker.attackCd)return;
  attacker.attackCd=now+330;attacker.attackUntil=now+120;
  const dx=(target.x+target.w/2)-(attacker.x+attacker.w/2),dy=(target.y+target.h/2)-(attacker.y+attacker.h/2);
  attacker.face=dx>=0?1:-1;
  if(Math.abs(dx)>78||Math.abs(dy)>62||target.invuln>0)return;
  hitTarget(attacker,target,damage,push);
}
function hitTarget(attacker,target,damage,push=1){
  if(!target || target.invuln>0||target.dead)return;
  target.percent+=damage;
  const dir=(target.x+target.w/2)>=(attacker.x+attacker.w/2)?1:-1;
  const kb=(4.8+target.percent*.045)*push;
  target.vx=dir*kb;target.vy=-3.8-target.percent*.018;
  if(attacker.kind==='player'){state.damage+=damage;}
}
function special(f,now){
  if(!f || f.dead||now<f.specialCd)return;
  f.specialCd=now+700;
  state.projectiles.push({owner:f.kind,x:f.x+f.w/2+f.face*34,y:f.y+22,vx:f.face*8.5,life:1500,r:9});
}
function cpuThink(now){
  const c=state.cpu,p=state.player;if(!c||!p||c.dead||p.dead)return;
  const dx=p.x-c.x,dy=p.y-c.y;c.face=dx>=0?1:-1;
  if(Math.abs(dx)>52)c.vx+=Math.sign(dx)*.43;
  if((dy<-80||c.y>410)&&c.jumps>0&&Math.random()<.045)jump(c);
  if(Math.abs(dx)<72&&Math.abs(dy)<60&&Math.random()<.12)attack(c,p,now,9,1);
  else if(Math.abs(dx)>160&&Math.abs(dx)<420&&Math.random()<.012)special(c,now);
}
function physics(f,dt){
  if(!f || f.dead)return;
  f.prevY=f.y;
  f.vy+=.78*dt;f.vx*=Math.pow(.88,dt);f.vx=Math.max(-8.6,Math.min(8.6,f.vx));
  f.x+=f.vx*dt;f.y+=f.vy*dt;f.grounded=false;
  const prevBottom=f.prevY+f.h,bottom=f.y+f.h;
  if(f.vy>=0){
    for(const p of platforms){
      if(f.x+f.w>p.x+5&&f.x<p.x+p.w-5&&prevBottom<=p.y+7&&bottom>=p.y){
        f.y=p.y-f.h;f.vy=0;f.grounded=true;f.jumps=2;break;
      }
    }
  }
  if(f.invuln>0)f.invuln=Math.max(0,f.invuln-16.67*dt);
}
function checkKO(f){
  if(!f || f.dead)return;
  if(f.x<-150||f.x>canvas.width+150||f.y>canvas.height+160||f.y<-260){
    f.dead=true;f.stocks--;
    if(f.kind==='cpu')state.kos++;
    updateHud();
    if(f.stocks<=0){
      finishMatch(f.kind==='cpu');
      return;
    }
    setTimeout(()=>{if(state.running)resetFighter(f,f.kind==='player'?260:650);},520);
  }
}
function projectileStep(dt){
  for(const q of state.projectiles){q.x+=q.vx*dt;q.life-=16.67*dt;}
  for(const q of state.projectiles){
    const target=q.owner==='player'?state.cpu:state.player,owner=q.owner==='player'?state.player:state.cpu;
    if(!target||target.dead||target.invuln>0||q.life<=0)continue;
    if(q.x>target.x-10&&q.x<target.x+target.w+10&&q.y>target.y-10&&q.y<target.y+target.h+10){
      hitTarget(owner,target,8,.88);q.life=0;
    }
  }
  state.projectiles=state.projectiles.filter(q=>q.life>0&&q.x>-30&&q.x<canvas.width+30);
}
function drawStage(){
  const grd=ctx.createLinearGradient(0,0,0,canvas.height);grd.addColorStop(0,'#071022');grd.addColorStop(.55,'#07131b');grd.addColorStop(1,'#02090b');ctx.fillStyle=grd;ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(118,92,196,.14)';ctx.beginPath();ctx.arc(480,170,145,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(131,224,227,.08)';for(let x=0;x<canvas.width;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
  for(const p of platforms){ctx.fillStyle='#102027';ctx.fillRect(p.x,p.y,p.w,p.h);ctx.fillStyle='#6a858c';ctx.fillRect(p.x,p.y,p.w,2);}
}
function drawPlayerIconFighter(f){
  const cx=f.x+f.w/2, cy=f.y+f.h/2;
  ctx.save();
  ctx.translate(cx,cy);
  if(f.face<0)ctx.scale(-1,1);
  const flash=f.invuln>0&&Math.floor(f.invuln/80)%2===0;
  ctx.globalAlpha=flash?.45:1;
  const stretch=1+Math.min(.14,Math.abs(f.vy)*.01),squash=1-Math.min(.10,Math.abs(f.vy)*.006);
  ctx.scale(squash,stretch);

  ctx.beginPath();
  ctx.arc(0,0,26,0,Math.PI*2);
  ctx.fillStyle='rgba(5,17,28,.96)';
  ctx.fill();
  ctx.lineWidth=3;
  ctx.strokeStyle='rgba(131,224,227,.85)';
  ctx.stroke();

  if(state.playerIconImage && state.playerIconImage.complete && state.playerIconImage.naturalWidth){
    ctx.save();
    ctx.beginPath();
    ctx.arc(0,0,22,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(state.playerIconImage,-22,-22,44,44);
    ctx.restore();
  }else{
    ctx.beginPath();
    ctx.arc(0,0,22,0,Math.PI*2);
    ctx.fillStyle='#214d66';
    ctx.fill();
    ctx.fillStyle='#e9f7f8';
    ctx.font='900 18px system-ui, sans-serif';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(state.playerBadge || 'P',0,1);
  }

  ctx.strokeStyle='rgba(255,233,138,.85)';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.arc(0,0,28,-2.5,-0.64);
  ctx.stroke();

  if(f.attackUntil>performance.now()){
    ctx.strokeStyle='#ffe98a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(26,0,30,-.8,.8);ctx.stroke();
  }
  ctx.restore();
}
function drawCpuSlimeFighter(f){
  const cx=f.x+f.w/2, cy=f.y+f.h/2;
  ctx.save();
  ctx.translate(cx,cy);
  if(f.face<0)ctx.scale(-1,1);
  const flash=f.invuln>0&&Math.floor(f.invuln/80)%2===0;
  ctx.globalAlpha=flash?.45:1;
  const stretch=1+Math.min(.20,Math.abs(f.vy)*.012),squash=1-Math.min(.15,Math.abs(f.vy)*.008);
  ctx.scale(squash,stretch);
  if(cpuSlimeImg.complete&&cpuSlimeImg.naturalWidth){
    ctx.filter='hue-rotate(75deg) saturate(2.4) brightness(1.05)';
    ctx.drawImage(cpuSlimeImg,-f.w/2,-f.h/2,f.w,f.h);
    ctx.filter='none';
  }else{
    ctx.fillStyle='#62db62';ctx.beginPath();ctx.arc(0,6,24,0,Math.PI*2);ctx.fill();
  }
  if(f.attackUntil>performance.now()){ctx.strokeStyle='#ffe98a';ctx.lineWidth=4;ctx.beginPath();ctx.arc(25,0,32,-.8,.8);ctx.stroke();}
  ctx.restore();
}
function drawFighter(f){
  if(!f||f.dead)return;
  if(f.kind==='player') drawPlayerIconFighter(f);
  else drawCpuSlimeFighter(f);
}
function drawProjectiles(){
  for(const q of state.projectiles){
    ctx.save();
    ctx.fillStyle=q.owner==='player'?'#a8ff90':'#6bff77';
    ctx.shadowColor=ctx.fillStyle;
    ctx.shadowBlur=13;
    ctx.beginPath();
    ctx.arc(q.x,q.y,q.r,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}
function frame(now){
  if(!state.running)return;
  const dt=Math.min(2.2,state.last?(now-state.last)/16.667:1);state.last=now;
  const p=state.player,c=state.cpu;
  if(!p.dead){
    if(pressed('left')){p.vx-=.72*dt;p.face=-1;}
    if(pressed('right')){p.vx+=.72*dt;p.face=1;}
  }
  cpuThink(now);physics(p,dt);physics(c,dt);projectileStep(dt);checkKO(p);checkKO(c);
  drawStage();drawProjectiles();drawFighter(p);drawFighter(c);updateHud();
  state.raf=requestAnimationFrame(frame);
}
function action(id,down=true){
  if(!state.running)return;
  if(id==='left'||id==='right'){down?state.touch.add(id):state.touch.delete(id);return;}
  if(!down)return;
  if(id==='jump')jump(state.player);
  if(id==='attack')attack(state.player,state.cpu,performance.now(),10,1);
  if(id==='special')special(state.player,performance.now());
}
document.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  const k=e.key.toLowerCase();
  if(k==='a'||k==='arrowleft'){state.keys.add('left');e.preventDefault();}
  if(k==='d'||k==='arrowright'){state.keys.add('right');e.preventDefault();}
  if((k==='w'||k==='arrowup')&&!e.repeat){jump(state.player);e.preventDefault();}
  if((k==='j'||k===' ')&&!e.repeat){attack(state.player,state.cpu,performance.now(),10,1);e.preventDefault();}
  if(k==='k'&&!e.repeat){special(state.player,performance.now());e.preventDefault();}
});
document.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='a'||k==='arrowleft')state.keys.delete('left');if(k==='d'||k==='arrowright')state.keys.delete('right');});
document.querySelectorAll('[data-clash-action]').forEach(btn=>{
  const id=btn.dataset.clashAction;
  btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);action(id,true);});
  btn.addEventListener('pointerup',e=>{e.preventDefault();action(id,false);});
  btn.addEventListener('pointercancel',()=>action(id,false));
});
$('#startRun').addEventListener('click',()=>{if(state.identity?.profileId)startMatch();});

drawStage();updateHud();
state.track=createGlobalPremadeTrack({
  gameId:'arena-clash',
  getProfileId:()=>state.identity?.profileId||'',
  leaderboard:$('#globalLeaderboard'),
  personalBest:$('#personalBest'),
  feedback:$('#gameFeedback')
});
watchIdentity(identity=>{
  state.identity=identity?.profileId?identity:null;
  $('#startRun').disabled=!state.identity;
  if(!state.identity){say('Sign in to play E.R.A.S. Clash Global.','error');return;}
  refreshPlayerIcon(state.identity);
  $('#personalBest').textContent=state.track.localBest().toLocaleString();
  state.track.refresh();
  say(`Global ready // personal best ${state.track.localBest().toLocaleString()} // your fighter uses your icon // start match.`,'ok');
});
setInterval(()=>state.track.refresh(),30000);
