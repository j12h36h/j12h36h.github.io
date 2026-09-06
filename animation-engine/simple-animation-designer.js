const $=s=>document.querySelector(s);
const canvas=$('#animationCanvas');
const ctx=canvas.getContext('2d',{alpha:true});
const editor=$('#jsonEditor');
const state={
  project:null,time:0,playing:false,lastFrame:0,raf:0,speed:1,
  images:new Map(),localUrls:new Map(),loadToken:0,presets:null,
  audio:{ctx:null,master:null,buffers:new Map(),active:new Map(),muted:false,volume:1,token:0}
};
const PRESET_MANIFEST_URL='./presets/presets.json';

const EXAMPLE_2D={
  version:2,
  title:'ORBIT CARTOON',
  mode:'2D',
  duration:6,
  loop:true,
  canvas:{width:960,height:540,background:'#06111a'},
  lighting:{ambient:{color:'#ffffff',intensity:.92},point:[{id:'glow',x:480,y:230,color:'#8ad8ff',intensity:.5,range:300}]},
  post:{exposure:1,vignette:.14,letterbox:0,fade:0,flash:0,grain:.02},
  assets:{ping:{type:'tone',wave:'sine',frequency:440,duration:.18}},
  sounds:[{id:'orbit-ping',asset:'ping',start:.55,volume:.16,pan:0,rate:1}],
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
  version:2,
  title:'CINEMATIC SPACE SCENE',
  mode:'3D',
  duration:8,
  loop:true,
  canvas:{width:960,height:540,background:'#030711'},
  camera:{x:0,y:.2,z:-8,rotateX:0,rotateY:0,rotateZ:0,fov:520,shake:0,near:.2,far:5000,interpolation:'spline',smoothing:1,
    keyframes:[{t:0,x:-.7,y:.35,rotateY:-4,fov:500},{t:4,x:.7,y:-.05,rotateY:4,fov:555,easing:'ease-in-out'},{t:8,x:-.7,y:.35,rotateY:-4,fov:500,easing:'ease-in-out'}]},
  lighting:{
    ambient:{color:'#8db3d8',intensity:.32},
    directional:[{id:'key',x:-.45,y:.7,z:-.65,color:'#cceeff',intensity:1.15}],
    shadows:{enabled:true,groundY:-2.15,opacity:.24,softness:18},
    point:[{id:'core-light',x:0,y:0,z:5.8,color:'#58d7ff',intensity:2.2,range:7,
      keyframes:[{t:0,intensity:1.4},{t:4,intensity:2.5},{t:8,intensity:1.4}]}]
  },
  post:{exposure:1.04,vignette:.24,letterbox:.055,fade:0,flash:0,grain:.025},
  assets:{pulse:{type:'tone',wave:'sine',frequency:92,duration:.35}},
  sounds:[{id:'pulse-a',asset:'pulse',start:1.2,volume:.12,pan:-.25},{id:'pulse-b',asset:'pulse',start:5.2,volume:.12,pan:.25}],
  objects:[
    {id:'floor',type:'plane',x:0,y:-2.15,z:7.4,width:12,height:12,rotationX:90,fill:'#111c28',stroke:'#2e4f64',lineWidth:1,castShadow:false},
    {id:'rig',type:'group',x:0,y:0,z:0,keyframes:[{t:0,rotationY:0},{t:8,rotationY:40}]},
    {id:'core',parent:'rig',type:'sphere',x:0,y:0,z:6,radius:1.35,fill:'#285b79',stroke:'#7de5ff',emissive:'#38bff1',emissiveIntensity:.45,lineWidth:2,
      keyframes:[{t:0,rotationY:0},{t:8,rotationY:360}]},
    {id:'cube',parent:'rig',type:'box',x:-2.6,y:.2,z:7,width:1.3,height:1.3,depth:1.3,fill:'#5a477e',stroke:'#b49cff',
      keyframes:[{t:0,y:-1.7,rotationX:0,rotationY:0},{t:4,y:1.7,rotationX:180,rotationY:270},{t:8,y:-1.7,rotationX:360,rotationY:540}]},
    {id:'panel',parent:'rig',type:'plane',x:2.7,y:0,z:7,width:2.1,height:1.1,fill:'#23594b',stroke:'#72efc1',
      keyframes:[{t:0,rotationY:-30},{t:4,rotationY:30},{t:8,rotationY:-30}]}
  ]
};

const deepCopy=v=>JSON.parse(JSON.stringify(v));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rad=d=>Number(d||0)*Math.PI/180;
const lerp=(a,b,t)=>Number(a)+(Number(b)-Number(a))*t;
const safeId=s=>String(s||'asset').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'asset';
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;

function setStatus(message,tone='ok'){
  $('#jsonStatus').textContent=String(message).toUpperCase();
  $('#jsonStatus').dataset.tone=tone;
}
function renderStatus(message){$('#renderStatus').textContent=String(message).toUpperCase();}
function stringifyProject(project){return JSON.stringify(project,null,2);}
function setExample(mode='2D'){
  const p=deepCopy(String(mode).toUpperCase()==='3D'?EXAMPLE_3D:EXAMPLE_2D);
  editor.value=stringifyProject(p);state.time=0;applyEditor();
}

function normalizeColor(value,fallback='#ffffff'){
  const s=String(value||fallback).trim();
  return s||fallback;
}
function validateProject(p){
  if(!p||typeof p!=='object'||Array.isArray(p))throw new Error('Project JSON must be an object.');
  const meta=p.meta&&typeof p.meta==='object'&&!Array.isArray(p.meta)?p.meta:{};
  const modeValue=p.mode??meta.mode??'';
  p.mode=String(modeValue).trim().toUpperCase();
  if(!['2D','3D'].includes(p.mode))throw new Error('MODE MUST BE "2D" OR "3D". ROOT mode OR meta.mode IS ACCEPTED.');
  if((p.title===undefined||p.title===null||p.title==='')&&(meta.title||meta.name))p.title=meta.title||meta.name;
  if((p.duration===undefined||p.duration===null||p.duration==='')&&meta.duration!==undefined)p.duration=meta.duration;
  if(p.loop===undefined&&meta.loop!==undefined)p.loop=meta.loop;
  if(!Number.isFinite(Number(p.duration))||Number(p.duration)<=0)throw new Error('duration must be greater than 0.');
  p.version=Math.max(1,Math.floor(finite(p.version,1)));
  p.canvas=p.canvas&&typeof p.canvas==='object'&&!Array.isArray(p.canvas)?p.canvas:{};
  if((p.canvas.background===undefined||p.canvas.background===null||p.canvas.background==='')&&meta.background)p.canvas.background=meta.background;
  p.canvas.width=clamp(Math.round(Number(p.canvas.width)||960),64,4096);
  p.canvas.height=clamp(Math.round(Number(p.canvas.height)||540),64,4096);
  p.canvas.background=String(p.canvas.background||'#02090b');
  p.duration=clamp(Number(p.duration)||1,.05,86400);
  p.loop=p.loop!==false;
  p.assets=p.assets&&typeof p.assets==='object'&&!Array.isArray(p.assets)?p.assets:{};
  p.objects=Array.isArray(p.objects)?p.objects:[];
  if(p.objects.length>2000)throw new Error('A project may contain up to 2000 objects.');
  p.sounds=Array.isArray(p.sounds)?p.sounds:[];
  if(p.sounds.length>256)throw new Error('A project may contain up to 256 sound clips.');
  p.clips=p.clips&&typeof p.clips==='object'&&!Array.isArray(p.clips)?p.clips:{};
  p.post=p.post&&typeof p.post==='object'&&!Array.isArray(p.post)?p.post:{};
  p.post={exposure:1,vignette:0,letterbox:0,fade:0,flash:0,grain:0,tint:'#ffffff',tintOpacity:0,...p.post};
  p.lighting=p.lighting&&typeof p.lighting==='object'&&!Array.isArray(p.lighting)?p.lighting:{};
  p.lighting.ambient={color:'#ffffff',intensity:p.mode==='3D'?.28:1,...(p.lighting.ambient||{})};
  p.lighting.directional=Array.isArray(p.lighting.directional)?p.lighting.directional:[];
  p.lighting.point=Array.isArray(p.lighting.point)?p.lighting.point:[];
  p.lighting.shadows={enabled:false,groundY:-2.5,opacity:.25,softness:14,...(p.lighting.shadows||{})};
  if(p.mode==='3D')p.camera={x:0,y:0,z:-8,rotateX:0,rotateY:0,rotateZ:0,fov:520,shake:0,near:.2,far:5000,interpolation:'spline',smoothing:1,...(p.camera||{})};
  else p.camera={x:p.canvas.width/2,y:p.canvas.height/2,zoom:1,rotation:0,shake:0,interpolation:'spline',smoothing:1,...(p.camera||{})};
  return p;
}

async function applyEditor(){
  try{
    const project=validateProject(JSON.parse(editor.value));
    stopAllAudio();
    state.audio.token++;state.audio.buffers.clear();
    state.project=project;
    state.time=clamp(state.time,0,project.duration);
    state.playing=false;state.lastFrame=0;cancelAnimationFrame(state.raf);
    canvas.width=project.canvas.width;canvas.height=project.canvas.height;
    $('#projectMode').textContent=project.mode;
    $('#projectTitle').textContent=String(project.title||'UNTITLED ANIMATION').toUpperCase();
    $('#timeline').value=Math.round(state.time/project.duration*1000);
    $('#playPauseButton').textContent='PLAY';
    renderStatus('STOPPED');
    setStatus('VALID JSON');
    await loadProjectImages(project);
    renderFrame();
    refreshReference();
  }catch(error){setStatus(error.message||'INVALID JSON','error');renderStatus('ERROR');}
}
function formatEditor(){try{editor.value=JSON.stringify(JSON.parse(editor.value),null,2);setStatus('FORMATTED');}catch(e){setStatus(e.message,'error');}}

function ease(t,type){
  t=clamp(t,0,1);
  if(type==='step')return 0;
  if(type==='ease-in')return t*t;
  if(type==='ease-out')return 1-(1-t)*(1-t);
  if(type==='ease-in-out')return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  return t;
}
function interpolateValue(a,b,t,raw=t){
  if(typeof a==='number'&&typeof b==='number')return lerp(a,b,t);
  if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)return a.map((v,i)=>interpolateValue(v,b[i],t,raw));
  if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
    const keys=new Set([...Object.keys(a),...Object.keys(b)]),out={};
    for(const k of keys)out[k]=(k in a&&k in b)?interpolateValue(a[k],b[k],t,raw):(raw<1?a[k]:b[k]);
    return out;
  }
  return raw<1?a:b;
}
function keyframeValue(obj,key,time){
  const frames=Array.isArray(obj?.keyframes)?obj.keyframes.filter(f=>f&&Number.isFinite(Number(f.t))&&Object.prototype.hasOwnProperty.call(f,key)).slice().sort((a,b)=>Number(a.t)-Number(b.t)):[];
  const base=obj&&Object.prototype.hasOwnProperty.call(obj,key)?obj[key]:undefined;
  if(!frames.length)return base;
  if(time<=Number(frames[0].t))return frames[0][key];
  if(time>=Number(frames.at(-1).t))return frames.at(-1)[key];
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i],b=frames[i+1],at=Number(a.t),bt=Number(b.t);
    if(time<at||time>bt)continue;
    const raw=(time-at)/Math.max(.000001,bt-at),t=ease(raw,b.easing||a.easing||'linear');
    return interpolateValue(a[key],b[key],t,raw);
  }
  return base;
}
function applyAnimationClip(out,obj,time){
  const name=String(obj?.clip||'');if(!name)return out;
  const clip=state.project?.clips?.[name];if(!clip||typeof clip!=='object')return out;
  const duration=Math.max(.0001,finite(clip.duration,1)),rate=finite(obj.clipRate,1),start=finite(obj.clipStart,0);
  let local=(time-start)*rate;if(local<0)return out;
  const loop=obj.clipLoop!==undefined?obj.clipLoop!==false:clip.loop!==false;
  local=loop?((local%duration)+duration)%duration:clamp(local,0,duration);
  const keys=new Set();for(const f of clip.keyframes||[])for(const k of Object.keys(f||{}))if(k!=='t'&&k!=='easing')keys.add(k);
  for(const k of keys){const v=keyframeValue(clip,k,local);if(v!==undefined)out[k]=v;}
  return out;
}
function resolved(obj,time=state.time){
  const out={...(obj||{})};
  const keys=new Set(['x','y','z','width','height','depth','radius','rotation','rotationX','rotationY','rotationZ','scale','scaleX','scaleY','skewX','skewY','pivotX','pivotY','opacity','anchorX','anchorY','frame','intensity','range','fov','shake','zoom','targetX','targetY','targetZ','volume','pan','rate','frequency','exposure','vignette','letterbox','fade','flash','grain','tintOpacity','points']);
  for(const f of obj?.keyframes||[])for(const k of Object.keys(f||{}))if(k!=='t'&&k!=='easing')keys.add(k);
  for(const k of keys){const v=keyframeValue(obj,k,time);if(v!==undefined)out[k]=v;}
  return applyAnimationClip(out,obj,time);
}

function assetSource(assetId,asset){
  const src=String(asset?.src||'');
  return state.localUrls.get(assetId)||state.localUrls.get(src)||state.localUrls.get(src.split('/').pop())||src;
}
async function loadProjectImages(project){
  const token=++state.loadToken;state.images.clear();
  const entries=Object.entries(project.assets||{}).filter(([,a])=>a?.type==='sprite'&&a.src);
  await Promise.all(entries.map(async([id,a])=>{
    const src=assetSource(id,a);
    try{const img=new Image();img.decoding='async';img.crossOrigin='anonymous';img.src=src;await img.decode();if(token===state.loadToken)state.images.set(id,img);}
    catch(_){try{const img=new Image();img.src=src;await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;});if(token===state.loadToken)state.images.set(id,img);}catch(__){}}
  }));
}

function objectMap(){return new Map((state.project?.objects||[]).map(o=>[String(o.id||''),o]));}
function sceneObjects(){
  const map=objectMap(),cache=new Map();
  return (state.project?.objects||[]).map(raw=>resolveWorldObject(raw,map,cache,new Set())).filter(Boolean);
}
function resolveWorldObject(raw,map,cache,stack){
  const id=String(raw?.id||'');if(id&&cache.has(id))return cache.get(id);
  if(id&&stack.has(id)){const cycle={...resolved(raw),visible:false,_hierarchyCycle:true};cache.set(id,cycle);return cycle;}
  const next=new Set(stack);if(id)next.add(id);
  let o=resolved(raw);const parentId=String(o.parent||o.parentId||'');
  if(parentId&&map.has(parentId)){
    const p=resolveWorldObject(map.get(parentId),map,cache,next);
    if(p?._hierarchyCycle)o={...o,visible:false,_hierarchyCycle:true};
    else if(state.project.mode==='3D')o=inherit3D(o,p);else o=inherit2D(o,p);
  }
  if(id)cache.set(id,o);return o;
}
function inherit2D(o,p){
  const psx=finite(p.scaleX,p.scale??1),psy=finite(p.scaleY,p.scale??1),pr=rad(p.rotation),ppx=finite(p.pivotX,0),ppy=finite(p.pivotY,0);
  const lx=(finite(o.x)-ppx)*psx,ly=(finite(o.y)-ppy)*psy;
  const rx=lx*Math.cos(pr)-ly*Math.sin(pr),ry=lx*Math.sin(pr)+ly*Math.cos(pr);
  return {...o,x:finite(p.x)+rx,y:finite(p.y)+ry,rotation:finite(p.rotation)+finite(o.rotation),skewX:finite(p.skewX)+finite(o.skewX),skewY:finite(p.skewY)+finite(o.skewY),scaleX:psx*finite(o.scaleX,o.scale??1),scaleY:psy*finite(o.scaleY,o.scale??1),scale:1,opacity:clamp(finite(p.opacity,1)*finite(o.opacity,1),0,1),visible:p.visible!==false&&o.visible!==false,start:Math.max(finite(p.start,0),finite(o.start,0)),end:Math.min(finite(p.end,state.project.duration),finite(o.end,state.project.duration))};
}
function inherit3D(o,p){
  const ps=finite(p.scale,1);const q=rotatePoint({x:finite(o.x)*ps,y:finite(o.y)*ps,z:finite(o.z)*ps},rad(p.rotationX),rad(p.rotationY),rad(p.rotationZ));
  return {...o,x:finite(p.x)+q.x,y:finite(p.y)+q.y,z:finite(p.z)+q.z,rotationX:finite(p.rotationX)+finite(o.rotationX),rotationY:finite(p.rotationY)+finite(o.rotationY),rotationZ:finite(p.rotationZ)+finite(o.rotationZ),scale:ps*finite(o.scale,1),opacity:clamp(finite(p.opacity,1)*finite(o.opacity,1),0,1),visible:p.visible!==false&&o.visible!==false,start:Math.max(finite(p.start,0),finite(o.start,0)),end:Math.min(finite(p.end,state.project.duration),finite(o.end,state.project.duration))};
}
function objectVisible(o){return o&&o.visible!==false&&state.time>=finite(o.start,0)&&state.time<=finite(o.end,state.project.duration);}

function clearStage(){ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle=state.project?.canvas?.background||'#02090b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
function renderFrame(){
  if(!state.project)return;
  clearStage();
  if(state.project.mode==='3D')render3D();else render2D();
  applyPostEffects();
  updateAudioNodes();
  $('#timeReadout').textContent=`${state.time.toFixed(2)} / ${state.project.duration.toFixed(2)}`;
  $('#timeline').value=Math.round(clamp(state.time/state.project.duration,0,1)*1000);
}

function currentCamera2D(){
  const source=state.project.camera||{},c={...source},keys=new Set(['x','y','zoom','rotation','shake']);
  for(const f of source.keyframes||[])for(const k of Object.keys(f||{}))if(k!=='t'&&k!=='easing'&&k!=='interpolation')keys.add(k);
  for(const k of keys){const v=cameraTrackValue(source,k,state.time);if(v!==undefined)c[k]=v;}
  c.x=finite(c.x,canvas.width/2);c.y=finite(c.y,canvas.height/2);c.zoom=clamp(finite(c.zoom,1),.02,64);c.rotation=finite(c.rotation,0);
  const shake=Math.max(0,finite(c.shake,0));if(shake>0){const t=state.time;c.x+=Math.sin(t*47.7)*shake;c.y+=Math.cos(t*39.3)*shake*.8;c.rotation+=Math.sin(t*58.2)*shake*.05;}
  return c;
}
function apply2DCameraTransform(c){ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(-rad(c.rotation));ctx.scale(c.zoom,c.zoom);ctx.translate(-c.x,-c.y);}
function applyObject2DTransform(o){
  ctx.translate(finite(o.x),finite(o.y));ctx.rotate(rad(o.rotation));
  const kx=Math.tan(rad(clamp(finite(o.skewX,0),-89,89))),ky=Math.tan(rad(clamp(finite(o.skewY,0),-89,89)));if(kx||ky)ctx.transform(1,ky,kx,1,0,0);
  ctx.scale(finite(o.scaleX,o.scale??1),finite(o.scaleY,o.scale??1));ctx.translate(-finite(o.pivotX,0),-finite(o.pivotY,0));
}
function localPoint(v){return Array.isArray(v)?{x:finite(v[0]),y:finite(v[1])}:{x:finite(v?.x),y:finite(v?.y)};}
function tracePointPath(points,closed=true,smooth=false){
  const pts=(Array.isArray(points)?points:[]).map(localPoint);if(!pts.length)return false;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  if(smooth&&pts.length>2){for(let i=1;i<pts.length;i++){const p=pts[i],n=pts[(i+1)%pts.length],mx=(p.x+n.x)/2,my=(p.y+n.y)/2;ctx.quadraticCurveTo(p.x,p.y,mx,my);}if(closed)ctx.closePath();}
  else{for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);if(closed)ctx.closePath();}
  return true;
}
function tracePrimitivePath(o){
  if(o.type==='rect'){const w=finite(o.width,100),h=finite(o.height,100),ax=finite(o.anchorX,.5),ay=finite(o.anchorY,.5);ctx.beginPath();ctx.rect(-w*ax,-h*ay,w,h);return true;}
  if(o.type==='circle'||o.type==='ellipse'){const rx=finite(o.radiusX,o.radius??50),ry=finite(o.radiusY,o.radius??rx);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);return true;}
  if(o.type==='polygon'||o.type==='path')return tracePointPath(o.points??o.pathPoints,o.closed!==false,o.smooth===true);
  return false;
}
function paintStyle(value,o,fallback='#ffffff'){
  if(!value||typeof value!=='object'||Array.isArray(value))return value||fallback;
  const type=String(value.type||'linear').toLowerCase();let g;
  if(type==='radial')g=ctx.createRadialGradient(finite(value.x0,0),finite(value.y0,0),Math.max(0,finite(value.r0,0)),finite(value.x1,0),finite(value.y1,0),Math.max(.001,finite(value.r1,finite(o.radius,100))));
  else g=ctx.createLinearGradient(finite(value.x0,-finite(o.width,100)/2),finite(value.y0,0),finite(value.x1,finite(o.width,100)/2),finite(value.y1,0));
  const stops=Array.isArray(value.stops)?value.stops:[];if(!stops.length){g.addColorStop(0,fallback);g.addColorStop(1,fallback);}else for(const stop of stops)g.addColorStop(clamp(finite(stop.offset,0),0,1),String(stop.color||fallback));return g;
}
function apply2DMask(mask){
  if(!mask)return false;const base=typeof ctx.getTransform==='function'?ctx.getTransform():null;applyObject2DTransform(mask);let traced=false;
  if(mask.type==='path'&&mask.d&&typeof Path2D!=='undefined'){try{const p=new Path2D(mask.d);ctx.clip(p,mask.fillRule||'nonzero');if(base)ctx.setTransform(base);return true;}catch(_){}}
  traced=tracePrimitivePath(mask);if(traced)ctx.clip(mask.fillRule||'nonzero');if(base)ctx.setTransform(base);return traced;
}
function render2D(){
  state._frameLights=null;const objects=sceneObjects().filter(objectVisible),map=new Map(objects.map(o=>[String(o.id||''),o])),cam=currentCamera2D();
  ctx.save();apply2DCameraTransform(cam);
  for(const o of objects){if(['group','bone'].includes(o.type)||o.maskOnly===true)continue;ctx.save();const maskId=String(o.mask||o.clipPath||'');if(maskId&&map.has(maskId))apply2DMask(map.get(maskId));draw2DObject(o);ctx.restore();}
  apply2DPointLights();ctx.restore();apply2DAmbientLighting();
}
function draw2DObject(o){
  ctx.save();ctx.globalAlpha=clamp(finite(o.opacity,1),0,1);ctx.globalCompositeOperation=o.blend||'source-over';applyObject2DTransform(o);
  if(o.shadow){ctx.shadowColor=normalizeColor(o.shadow,'#000000');ctx.shadowBlur=finite(o.shadowBlur,12);ctx.shadowOffsetX=finite(o.shadowX,0);ctx.shadowOffsetY=finite(o.shadowY,4);}
  if(['rect','circle','ellipse','polygon','path'].includes(o.type)){
    if(o.type==='path'&&o.d&&typeof Path2D!=='undefined'){
      try{const p=new Path2D(o.d);if(o.fill!==false){ctx.fillStyle=paintStyle(o.fill,o,'#ffffff');ctx.fill(p,o.fillRule||'nonzero');}if(o.stroke){ctx.strokeStyle=paintStyle(o.stroke,o,'#ffffff');ctx.lineWidth=finite(o.lineWidth,1);ctx.stroke(p);}ctx.restore();return;}catch(_){}
    }
    if(tracePrimitivePath(o)){if(o.fill!==false&&o.fill){ctx.fillStyle=paintStyle(o.fill,o,'#ffffff');ctx.fill(o.fillRule||'nonzero');}if(o.stroke){ctx.strokeStyle=paintStyle(o.stroke,o,'#ffffff');ctx.lineWidth=finite(o.lineWidth,1);ctx.lineJoin=o.lineJoin||'round';ctx.lineCap=o.lineCap||'round';ctx.stroke();}}
  }else if(o.type==='text'){
    ctx.font=o.font||'700 32px system-ui';ctx.textAlign=o.align||'left';ctx.textBaseline=o.baseline||'alphabetic';if(o.fill!==false){ctx.fillStyle=paintStyle(o.fill,o,'#ffffff');ctx.fillText(String(o.text??''),0,0);}if(o.stroke){ctx.strokeStyle=paintStyle(o.stroke,o,'#ffffff');ctx.lineWidth=finite(o.lineWidth,1);ctx.strokeText(String(o.text??''),0,0);}
  }else if(o.type==='sprite')drawSprite(o);else if(o.type==='emitter')drawParticleEmitter(o);
  ctx.restore();
}
function spriteFrame(asset,o,img){
  const fw=Math.max(1,finite(asset.frameWidth,img.width)),fh=Math.max(1,finite(asset.frameHeight,img.height));const cols=Math.max(1,Math.floor(img.width/fw));
  const total=Math.max(1,finite(asset.frames,Math.floor(img.width/fw)*Math.floor(img.height/fh)));const fps=Math.max(0,finite(asset.fps,0));let frame=Number.isFinite(Number(o.frame))?Math.floor(Number(o.frame)):fps>0?Math.floor(state.time*fps):0;frame=((frame%total)+total)%total;
  return {sx:(frame%cols)*fw,sy:Math.floor(frame/cols)*fh,sw:fw,sh:fh};
}
function drawSprite(o){
  const img=state.images.get(o.asset);if(!img){drawMissingSprite(o);return;}const a=state.project.assets[o.asset]||{},f=spriteFrame(a,o,img),w=finite(o.width,f.sw),h=finite(o.height,f.sh),ax=finite(o.anchorX,.5),ay=finite(o.anchorY,.5);
  ctx.imageSmoothingEnabled=o.pixelated!==true;ctx.drawImage(img,f.sx,f.sy,f.sw,f.sh,-w*ax,-h*ay,w,h);
}
function drawMissingSprite(o){const w=finite(o.width,80),h=finite(o.height,80);ctx.strokeStyle='#ff6b92';ctx.strokeRect(-w/2,-h/2,w,h);ctx.beginPath();ctx.moveTo(-w/2,-h/2);ctx.lineTo(w/2,h/2);ctx.moveTo(w/2,-h/2);ctx.lineTo(-w/2,h/2);ctx.stroke();}
function stringSeed(value){let h=2166136261>>>0;for(const ch of String(value||'')){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function particleRand(seed,index,salt=0){let x=(seed^Math.imul(index+1,2654435761)^Math.imul(salt+1,1597334677))>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296;}
function mixColor(a,b,t){const x=parseColor(a),y=parseColor(b||a);return rgba([lerp(x[0],y[0],t),lerp(x[1],y[1],t),lerp(x[2],y[2],t),lerp(x[3],y[3],t)],lerp(x[3],y[3],t));}
function drawParticleEmitter(o){
  const elapsed=state.time-finite(o.start,0);if(elapsed<0)return;const rate=clamp(finite(o.emitRate??o.rate,20),0,500),life=Math.max(.01,finite(o.life,1)),burst=clamp(Math.floor(finite(o.burst,0)),0,1000),maxParticles=clamp(Math.floor(finite(o.maxParticles,500)),1,1500),seed=stringSeed(o.seed??o.id),direction=rad(finite(o.direction,-90)),spread=rad(Math.abs(finite(o.spread,40))),speed=finite(o.speed,140),speedJitter=Math.max(0,finite(o.speedJitter,.25)),gx=finite(o.gravityX,0),gy=finite(o.gravityY,0);
  const timedCount=rate>0?Math.floor(elapsed*rate)+1:0,total=Math.min(maxParticles,burst+timedCount),first=Math.max(0,total-maxParticles);
  for(let i=first;i<total;i++){
    const born=i<burst?0:(i-burst)/Math.max(rate,.0001),age=elapsed-born;if(age<0||age>life)continue;const q=clamp(age/life,0,1),ang=direction+(particleRand(seed,i,1)-.5)*spread,sp=speed*(1+(particleRand(seed,i,2)*2-1)*speedJitter),vx=Math.cos(ang)*sp,vy=Math.sin(ang)*sp,x=vx*age+.5*gx*age*age,y=vy*age+.5*gy*age*age,size=lerp(finite(o.size,8),finite(o.sizeEnd,0),q),alpha=clamp(lerp(finite(o.particleOpacity,1),finite(o.opacityEnd,0),q),0,1);if(size<=0||alpha<=0)continue;
    ctx.save();ctx.translate(x,y);ctx.rotate(rad(finite(o.particleRotation,0)+finite(o.rotationSpeed,0)*age));ctx.globalAlpha*=alpha;ctx.fillStyle=mixColor(o.color||'#ffffff',o.colorEnd||o.color||'#ffffff',q);const shape=String(o.particleShape||'circle').toLowerCase();if(shape==='rect')ctx.fillRect(-size/2,-size/2,size,size);else if(shape==='line'){ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(1,finite(o.lineWidth,2));ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-Math.cos(ang)*size*2,-Math.sin(ang)*size*2);ctx.stroke();}else{ctx.beginPath();ctx.arc(0,0,size/2,0,Math.PI*2);ctx.fill();}ctx.restore();
  }
}
function resolvePointLight2DWorld(raw,map,cache){
  const l=resolved(raw),parentId=String(l.parent||l.parentId||'');if(!parentId||!map.has(parentId))return l;const p=resolveWorldObject(map.get(parentId),map,cache,new Set()),psx=finite(p.scaleX,p.scale??1),psy=finite(p.scaleY,p.scale??1),pr=rad(p.rotation),lx=(finite(l.x)-finite(p.pivotX,0))*psx,ly=(finite(l.y)-finite(p.pivotY,0))*psy;return {...l,x:finite(p.x)+lx*Math.cos(pr)-ly*Math.sin(pr),y:finite(p.y)+lx*Math.sin(pr)+ly*Math.cos(pr)};
}
function apply2DPointLights(){
  const lighting=state.project.lighting||{},map=objectMap(),cache=new Map();
  for(const raw of lighting.point||[]){const l=resolvePointLight2DWorld(raw,map,cache),intensity=clamp(finite(l.intensity,0),0,8),range=Math.max(1,finite(l.range,220));if(intensity<=0)continue;const rgb=parseColor(l.color||'#ffffff'),g=ctx.createRadialGradient(finite(l.x),finite(l.y),0,finite(l.x),finite(l.y),range);g.addColorStop(0,rgba(rgb,clamp(intensity*.18,0,.8)));g.addColorStop(1,rgba(rgb,0));ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=g;ctx.fillRect(finite(l.x)-range,finite(l.y)-range,range*2,range*2);ctx.restore();}
}
function apply2DAmbientLighting(){const ambient=resolved(state.project.lighting?.ambient||{}),intensity=clamp(finite(ambient.intensity,1),0,2);if(intensity<1){ctx.save();ctx.fillStyle=`rgba(0,0,0,${clamp((1-intensity)*.65,0,.8)})`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}}

function rotatePoint(p,rx,ry,rz){let{x,y,z}=p;let c=Math.cos(rx),s=Math.sin(rx);[y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];return{x,y,z};}
function catmullRom(a,b,c,d,t){
  const t2=t*t,t3=t2*t;
  return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3);
}
function smootherStep(t){t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);}
function cameraTrackValue(camera,key,time){
  const frames=Array.isArray(camera?.keyframes)?camera.keyframes.filter(f=>f&&Number.isFinite(Number(f.t))&&Object.prototype.hasOwnProperty.call(f,key)).slice().sort((a,b)=>Number(a.t)-Number(b.t)):[];
  const base=Object.prototype.hasOwnProperty.call(camera||{},key)?camera[key]:undefined;
  if(!frames.length)return base;
  if(time<=Number(frames[0].t))return frames[0][key];
  if(time>=Number(frames.at(-1).t))return frames.at(-1)[key];
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i],b=frames[i+1],at=Number(a.t),bt=Number(b.t);if(time<at||time>bt)continue;
    const raw=(time-at)/Math.max(.000001,bt-at),av=a[key],bv=b[key];
    if(typeof av!=='number'||typeof bv!=='number')return raw<1?av:bv;
    const easing=String(b.easing||a.easing||'').toLowerCase();
    const interpolation=String(b.interpolation||a.interpolation||camera.interpolation||'spline').toLowerCase();
    if(interpolation==='step'||easing==='step')return av;
    if(interpolation==='linear')return lerp(av,bv,ease(raw,easing||'linear'));
    if(['x','y','z','targetX','targetY','targetZ'].includes(key)){
      const p0=i>0&&typeof frames[i-1][key]==='number'?frames[i-1][key]:av;
      const p3=i+2<frames.length&&typeof frames[i+2][key]==='number'?frames[i+2][key]:bv;
      const spline=catmullRom(p0,av,bv,p3,raw);
      const linear=lerp(av,bv,smootherStep(raw));
      const smooth=clamp(finite(camera.smoothing,1),0,1);
      return lerp(linear,spline,smooth);
    }
    return lerp(av,bv,easing?ease(raw,easing):smootherStep(raw));
  }
  return base;
}
function currentCamera(){
  const source=state.project.camera||{},c={...source};
  const keys=new Set(['x','y','z','rotateX','rotateY','rotateZ','fov','shake','targetX','targetY','targetZ','near','far']);
  for(const f of source.keyframes||[])for(const k of Object.keys(f||{}))if(k!=='t'&&k!=='easing'&&k!=='interpolation')keys.add(k);
  for(const k of keys){const v=cameraTrackValue(source,k,state.time);if(v!==undefined)c[k]=v;}
  c.near=clamp(finite(c.near,.2),.01,1000);c.far=Math.max(c.near+.01,finite(c.far,5000));
  if(Number.isFinite(Number(c.targetX))&&Number.isFinite(Number(c.targetY))&&Number.isFinite(Number(c.targetZ))){const dx=finite(c.targetX)-finite(c.x),dy=finite(c.targetY)-finite(c.y),dz=finite(c.targetZ)-finite(c.z),h=Math.hypot(dx,dz)||.0001;c.rotateY=Math.atan2(dx,dz)*180/Math.PI;c.rotateX=-Math.atan2(dy,h)*180/Math.PI;}
  const shake=Math.max(0,finite(c.shake,0));if(shake>0){const t=state.time;c.x=finite(c.x)+Math.sin(t*47.1)*shake*.035;c.y=finite(c.y)+Math.cos(t*39.7)*shake*.027;c.rotateZ=finite(c.rotateZ)+Math.sin(t*61.3)*shake*.42;c.rotateX=finite(c.rotateX)+Math.cos(t*53.2)*shake*.22;}return c;
}
function cameraPointWith(p,c){let q={x:p.x-finite(c.x),y:p.y-finite(c.y),z:p.z-finite(c.z)};q=rotatePoint(q,-rad(c.rotateX),-rad(c.rotateY),-rad(c.rotateZ));return q;}
function cameraPoint(p){return cameraPointWith(p,currentCamera());}
function projectCameraPoint(q,c){const f=Math.max(10,finite(c.fov,520));if(q.z<=0)return null;const s=f/q.z;return{x:canvas.width/2+q.x*s,y:canvas.height/2-q.y*s,scale:s,z:q.z};}
function projectPointWith(p,c){const q=cameraPointWith(p,c),near=finite(c.near,.2),far=finite(c.far,5000);if(q.z<near||q.z>far)return null;return projectCameraPoint(q,c);}
function projectPoint(p){return projectPointWith(p,currentCamera());}
function objectVertex(o,v){const local=rotatePoint({x:v.x*finite(o.scale,1),y:v.y*finite(o.scale,1),z:v.z*finite(o.scale,1)},rad(o.rotationX),rad(o.rotationY),rad(o.rotationZ));return{x:local.x+finite(o.x),y:local.y+finite(o.y),z:local.z+finite(o.z)};}
function normalize3(v){const d=Math.hypot(v.x,v.y,v.z)||1;return{x:v.x/d,y:v.y/d,z:v.z/d};}
function cross(a,b){return{x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x};}
function sub(a,b){return{x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};}
function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z;}
function resolvePointLightWorld(raw,map,cache){
  const l=resolved(raw),parentId=String(l.parent||l.parentId||'');if(!parentId||!map.has(parentId))return l;
  const p=resolveWorldObject(map.get(parentId),map,cache,new Set()),ps=finite(p.scale,1),q=rotatePoint({x:finite(l.x)*ps,y:finite(l.y)*ps,z:finite(l.z)*ps},rad(p.rotationX),rad(p.rotationY),rad(p.rotationZ));
  return {...l,x:finite(p.x)+q.x,y:finite(p.y)+q.y,z:finite(p.z)+q.z};
}
function resolvedLights(){
  if(state._frameLights&&state._frameLights.time===state.time)return state._frameLights.value;
  const l=state.project.lighting||{},map=objectMap(),cache=new Map(),value={ambient:resolved(l.ambient||{}),directional:(l.directional||[]).map(x=>resolved(x)),point:(l.point||[]).map(x=>resolvePointLightWorld(x,map,cache))};
  state._frameLights={time:state.time,value};return value;
}
function pointLightAttenuation(light,dist){
  const range=Math.max(.001,finite(light.range,8));if(dist>=range)return 0;
  const edge=Math.pow(clamp(1-dist/range,0,1),clamp(finite(light.falloff,2),.25,8));
  const decay=clamp(finite(light.decay,1),0,8),normalized=dist/range;
  return edge/(1+decay*normalized*normalized*4);
}
function surfaceLightSample(point,normal={x:0,y:0,z:-1}){
  const lights=resolvedLights(),n=normalize3(normal),ambientIntensity=clamp(finite(lights.ambient.intensity,.28),0,3),ambientColor=parseColor(lights.ambient.color||'#ffffff');
  let intensity=ambientIntensity,weight=Math.max(.001,ambientIntensity),tint=[ambientColor[0]*weight,ambientColor[1]*weight,ambientColor[2]*weight];
  for(const d of lights.directional){const dir=normalize3({x:finite(d.x,-.4),y:finite(d.y,.6),z:finite(d.z,-.6)}),amount=Math.max(0,dot(n,dir))*clamp(finite(d.intensity,1),0,8);if(amount<=0)continue;const c=parseColor(d.color||'#ffffff');intensity+=amount;weight+=amount;tint[0]+=c[0]*amount;tint[1]+=c[1]*amount;tint[2]+=c[2]*amount;}
  for(const p of lights.point){const delta=sub({x:finite(p.x),y:finite(p.y),z:finite(p.z)},point),dist=Math.hypot(delta.x,delta.y,delta.z),attenuation=pointLightAttenuation(p,dist);if(attenuation<=0)continue;const lambert=p.omnidirectional===true?1:Math.max(0,dot(n,normalize3(delta))),amount=lambert*attenuation*clamp(finite(p.intensity,1),0,20);if(amount<=0)continue;const c=parseColor(p.color||'#ffffff');intensity+=amount;weight+=amount;tint[0]+=c[0]*amount;tint[1]+=c[1]*amount;tint[2]+=c[2]*amount;}
  return{intensity:clamp(intensity,.03,5),tint:[tint[0]/weight,tint[1]/weight,tint[2]/weight]};
}
function litSurfaceColor(value,point,normal,multiplier=1){const base=parseColor(value),sample=surfaceLightSample(point,normal),f=sample.intensity*multiplier;return rgba([clamp(base[0]*f*(.55+.45*sample.tint[0]/255),0,255),clamp(base[1]*f*(.55+.45*sample.tint[1]/255),0,255),clamp(base[2]*f*(.55+.45*sample.tint[2]/255),0,255),base[3]],base[3]);}
function parseColor(value){
  const s=String(value||'#ffffff').trim();let m;
  if((m=s.match(/^#([0-9a-f]{3})$/i))){return m[1].split('').map(x=>parseInt(x+x,16)).concat(1);}
  if((m=s.match(/^#([0-9a-f]{6})$/i))){return[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16),1];}
  if((m=s.match(/^rgba?\(([^)]+)\)$/i))){const a=m[1].split(',').map(Number);return[clamp(a[0]||0,0,255),clamp(a[1]||0,0,255),clamp(a[2]||0,0,255),Number.isFinite(a[3])?clamp(a[3],0,1):1];}
  return[170,205,220,1];
}
function rgba(c,a=c[3]??1){return`rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp(a,0,1)})`;}
function shadeColor(value,factor=1){const c=parseColor(value);return rgba([clamp(c[0]*factor,0,255),clamp(c[1]*factor,0,255),clamp(c[2]*factor,0,255),c[3]],c[3]);}
function clipPolygonAtZ(poly,z,keepGreater=true){
  if(!poly.length)return[];const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],ain=keepGreater?a.z>=z:a.z<=z,bin=keepGreater?b.z>=z:b.z<=z;
    if(ain)out.push(a);
    if(ain!==bin){const t=(z-a.z)/((b.z-a.z)||1e-9);out.push({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t),z});}
  }
  return out;
}
function clipCameraPolygon(poly,cam){let out=clipPolygonAtZ(poly,finite(cam.near,.2),true);if(out.length<3)return[];out=clipPolygonAtZ(out,finite(cam.far,5000),false);return out.length>=3?out:[];}
function projectedCameraPolygon(poly,cam){
  const screen=poly.map(p=>projectCameraPoint(p,cam));if(screen.some(p=>!p))return null;
  const margin=8;if(screen.every(p=>p.x<-margin)||screen.every(p=>p.x>canvas.width+margin)||screen.every(p=>p.y<-margin)||screen.every(p=>p.y>canvas.height+margin))return null;
  return screen;
}
function beginScreenPath(points){if(!points?.length)return false;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)ctx.lineTo(points[i].x,points[i].y);ctx.closePath();return true;}
function faceNormal(world){return normalize3(cross(sub(world[1],world[0]),sub(world[2],world[0])));}
function faceCenter(world){return world.reduce((a,p)=>({x:a.x+p.x/world.length,y:a.y+p.y/world.length,z:a.z+p.z/world.length}),{x:0,y:0,z:0});}
function faceCommand(o,world,cam){
  const camPoly=clipCameraPolygon(world.map(p=>cameraPointWith(p,cam)),cam);if(camPoly.length<3)return null;const screen=projectedCameraPolygon(camPoly,cam);if(!screen)return null;
  return{kind:'face',o,world,screen,depth:camPoly.reduce((sum,p)=>sum+p.z,0)/camPoly.length,normal:faceNormal(world),center:faceCenter(world)};
}
function collect3DCommands(objects,cam){
  const commands=[];
  for(const o of objects){
    if(o.type==='box'){
      const w=finite(o.width,2)/2,h=finite(o.height,2)/2,d=finite(o.depth,2)/2,local=[[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d],[-w,-h,d],[w,-h,d],[w,h,d],[-w,h,d]],verts=local.map(([x,y,z])=>objectVertex(o,{x,y,z})),faces=[[0,1,2,3],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,3,7,4]];
      for(const face of faces){const cmd=faceCommand(o,face.map(i=>verts[i]),cam);if(cmd)commands.push(cmd);}
    }else if(o.type==='plane'){
      const w=finite(o.width,2)/2,h=finite(o.height,2)/2,world=[[-w,-h,0],[w,-h,0],[w,h,0],[-w,h,0]].map(([x,y,z])=>objectVertex(o,{x,y,z})),cmd=faceCommand(o,world,cam);if(cmd)commands.push(cmd);
    }else if(o.type==='sphere'||o.type==='sprite'){
      const q=cameraPointWith({x:finite(o.x),y:finite(o.y),z:finite(o.z)},cam);if(q.z>=cam.near&&q.z<=cam.far)commands.push({kind:o.type,o,depth:q.z});
    }
  }
  return commands.sort((a,b)=>b.depth-a.depth);
}
function render3D(){
  state._frameLights=null;const cam=currentCamera(),objects=sceneObjects().filter(objectVisible).filter(o=>!['group','bone'].includes(o.type));
  renderShadows3D(objects,cam);
  for(const command of collect3DCommands(objects,cam))draw3DCommand(command,cam);
}
function renderShadows3D(objects,cam){
  const cfg=state.project.lighting?.shadows||{};if(cfg.enabled!==true)return;const groundY=finite(cfg.groundY,-2.5),opacity=clamp(finite(cfg.opacity,.25),0,.8),softness=Math.max(0,finite(cfg.softness,14)),key=(resolvedLights().directional||[])[0]||{x:-.4,y:.8,z:-.5};let toward=normalize3({x:finite(key.x,-.4),y:finite(key.y,.8),z:finite(key.z,-.5)});if(Math.abs(toward.y)<.05)toward.y=.05;const away={x:-toward.x,y:-toward.y,z:-toward.z};
  ctx.save();ctx.fillStyle=`rgba(0,0,0,${opacity})`;ctx.shadowColor=`rgba(0,0,0,${opacity})`;ctx.shadowBlur=softness;
  for(const o of objects){if(o.castShadow===false||!['sphere','box','sprite'].includes(o.type))continue;const py=finite(o.y);let t=(groundY-py)/away.y;if(!Number.isFinite(t)||t<0)t=(groundY-py)/(-away.y);if(!Number.isFinite(t)||t<0)continue;const sp={x:finite(o.x)+away.x*t,y:groundY,z:finite(o.z)+away.z*t},pp=projectPointWith(sp,cam);if(!pp)continue;const size=(o.type==='sphere'?finite(o.radius,1):Math.max(finite(o.width,1),finite(o.depth,1))*.5)*finite(o.scale,1)*pp.scale;if(size<=0)continue;if(pp.x+size<0||pp.x-size>canvas.width||pp.y+size<0||pp.y-size>canvas.height)continue;ctx.beginPath();ctx.ellipse(pp.x,pp.y,Math.max(2,size*.9),Math.max(1,size*.24),0,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
function draw3DCommand(command,cam){
  const o=command.o;ctx.save();ctx.globalAlpha=clamp(finite(o.opacity,1),0,1);ctx.lineWidth=finite(o.lineWidth,1.5);ctx.strokeStyle=o.stroke===false?'transparent':(o.stroke||'#8adfff');
  if(command.kind==='face')drawFaceCommand(command);else if(command.kind==='sphere')drawLitSphere(o,cam);else if(command.kind==='sprite')drawBillboard(o,cam);
  ctx.restore();
}
function drawFaceCommand(command){
  const {o,screen,center,normal}=command;if(!beginScreenPath(screen))return;ctx.fillStyle=litSurfaceColor(o.fill||'#546d7d',center,normal);
  if(o.fill!==false)ctx.fill();
  if(o.emissive){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=clamp(finite(o.emissiveIntensity,.35),0,2);ctx.fillStyle=o.emissive;ctx.fill();ctx.restore();}
  if(o.stroke!==false){ctx.strokeStyle=o.stroke||'#8adfff';ctx.stroke();}
}
function strongestLightScreenOffset(point,cam,r){
  const lights=resolvedLights();let best=null,bestScore=0;
  for(const l of lights.point){const intensity=finite(l.intensity,0),d=Math.hypot(finite(l.x)-point.x,finite(l.y)-point.y,finite(l.z)-point.z),score=intensity*pointLightAttenuation(l,d);if(score>bestScore){const pp=projectPointWith({x:finite(l.x),y:finite(l.y),z:finite(l.z)},cam),cp=projectPointWith(point,cam);if(pp&&cp){bestScore=score;const dx=pp.x-cp.x,dy=pp.y-cp.y,len=Math.hypot(dx,dy)||1;best={x:dx/len*r*.33,y:dy/len*r*.33};}}}
  if(!best&&lights.directional.length){const l=lights.directional[0],v=normalize3({x:finite(l.x,-.4),y:finite(l.y,.6),z:finite(l.z,-.6)});best={x:v.x*r*.28,y:-v.y*r*.28};}
  return best||{x:-r*.18,y:-r*.18};
}
function drawLitSphere(o,cam){
  const point={x:finite(o.x),y:finite(o.y),z:finite(o.z)},center=projectPointWith(point,cam);if(!center)return;const edge=projectPointWith({x:point.x+finite(o.radius,1)*finite(o.scale,1),y:point.y,z:point.z},cam);const r=edge?Math.abs(edge.x-center.x):Math.abs(finite(o.radius,1)*center.scale);if(r<=0||center.x+r<0||center.x-r>canvas.width||center.y+r<0||center.y-r>canvas.height)return;
  const base=o.fill||'#6aa4bf',normal={x:0,y:0,z:-1},off=strongestLightScreenOffset(point,cam,r),g=ctx.createRadialGradient(center.x+off.x,center.y+off.y,Math.max(1,r*.05),center.x,center.y,r*1.1);g.addColorStop(0,litSurfaceColor(base,point,normal,1.35));g.addColorStop(.52,litSurfaceColor(base,point,normal,.78));g.addColorStop(1,litSurfaceColor(base,point,normal,.27));ctx.fillStyle=g;ctx.beginPath();ctx.arc(center.x,center.y,r,0,Math.PI*2);if(o.fill!==false)ctx.fill();
  if(o.emissive){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha*=clamp(finite(o.emissiveIntensity,.5),0,2);const eg=ctx.createRadialGradient(center.x,center.y,0,center.x,center.y,r*1.35),ec=parseColor(o.emissive);eg.addColorStop(0,rgba(ec,.34));eg.addColorStop(1,rgba(ec,0));ctx.fillStyle=eg;ctx.beginPath();ctx.arc(center.x,center.y,r*1.35,0,Math.PI*2);ctx.fill();ctx.restore();}
  if(o.stroke!==false){ctx.strokeStyle=o.stroke||'#8adfff';ctx.stroke();ctx.save();ctx.globalAlpha*=.35;ctx.beginPath();ctx.ellipse(center.x,center.y,r,r*.28,rad(o.rotationY),0,Math.PI*2);ctx.stroke();ctx.restore();}
}
function drawBillboard(o,cam){
  const p=projectPointWith({x:finite(o.x),y:finite(o.y),z:finite(o.z)},cam);if(!p)return;const img=state.images.get(o.asset),a=state.project.assets[o.asset]||{},worldW=finite(o.width,1.5)*finite(o.scale,1),worldH=finite(o.height,1.5)*finite(o.scale,1),w=worldW*p.scale,h=worldH*p.scale;if(p.x+w/2<0||p.x-w/2>canvas.width||p.y+h/2<0||p.y-h/2>canvas.height)return;ctx.translate(p.x,p.y);ctx.rotate(rad(o.rotationZ));
  if(!img){ctx.strokeStyle=o.stroke||'#ff6b92';ctx.strokeRect(-w/2,-h/2,w,h);return;}const f=spriteFrame(a,o,img);ctx.imageSmoothingEnabled=o.pixelated!==true;ctx.drawImage(img,f.sx,f.sy,f.sw,f.sh,-w/2,-h/2,w,h);
}

function applyPostEffects(){
  const p=resolved(state.project.post||{}),exposure=clamp(finite(p.exposure,1),0,4),vignette=clamp(finite(p.vignette,0),0,1),letterbox=clamp(finite(p.letterbox,0),0,.45),fade=clamp(finite(p.fade,0),0,1),flash=clamp(finite(p.flash,0),0,1),grain=clamp(finite(p.grain,0),0,.5),tintOpacity=clamp(finite(p.tintOpacity,0),0,1);
  if(exposure!==1){ctx.save();ctx.fillStyle=exposure>1?`rgba(255,255,255,${clamp((exposure-1)*.18,0,.55)})`:`rgba(0,0,0,${clamp((1-exposure)*.75,0,.8)})`;ctx.globalCompositeOperation=exposure>1?'screen':'source-over';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
  if(tintOpacity>0){ctx.save();ctx.fillStyle=normalizeColor(p.tint,'#ffffff');ctx.globalAlpha=tintOpacity;ctx.globalCompositeOperation='soft-light';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
  if(vignette>0){ctx.save();const g=ctx.createRadialGradient(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.18,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*.68);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${vignette})`);ctx.fillStyle=g;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
  if(grain>0){ctx.save();ctx.globalAlpha=grain*.34;ctx.fillStyle='#ffffff';let seed=Math.floor(state.time*60)+17;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const count=Math.min(800,Math.floor(canvas.width*canvas.height/1800));for(let i=0;i<count;i++)ctx.fillRect(rand()*canvas.width,rand()*canvas.height,1,1);ctx.restore();}
  if(letterbox>0){ctx.save();ctx.fillStyle='#000';const h=canvas.height*letterbox;ctx.fillRect(0,0,canvas.width,h);ctx.fillRect(0,canvas.height-h,canvas.width,h);ctx.restore();}
  if(flash>0){ctx.save();ctx.fillStyle=`rgba(255,255,255,${flash})`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
  if(fade>0){ctx.save();ctx.fillStyle=`rgba(0,0,0,${fade})`;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
}

function ensureAudioContext(){
  if(state.audio.ctx)return state.audio.ctx;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const ac=new AC(),master=ac.createGain();master.connect(ac.destination);state.audio.ctx=ac;state.audio.master=master;updateMasterVolume();return ac;
}
function updateMasterVolume(){if(state.audio.master)state.audio.master.gain.value=state.audio.muted?0:clamp(state.audio.volume,0,1);const b=$('#muteAudioButton');if(b)b.textContent=state.audio.muted?'UNMUTE':'MUTE';}
async function prepareAudioBuffers(){
  const ac=ensureAudioContext();if(!ac||!state.project)return;const token=++state.audio.token;
  const entries=Object.entries(state.project.assets||{}).filter(([,a])=>a?.type==='audio'&&a.src&&!state.audio.buffers.has(a.src));
  await Promise.all(entries.map(async([id,a])=>{try{const src=assetSource(id,a),res=await fetch(src);if(!res.ok)throw new Error(`HTTP ${res.status}`);const buf=await ac.decodeAudioData(await res.arrayBuffer());if(token===state.audio.token){state.audio.buffers.set(a.src,buf);state.audio.buffers.set(id,buf);}}catch(e){console.debug('S.A.D. audio asset',id,e?.message||e);}}));
}
function stopAllAudio(){for(const row of state.audio.active.values()){try{row.node.stop();}catch(_){}try{row.node.disconnect();}catch(_){}try{row.gain.disconnect();}catch(_){}try{row.panner?.disconnect();}catch(_){}}state.audio.active.clear();}
function soundEnd(sound,asset,buffer){const start=finite(sound.start,0);if(Number.isFinite(Number(sound.end)))return Math.max(start,Number(sound.end));if(asset?.type==='tone')return start+Math.max(.01,finite(asset.duration,.25));if(buffer)return start+buffer.duration/Math.max(.01,finite(sound.rate,1));return state.project.duration;}
async function syncAudio(){
  stopAllAudio();if(!state.playing||!state.project||!state.project.sounds.length)return;const ac=ensureAudioContext();if(!ac)return;try{await ac.resume();}catch(_){}await prepareAudioBuffers();
  const nowTimeline=state.time,projectSpeed=Math.max(.01,state.speed);
  for(const raw of state.project.sounds){const asset=state.project.assets?.[raw.asset];if(!asset)continue;const sound=resolved(raw,nowTimeline),start=finite(raw.start,0),buffer=state.audio.buffers.get(raw.asset)||state.audio.buffers.get(asset.src),end=soundEnd(raw,asset,buffer);if(!raw.loop&&nowTimeline>=end)continue;
    const delay=Math.max(0,start-nowTimeline)/projectSpeed,clipTime=Math.max(0,nowTimeline-start),gain=ac.createGain(),panner=ac.createStereoPanner?ac.createStereoPanner():null;gain.gain.value=clamp(finite(sound.volume,1),0,2);if(panner){panner.pan.value=clamp(finite(sound.pan,0),-1,1);gain.connect(panner);panner.connect(state.audio.master);}else gain.connect(state.audio.master);
    let node=null;
    if(asset.type==='tone'){const osc=ac.createOscillator();osc.type=['sine','square','sawtooth','triangle'].includes(asset.wave)?asset.wave:'sine';osc.frequency.value=Math.max(1,finite(sound.frequency,finite(asset.frequency,220)));osc.connect(gain);node=osc;osc.start(ac.currentTime+delay);const remaining=Math.max(.01,end-Math.max(nowTimeline,start))/projectSpeed;osc.stop(ac.currentTime+delay+remaining);}
    else if(asset.type==='audio'&&buffer){const source=ac.createBufferSource();source.buffer=buffer;source.loop=raw.loop===true;source.playbackRate.value=Math.max(.01,finite(sound.rate,1)*projectSpeed);source.connect(gain);node=source;let offset=clipTime*Math.max(.01,finite(sound.rate,1));if(source.loop&&buffer.duration)offset%=buffer.duration;offset=Math.min(Math.max(0,offset),Math.max(0,buffer.duration-.001));try{source.start(ac.currentTime+delay,offset);}catch(_){continue;}if(!source.loop){const remaining=Math.max(.01,end-Math.max(nowTimeline,start))/projectSpeed;try{source.stop(ac.currentTime+delay+remaining);}catch(_){}}}
    if(node){const id=String(raw.id||`${raw.asset}-${start}`);state.audio.active.set(id,{node,gain,panner,raw,asset});node.onended=()=>state.audio.active.delete(id);}
  }
}
function updateAudioNodes(){if(!state.playing)return;for(const row of state.audio.active.values()){const s=resolved(row.raw,state.time);try{row.gain.gain.setTargetAtTime(clamp(finite(s.volume,1),0,2),state.audio.ctx.currentTime,.02);}catch(_){}if(row.panner)try{row.panner.pan.setTargetAtTime(clamp(finite(s.pan,0),-1,1),state.audio.ctx.currentTime,.02);}catch(_){}if(row.node.playbackRate)try{row.node.playbackRate.setTargetAtTime(Math.max(.01,finite(s.rate,1)*state.speed),state.audio.ctx.currentTime,.02);}catch(_){}if(row.node.frequency)try{row.node.frequency.setTargetAtTime(Math.max(1,finite(s.frequency,finite(row.asset.frequency,220))),state.audio.ctx.currentTime,.02);}catch(_){}}
}

function tick(now){
  if(!state.playing||!state.project)return;if(!state.lastFrame)state.lastFrame=now;const dt=Math.min(.1,(now-state.lastFrame)/1000)*state.speed;state.lastFrame=now;const before=state.time;state.time+=dt;let wrapped=false;
  if(state.time>=state.project.duration){if(state.project.loop){state.time=state.time%state.project.duration;wrapped=true;}else{state.time=state.project.duration;state.playing=false;renderStatus('FINISHED');stopAllAudio();$('#playPauseButton').textContent='PLAY';}}
  renderFrame();if(wrapped&&state.playing)syncAudio();if(state.playing)state.raf=requestAnimationFrame(tick);
}
async function togglePlay(){
  if(!state.project)return;if(state.time>=state.project.duration)state.time=0;state.playing=!state.playing;state.lastFrame=0;$('#playPauseButton').textContent=state.playing?'PAUSE':'PLAY';renderStatus(state.playing?'PLAYING':'PAUSED');cancelAnimationFrame(state.raf);
  if(state.playing){await syncAudio();state.raf=requestAnimationFrame(tick);}else stopAllAudio();
}
function stop(){state.playing=false;state.time=0;state.lastFrame=0;cancelAnimationFrame(state.raf);stopAllAudio();$('#playPauseButton').textContent='PLAY';renderStatus('STOPPED');renderFrame();}

function saveJson(){try{const p=validateProject(JSON.parse(editor.value)),blob=new Blob([JSON.stringify(p,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${safeId(p.title||'animation')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('JSON SAVED');}catch(e){setStatus(e.message,'error');}}
async function loadJsonFile(file){try{editor.value=await file.text();state.time=0;await applyEditor();setStatus(`LOADED ${file.name}`);}catch(e){setStatus(e.message||'LOAD FAILED','error');}}
async function loadJsonFromClipboard(){
  try{if(!navigator.clipboard?.readText)throw new Error('Clipboard reading is unavailable in this browser or page context.');const text=await navigator.clipboard.readText();if(!String(text||'').trim())throw new Error('Clipboard does not contain JSON text.');const project=validateProject(JSON.parse(text));if(!confirm('REPLACE THE CURRENT ANIMATION WITH JSON FROM YOUR CLIPBOARD?'))return;editor.value=stringifyProject(project);state.time=0;await applyEditor();setStatus('LOADED FROM CLIPBOARD');}catch(e){setStatus(e.message||'CLIPBOARD LOAD FAILED','error');}
}
async function loadPresetManifest(){if(Array.isArray(state.presets))return state.presets;const response=await fetch(PRESET_MANIFEST_URL,{cache:'no-store'});if(!response.ok)throw new Error(`Could not load preset list (${response.status}).`);const manifest=await response.json(),presets=Array.isArray(manifest?.presets)?manifest.presets:[];state.presets=presets.filter(p=>p&&p.id&&p.src&&p.title);return state.presets;}
function renderPresetAnimations(presets){const root=$('#presetAnimationsGrid');if(!root)return;if(!presets.length){root.innerHTML='<p class="sad-preset-loading">NO PRESET ANIMATIONS ARE AVAILABLE.</p>';return;}root.innerHTML=presets.map(p=>`<article class="sad-preset-card"><div class="sad-preset-card-head"><span>${String(p.mode||'').toUpperCase()}</span><b>${String(p.title||'UNTITLED')}</b></div><p>${String(p.description||'Editable starter animation.')}</p><button type="button" data-sad-preset="${String(p.id)}">USE PRESET</button></article>`).join('');}
async function openPresetAnimations(){const dialog=$('#presetAnimationsDialog'),root=$('#presetAnimationsGrid');if(!dialog||!root)return;root.innerHTML='<p class="sad-preset-loading">LOADING PRESETS…</p>';if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');try{renderPresetAnimations(await loadPresetManifest());}catch(e){root.innerHTML=`<p class="sad-preset-loading is-error">${String(e?.message||'PRESET LIST FAILED')}</p>`;}}
function closePresetAnimations(){const dialog=$('#presetAnimationsDialog');if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
async function usePresetAnimation(id){try{const presets=await loadPresetManifest(),preset=presets.find(p=>String(p.id)===String(id));if(!preset)throw new Error('Preset animation was not found.');const response=await fetch(preset.src,{cache:'no-store'});if(!response.ok)throw new Error(`Could not load preset (${response.status}).`);const project=validateProject(await response.json());if(!confirm(`REPLACE THE CURRENT ANIMATION WITH PRESET:\n\n${String(preset.title||project.title||'UNTITLED').toUpperCase()}?`))return;editor.value=stringifyProject(project);state.time=0;closePresetAnimations();await applyEditor();setStatus(`PRESET LOADED // ${preset.title}`);}catch(e){setStatus(e?.message||'PRESET LOAD FAILED','error');}}

function uniqueAssetId(base,assets){let id=safeId(base),n=2;while(assets[id])id=`${safeId(base)}-${n++}`;return id;}
async function addSprites(files){
  if(!files?.length)return;let p;try{p=validateProject(JSON.parse(editor.value));}catch(e){setStatus(e.message,'error');return;}p.assets=p.assets||{};p.objects=p.objects||[];let offset=0,count=0;
  for(const file of files){if(!file.type.startsWith('image/'))continue;const id=uniqueAssetId(file.name.replace(/\.[^.]+$/,''),p.assets),url=URL.createObjectURL(file);state.localUrls.set(id,url);state.localUrls.set(file.name,url);state.localUrls.set(`./${file.name}`,url);p.assets[id]={type:'sprite',src:`./${file.name}`};if(p.mode==='3D')p.objects.push({id:`${id}-object`,type:'sprite',asset:id,x:(offset-((files.length-1)/2))*1.8,y:0,z:6,width:1.5,height:1.5,keyframes:[{t:0,rotationZ:-6},{t:p.duration/2,rotationZ:6},{t:p.duration,rotationZ:-6}]});else p.objects.push({id:`${id}-object`,type:'sprite',asset:id,x:p.canvas.width/2+offset*28,y:p.canvas.height/2,width:128,height:128,anchorX:.5,anchorY:.5,keyframes:[{t:0,rotation:-6},{t:p.duration/2,rotation:6},{t:p.duration,rotation:-6}]});offset++;count++;}
  editor.value=stringifyProject(p);await applyEditor();setStatus(`${count} SPRITE${count===1?'':'S'} ADDED`);
}
async function addAudio(files){
  if(!files?.length)return;let p;try{p=validateProject(JSON.parse(editor.value));}catch(e){setStatus(e.message,'error');return;}p.assets=p.assets||{};p.sounds=p.sounds||[];let count=0;
  for(const file of files){if(!file.type.startsWith('audio/'))continue;const id=uniqueAssetId(file.name.replace(/\.[^.]+$/,''),p.assets),url=URL.createObjectURL(file);state.localUrls.set(id,url);state.localUrls.set(file.name,url);state.localUrls.set(`./${file.name}`,url);p.assets[id]={type:'audio',src:`./${file.name}`};p.sounds.push({id:`${id}-clip`,asset:id,start:0,volume:1,pan:0,rate:1,loop:false});count++;}
  editor.value=stringifyProject(p);await applyEditor();setStatus(`${count} AUDIO FILE${count===1?'':'S'} ADDED`);
}

function refreshReference(){
  const mode=state.project?.mode||'2D';const rows=mode==='3D'?
    [['camera','spline keyframes + look-at + near/far clipping + smoothing'],['lighting','spatial ambient/directional/point lights + range/falloff/decay + parent'],['objects[]','group | box | sphere | plane | sprite'],['parent','inherit group/object transforms'],['post','exposure, vignette, letterbox, fade, flash, grain'],['sounds[]','asset, start/end, volume, pan, rate, keyframes']]:
    [['camera','2D pan/zoom/rotation/shake with spline keyframes'],['objects[]','group | bone | rect | circle | ellipse | polygon | path | text | sprite | emitter'],['hierarchy','recursive parent chains + pivots/skew'],['mask','mask / clipPath by object id'],['morph','keyframe points[] for vector shape morphing'],['clips','reusable clips{} keyframes via object.clip'],['particles','deterministic emitter rate/burst/life/speed/gravity'],['lighting','ambient + parentable point[] canvas lights'],['post','exposure, vignette, letterbox, fade, flash, grain'],['sounds[]','audio/tone cues on the timeline']];
  $('#schemaReference').innerHTML=rows.map(([a,b])=>`<div class="sad-reference-item"><b>${a}</b><small>${b}</small></div>`).join('');
  const entries=[];for(const [id,a] of Object.entries(state.project?.assets||{})){if(a?.type==='sprite'||a?.type==='audio'||a?.type==='tone')entries.push({id,type:a.type});}
  $('#spriteList').innerHTML=entries.length?entries.map(x=>`<div class="sad-reference-item"><b>${x.id}</b><small>${x.type.toUpperCase()} ASSET</small></div>`).join(''):'<p>NO MEDIA ASSETS LOADED.</p>';
}
function updateCursor(){const pos=editor.selectionStart,before=editor.value.slice(0,pos),line=before.split('\n').length,col=pos-(before.lastIndexOf('\n')+1)+1;$('#cursorInfo').textContent=`LINE ${line} // COL ${col}`;}

$('#applyJsonButton').addEventListener('click',applyEditor);$('#formatJsonButton').addEventListener('click',formatEditor);$('#saveJsonButton').addEventListener('click',saveJson);$('#playPauseButton').addEventListener('click',togglePlay);$('#stopButton').addEventListener('click',stop);
$('#playbackSpeed').addEventListener('change',async e=>{state.speed=Math.max(.01,Number(e.target.value)||1);if(state.playing)await syncAudio();});
$('#masterVolume').addEventListener('input',e=>{state.audio.volume=clamp(Number(e.target.value)||0,0,1);updateMasterVolume();});
$('#muteAudioButton').addEventListener('click',()=>{state.audio.muted=!state.audio.muted;updateMasterVolume();});
$('#timeline').addEventListener('input',async e=>{if(!state.project)return;state.time=Number(e.target.value)/1000*state.project.duration;state.lastFrame=0;renderFrame();if(state.playing)await syncAudio();});
$('[data-new="2D"]').addEventListener('click',()=>setExample('2D'));$('[data-new="3D"]').addEventListener('click',()=>setExample('3D'));
$('#openJsonButton').addEventListener('click',()=>$('#jsonFileInput').click());$('#clipboardJsonButton').addEventListener('click',loadJsonFromClipboard);$('#presetAnimationsButton').addEventListener('click',openPresetAnimations);$('#closePresetAnimationsButton').addEventListener('click',closePresetAnimations);$('#presetAnimationsDialog').addEventListener('click',e=>{if(e.target===e.currentTarget)closePresetAnimations();});$('#presetAnimationsGrid').addEventListener('click',e=>{const button=e.target.closest('[data-sad-preset]');if(button)usePresetAnimation(button.dataset.sadPreset);});$('#addSpriteButton').addEventListener('click',()=>$('#spriteFileInput').click());$('#addAudioButton').addEventListener('click',()=>$('#audioFileInput').click());
$('#jsonFileInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadJsonFile(f);e.target.value='';});$('#spriteFileInput').addEventListener('change',e=>{addSprites([...e.target.files]);e.target.value='';});$('#audioFileInput').addEventListener('change',e=>{addAudio([...e.target.files]);e.target.value='';});
editor.addEventListener('keyup',updateCursor);editor.addEventListener('click',updateCursor);editor.addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();const s=editor.selectionStart,en=editor.selectionEnd;editor.setRangeText('  ',s,en,'end');updateCursor();}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();applyEditor();}});
const drop=$('#dropZone');for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('is-dragging');});for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('is-dragging');});drop.addEventListener('drop',e=>{const files=[...e.dataTransfer.files],json=files.find(f=>f.name.toLowerCase().endsWith('.json')),sprites=files.filter(f=>f.type.startsWith('image/')),audio=files.filter(f=>f.type.startsWith('audio/'));if(json)loadJsonFile(json);if(sprites.length)addSprites(sprites);if(audio.length)addAudio(audio);});
window.addEventListener('beforeunload',()=>{stopAllAudio();for(const url of new Set(state.localUrls.values()))URL.revokeObjectURL(url);try{state.audio.ctx?.close();}catch(_){}});

setExample('2D');
