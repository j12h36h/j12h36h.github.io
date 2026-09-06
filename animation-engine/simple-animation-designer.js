const $=s=>document.querySelector(s);
const canvas=$('#animationCanvas');
const ctx=canvas.getContext('2d',{alpha:true});
const editor=$('#jsonEditor');
const state={project:null,time:0,playing:false,lastFrame:0,raf:0,speed:1,images:new Map(),localUrls:new Map(),loadToken:0};

const EXAMPLE_2D={
  version:1,
  title:'ORBIT CARTOON',
  mode:'2D',
  duration:6,
  loop:true,
  canvas:{width:960,height:540,background:'#06111a'},
  assets:{
    /* Add a sprite with ADD SPRITE, or define one like:
       hero:{type:'sprite',src:'./hero.png',frameWidth:64,frameHeight:64,frames:4,fps:8} */
  },
  objects:[
    {id:'planet',type:'circle',x:480,y:270,radius:92,fill:'#315d80',stroke:'#8ad8ff',lineWidth:3,
      keyframes:[{t:0,scale:1,rotation:0},{t:3,scale:1.08,rotation:180},{t:6,scale:1,rotation:360}]},
    {id:'moon',type:'circle',x:680,y:270,radius:24,fill:'#c9d9dd',
      keyframes:[{t:0,x:680,y:270},{t:1.5,x:480,y:120},{t:3,x:280,y:270},{t:4.5,x:480,y:420},{t:6,x:680,y:270}]},
    {id:'title',type:'text',x:480,y:72,text:'SIMPLE ANIMATION DESIGNER',font:'700 28px system-ui',align:'center',fill:'#dff7ff',
      keyframes:[{t:0,opacity:0,y:58},{t:.6,opacity:1,y:72},{t:5.4,opacity:1,y:72},{t:6,opacity:0,y:58}]}
  ]
};

const EXAMPLE_3D={
  version:1,
  title:'JSON SPACE SCENE',
  mode:'3D',
  duration:8,
  loop:true,
  canvas:{width:960,height:540,background:'#030711'},
  camera:{x:0,y:0,z:-8,rotateX:0,rotateY:0,fov:520},
  assets:{},
  objects:[
    {id:'core',type:'sphere',x:0,y:0,z:6,radius:1.35,fill:'#285b79',stroke:'#7de5ff',lineWidth:2,
      keyframes:[{t:0,rotationY:0},{t:8,rotationY:360}]},
    {id:'cube',type:'box',x:-2.6,y:.2,z:7,width:1.3,height:1.3,depth:1.3,fill:'rgba(169,141,255,.18)',stroke:'#b49cff',
      keyframes:[{t:0,y:-1.7,rotationX:0,rotationY:0},{t:4,y:1.7,rotationX:180,rotationY:270},{t:8,y:-1.7,rotationX:360,rotationY:540}]},
    {id:'panel',type:'plane',x:2.7,y:0,z:7,width:2.1,height:1.1,fill:'rgba(100,230,180,.13)',stroke:'#72efc1',
      keyframes:[{t:0,rotationY:-30},{t:4,rotationY:30},{t:8,rotationY:-30}]}
  ]
};

const deepCopy=v=>JSON.parse(JSON.stringify(v));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rad=d=>Number(d||0)*Math.PI/180;
const lerp=(a,b,t)=>Number(a)+(Number(b)-Number(a))*t;
const safeId=s=>String(s||'sprite').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'sprite';

function setStatus(message,tone='ok'){
  $('#jsonStatus').textContent=String(message).toUpperCase();
  $('#jsonStatus').dataset.tone=tone;
}
function renderStatus(message){$('#renderStatus').textContent=String(message).toUpperCase();}
function stringifyProject(project){return JSON.stringify(project,null,2);}
function setExample(mode='2D'){
  const p=deepCopy(String(mode).toUpperCase()==='3D'?EXAMPLE_3D:EXAMPLE_2D);
  editor.value=stringifyProject(p);
  applyEditor();
}
function validateProject(p){
  if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Project JSON must be an object.');
  p.mode=String(p.mode||'').toUpperCase();
  if(!['2D','3D'].includes(p.mode))throw new Error('MODE MUST BE "2D" OR "3D".');
  if(!Number.isFinite(Number(p.duration))||Number(p.duration)<=0)throw new Error('duration must be greater than 0.');
  p.canvas=p.canvas||{};
  p.canvas.width=clamp(Math.round(Number(p.canvas.width)||960),64,4096);
  p.canvas.height=clamp(Math.round(Number(p.canvas.height)||540),64,4096);
  p.canvas.background=String(p.canvas.background||'#02090b');
  p.duration=clamp(Number(p.duration)||1,.05,86400);
  p.loop=p.loop!==false;
  p.assets=p.assets&&typeof p.assets==='object'&&!Array.isArray(p.assets)?p.assets:{};
  p.objects=Array.isArray(p.objects)?p.objects:[];
  if(p.objects.length>1000)throw new Error('A project may contain up to 1000 objects.');
  if(p.mode==='3D')p.camera={x:0,y:0,z:-8,rotateX:0,rotateY:0,rotateZ:0,fov:520,...(p.camera||{})};
  return p;
}
async function applyEditor(){
  try{
    const project=validateProject(JSON.parse(editor.value));
    state.project=project;
    state.time=clamp(state.time,0,project.duration);
    state.playing=false;state.lastFrame=0;cancelAnimationFrame(state.raf);
    canvas.width=project.canvas.width;canvas.height=project.canvas.height;
    $('#projectMode').textContent=project.mode.toUpperCase();
    $('#projectTitle').textContent=String(project.title||'UNTITLED ANIMATION').toUpperCase();
    $('#timeline').value=Math.round(state.time/project.duration*1000);
    renderStatus('STOPPED');
    setStatus('VALID JSON');
    await loadProjectImages(project);
    renderFrame();
    refreshReference();
  }catch(error){setStatus(error.message||'INVALID JSON','error');renderStatus('ERROR');}
}
function formatEditor(){try{editor.value=JSON.stringify(JSON.parse(editor.value),null,2);setStatus('FORMATTED');}catch(e){setStatus(e.message,'error');}}

function keyframeValue(obj,key,time){
  const frames=Array.isArray(obj.keyframes)?obj.keyframes.filter(f=>f&&Number.isFinite(Number(f.t))&&Object.prototype.hasOwnProperty.call(f,key)).slice().sort((a,b)=>Number(a.t)-Number(b.t)):[];
  const base=Object.prototype.hasOwnProperty.call(obj,key)?obj[key]:undefined;
  if(!frames.length)return base;
  if(time<=Number(frames[0].t))return frames[0][key];
  if(time>=Number(frames.at(-1).t))return frames.at(-1)[key];
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i],b=frames[i+1],at=Number(a.t),bt=Number(b.t);
    if(time<at||time>bt)continue;
    const raw=(time-at)/Math.max(.000001,bt-at);
    const easing=b.easing||a.easing||'linear';
    const t=ease(raw,easing);
    const av=a[key],bv=b[key];
    if(typeof av==='number'&&typeof bv==='number')return lerp(av,bv,t);
    return raw<1?av:bv;
  }
  return base;
}
function ease(t,type){
  t=clamp(t,0,1);
  if(type==='step')return 0;
  if(type==='ease-in')return t*t;
  if(type==='ease-out')return 1-(1-t)*(1-t);
  if(type==='ease-in-out')return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  return t;
}
function resolved(obj,time){
  const out={...obj};
  const keys=new Set(['x','y','z','width','height','depth','radius','rotation','rotationX','rotationY','rotationZ','scale','scaleX','scaleY','opacity','anchorX','anchorY','frame']);
  for(const f of obj.keyframes||[])for(const k of Object.keys(f||{}))if(k!=='t'&&k!=='easing')keys.add(k);
  for(const k of keys){const v=keyframeValue(obj,k,time);if(v!==undefined)out[k]=v;}
  return out;
}

async function loadProjectImages(project){
  const token=++state.loadToken;
  state.images.clear();
  const entries=Object.entries(project.assets||{}).filter(([,a])=>a?.type==='sprite'&&a.src);
  await Promise.all(entries.map(async([id,a])=>{
    const local=state.localUrls.get(id)||state.localUrls.get(a.src)||state.localUrls.get(String(a.src).split('/').pop());
    const src=local||a.src;
    try{
      const img=new Image();img.decoding='async';img.crossOrigin='anonymous';img.src=src;
      await img.decode();if(token===state.loadToken)state.images.set(id,img);
    }catch(_){
      try{const img=new Image();img.src=src;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});if(token===state.loadToken)state.images.set(id,img);}catch(__){}
    }
  }));
}

function clearStage(){ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=state.project?.canvas?.background||'#02090b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
function renderFrame(){
  if(!state.project)return;
  clearStage();
  if(state.project.mode==='3D')render3D();else render2D();
  $('#timeReadout').textContent=`${state.time.toFixed(2)} / ${state.project.duration.toFixed(2)}`;
  $('#timeline').value=Math.round(clamp(state.time/state.project.duration,0,1)*1000);
}
function render2D(){for(const raw of state.project.objects){const o=resolved(raw,state.time);draw2DObject(o);}}
function draw2DObject(o){
  ctx.save();ctx.globalAlpha=clamp(Number(o.opacity??1),0,1);ctx.globalCompositeOperation=o.blend||'source-over';
  const x=Number(o.x||0),y=Number(o.y||0),sx=Number(o.scaleX??o.scale??1),sy=Number(o.scaleY??o.scale??1);
  ctx.translate(x,y);ctx.rotate(rad(o.rotation));ctx.scale(sx,sy);
  if(o.type==='rect'){
    const w=Number(o.width||100),h=Number(o.height||100),ax=Number(o.anchorX??.5),ay=Number(o.anchorY??.5);
    if(o.fill){ctx.fillStyle=o.fill;ctx.fillRect(-w*ax,-h*ay,w,h);}if(o.stroke){ctx.strokeStyle=o.stroke;ctx.lineWidth=Number(o.lineWidth||1);ctx.strokeRect(-w*ax,-h*ay,w,h);}
  }else if(o.type==='circle'||o.type==='ellipse'){
    const rx=Number(o.radiusX??o.radius??50),ry=Number(o.radiusY??o.radius??rx);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);if(o.fill){ctx.fillStyle=o.fill;ctx.fill();}if(o.stroke){ctx.strokeStyle=o.stroke;ctx.lineWidth=Number(o.lineWidth||1);ctx.stroke();}
  }else if(o.type==='text'){
    ctx.font=o.font||'700 32px system-ui';ctx.textAlign=o.align||'left';ctx.textBaseline=o.baseline||'alphabetic';if(o.fill!==false){ctx.fillStyle=o.fill||'#ffffff';ctx.fillText(String(o.text??''),0,0);}if(o.stroke){ctx.strokeStyle=o.stroke;ctx.lineWidth=Number(o.lineWidth||1);ctx.strokeText(String(o.text??''),0,0);}
  }else if(o.type==='sprite')drawSprite(o);
  ctx.restore();
}
function spriteFrame(asset,o,img){
  const fw=Math.max(1,Number(asset.frameWidth)||img.width),fh=Math.max(1,Number(asset.frameHeight)||img.height);const cols=Math.max(1,Math.floor(img.width/fw));
  const total=Math.max(1,Number(asset.frames)||Math.floor(img.width/fw)*Math.floor(img.height/fh));
  const fps=Math.max(0,Number(asset.fps)||0);let frame=Number.isFinite(Number(o.frame))?Math.floor(Number(o.frame)):fps>0?Math.floor(state.time*fps):0;frame=((frame%total)+total)%total;
  return {sx:(frame%cols)*fw,sy:Math.floor(frame/cols)*fh,sw:fw,sh:fh};
}
function drawSprite(o){
  const img=state.images.get(o.asset);if(!img){drawMissingSprite(o);return;}
  const a=state.project.assets[o.asset]||{},f=spriteFrame(a,o,img),w=Number(o.width||f.sw),h=Number(o.height||f.sh),ax=Number(o.anchorX??.5),ay=Number(o.anchorY??.5);
  ctx.imageSmoothingEnabled=o.pixelated!==true;ctx.drawImage(img,f.sx,f.sy,f.sw,f.sh,-w*ax,-h*ay,w,h);
}
function drawMissingSprite(o){const w=Number(o.width||80),h=Number(o.height||80);ctx.strokeStyle='#ff6b92';ctx.strokeRect(-w/2,-h/2,w,h);ctx.beginPath();ctx.moveTo(-w/2,-h/2);ctx.lineTo(w/2,h/2);ctx.moveTo(w/2,-h/2);ctx.lineTo(-w/2,h/2);ctx.stroke();}

function rotatePoint(p,rx,ry,rz){
  let {x,y,z}=p;let c=Math.cos(rx),s=Math.sin(rx);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];return{x,y,z};
}
function cameraPoint(p){
  const c=state.project.camera||{};let q={x:p.x-Number(c.x||0),y:p.y-Number(c.y||0),z:p.z-Number(c.z||0)};
  q=rotatePoint(q,-rad(c.rotateX),-rad(c.rotateY),-rad(c.rotateZ));return q;
}
function projectPoint(p){
  const q=cameraPoint(p),f=Math.max(10,Number(state.project.camera?.fov)||520);if(q.z<=.08)return null;const s=f/q.z;return{x:canvas.width/2+q.x*s,y:canvas.height/2-q.y*s,scale:s,z:q.z};
}
function objectVertex(o,v){
  const local=rotatePoint({x:v.x*Number(o.scale??1),y:v.y*Number(o.scale??1),z:v.z*Number(o.scale??1)},rad(o.rotationX),rad(o.rotationY),rad(o.rotationZ));return{x:local.x+Number(o.x||0),y:local.y+Number(o.y||0),z:local.z+Number(o.z||0)};
}
function render3D(){
  const objects=state.project.objects.map(raw=>resolved(raw,state.time)).map(o=>({o,depth:cameraPoint({x:Number(o.x||0),y:Number(o.y||0),z:Number(o.z||0)}).z})).sort((a,b)=>b.depth-a.depth);
  for(const row of objects)draw3DObject(row.o);
}
function draw3DObject(o){
  ctx.save();ctx.globalAlpha=clamp(Number(o.opacity??1),0,1);ctx.lineWidth=Number(o.lineWidth||1.5);ctx.strokeStyle=o.stroke||'#8adfff';ctx.fillStyle=o.fill||'rgba(100,180,220,.14)';
  if(o.type==='sphere'){
    const center=projectPoint({x:Number(o.x||0),y:Number(o.y||0),z:Number(o.z||0)});if(center){const edge=projectPoint({x:Number(o.x||0)+Number(o.radius||1)*Number(o.scale??1),y:Number(o.y||0),z:Number(o.z||0)});const r=edge?Math.abs(edge.x-center.x):Math.abs(Number(o.radius||1)*center.scale);ctx.beginPath();ctx.arc(center.x,center.y,r,0,Math.PI*2);if(o.fill)ctx.fill();if(o.stroke!==false)ctx.stroke();ctx.globalAlpha*=.4;ctx.beginPath();ctx.ellipse(center.x,center.y,r,r*.28,rad(o.rotationY),0,Math.PI*2);ctx.stroke();}
  }else if(o.type==='box')drawBox(o);else if(o.type==='plane')drawPlane(o);else if(o.type==='sprite')drawBillboard(o);
  ctx.restore();
}
function pathProjected(points){const pp=points.map(projectPoint);if(pp.some(p=>!p))return false;ctx.beginPath();ctx.moveTo(pp[0].x,pp[0].y);for(let i=1;i<pp.length;i++)ctx.lineTo(pp[i].x,pp[i].y);ctx.closePath();return pp;}
function drawPlane(o){const w=Number(o.width||2)/2,h=Number(o.height||2)/2,pts=[[-w,-h,0],[w,-h,0],[w,h,0],[-w,h,0]].map(([x,y,z])=>objectVertex(o,{x,y,z}));if(pathProjected(pts)){if(o.fill)ctx.fill();if(o.stroke!==false)ctx.stroke();}}
function drawBox(o){
  const w=Number(o.width||2)/2,h=Number(o.height||2)/2,d=Number(o.depth||2)/2,local=[[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d],[-w,-h,d],[w,-h,d],[w,h,d],[-w,h,d]],verts=local.map(([x,y,z])=>objectVertex(o,{x,y,z})),faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]];
  const rendered=faces.map(face=>{const world=face.map(i=>verts[i]),cam=world.map(cameraPoint);return{world,depth:cam.reduce((s,p)=>s+p.z,0)/4};}).sort((a,b)=>b.depth-a.depth);
  for(const f of rendered){if(pathProjected(f.world)){if(o.fill)ctx.fill();if(o.stroke!==false)ctx.stroke();}}
}
function drawBillboard(o){
  const p=projectPoint({x:Number(o.x||0),y:Number(o.y||0),z:Number(o.z||0)});if(!p)return;const img=state.images.get(o.asset),a=state.project.assets[o.asset]||{};
  const worldW=Number(o.width||1.5)*Number(o.scale??1),worldH=Number(o.height||1.5)*Number(o.scale??1),w=worldW*p.scale,h=worldH*p.scale;ctx.translate(p.x,p.y);ctx.rotate(rad(o.rotationZ));
  if(!img){ctx.strokeRect(-w/2,-h/2,w,h);return;}const f=spriteFrame(a,o,img);ctx.imageSmoothingEnabled=o.pixelated!==true;ctx.drawImage(img,f.sx,f.sy,f.sw,f.sh,-w/2,-h/2,w,h);
}

function tick(now){
  if(!state.playing||!state.project)return;
  if(!state.lastFrame)state.lastFrame=now;const dt=Math.min(.1,(now-state.lastFrame)/1000)*state.speed;state.lastFrame=now;state.time+=dt;
  if(state.time>=state.project.duration){if(state.project.loop)state.time=state.time%state.project.duration;else{state.time=state.project.duration;state.playing=false;renderStatus('FINISHED');}}
  renderFrame();if(state.playing)state.raf=requestAnimationFrame(tick);
}
function togglePlay(){
  if(!state.project)return;if(state.time>=state.project.duration)state.time=0;state.playing=!state.playing;state.lastFrame=0;$('#playPauseButton').textContent=state.playing?'PAUSE':'PLAY';renderStatus(state.playing?'PLAYING':'PAUSED');cancelAnimationFrame(state.raf);if(state.playing)state.raf=requestAnimationFrame(tick);
}
function stop(){state.playing=false;state.time=0;state.lastFrame=0;cancelAnimationFrame(state.raf);$('#playPauseButton').textContent='PLAY';renderStatus('STOPPED');renderFrame();}

function saveJson(){
  try{const p=validateProject(JSON.parse(editor.value)),blob=new Blob([JSON.stringify(p,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${safeId(p.title||'animation')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('JSON SAVED');}catch(e){setStatus(e.message,'error');}
}
async function loadJsonFile(file){
  try{editor.value=await file.text();state.time=0;await applyEditor();setStatus(`LOADED ${file.name}`);}catch(e){setStatus(e.message||'LOAD FAILED','error');}
}
function uniqueAssetId(base,assets){let id=safeId(base),n=2;while(assets[id])id=`${safeId(base)}-${n++}`;return id;}
async function addSprites(files){
  if(!files?.length)return;let p;try{p=validateProject(JSON.parse(editor.value));}catch(e){setStatus(e.message,'error');return;}
  p.assets=p.assets||{};p.objects=p.objects||[];
  let offset=0;
  for(const file of files){if(!file.type.startsWith('image/'))continue;const id=uniqueAssetId(file.name.replace(/\.[^.]+$/,''),p.assets),url=URL.createObjectURL(file);state.localUrls.set(id,url);state.localUrls.set(file.name,url);state.localUrls.set(`./${file.name}`,url);p.assets[id]={type:'sprite',src:`./${file.name}`};
    if(p.mode==='3D')p.objects.push({id:`${id}-object`,type:'sprite',asset:id,x:(offset-((files.length-1)/2))*1.8,y:0,z:6,width:1.5,height:1.5,keyframes:[{t:0,rotationZ:-6},{t:p.duration/2,rotationZ:6},{t:p.duration,rotationZ:-6}]});
    else p.objects.push({id:`${id}-object`,type:'sprite',asset:id,x:p.canvas.width/2+offset*28,y:p.canvas.height/2,width:128,height:128,anchorX:.5,anchorY:.5,keyframes:[{t:0,rotation:-6},{t:p.duration/2,rotation:6},{t:p.duration,rotation:-6}]});offset++;
  }
  editor.value=stringifyProject(p);await applyEditor();setStatus(`${files.length} SPRITE${files.length===1?'':'S'} ADDED`);
}

function refreshReference(){
  const mode=state.project?.mode||'2D';const rows=mode==='3D'?
    [['camera','x, y, z, rotateX/Y/Z, fov'],['objects[]','box | sphere | plane | sprite'],['3D transform','x, y, z, rotationX/Y/Z, scale, opacity'],['keyframes[]','{ t, property…, easing? }']]:
    [['objects[]','rect | circle | ellipse | text | sprite'],['2D transform','x, y, rotation, scale/X/Y, opacity'],['sprite sheet','frameWidth, frameHeight, frames, fps'],['keyframes[]','{ t, property…, easing? }']];
  $('#schemaReference').innerHTML=rows.map(([a,b])=>`<div class="sad-reference-item"><b>${a}</b><small>${b}</small></div>`).join('');
  const local=[...state.localUrls.entries()].filter(([k])=>!k.includes('/')&&!k.includes('.'));
  $('#spriteList').innerHTML=local.length?local.map(([id])=>`<div class="sad-reference-item"><b>${id}</b><small>LOCAL SESSION SPRITE</small></div>`).join(''):'<p>NO LOCAL SPRITES LOADED.</p>';
}
function updateCursor(){const pos=editor.selectionStart,before=editor.value.slice(0,pos),line=before.split('\n').length,col=pos-(before.lastIndexOf('\n')+1)+1;$('#cursorInfo').textContent=`LINE ${line} // COL ${col}`;}

$('#applyJsonButton').addEventListener('click',applyEditor);$('#formatJsonButton').addEventListener('click',formatEditor);$('#saveJsonButton').addEventListener('click',saveJson);$('#playPauseButton').addEventListener('click',togglePlay);$('#stopButton').addEventListener('click',stop);
$('#playbackSpeed').addEventListener('change',e=>state.speed=Number(e.target.value)||1);
$('#timeline').addEventListener('input',e=>{if(!state.project)return;state.time=Number(e.target.value)/1000*state.project.duration;state.lastFrame=0;renderFrame();});
$('[data-new="2D"]').addEventListener('click',()=>setExample('2D'));$('[data-new="3D"]').addEventListener('click',()=>setExample('3D'));
$('#openJsonButton').addEventListener('click',()=>$('#jsonFileInput').click());$('#addSpriteButton').addEventListener('click',()=>$('#spriteFileInput').click());
$('#jsonFileInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadJsonFile(f);e.target.value='';});
$('#spriteFileInput').addEventListener('change',e=>{addSprites([...e.target.files]);e.target.value='';});
editor.addEventListener('keyup',updateCursor);editor.addEventListener('click',updateCursor);editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const s=editor.selectionStart,en=editor.selectionEnd;editor.setRangeText('  ',s,en,'end');updateCursor();}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();applyEditor();}});
const drop=$('#dropZone');for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('is-dragging');});for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('is-dragging');});drop.addEventListener('drop',e=>{const files=[...e.dataTransfer.files],json=files.find(f=>f.name.toLowerCase().endsWith('.json')),sprites=files.filter(f=>f.type.startsWith('image/'));if(json)loadJsonFile(json);if(sprites.length)addSprites(sprites);});
window.addEventListener('beforeunload',()=>{for(const url of new Set(state.localUrls.values()))URL.revokeObjectURL(url);});

setExample('2D');
