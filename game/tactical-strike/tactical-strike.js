import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { db, fs } from '/game/assets/js/eras-data.js';

const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,deg=v=>THREE.MathUtils.degToRad(num(v));
const params=new URLSearchParams(location.search);
const state={scene:null,camera:null,renderer:null,world:new THREE.Group(),colliders:[],bots:[],keys:new Set(),yaw:Math.PI,pitch:0,velocity:new THREE.Vector3(),locked:false,last:performance.now(),lastShot:0,reloading:false,reloadToken:0,reloadingWeapon:'',triggerHeld:false,buyLockUntil:0,weaponBloom:0,
  movement:{jumpOffset:0,verticalVelocity:0,onGround:true,crouching:false,eyeHeight:1.7,horizontalSpeed:0,sprinting:false},
  player:{health:100,armor:0,credits:800,weapon:'pistol',owned:{pistol:true,rifle:false},ammo:{pistol:{mag:12,reserve:48},rifle:{mag:30,reserve:90}},diedThisRound:false},
  rules:null,sceneDef:null,objectDefs:new Map(),materialDefs:new Map(),phase:'loading',phaseEnds:0,round:1,score:{alpha:0,bravo:0},started:false,roundEnding:false,weaponMesh:null
};

async function getJson(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
const sceneUrlFor=id=>id==='scene.tactical_arena_02'?'/public-assets/3d/scenes/tactical-arena-02.json':'/public-assets/3d/scenes/tactical-arena-01.json';

async function loadHostedRules(baseRules){
  const lobbyId=params.get('lobby');if(!lobbyId)return baseRules;
  try{
    const snap=await fs.getDoc(fs.doc(db,'gameLobbies',lobbyId));if(!snap.exists())return baseRules;
    const lobby=snap.data()||{};
    const effectiveModeId=String(lobby.settings?.modeId||lobby.gameStyle||'');
    if(effectiveModeId!=='tactical-strike')return baseRules;
    const m=lobby.settings?.modeSettings||lobby.settings?.mode||{};
    $('#loadStatus').textContent=`Hosted rules loaded · ${lobby.name||'Tactical Strike'} · local practice combat runtime`;
    return {...baseRules,...m,hostedLobbyId:lobbyId,hostedLobbyName:lobby.name||''};
  }catch(e){console.warn('Hosted rules unavailable',e);return baseRules;}
}

async function boot(){
  const base=await getJson('/public-assets/3d/rulesets/tactical-strike.json');state.rules=await loadHostedRules(base);state.player.credits=num(state.rules.startingCredits,800);
  state.sceneDef=await getJson(sceneUrlFor(state.rules.sceneAssetId));await preloadDefs();initThree();await buildMap();wire();resetMatch(false);updateHud();
  $('#loadStatus').textContent=state.rules.hostedLobbyId?`HOSTED RULES · ${state.rules.hostedLobbyName||state.rules.hostedLobbyId} · ${state.sceneDef.name}`:`${state.sceneDef.name} · PRACTICE OPPONENTS READY`;
  $('#enterGame').disabled=false;$('#phaseLabel').textContent='READY';animate();
}
async function preloadDefs(){
  const pairs={
    'object.floor':'/public-assets/3d/objects/floor.json','object.wall':'/public-assets/3d/objects/wall.json','object.industrial_crate':'/public-assets/3d/objects/crate.json','object.ramp':'/public-assets/3d/objects/ramp.json'
  };
  for(const [id,url] of Object.entries(pairs))state.objectDefs.set(id,await getJson(url));
  for(const [id,url] of Object.entries({'material.concrete_dark':'/public-assets/3d/materials/concrete-dark.json','material.metal_green':'/public-assets/3d/materials/metal-green.json','material.floor_grid':'/public-assets/3d/materials/floor-grid.json'}))state.materialDefs.set(id,await getJson(url));
}
function initThree(){
  const viewport=$('#gameViewport');state.scene=new THREE.Scene();state.scene.background=new THREE.Color(state.sceneDef.environment?.skyColor||'#101719');state.scene.fog=new THREE.FogExp2(state.scene.background,0.008);
  state.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.05,400);state.camera.rotation.order='YXZ';state.scene.add(state.camera);
  state.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});state.renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));state.renderer.setSize(innerWidth,innerHeight);state.renderer.outputColorSpace=THREE.SRGBColorSpace;state.renderer.shadowMap.enabled=true;viewport.appendChild(state.renderer.domElement);
  state.scene.add(state.world);
  state.scene.add(new THREE.HemisphereLight(0xd9eee1,0x172019,num(state.sceneDef.environment?.ambientIntensity,.72)*1.7));
  const sun=new THREE.DirectionalLight(0xffffff,num(state.sceneDef.environment?.sunIntensity,1.1)*1.4);const d=state.sceneDef.environment?.sunDirection||[.5,1,.25];sun.position.set(d[0]*30,d[1]*30,d[2]*30);sun.castShadow=true;state.scene.add(sun);
  for(const l of state.sceneDef.lights||[]){if(l.type!=='point')continue;const p=new THREE.PointLight(l.color||'#fff',num(l.intensity,12),num(l.range,30));p.position.fromArray(l.position||[0,5,0]);state.scene.add(p);}
  makeWeaponView();addEventListener('resize',()=>{state.camera.aspect=innerWidth/innerHeight;state.camera.updateProjectionMatrix();state.renderer.setSize(innerWidth,innerHeight);});
}
async function materialFor(id,uv=[1,1]){const d=state.materialDefs.get(id)||{},m=new THREE.MeshStandardMaterial({color:d.baseColor||'#53665b',roughness:num(d.roughness,.8),metalness:num(d.metalness,.1)});if(d.texture){try{const t=await new THREE.TextureLoader().loadAsync(d.texture);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(Math.max(.1,num(uv?.[0],1)),Math.max(.1,num(uv?.[1],1)));t.colorSpace=THREE.SRGBColorSpace;m.map=t;}catch(_){}}return m;}
function geometryFor(d){const s=d.size||[1,1,1];return new THREE.BoxGeometry(num(s[0],1),num(s[1],1),num(s[2],1));}
async function buildMap(){
  for(const entry of state.sceneDef.objects||[]){const d=state.objectDefs.get(entry.assetId)||{size:[1,1,1]},mesh=new THREE.Mesh(geometryFor(d),await materialFor(entry.materialId||d.materialId,entry.uvScale||d.uvScale));const p=entry.position||[0,0,0],r=entry.rotation||[0,0,0],s=entry.scale||[1,1,1];mesh.position.fromArray(p);mesh.rotation.set(deg(r[0]),deg(r[1]),deg(r[2]));mesh.scale.set(num(s[0],1),num(s[1],1),num(s[2],1));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.mapCollider=entry.collision==='solid';state.world.add(mesh);mesh.updateMatrixWorld(true);if(mesh.userData.mapCollider&&entry.assetId!=='object.floor')state.colliders.push({mesh,box:new THREE.Box3().setFromObject(mesh)});}
}
function makeWeaponView(){
  const g=new THREE.Group();const dark=new THREE.MeshStandardMaterial({color:0x1b2520,roughness:.5,metalness:.65}),green=new THREE.MeshStandardMaterial({color:0x315c45,roughness:.55,metalness:.55});const body=new THREE.Mesh(new THREE.BoxGeometry(.18,.16,.72),dark);body.position.set(.28,-.27,-.62);g.add(body);const barrel=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.42),green);barrel.position.set(.28,-.24,-1.12);g.add(barrel);g.position.set(0,0,0);state.camera.add(g);state.weaponMesh=g;
}
function updateWeaponView(){if(!state.weaponMesh)return;state.weaponMesh.scale.set(state.player.weapon==='rifle'?1.25:1,1, state.player.weapon==='rifle'?1.35:.8);}

function spawnPoint(team,index=0){const list=(state.sceneDef.markers||[]).filter(m=>m.type==='team_spawn'&&m.team===team);const m=list[index%Math.max(1,list.length)]||{position:team==='alpha'?[-24,1.7,20]:[24,1,-20],rotation:[0,0,0]};return m;}
function weaponCaps(id){
  const w=state.rules?.weapons?.[id]||{};
  return {
    mag:Math.max(1,num(w.magazine,id==='rifle'?30:12)),
    reserve:Math.max(0,num(w.reserveMax,w.reserve??(id==='rifle'?90:48)))
  };
}
function resetBasicLoadout(){
  const pCap=weaponCaps('pistol'),rCap=weaponCaps('rifle');
  state.player.owned={pistol:true,rifle:false};
  state.player.weapon='pistol';
  state.player.armor=0;
  state.player.ammo.pistol={mag:pCap.mag,reserve:pCap.reserve};
  state.player.ammo.rifle={mag:rCap.mag,reserve:0};
}
function resetPlayer(){
  const sp=spawnPoint('alpha');
  if(state.player.diedThisRound)resetBasicLoadout();
  const moveRules=state.rules?.movement||{};
  const eye=num(moveRules.standingEyeHeight,1.7);
  state.camera.position.set(num(sp.position[0]),eye,num(sp.position[2]));
  state.yaw=deg(sp.rotation?.[1]||45)+Math.PI;
  state.pitch=0;
  state.camera.rotation.set(0,state.yaw,0);
  state.player.health=100;
  state.player.armor=Math.max(0,state.player.armor);
  state.player.diedThisRound=false;
  state.reloading=false;
  state.reloadToken++;
  state.reloadingWeapon='';
  state.triggerHeld=false;
  state.weaponBloom=0;
  state.movement.jumpOffset=0;
  state.movement.verticalVelocity=0;
  state.movement.onGround=true;
  state.movement.crouching=false;
  state.movement.eyeHeight=eye;
  state.movement.horizontalSpeed=0;
  state.movement.sprinting=false;
  updateWeaponView();
}
function clearBots(){for(const b of state.bots)b.group.removeFromParent();state.bots=[];}
function randomBetween(a,b){return a+Math.random()*(b-a);}
function spawnBots(){
  clearBots();
  const ai=state.rules?.ai||{},count=Math.max(1,Math.min(5,num(state.rules.teamSize,5)));
  for(let i=0;i<count;i++){
    const sp=spawnPoint('bravo',i),group=new THREE.Group(),
      body=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.9,4,8),new THREE.MeshStandardMaterial({color:0xa84854,roughness:.72})),
      head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),new THREE.MeshStandardMaterial({color:0xd5b4a7,roughness:.8}));
    body.position.y=.85;body.castShadow=true;group.add(body);
    head.position.y=1.62;group.add(head);
    group.position.set(num(sp.position[0])+((i%2)*1.2),0,num(sp.position[2])+Math.floor(i/2)*1.2);
    state.world.add(group);
    const now=performance.now();
    const bot={
      id:`bravo-${i+1}`,group,body,head,health:100,alive:true,
      skill:clamp(num(ai.baseAccuracy,.68)+randomBetween(-.10,.08),.38,.82),
      strafeDir:Math.random()<.5?-1:1,nextThink:now+randomBetween(250,700),
      aimReadyAt:0,nextShotAt:now+randomBetween(600,1200),burstRemaining:0,
      lastSeen:null,lastSeenAt:0
    };
    body.userData.bot=bot;head.userData.bot=bot;state.bots.push(bot);
  }
}

function setPhase(phase,seconds){state.phase=phase;state.phaseEnds=performance.now()+seconds*1000;$('#phaseLabel').textContent=phase.toUpperCase();if(phase==='buy'){$('#buyPanel').hidden=false;}else $('#buyPanel').hidden=true;}
function resetRound(){state.roundEnding=false;resetPlayer();spawnBots();setPhase('buy',num(state.rules.buySeconds,15));$('#roundLabel').textContent=`ROUND ${state.round}`;banner(`ROUND ${state.round} · BUY PHASE`,1100);updateHud();}
function resetMatch(start=true){state.score={alpha:0,bravo:0};state.round=1;state.player.credits=num(state.rules.startingCredits,800);resetBasicLoadout();state.player.diedThisRound=false;resetRound();state.started=start;}
function endRound(winner,reason){if(state.roundEnding)return;state.roundEnding=true;state.score[winner]++;state.player.credits+=winner==='alpha'?num(state.rules.economy?.winReward,3250):num(state.rules.economy?.lossReward,1900);updateHud();banner(`${winner.toUpperCase()} WINS · ${reason}`,2300);setPhase('round end',2.5);setTimeout(()=>{const need=num(state.rules.roundsToWin,7);if(state.score[winner]>=need){banner(`${winner.toUpperCase()} WINS THE MATCH`,3500);setTimeout(()=>resetMatch(true),3800);}else{state.round++;resetRound();}},2600);}
function banner(text,ms=1200){const b=$('#roundBanner');b.textContent=text;b.hidden=false;clearTimeout(b._t);b._t=setTimeout(()=>b.hidden=true,ms);}
function feed(text){const root=$('#killFeed'),d=document.createElement('div');d.textContent=text;root.prepend(d);setTimeout(()=>d.remove(),3500);while(root.children.length>5)root.lastChild.remove();}

function wire(){
  const recapture=$('#recaptureMouse');
  const syncRecaptureButton=()=>{
    if(recapture)recapture.hidden=!state.started||state.locked;
  };
  const captureMouse=()=>{
    if(!state.started||document.pointerLockElement===state.renderer.domElement)return;
    state.renderer.domElement.requestPointerLock();
  };

  $('#enterGame').addEventListener('click',()=>{state.started=true;$('#startOverlay').hidden=true;syncRecaptureButton();captureMouse();});
  recapture?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();captureMouse();});
  document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===state.renderer.domElement;if(!state.locked){state.keys.clear();state.triggerHeld=false;}syncRecaptureButton();if(state.locked&&state.phase==='buy')$('#buyPanel').hidden=false;});
  document.addEventListener('mousemove',e=>{if(!state.locked||!state.started)return;state.yaw-=e.movementX*.0022;state.pitch=clamp(state.pitch-e.movementY*.0022,-1.48,1.48);state.camera.rotation.set(state.pitch,state.yaw,0);});
  const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','KeyC']);
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
    if(state.locked&&movementKeys.has(e.code))e.preventDefault();
    state.keys.add(e.code);
    if(e.code==='Space'&&!e.repeat)tryJump();
    if(e.code==='KeyR')reload();
    if(e.code==='Digit1')switchWeapon('rifle');
    if(e.code==='Digit2')switchWeapon('pistol');
    if(e.code==='KeyB'&&state.phase==='buy')$('#buyPanel').hidden=!$('#buyPanel').hidden;
  });
  document.addEventListener('keyup',e=>{state.keys.delete(e.code);if(state.locked&&movementKeys.has(e.code))e.preventDefault();});
  addEventListener('blur',()=>{state.keys.clear();state.triggerHeld=false;});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){state.keys.clear();state.triggerHeld=false;}});
  document.addEventListener('mousedown',e=>{
    if(e.button!==0||!state.started)return;
    if(state.locked){state.triggerHeld=true;shoot();return;}
    if(e.target===state.renderer.domElement)captureMouse();
  });
  document.addEventListener('mouseup',e=>{if(e.button===0)state.triggerHeld=false;});
  $('#buyPanel').addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(b)buy(b.dataset.buy);});
}
function purchaseStatus(item){
  if(state.phase!=='buy')return {ok:false,reason:'BUY PHASE CLOSED'};
  if(item==='rifle'&&state.player.owned.rifle)return {ok:false,reason:'RIFLE ALREADY OWNED'};
  if(item==='armor'){
    const max=num(state.rules.equipment?.armor?.max,100);
    if(state.player.armor>=max-.01)return {ok:false,reason:'ARMOR ALREADY FULL'};
  }
  if(item==='ammo'){
    const id=state.player.weapon,a=state.player.ammo[id],cap=weaponCaps(id);
    if(!a||a.reserve>=cap.reserve)return {ok:false,reason:`${id.toUpperCase()} AMMO ALREADY FULL`};
  }
  return {ok:true,reason:''};
}
function updateBuyPanel(){
  const rifle=$('#buyPanel [data-buy="rifle"]'),armor=$('#buyPanel [data-buy="armor"]'),ammo=$('#buyPanel [data-buy="ammo"]');
  if(rifle)rifle.disabled=!purchaseStatus('rifle').ok;
  if(armor)armor.disabled=!purchaseStatus('armor').ok;
  if(ammo)ammo.disabled=!purchaseStatus('ammo').ok;
  const price=$('#ammoPriceHud'),detail=$('#ammoBuyDetail');
  if(price)price.textContent=String(num(state.rules.equipment?.ammo?.cost,300));
  if(detail){
    const cap=weaponCaps(state.player.weapon),a=state.player.ammo[state.player.weapon];
    detail.textContent=`${state.player.weapon.toUpperCase()} RESERVE · ${a?.reserve||0} / ${cap.reserve}`;
  }
}
function buy(item){
  const now=performance.now();
  if(now<state.buyLockUntil)return;
  state.buyLockUntil=now+140;
  const status=purchaseStatus(item);
  if(!status.ok){banner(status.reason,850);updateBuyPanel();return;}
  const price=item==='rifle'?num(state.rules.weapons?.rifle?.cost,2700):item==='armor'?num(state.rules.equipment?.armor?.cost,650):num(state.rules.equipment?.ammo?.cost,300);
  if(state.player.credits<price){banner('NOT ENOUGH MATCH CREDITS',900);return;}
  state.player.credits-=price;
  if(item==='rifle'){
    const cap=weaponCaps('rifle');
    state.player.owned.rifle=true;
    state.player.weapon='rifle';
    state.player.ammo.rifle={mag:cap.mag,reserve:cap.reserve};
    cancelReload();
    updateWeaponView();
    banner('TACTICAL RIFLE PURCHASED',750);
  }else if(item==='armor'){
    state.player.armor=num(state.rules.equipment?.armor?.max,100);
    banner('ARMOR RESTORED',650);
  }else{
    const id=state.player.weapon,cap=weaponCaps(id);
    state.player.ammo[id].reserve=cap.reserve;
    banner(`${id.toUpperCase()} AMMO RESTOCKED`,650);
  }
  updateHud();
}

function currentWeapon(){return state.rules.weapons?.[state.player.weapon]||state.rules.weapons?.pistol||{};}
function cancelReload(){state.reloadToken++;state.reloading=false;state.reloadingWeapon='';}
function switchWeapon(id){
  if(id==='rifle'&&!state.player.owned.rifle)id='pistol';
  if(!state.player.owned[id]||state.player.weapon===id){updateHud();return;}
  cancelReload();state.triggerHeld=false;state.player.weapon=id;updateWeaponView();updateHud();
}
function reload(){
  if(state.reloading||!state.started||state.player.health<=0)return;
  const id=state.player.weapon,a=state.player.ammo[id],w=currentWeapon(),cap=weaponCaps(id).mag;
  if(!a||a.mag>=cap||a.reserve<=0)return;
  state.reloading=true;state.reloadingWeapon=id;
  const token=++state.reloadToken;
  $('#weaponHud').textContent='RELOADING…';
  setTimeout(()=>{
    if(token!==state.reloadToken||state.player.weapon!==id)return;
    const take=Math.min(cap-a.mag,a.reserve);
    a.mag+=take;a.reserve-=take;
    state.reloading=false;state.reloadingWeapon='';
    updateHud();
  },num(w.reloadMs,1500));
}
function effectiveWeaponSpread(w){
  let spread=num(w.spread,.01)+state.weaponBloom;
  const walk=num(state.rules?.movement?.walkSpeed,4.8);
  if(state.movement.horizontalSpeed>.1)spread+=num(w.moveSpread,.02)*clamp(state.movement.horizontalSpeed/Math.max(.1,walk),0,1.8);
  if(!state.movement.onGround)spread+=num(w.airSpread,.06);
  if(state.movement.crouching)spread*=num(w.crouchSpreadMultiplier,.68);
  return Math.max(.0005,spread);
}
function rangedDamage(w,distance,headshot){
  const base=num(w.damage,34),start=num(w.falloffStart,40),range=Math.max(start+1,num(w.range,100)),minimum=clamp(num(w.minDamageMultiplier,.7),.2,1);
  const t=clamp((distance-start)/(range-start),0,1);
  const falloff=1-(1-minimum)*t;
  return base*falloff*(headshot?num(w.headshotMultiplier,1.9):1);
}
function shoot(){
  if(state.phase!=='live'||state.reloading||state.player.health<=0)return;
  const now=performance.now(),w=currentWeapon();
  if(now-state.lastShot<num(w.fireIntervalMs,200))return;
  const a=state.player.ammo[state.player.weapon];
  if(a.mag<=0){reload();return;}
  state.lastShot=now;a.mag--;
  const recoil=num(w.recoil,.012)*(0.78+Math.random()*.44);
  const yawKick=(Math.random()-.5)*2*num(w.recoilYaw,.004);
  state.pitch=clamp(state.pitch+recoil,-1.48,1.48);
  state.yaw+=yawKick;
  state.weaponBloom=clamp(state.weaponBloom+num(w.spread,.01)*.45,0,.055);
  state.camera.rotation.set(state.pitch,state.yaw,0);
  if(state.weaponMesh){state.weaponMesh.position.z=.045;setTimeout(()=>{if(state.weaponMesh)state.weaponMesh.position.z=0;},42);}
  updateHud();

  const spread=effectiveWeaponSpread(w),dir=new THREE.Vector3();
  state.camera.getWorldDirection(dir);
  dir.x+=(Math.random()-.5)*spread;dir.y+=(Math.random()-.5)*spread;dir.z+=(Math.random()-.5)*spread;dir.normalize();
  const range=num(w.range,100),ray=new THREE.Raycaster(state.camera.position,dir,.05,range),targets=[];
  for(const b of state.bots)if(b.alive)targets.push(b.body,b.head);
  targets.push(...state.colliders.map(c=>c.mesh));
  const hits=ray.intersectObjects(targets,false);
  if(!hits.length)return;
  const hit=hits[0],bot=hit.object.userData.bot;
  if(bot&&bot.alive){
    const head=hit.object===bot.head,damage=rangedDamage(w,hit.distance,head);
    bot.health-=damage;hitMark();
    if(bot.health<=0){
      bot.alive=false;bot.group.visible=false;
      state.player.credits+=num(state.rules.economy?.killReward,300);
      feed(`YOU  ⊕  ${bot.id.toUpperCase()}`);
      updateHud();
      if(!state.bots.some(x=>x.alive))endRound('alpha','TEAM ELIMINATED');
    }
  }
}
function hitMark(){const h=$('#hitMarker');h.classList.remove('show');void h.offsetWidth;h.classList.add('show');}
function damagePlayer(amount,from='BRAVO'){if(state.player.health<=0)return;let d=amount;if(state.player.armor>0){const absorbed=Math.min(state.player.armor,d*.6);state.player.armor-=absorbed;d-=absorbed;}state.player.health=Math.max(0,state.player.health-d);const f=$('#damageFlash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');updateHud();if(state.player.health<=0){state.player.diedThisRound=true;state.triggerHeld=false;cancelReload();feed(`${from}  ⊕  YOU`);endRound('bravo','ALPHA ELIMINATED');}}

function playerBoxAt(pos,standing=false){
  const standingHeight=1.78,crouchHeight=1.16;
  const top=(standing||!state.movement.crouching?standingHeight:crouchHeight)+state.movement.jumpOffset;
  const bottom=.06+state.movement.jumpOffset;
  return new THREE.Box3(new THREE.Vector3(pos.x-.32,bottom,pos.z-.32),new THREE.Vector3(pos.x+.32,top,pos.z+.32));
}
function collides(pos,standing=false){const box=playerBoxAt(pos,standing);return state.colliders.some(c=>c.box.intersectsBox(box));}
function tryJump(){
  if(!state.started||!state.locked||state.player.health<=0||!state.movement.onGround||state.movement.crouching)return;
  state.movement.onGround=false;
  state.movement.verticalVelocity=num(state.rules?.movement?.jumpVelocity,5.6);
}
function updateMovement(dt){
  if(!state.started||state.player.health<=0||state.phase==='round end')return;

  const moveRules=state.rules?.movement||{},p=state.camera.position.clone();
  const wantsCrouch=state.keys.has('KeyC');
  const canStand=!collides(p,true);
  state.movement.crouching=wantsCrouch||!canStand;

  const standingEye=num(moveRules.standingEyeHeight,1.7),crouchEye=num(moveRules.crouchEyeHeight,1.08);
  const targetEye=state.movement.crouching?crouchEye:standingEye;
  state.movement.eyeHeight+= (targetEye-state.movement.eyeHeight)*Math.min(1,dt*13);

  if(!state.movement.onGround){
    state.movement.jumpOffset+=state.movement.verticalVelocity*dt;
    state.movement.verticalVelocity-=num(moveRules.gravity,16.5)*dt;
    if(state.movement.jumpOffset<=0){
      state.movement.jumpOffset=0;state.movement.verticalVelocity=0;state.movement.onGround=true;
    }
  }

  let forwardInput=0,rightInput=0;
  if(state.locked){
    forwardInput=(state.keys.has('KeyW')||state.keys.has('ArrowUp')?1:0)-(state.keys.has('KeyS')||state.keys.has('ArrowDown')?1:0);
    rightInput=(state.keys.has('KeyD')||state.keys.has('ArrowRight')?1:0)-(state.keys.has('KeyA')||state.keys.has('ArrowLeft')?1:0);
  }
  const moving=!!(forwardInput||rightInput);
  const wantsSprint=(state.keys.has('ShiftLeft')||state.keys.has('ShiftRight'))&&moving;
  state.movement.sprinting=wantsSprint&&!state.movement.crouching&&state.movement.onGround;

  const speed=state.movement.crouching?num(moveRules.crouchSpeed,2.55):state.movement.sprinting?num(moveRules.sprintSpeed,7.2):num(moveRules.walkSpeed,4.8);
  state.movement.horizontalSpeed=moving?speed:0;

  if(moving){
    const forward=new THREE.Vector3();
    state.camera.getWorldDirection(forward);forward.y=0;
    if(forward.lengthSq()<1e-8)forward.set(0,0,-1);
    forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const move=new THREE.Vector3().addScaledVector(forward,forwardInput).addScaledVector(right,rightInput);
    if(move.lengthSq()>1)move.normalize();
    move.multiplyScalar(speed*dt);

    let q=p.clone();q.x+=move.x;if(!collides(q))p.x=q.x;
    q=p.clone();q.z+=move.z;if(!collides(q))p.z=q.z;
  }

  p.y=state.movement.eyeHeight+state.movement.jumpOffset;
  state.camera.position.copy(p);

  const motion=$('#motionStateHud');
  if(motion){
    motion.textContent=!state.movement.onGround?'AIR':state.movement.crouching?'CROUCH':state.movement.sprinting?'SPRINT':'';
    motion.hidden=!motion.textContent;
  }
}
function botLineOfSight(bot){
  const origin=bot.group.position.clone().add(new THREE.Vector3(0,1.3,0)),target=state.camera.position.clone(),dir=target.clone().sub(origin),distance=dir.length();
  if(distance<=.01)return true;dir.normalize();
  const ray=new THREE.Raycaster(origin,dir,.1,distance);
  return ray.intersectObjects(state.colliders.map(c=>c.mesh),false).length===0;
}
function botCollides(bot,pos){
  const box=new THREE.Box3(new THREE.Vector3(pos.x-.36,0,pos.z-.36),new THREE.Vector3(pos.x+.36,1.82,pos.z+.36));
  if(state.colliders.some(c=>c.box.intersectsBox(box)))return true;
  return state.bots.some(other=>other!==bot&&other.alive&&other.group.position.distanceToSquared(pos)<.78*.78);
}
function botMove(bot,dir,distance){
  if(dir.lengthSq()<1e-6)return;
  dir.normalize().multiplyScalar(distance);
  const p=bot.group.position.clone();
  let q=p.clone();q.x+=dir.x;if(!botCollides(bot,q))p.x=q.x;
  q=p.clone();q.z+=dir.z;if(!botCollides(bot,q))p.z=q.z;
  if(p.distanceToSquared(bot.group.position)<1e-5){
    const side=new THREE.Vector3(-dir.z,0,dir.x).normalize().multiplyScalar(distance*(bot.strafeDir||1));
    q=bot.group.position.clone().add(side);
    if(!botCollides(bot,q))p.copy(q);else bot.strafeDir*=-1;
  }
  bot.group.position.copy(p);
}
function botFire(bot,dist,now){
  const ai=state.rules?.ai||{};
  if(bot.burstRemaining<=0){
    bot.burstRemaining=Math.max(1,Math.round(randomBetween(num(ai.burstMin,2),num(ai.burstMax,5))));
  }
  let accuracy=bot.skill;
  accuracy-=clamp(dist/Math.max(1,num(ai.sightRange,42)),0,1)*.22;
  if(state.movement.sprinting)accuracy-=.13;
  if(!state.movement.onGround)accuracy-=.10;
  if(state.movement.crouching)accuracy-=.07;
  accuracy=clamp(accuracy,.20,.86);

  if(Math.random()<accuracy){
    const damage=randomBetween(num(ai.damageMin,18),num(ai.damageMax,27));
    damagePlayer(damage,bot.id.toUpperCase());
  }

  bot.burstRemaining--;
  if(bot.burstRemaining>0){
    bot.nextShotAt=now+randomBetween(num(ai.shotIntervalMinMs,165),num(ai.shotIntervalMaxMs,265));
  }else{
    bot.nextShotAt=now+randomBetween(num(ai.burstCooldownMinMs,520),num(ai.burstCooldownMaxMs,1100));
  }
}
function updateBots(dt,now){
  if(state.phase!=='live'||state.player.health<=0)return;
  const ai=state.rules?.ai||{},preferred=num(ai.preferredRange,15),sight=num(ai.sightRange,42),speed=num(ai.moveSpeed,2.6);
  for(const b of state.bots){
    if(!b.alive)continue;
    const playerFlat=state.camera.position.clone();playerFlat.y=0;
    const pos=b.group.position.clone();pos.y=0;
    const toPlayer=playerFlat.clone().sub(pos),dist=toPlayer.length(),hasLOS=dist<=sight&&botLineOfSight(b);

    if(hasLOS){
      b.lastSeen=playerFlat.clone();b.lastSeenAt=now;
      if(!b.aimReadyAt)b.aimReadyAt=now+randomBetween(num(ai.reactionMinMs,240),num(ai.reactionMaxMs,650));
    }else{
      b.aimReadyAt=0;b.burstRemaining=0;
    }

    if(now>b.nextThink){
      b.nextThink=now+randomBetween(280,720);
      if(Math.random()<.55)b.strafeDir*=-1;
    }

    let moveDir=new THREE.Vector3();
    if(hasLOS){
      if(dist>preferred+4)moveDir.add(toPlayer);
      else if(dist<preferred-4)moveDir.sub(toPlayer);
      const side=new THREE.Vector3(-toPlayer.z,0,toPlayer.x);
      if(side.lengthSq()>0)moveDir.addScaledVector(side.normalize(),b.strafeDir*(dist>preferred+6?.35:1));
    }else if(b.lastSeen&&now-b.lastSeenAt<5000){
      moveDir.add(b.lastSeen.clone().sub(pos));
      if(moveDir.length()<1.2)b.lastSeen=null;
    }else{
      const angle=(Number(b.id.split('-').pop())*.9)+(now/4200);
      moveDir.set(Math.cos(angle),0,Math.sin(angle));
    }

    // Separation prevents the squad from collapsing into one stack.
    for(const other of state.bots){
      if(other===b||!other.alive)continue;
      const away=pos.clone().sub(other.group.position);away.y=0;
      const d=away.length();
      if(d>0&&d<1.8)moveDir.addScaledVector(away.normalize(),(1.8-d)*1.4);
    }

    botMove(b,moveDir,dt*speed);
    b.group.lookAt(state.camera.position.x,b.group.position.y,state.camera.position.z);

    if(hasLOS&&dist<=sight&&now>=b.aimReadyAt&&now>=b.nextShotAt){
      botFire(b,dist,now);
    }
  }
}
function updateRound(now){if(!state.started)return;const left=Math.max(0,state.phaseEnds-now),sec=Math.ceil(left/1000);$('#roundTimer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;if(left>0)return;if(state.phase==='buy'){setPhase('live',num(state.rules.roundSeconds,105));banner('ROUND LIVE',800);}else if(state.phase==='live')endRound('bravo','TIME EXPIRED');}
function updateHud(){
  const p=state.player,a=p.ammo[p.weapon],w=currentWeapon();
  $('#healthHud').textContent=Math.ceil(p.health);$('#armorHud').textContent=Math.ceil(p.armor);$('#creditsHud').textContent=Math.floor(p.credits);
  $('#weaponHud').textContent=state.reloading?'RELOADING…':String(w.name||p.weapon).toUpperCase();
  $('#magHud').textContent=a.mag;$('#reserveHud').textContent=a.reserve;$('#alphaScore').textContent=state.score.alpha;$('#bravoScore').textContent=state.score.bravo;
  updateBuyPanel();
}
function updateWeaponHandling(dt){
  state.weaponBloom=Math.max(0,state.weaponBloom-dt*.035);
  const w=currentWeapon();
  if(state.triggerHeld&&w.automatic===true)shoot();
}
function animate(now=performance.now()){requestAnimationFrame(animate);const dt=Math.min(.04,(now-state.last)/1000);state.last=now;updateMovement(dt);updateWeaponHandling(dt);updateBots(dt,now);updateRound(now);state.renderer.render(state.scene,state.camera);}

boot().catch(e=>{console.error(e);$('#loadStatus').textContent=`Could not load Tactical Strike: ${e.message}`;$('#phaseLabel').textContent='ERROR';});
