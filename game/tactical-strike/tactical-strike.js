import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import { db, fs } from '/game/assets/js/eras-data.js';

const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f,deg=v=>THREE.MathUtils.degToRad(num(v));
const params=new URLSearchParams(location.search);
const state={scene:null,camera:null,renderer:null,world:new THREE.Group(),colliders:[],bots:[],keys:new Set(),yaw:Math.PI,pitch:0,velocity:new THREE.Vector3(),locked:false,last:performance.now(),lastShot:0,reloading:false,
  player:{health:100,armor:0,credits:800,weapon:'pistol',owned:{pistol:true,rifle:false},ammo:{pistol:{mag:12,reserve:48},rifle:{mag:30,reserve:90}}},
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
function resetPlayer(){const sp=spawnPoint('alpha');state.camera.position.set(num(sp.position[0]),1.7,num(sp.position[2]));state.yaw=deg(sp.rotation?.[1]||45)+Math.PI;state.pitch=0;state.camera.rotation.set(0,state.yaw,0);state.player.health=100;state.player.armor=Math.max(0,state.player.armor);state.player.ammo.pistol.mag=12;state.player.ammo.pistol.reserve=Math.max(48,state.player.ammo.pistol.reserve);if(state.player.owned.rifle){state.player.ammo.rifle.mag=30;state.player.ammo.rifle.reserve=Math.max(90,state.player.ammo.rifle.reserve);}state.reloading=false;}
function clearBots(){for(const b of state.bots)b.group.removeFromParent();state.bots=[];}
function spawnBots(){clearBots();const count=Math.max(1,Math.min(5,num(state.rules.teamSize,5)));for(let i=0;i<count;i++){const sp=spawnPoint('bravo',i),group=new THREE.Group(),body=new THREE.Mesh(new THREE.CapsuleGeometry(.35,.9,4,8),new THREE.MeshStandardMaterial({color:0xa84854,roughness:.72}));body.position.y=.85;body.castShadow=true;group.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.25,12,8),new THREE.MeshStandardMaterial({color:0xd5b4a7,roughness:.8}));head.position.y=1.62;group.add(head);group.position.set(num(sp.position[0])+((i%2)*1.2),0,num(sp.position[2])+Math.floor(i/2)*1.2);state.world.add(group);const bot={id:`bravo-${i+1}`,group,body,head,health:100,alive:true,lastFire:performance.now()+700+Math.random()*500};body.userData.bot=bot;head.userData.bot=bot;state.bots.push(bot);}}

function setPhase(phase,seconds){state.phase=phase;state.phaseEnds=performance.now()+seconds*1000;$('#phaseLabel').textContent=phase.toUpperCase();if(phase==='buy'){$('#buyPanel').hidden=false;}else $('#buyPanel').hidden=true;}
function resetRound(){state.roundEnding=false;resetPlayer();spawnBots();setPhase('buy',num(state.rules.buySeconds,15));$('#roundLabel').textContent=`ROUND ${state.round}`;banner(`ROUND ${state.round} · BUY PHASE`,1100);updateHud();}
function resetMatch(start=true){state.score={alpha:0,bravo:0};state.round=1;state.player.credits=num(state.rules.startingCredits,800);state.player.owned={pistol:true,rifle:false};state.player.weapon='pistol';state.player.armor=0;resetRound();state.started=start;}
function endRound(winner,reason){if(state.roundEnding)return;state.roundEnding=true;state.score[winner]++;state.player.credits+=winner==='alpha'?num(state.rules.economy?.winReward,3250):num(state.rules.economy?.lossReward,1900);updateHud();banner(`${winner.toUpperCase()} WINS · ${reason}`,2300);setPhase('round end',2.5);setTimeout(()=>{const need=num(state.rules.roundsToWin,7);if(state.score[winner]>=need){banner(`${winner.toUpperCase()} WINS THE MATCH`,3500);setTimeout(()=>resetMatch(true),3800);}else{state.round++;resetRound();}},2600);}
function banner(text,ms=1200){const b=$('#roundBanner');b.textContent=text;b.hidden=false;clearTimeout(b._t);b._t=setTimeout(()=>b.hidden=true,ms);}
function feed(text){const root=$('#killFeed'),d=document.createElement('div');d.textContent=text;root.prepend(d);setTimeout(()=>d.remove(),3500);while(root.children.length>5)root.lastChild.remove();}

function wire(){
  $('#enterGame').addEventListener('click',()=>{state.started=true;$('#startOverlay').hidden=true;state.renderer.domElement.requestPointerLock();});
  document.addEventListener('pointerlockchange',()=>{state.locked=document.pointerLockElement===state.renderer.domElement;if(!state.locked)state.keys.clear();if(state.locked&&state.phase==='buy')$('#buyPanel').hidden=false;});
  document.addEventListener('mousemove',e=>{if(!state.locked||!state.started)return;state.yaw-=e.movementX*.0022;state.pitch=clamp(state.pitch-e.movementY*.0022,-1.48,1.48);state.camera.rotation.set(state.pitch,state.yaw,0);});
  const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(state.locked&&movementKeys.has(e.code))e.preventDefault();state.keys.add(e.code);if(e.code==='KeyR')reload();if(e.code==='Digit1'){state.player.weapon='rifle';if(!state.player.owned.rifle)state.player.weapon='pistol';updateWeaponView();updateHud();}if(e.code==='Digit2'){state.player.weapon='pistol';updateWeaponView();updateHud();}if(e.code==='KeyB'&&state.phase==='buy')$('#buyPanel').hidden=!$('#buyPanel').hidden;});
  document.addEventListener('keyup',e=>{state.keys.delete(e.code);if(state.locked&&movementKeys.has(e.code))e.preventDefault();});
  addEventListener('blur',()=>state.keys.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)state.keys.clear();});
  document.addEventListener('mousedown',e=>{if(e.button===0&&state.locked)shoot();});
  $('#buyPanel').addEventListener('click',e=>{const b=e.target.closest('[data-buy]');if(b)buy(b.dataset.buy);});
}
function buy(item){if(state.phase!=='buy')return;const price=item==='rifle'?num(state.rules.weapons?.rifle?.cost,2700):item==='armor'?num(state.rules.equipment?.armor?.cost,650):num(state.rules.equipment?.ammo?.cost,300);if(state.player.credits<price){banner('NOT ENOUGH MATCH CREDITS',900);return;}if(item==='rifle'&&state.player.owned.rifle){banner('RIFLE ALREADY OWNED',800);return;}state.player.credits-=price;if(item==='rifle'){state.player.owned.rifle=true;state.player.weapon='rifle';state.player.ammo.rifle={mag:30,reserve:90};updateWeaponView();}else if(item==='armor')state.player.armor=100;else{for(const w of ['pistol','rifle'])if(state.player.owned[w])state.player.ammo[w].reserve=w==='rifle'?90:48;}updateHud();}

function currentWeapon(){return state.rules.weapons?.[state.player.weapon]||state.rules.weapons?.pistol||{};}
function reload(){if(state.reloading||!state.started)return;const a=state.player.ammo[state.player.weapon],w=currentWeapon(),cap=num(w.magazine,state.player.weapon==='rifle'?30:12);if(a.mag>=cap||a.reserve<=0)return;state.reloading=true;$('#weaponHud').textContent='RELOADING…';setTimeout(()=>{const take=Math.min(cap-a.mag,a.reserve);a.mag+=take;a.reserve-=take;state.reloading=false;updateHud();},num(w.reloadMs,1500));}
function shoot(){if(state.phase!=='live'||state.reloading||state.player.health<=0)return;const now=performance.now(),w=currentWeapon();if(now-state.lastShot<num(w.fireIntervalMs,200))return;const a=state.player.ammo[state.player.weapon];if(a.mag<=0){reload();return;}state.lastShot=now;a.mag--;state.pitch=clamp(state.pitch+num(w.recoil,.012)*(0.8+Math.random()*.4),-1.48,1.48);state.camera.rotation.set(state.pitch,state.yaw,0);if(state.weaponMesh){state.weaponMesh.position.z=.04;setTimeout(()=>{if(state.weaponMesh)state.weaponMesh.position.z=0;},45);}updateHud();
  const spread=num(w.spread,.01),dir=new THREE.Vector3();state.camera.getWorldDirection(dir);dir.x+=(Math.random()-.5)*spread;dir.y+=(Math.random()-.5)*spread;dir.z+=(Math.random()-.5)*spread;dir.normalize();const ray=new THREE.Raycaster(state.camera.position,dir,.05,120),targets=[];for(const b of state.bots)if(b.alive)targets.push(b.body,b.head);targets.push(...state.colliders.map(c=>c.mesh));const hits=ray.intersectObjects(targets,false);if(!hits.length)return;const hit=hits[0],bot=hit.object.userData.bot;if(bot&&bot.alive){const head=hit.object===bot.head,damage=num(w.damage,34)*(head?2:1);bot.health-=damage;hitMark();if(bot.health<=0){bot.alive=false;bot.group.visible=false;state.player.credits+=num(state.rules.economy?.killReward,300);feed(`YOU  ⊕  ${bot.id.toUpperCase()}`);updateHud();if(!state.bots.some(x=>x.alive))endRound('alpha','TEAM ELIMINATED');}}}
function hitMark(){const h=$('#hitMarker');h.classList.remove('show');void h.offsetWidth;h.classList.add('show');}
function damagePlayer(amount,from='BRAVO'){if(state.player.health<=0)return;let d=amount;if(state.player.armor>0){const absorbed=Math.min(state.player.armor,d*.6);state.player.armor-=absorbed;d-=absorbed;}state.player.health=Math.max(0,state.player.health-d);const f=$('#damageFlash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');updateHud();if(state.player.health<=0){feed(`${from}  ⊕  YOU`);endRound('bravo','ALPHA ELIMINATED');}}

function collides(pos){const box=new THREE.Box3(new THREE.Vector3(pos.x-.32,.08,pos.z-.32),new THREE.Vector3(pos.x+.32,1.78,pos.z+.32));return state.colliders.some(c=>c.box.intersectsBox(box));}
function updateMovement(dt){
  if(!state.started||!state.locked||state.player.health<=0||state.phase==='round end')return;

  const forwardInput=(state.keys.has('KeyW')||state.keys.has('ArrowUp')?1:0)-(state.keys.has('KeyS')||state.keys.has('ArrowDown')?1:0);
  const rightInput=(state.keys.has('KeyD')||state.keys.has('ArrowRight')?1:0)-(state.keys.has('KeyA')||state.keys.has('ArrowLeft')?1:0);
  if(!forwardInput&&!rightInput)return;

  const speed=(state.keys.has('ShiftLeft')||state.keys.has('ShiftRight'))?7.2:4.8;

  // Derive movement from the camera itself. This keeps W/S aligned with the
  // direction the player is actually looking and A/D perpendicular to it,
  // regardless of Three.js yaw sign conventions.
  const forward=new THREE.Vector3();
  state.camera.getWorldDirection(forward);
  forward.y=0;
  if(forward.lengthSq()<1e-8)forward.set(0,0,-1);
  forward.normalize();

  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  const move=new THREE.Vector3()
    .addScaledVector(forward,forwardInput)
    .addScaledVector(right,rightInput);

  if(move.lengthSq()>1)move.normalize();
  move.multiplyScalar(speed*dt);

  // Resolve axes independently so players slide along walls instead of
  // sticking when only one component of the movement is blocked.
  const p=state.camera.position.clone();
  let q=p.clone();
  q.x+=move.x;
  if(!collides(q))p.x=q.x;
  q=p.clone();
  q.z+=move.z;
  if(!collides(q))p.z=q.z;
  p.y=1.7;
  state.camera.position.copy(p);
}
function botLineOfSight(bot){const origin=bot.group.position.clone().add(new THREE.Vector3(0,1.25,0)),target=state.camera.position.clone(),dir=target.clone().sub(origin),distance=dir.length();dir.normalize();const ray=new THREE.Raycaster(origin,dir,.1,distance);return ray.intersectObjects(state.colliders.map(c=>c.mesh),false).length===0;}
function updateBots(dt,now){if(state.phase!=='live'||state.player.health<=0)return;for(const b of state.bots){if(!b.alive)continue;const target=state.camera.position.clone();target.y=0;const pos=b.group.position.clone();pos.y=0;const v=target.sub(pos),dist=v.length();if(dist>5){v.normalize();const np=b.group.position.clone().addScaledVector(v,dt*1.5);const botBox=new THREE.Box3(new THREE.Vector3(np.x-.35,0,np.z-.35),new THREE.Vector3(np.x+.35,1.8,np.z+.35));if(!state.colliders.some(c=>c.box.intersectsBox(botBox)))b.group.position.copy(np);}b.group.lookAt(state.camera.position.x,b.group.position.y,state.camera.position.z);if(dist<28&&now>b.lastFire&&botLineOfSight(b)){b.lastFire=now+650+Math.random()*450;damagePlayer(10+Math.random()*5,b.id.toUpperCase());}}}
function updateRound(now){if(!state.started)return;const left=Math.max(0,state.phaseEnds-now),sec=Math.ceil(left/1000);$('#roundTimer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;if(left>0)return;if(state.phase==='buy'){setPhase('live',num(state.rules.roundSeconds,105));banner('ROUND LIVE',800);}else if(state.phase==='live')endRound('bravo','TIME EXPIRED');}
function updateHud(){const p=state.player,a=p.ammo[p.weapon],w=currentWeapon();$('#healthHud').textContent=Math.ceil(p.health);$('#armorHud').textContent=Math.ceil(p.armor);$('#creditsHud').textContent=Math.floor(p.credits);$('#weaponHud').textContent=String(w.name||p.weapon).toUpperCase();$('#magHud').textContent=a.mag;$('#reserveHud').textContent=a.reserve;$('#alphaScore').textContent=state.score.alpha;$('#bravoScore').textContent=state.score.bravo;}
function animate(now=performance.now()){requestAnimationFrame(animate);const dt=Math.min(.04,(now-state.last)/1000);state.last=now;updateMovement(dt);updateBots(dt,now);updateRound(now);state.renderer.render(state.scene,state.camera);}

boot().catch(e=>{console.error(e);$('#loadStatus').textContent=`Could not load Tactical Strike: ${e.message}`;$('#phaseLabel').textContent='ERROR';});
