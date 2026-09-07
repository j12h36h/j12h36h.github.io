import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const clone=v=>JSON.parse(JSON.stringify(v));
const uid=p=>`${p}-${crypto.randomUUID().slice(0,8)}`;
const deg=v=>THREE.MathUtils.degToRad(Number(v)||0);
const num=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const STORAGE_KEY='eras.sceneDesigner.document.v1';

const state={
  mode:'scene',doc:null,selectedId:'',catalog:{assets:[]},defs:new Map(),materials:new Map(),sceneAssets:new Map(),
  scene:null,camera:null,renderer:null,raycaster:new THREE.Raycaster(),mouse:new THREE.Vector2(),root3d:null,grid:null,
  object3d:new Map(),selectionBox:null,orbit:{yaw:.72,pitch:.55,distance:46,target:new THREE.Vector3(0,2,0)},drag:null,raf:0
};

const blankScene=()=>({eras3d:1,type:'scene',id:`scene.${uid('untitled')}`,name:'Untitled Scene',version:1,chunkSize:[64,16,64],environment:{skyColor:'#11191c',ambientIntensity:.72,sunIntensity:1.1,sunDirection:[.5,1,.25]},objects:[],markers:[],lights:[],sockets:[]});
const blankWorld=()=>({eras3d:1,type:'world',id:`world.${uid('untitled')}`,name:'Untitled World',version:1,streaming:{chunkRadius:1,unloadRadius:2},sceneChunks:[],connections:[]});

async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json();}
async function loadLibrary(){
  state.catalog=await json('/public-assets/catalog-3d.json').catch(()=>({assets:[]}));
  const materials=state.catalog.assets.filter(a=>String(a.type).toLowerCase()==='material');
  for(const a of materials){try{state.materials.set(a.source,await json(a.source));}catch(_){}}
  renderPalette();renderMaterialOptions();
}
function assetBySource(source){return state.catalog.assets.find(a=>a.source===source)||null;}
function assetBySemanticId(id){return state.catalog.assets.find(a=>String(a.source||'').includes(`/${id.replace(/\./g,'-')}.json`))||state.catalog.assets.find(a=>a.id===id)||null;}
async function defForAsset(asset){
  if(!asset?.source)return null;
  if(state.defs.has(asset.source))return state.defs.get(asset.source);
  const d=await json(asset.source);state.defs.set(asset.source,d);return d;
}
async function defById(id){
  if(state.defs.has(id))return state.defs.get(id);
  const mapping={
    'object.floor':'/public-assets/3d/objects/floor.json','object.wall':'/public-assets/3d/objects/wall.json','object.industrial_crate':'/public-assets/3d/objects/crate.json','object.ramp':'/public-assets/3d/objects/ramp.json',
    'structure.doorway':'/public-assets/3d/structures/doorway.json','scene.tactical_arena_01':'/public-assets/3d/scenes/tactical-arena-01.json','scene.tactical_arena_02':'/public-assets/3d/scenes/tactical-arena-02.json'
  };
  const url=mapping[id];if(!url)return null;const d=await json(url);state.defs.set(id,d);return d;
}

function renderPalette(){
  const q=$('#assetSearch').value.trim().toLowerCase();
  const root=$('#paletteList');
  const wanted=state.mode==='world'?['scene']:['object','structure'];
  const groups=new Map();
  for(const a of state.catalog.assets){const t=String(a.type||'').toLowerCase();if(!wanted.includes(t))continue;if(q&&!`${a.name} ${a.description} ${(a.tags||[]).join(' ')}`.toLowerCase().includes(q))continue;if(!groups.has(t))groups.set(t,[]);groups.get(t).push(a);}
  root.innerHTML=[...groups.entries()].map(([type,items])=>`<section class="sd-palette-group"><h3>${type.toUpperCase()}</h3>${items.map(a=>`<button class="sd-asset-button" type="button" data-asset-id="${a.id}"><img src="${a.thumbnail}" alt=""><span><b>${a.name}</b><small>${a.description||''}</small></span></button>`).join('')}</section>`).join('')||'<p class="sd-help">No matching assets.</p>';
  $('#sceneTools').hidden=state.mode==='world';
}
function renderMaterialOptions(){const sel=$('#iMaterial'),old=sel.value;sel.innerHTML='<option value="">ASSET DEFAULT</option>'+state.catalog.assets.filter(a=>a.type==='material').map(a=>`<option value="${a.source}">${a.name}</option>`).join('');if([...sel.options].some(o=>o.value===old))sel.value=old;}

function initThree(){
  const viewport=$('#viewport');
  state.scene=new THREE.Scene();state.scene.background=new THREE.Color('#09110d');
  state.camera=new THREE.PerspectiveCamera(55,1,.1,1000);
  state.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});state.renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));state.renderer.shadowMap.enabled=true;state.renderer.outputColorSpace=THREE.SRGBColorSpace;
  viewport.prepend(state.renderer.domElement);
  state.root3d=new THREE.Group();state.root3d.name='documentRoot';state.scene.add(state.root3d);
  state.grid=new THREE.GridHelper(128,64,0x41684a,0x1b3020);state.scene.add(state.grid);
  const hemi=new THREE.HemisphereLight(0xddeee5,0x172019,1.4);state.scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xffffff,1.8);sun.position.set(18,30,12);state.scene.add(sun);
  state.selectionBox=new THREE.BoxHelper(undefined,0x8de3a0);state.selectionBox.visible=false;state.scene.add(state.selectionBox);
  resize();updateCamera();
  new ResizeObserver(resize).observe(viewport);
  setupViewportControls();
  $('#viewportStatus').textContent='3D ENGINE READY';
  animate();
}
function resize(){if(!state.renderer)return;const r=$('#viewport').getBoundingClientRect();const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));state.renderer.setSize(w,h,false);state.camera.aspect=w/h;state.camera.updateProjectionMatrix();}
function updateCamera(){const o=state.orbit,p=Math.max(-1.35,Math.min(1.35,o.pitch)),cp=Math.cos(p);state.camera.position.set(o.target.x+Math.sin(o.yaw)*cp*o.distance,o.target.y+Math.sin(p)*o.distance,o.target.z+Math.cos(o.yaw)*cp*o.distance);state.camera.lookAt(o.target);}
function animate(){state.raf=requestAnimationFrame(animate);if(state.selectionBox.visible)state.selectionBox.update();state.renderer.render(state.scene,state.camera);}
function setupViewportControls(){
  const v=$('#viewport'),canvas=state.renderer.domElement;
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);state.drag={x:e.clientX,y:e.clientY,button:e.button,pan:e.shiftKey,moved:false};});
  canvas.addEventListener('pointermove',e=>{if(!state.drag)return;const dx=e.clientX-state.drag.x,dy=e.clientY-state.drag.y;if(Math.abs(dx)+Math.abs(dy)>2)state.drag.moved=true;state.drag.x=e.clientX;state.drag.y=e.clientY;if(state.drag.pan||state.drag.button===2){const right=new THREE.Vector3().setFromMatrixColumn(state.camera.matrix,0).multiplyScalar(-dx*.025);const up=new THREE.Vector3(0,1,0).multiplyScalar(dy*.025);state.orbit.target.add(right).add(up);}else{state.orbit.yaw-=dx*.007;state.orbit.pitch=Math.max(-1.3,Math.min(1.3,state.orbit.pitch+dy*.007));}updateCamera();});
  canvas.addEventListener('pointerup',e=>{const drag=state.drag;state.drag=null;if(drag&&!drag.moved&&e.button===0)pick(e);});
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.orbit.distance=Math.max(3,Math.min(180,state.orbit.distance*Math.exp(e.deltaY*.001)));updateCamera();},{passive:false});
}
function pick(e){const r=state.renderer.domElement.getBoundingClientRect();state.mouse.x=((e.clientX-r.left)/r.width)*2-1;state.mouse.y=-((e.clientY-r.top)/r.height)*2+1;state.raycaster.setFromCamera(state.mouse,state.camera);const hits=state.raycaster.intersectObjects([...state.object3d.values()],true);for(const h of hits){let n=h.object;while(n&&!n.userData?.entryId)n=n.parent;if(n?.userData?.entryId){select(n.userData.entryId);return;}}select('');}

function snap(v){if(!$('#snapEnabled').checked)return num(v);const s=Math.max(.1,num($('#snapStep').value,1));return Math.round(num(v)/s)*s;}
function materialDefinition(idOrSource){if(!idOrSource)return null;for(const m of state.materials.values())if(m.id===idOrSource)return m;return state.materials.get(idOrSource)||null;}
async function makeMaterial(materialId,uv=[1,1]){
  let def=materialDefinition(materialId);
  if(!def&&materialId?.startsWith('material.')){const map={'material.concrete_dark':'/public-assets/3d/materials/concrete-dark.json','material.metal_green':'/public-assets/3d/materials/metal-green.json','material.floor_grid':'/public-assets/3d/materials/floor-grid.json'};if(map[materialId]){def=await json(map[materialId]);state.materials.set(map[materialId],def);}}
  const color=def?.baseColor||'#60766a',mat=new THREE.MeshStandardMaterial({color,roughness:num(def?.roughness,.75),metalness:num(def?.metalness,.1)});
  if(def?.texture){try{const tex=await new THREE.TextureLoader().loadAsync(def.texture);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.repeat.set(Math.max(.1,num(uv?.[0],1)),Math.max(.1,num(uv?.[1],1)));mat.map=tex;}catch(_){}}
  return mat;
}
function geometryFor(def){const s=def?.size||[1,1,1];switch(def?.primitive){case'cylinder':return new THREE.CylinderGeometry(s[0]/2,s[0]/2,s[1],16);case'sphere':return new THREE.SphereGeometry(s[0]/2,16,12);default:return new THREE.BoxGeometry(num(s[0],1),num(s[1],1),num(s[2],1));}}
async function createObject3d(entry){
  const def=await defById(entry.assetId)||{primitive:entry.primitive||'box',size:entry.size||[1,1,1],materialId:entry.materialId};
  if(def.type==='structure')return createStructure3d(entry,def);
  const mat=await makeMaterial(entry.materialId||def.materialId,entry.uvScale||def.uvScale);const mesh=new THREE.Mesh(geometryFor(def),mat);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.entryId=entry.id;applyTransform(mesh,entry);return mesh;
}
async function createStructure3d(entry,def){const group=new THREE.Group();group.userData.entryId=entry.id;for(const child of def.children||[]){const merged={id:entry.id,assetId:child.assetId,position:child.position||[0,0,0],rotation:child.rotation||[0,0,0],scale:child.scale||[1,1,1],materialId:child.materialId};const c=await createObject3d(merged);c.userData.entryId=entry.id;group.add(c);}applyTransform(group,entry);return group;}
function applyTransform(o,e){const p=e.position||[0,0,0],r=e.rotation||[0,0,0],s=e.scale||[1,1,1];o.position.set(num(p[0]),num(p[1]),num(p[2]));o.rotation.set(deg(r[0]),deg(r[1]),deg(r[2]));o.scale.set(Math.max(.05,num(s[0],1)),Math.max(.05,num(s[1],1)),Math.max(.05,num(s[2],1)));}
function marker3d(e){let geo=new THREE.ConeGeometry(.45,1,8),color=e.type==='team_spawn'?(e.team==='bravo'?0xd95568:0x65c97c):e.type==='objective'?0xe0bd62:0x72a7d7;const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,wireframe:true}));m.userData.entryId=e.id;applyTransform(m,{...e,position:e.position||[0,.5,0]});return m;}
function socket3d(e){const g=new THREE.Group();g.userData.entryId=e.id;const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.08,8,18),new THREE.MeshBasicMaterial({color:0x8de3a0}));ring.rotation.x=Math.PI/2;g.add(ring);const arrow=new THREE.ArrowHelper(new THREE.Vector3(...(e.direction||[1,0,0])).normalize(),new THREE.Vector3(),1.5,0x8de3a0,.35,.18);g.add(arrow);applyTransform(g,e);return g;}
function light3d(e){const g=new THREE.Group();g.userData.entryId=e.id;const bulb=new THREE.Mesh(new THREE.SphereGeometry(.28,10,8),new THREE.MeshBasicMaterial({color:e.color||'#ffffff'}));g.add(bulb);const l=new THREE.PointLight(e.color||'#ffffff',num(e.intensity,10),num(e.range,20));g.add(l);applyTransform(g,e);return g;}
async function sceneChunk3d(e){
  const group=new THREE.Group();group.userData.entryId=e.id;const d=await defById(e.sceneId);const size=d?.chunkSize||[64,16,64];
  const base=new THREE.Mesh(new THREE.BoxGeometry(size[0],.2,size[2]),new THREE.MeshStandardMaterial({color:0x15251a,transparent:true,opacity:.55,wireframe:false}));base.position.y=-.1;base.userData.entryId=e.id;group.add(base);
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size[0],.25,size[2])),new THREE.LineBasicMaterial({color:0x65c97c}));edge.userData.entryId=e.id;group.add(edge);
  // lightweight preview of the referenced scene's objects
  if(d?.objects){for(const obj of d.objects.slice(0,80)){const child=await createObject3d({...obj,id:e.id});child.userData.entryId=e.id;group.add(child);}}
  applyTransform(group,e);return group;
}

function allEntries(){if(state.mode==='world')return state.doc.sceneChunks||[];return [...(state.doc.objects||[]),...(state.doc.markers||[]),...(state.doc.lights||[]),...(state.doc.sockets||[])];}
function entryById(id){return allEntries().find(e=>e.id===id)||null;}
async function rebuild3d(){
  while(state.root3d.children.length){const o=state.root3d.children.pop();o.traverse?.(n=>{n.geometry?.dispose?.();if(Array.isArray(n.material))n.material.forEach(m=>m.dispose?.());else n.material?.dispose?.();});}
  state.object3d.clear();
  if(state.mode==='world'){
    for(const e of state.doc.sceneChunks||[]){const o=await sceneChunk3d(e);state.root3d.add(o);state.object3d.set(e.id,o);}
  }else{
    for(const e of state.doc.objects||[]){const o=await createObject3d(e);state.root3d.add(o);state.object3d.set(e.id,o);}
    for(const e of state.doc.markers||[]){const o=marker3d(e);state.root3d.add(o);state.object3d.set(e.id,o);}
    for(const e of state.doc.lights||[]){const o=light3d(e);state.root3d.add(o);state.object3d.set(e.id,o);}
    for(const e of state.doc.sockets||[]){const o=socket3d(e);state.root3d.add(o);state.object3d.set(e.id,o);}
  }
  applyEnvironment();refreshSelectionBox();
}
function applyEnvironment(){if(state.mode==='scene'){const c=state.doc.environment?.skyColor||'#11191c';state.scene.background=new THREE.Color(c);}else state.scene.background=new THREE.Color('#07100a');}

async function addAsset(asset){
  const def=await defForAsset(asset);if(!def)return;
  if(state.mode==='world'){
    const sceneId=def.id||String(asset.id).replace('eras:','').replace(/^scene_/,'scene.').replace(/_/g,'.');const e={id:uid('chunk'),sceneId,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};state.doc.sceneChunks.push(e);select(e.id);await changed(true);return;
  }
  const e={id:uid(def.type==='structure'?'structure':'object'),name:def.name,assetId:def.id,position:[0,def.type==='object'&&def.id==='object.floor'?-0.25:0,0],rotation:def.defaultRotation||[0,0,0],scale:[1,1,1],materialId:def.materialId||'',uvScale:def.uvScale||[1,1],collision:def.collision||'solid'};
  state.doc.objects.push(e);select(e.id);await changed(true);
}
function addSpecial(type){if(state.mode!=='scene')return;let e;if(type==='marker'){e={id:uid('marker'),name:'Team Spawn',type:'team_spawn',team:'alpha',position:[0,1,0],rotation:[0,0,0],scale:[1,1,1]};state.doc.markers.push(e);}else if(type==='light'){e={id:uid('light'),name:'Point Light',type:'point',position:[0,5,0],rotation:[0,0,0],scale:[1,1,1],color:'#ffffff',intensity:15,range:25};state.doc.lights.push(e);}else{e={id:uid('socket'),name:'Road Socket',type:'socket',kind:'road',edge:'east',position:[32,0,0],rotation:[0,0,0],scale:[1,1,1],direction:[1,0,0]};state.doc.sockets.push(e);}select(e.id);changed(true);}
function select(id){state.selectedId=id||'';renderHierarchy();renderInspector();refreshSelectionBox();}
function refreshSelectionBox(){const o=state.object3d.get(state.selectedId);if(o){state.selectionBox.setFromObject(o);state.selectionBox.visible=true;}else state.selectionBox.visible=false;$('#selectionLabel').textContent=entryById(state.selectedId)?.name||entryById(state.selectedId)?.sceneId||'NO SELECTION';}
function renderHierarchy(){const root=$('#hierarchy'),entries=allEntries();root.innerHTML=entries.map(e=>`<button type="button" class="${e.id===state.selectedId?'is-selected':''}" data-entry-id="${e.id}">${state.mode==='world'?'▦':e.assetId?'◇':e.type==='socket'?'↔':e.type==='point'?'✦':'◎'} ${e.name||e.sceneId||e.id}</button>`).join('')||'<span class="sd-help">EMPTY DOCUMENT</span>';$('#docStats').textContent=state.mode==='world'?`${entries.length} SCENE CHUNKS`:`${state.doc.objects?.length||0} OBJECTS · ${state.doc.markers?.length||0} MARKERS · ${state.doc.sockets?.length||0} SOCKETS`;}
function setField(id,v){const e=$(id);if(e)e.value=v??'';}
function renderInspector(){
  const e=entryById(state.selectedId),form=$('#inspectorForm');$('#inspectorEmpty').hidden=!!e;form.hidden=!e;if(!e)return;
  setField('#iName',e.name||e.sceneId||e.id);setField('#iAsset',e.assetId||e.sceneId||e.type||'');
  const p=e.position||[0,0,0],r=e.rotation||[0,0,0],s=e.scale||[1,1,1];['#iPx','#iPy','#iPz'].forEach((id,i)=>setField(id,p[i]));['#iRx','#iRy','#iRz'].forEach((id,i)=>setField(id,r[i]));['#iSx','#iSy','#iSz'].forEach((id,i)=>setField(id,s[i]));
  const isWorld=state.mode==='world',isObject=!!e.assetId,isMarker=!isWorld&&!isObject&&!['socket','point'].includes(e.type),isSocket=e.type==='socket',isLight=e.type==='point';
  $('#scaleFields').hidden=isMarker||isSocket||isLight;$('#materialField').hidden=!isObject;$('#uvFields').hidden=!isObject;$('#collisionField').hidden=!isObject;$('#markerFields').hidden=!isMarker;$('#socketFields').hidden=!isSocket;$('#lightFields').hidden=!isLight;$('#worldFields').hidden=!isWorld;
  if(isObject){const a=state.catalog.assets.find(a=>a.source&&state.materials.get(a.source)?.id===e.materialId);$('#iMaterial').value=a?.source||'';setField('#iUvX',e.uvScale?.[0]||1);setField('#iUvY',e.uvScale?.[1]||1);setField('#iCollision',e.collision||'solid');}
  if(isMarker){setField('#iMarkerType',e.type||'team_spawn');setField('#iMarkerTeam',e.team||e.objective||'');}
  if(isSocket){setField('#iSocketKind',e.kind||'road');setField('#iSocketEdge',e.edge||'custom');}
  if(isLight){setField('#iLightColor',e.color||'#ffffff');setField('#iLightIntensity',e.intensity||10);}
  if(isWorld)setField('#iSceneId',e.sceneId||'');
}
async function inspectorChanged(){
  const e=entryById(state.selectedId);if(!e)return;e.name=$('#iName').value.trim().slice(0,80)||e.name;
  e.position=[snap($('#iPx').value),snap($('#iPy').value),snap($('#iPz').value)];e.rotation=[num($('#iRx').value),num($('#iRy').value),num($('#iRz').value)];
  if(!$('#scaleFields').hidden)e.scale=[Math.max(.05,num($('#iSx').value,1)),Math.max(.05,num($('#iSy').value,1)),Math.max(.05,num($('#iSz').value,1))];
  if(e.assetId){const src=$('#iMaterial').value,mat=state.materials.get(src);if(mat)e.materialId=mat.id;e.uvScale=[Math.max(.1,num($('#iUvX').value,1)),Math.max(.1,num($('#iUvY').value,1))];e.collision=$('#iCollision').value;}
  if(!$('#markerFields').hidden){e.type=$('#iMarkerType').value;const label=$('#iMarkerTeam').value.trim().slice(0,32);if(e.type==='team_spawn')e.team=label||'alpha';else if(e.type==='objective')e.objective=label||'A';}
  if(e.type==='socket'){e.kind=$('#iSocketKind').value.trim().slice(0,32)||'road';e.edge=$('#iSocketEdge').value;e.direction=e.edge==='north'?[0,0,-1]:e.edge==='south'?[0,0,1]:e.edge==='west'?[-1,0,0]:e.edge==='east'?[1,0,0]:e.direction||[1,0,0];}
  if(e.type==='point'){e.color=$('#iLightColor').value;e.intensity=Math.max(0,num($('#iLightIntensity').value,10));}
  await changed(true);select(e.id);
}
function deleteSelection(){if(!state.selectedId)return;if(state.mode==='world')state.doc.sceneChunks=state.doc.sceneChunks.filter(e=>e.id!==state.selectedId);else for(const k of ['objects','markers','lights','sockets'])state.doc[k]=state.doc[k].filter(e=>e.id!==state.selectedId);state.selectedId='';changed(true);}
function duplicateSelection(){const e=entryById(state.selectedId);if(!e)return;const c=clone(e);c.id=uid(state.mode==='world'?'chunk':'copy');c.name=`${c.name||c.sceneId} Copy`;c.position=[num(c.position?.[0])+2,num(c.position?.[1]),num(c.position?.[2])+2];if(state.mode==='world')state.doc.sceneChunks.push(c);else{const bucket=c.assetId?'objects':c.type==='socket'?'sockets':c.type==='point'?'lights':'markers';state.doc[bucket].push(c);}state.selectedId=c.id;changed(true);}
async function addAdjacent(direction){if(state.mode!=='world')return;const base=entryById(state.selectedId);if(!base)return;const baseDef=await defById(base.sceneId),size=baseDef?.chunkSize||[64,16,64];const paletteScene=state.catalog.assets.find(a=>a.type==='scene');if(!paletteScene)return;const nextDef=await defForAsset(paletteScene),delta=direction==='north'?[0,0,-size[2]]:direction==='south'?[0,0,size[2]]:direction==='west'?[-size[0],0,0]:[size[0],0,0];const e={id:uid('chunk'),sceneId:nextDef.id,position:[num(base.position?.[0])+delta[0],num(base.position?.[1]),num(base.position?.[2])+delta[2]],rotation:[0,0,0],scale:[1,1,1]};state.doc.sceneChunks.push(e);state.doc.connections=state.doc.connections||[];state.doc.connections.push({from:`${base.id}:${direction}-road`,to:`${e.id}:${({north:'south',south:'north',east:'west',west:'east'})[direction]}-road`});state.selectedId=e.id;changed(true);}

async function changed(rebuild=false){state.doc.name=$('#docName').value.trim().slice(0,80)||state.doc.name;localStorage.setItem(STORAGE_KEY,JSON.stringify({mode:state.mode,doc:state.doc}));$('#saveStatus').textContent='AUTOSAVED LOCALLY';renderHierarchy();if(rebuild)await rebuild3d();}
function setMode(mode,newDoc=false){state.mode=mode;$$('[data-doc-mode]').forEach(b=>b.classList.toggle('is-active',b.dataset.docMode===mode));$('#viewportModeLabel').textContent=mode==='world'?'WORLD CHUNK VIEWPORT':'SCENE VIEWPORT';if(newDoc)state.doc=mode==='world'?blankWorld():blankScene();$('#docName').value=state.doc.name;state.selectedId='';renderPalette();renderHierarchy();renderInspector();rebuild3d();changed(false);}
async function loadSample(){state.doc=state.mode==='world'?await json('/public-assets/3d/worlds/tactical-open-world-demo.json'):await json('/public-assets/3d/scenes/tactical-arena-01.json');$('#docName').value=state.doc.name;state.selectedId='';await changed(true);renderInspector();frameAll();}
function exportDoc(){state.doc.name=$('#docName').value.trim()||state.doc.name;const blob=new Blob([JSON.stringify(state.doc,null,2)+'\n'],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${state.doc.id||state.doc.name||'eras-3d'}.json`.replace(/[^a-z0-9._-]+/gi,'_');a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function importDoc(file){try{const parsed=JSON.parse(await file.text());if(parsed?.eras3d!==1||!['scene','world'].includes(parsed.type))throw new Error('Expected E.R.A.S. 3D scene/world JSON.');state.doc=parsed;state.mode=parsed.type;setMode(state.mode,false);$('#saveStatus').textContent='IMPORTED JSON';frameAll();}catch(e){$('#saveStatus').textContent=`IMPORT ERROR: ${e.message}`;}}
function frameAll(){const box=new THREE.Box3().setFromObject(state.root3d);if(box.isEmpty()){state.orbit.target.set(0,2,0);state.orbit.distance=46;}else{const sphere=box.getBoundingSphere(new THREE.Sphere());state.orbit.target.copy(sphere.center);state.orbit.distance=Math.max(8,sphere.radius*2.2);}updateCamera();}

function wire(){
  $('#assetSearch').addEventListener('input',renderPalette);
  $('#paletteList').addEventListener('click',e=>{const b=e.target.closest('[data-asset-id]');if(b)addAsset(state.catalog.assets.find(a=>a.id===b.dataset.assetId));});
  $('#sceneTools').addEventListener('click',e=>{const b=e.target.closest('[data-special-add]');if(b)addSpecial(b.dataset.specialAdd);});
  $('#hierarchy').addEventListener('click',e=>{const b=e.target.closest('[data-entry-id]');if(b)select(b.dataset.entryId);});
  $('#inspectorForm').addEventListener('change',()=>inspectorChanged());
  $('#docName').addEventListener('change',()=>changed(false));
  $$('[data-doc-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.docMode,true)));
  $('#newDoc').addEventListener('click',()=>setMode(state.mode,true));$('#loadSample').addEventListener('click',loadSample);$('#exportJson').addEventListener('click',exportDoc);$('#importJson').addEventListener('change',e=>{if(e.target.files?.[0])importDoc(e.target.files[0]);e.target.value='';});
  $('#duplicateSelection').addEventListener('click',duplicateSelection);$('#deleteSelection').addEventListener('click',deleteSelection);$('#frameAll').addEventListener('click',frameAll);
  $('#worldFields').addEventListener('click',e=>{const b=e.target.closest('[data-adjacent]');if(b)addAdjacent(b.dataset.adjacent);});
}

async function boot(){
  initThree();wire();await loadLibrary();
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(saved?.doc&&['scene','world'].includes(saved.mode)){state.mode=saved.mode;state.doc=saved.doc;}else{state.doc=blankScene();}}catch(_){state.doc=blankScene();}
  setMode(state.mode,false);$('#viewportStatus').textContent='READY · ASSET LIBRARY CONNECTED';
}
boot().catch(e=>{$('#viewportStatus').textContent=`DESIGNER ERROR · ${e.message}`;console.error(e);});
