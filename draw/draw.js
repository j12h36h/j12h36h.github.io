const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const state={
  name:'Untitled Sprite',
  width:128,height:128,
  zoom:4,
  tool:'pencil',
  primary:'#d39a62',
  secondary:'#392114',
  brushSize:4,
  toolOpacity:1,
  fillShapes:false,
  pixelPerfect:true,
  frames:[],
  frameIndex:0,
  layerIndex:0,
  drawing:false,
  start:null,
  last:null,
  undo:[],
  redo:[],
  maxHistory:40
};

const display=$('#displayCanvas'),preview=$('#previewCanvas');
const dctx=display.getContext('2d',{willReadFrequently:true});
const pctx=preview.getContext('2d');
dctx.imageSmoothingEnabled=false;pctx.imageSmoothingEnabled=false;

function say(message,tone=''){
  const el=$('#drawFeedback');if(!el)return;
  el.textContent=String(message).toUpperCase();el.dataset.tone=tone;
}
function clamp(v,min,max){return Math.max(min,Math.min(max,Number(v)||0))}
function fileSafe(value){return String(value||'graphic').trim().replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'')||'graphic'}
function makeLayer(name='Layer'){
  const canvas=document.createElement('canvas');canvas.width=state.width;canvas.height=state.height;
  return {id:crypto.randomUUID(),name,visible:true,opacity:1,canvas};
}
function makeFrame(copy=null){
  if(copy){
    return {id:crypto.randomUUID(),layers:copy.layers.map(layer=>{
      const next=makeLayer(layer.name);next.visible=layer.visible;next.opacity=layer.opacity;
      next.canvas.getContext('2d').drawImage(layer.canvas,0,0);return next;
    })};
  }
  return {id:crypto.randomUUID(),layers:[makeLayer('Layer 1')]};
}
function frame(){return state.frames[state.frameIndex]}
function layer(){return frame()?.layers[state.layerIndex]||null}
function activeCtx(){return layer()?.canvas.getContext('2d',{willReadFrequently:true})||null}
function resetHistory(){state.undo=[];state.redo=[];updateHistoryButtons()}
function updateHistoryButtons(){
  $('#undoButton').disabled=!state.undo.length;$('#redoButton').disabled=!state.redo.length;
}
function snapshot(){
  return {
    frameIndex:state.frameIndex,layerIndex:state.layerIndex,
    frames:state.frames.map(f=>({id:f.id,layers:f.layers.map(l=>({
      id:l.id,name:l.name,visible:l.visible,opacity:l.opacity,data:l.canvas.toDataURL('image/png')
    }))}))
  };
}
async function restoreSnapshot(snap){
  state.frames=[];
  for(const f of snap.frames){
    const next={id:f.id,layers:[]};
    for(const l of f.layers){
      const nl=makeLayer(l.name);nl.id=l.id;nl.visible=l.visible;nl.opacity=l.opacity;
      await drawDataUrl(nl.canvas,l.data);next.layers.push(nl);
    }
    state.frames.push(next);
  }
  state.frameIndex=clamp(snap.frameIndex,0,state.frames.length-1);
  state.layerIndex=clamp(snap.layerIndex,0,frame().layers.length-1);
  renderAll();
}
function pushHistory(){
  state.undo.push(snapshot());if(state.undo.length>state.maxHistory)state.undo.shift();
  state.redo=[];updateHistoryButtons();
}
async function undo(){
  if(!state.undo.length)return;
  state.redo.push(snapshot());const snap=state.undo.pop();await restoreSnapshot(snap);updateHistoryButtons();say('Undo','ok');
}
async function redo(){
  if(!state.redo.length)return;
  state.undo.push(snapshot());const snap=state.redo.pop();await restoreSnapshot(snap);updateHistoryButtons();say('Redo','ok');
}
function resizeCanvas(canvas,w,h,preserve=true){
  const temp=document.createElement('canvas');temp.width=canvas.width;temp.height=canvas.height;temp.getContext('2d').drawImage(canvas,0,0);
  canvas.width=w;canvas.height=h;
  if(preserve)canvas.getContext('2d').drawImage(temp,0,0);
}
function setDocumentSize(w,h,preserve=true){
  w=Math.round(clamp(w,1,4096));h=Math.round(clamp(h,1,4096));
  state.width=w;state.height=h;
  for(const f of state.frames)for(const l of f.layers)resizeCanvas(l.canvas,w,h,preserve);
  display.width=preview.width=w;display.height=preview.height=h;
  $('#docWidth').value=w;$('#docHeight').value=h;
  $('#documentDimensions').textContent=`${w} × ${h}`;
  applyZoom();renderAll();
}
function newDocument(name,w,h,bg='transparent'){
  state.name=String(name||'Untitled Sprite').trim().slice(0,80)||'Untitled Sprite';
  state.width=Math.round(clamp(w,1,4096));state.height=Math.round(clamp(h,1,4096));
  state.frames=[makeFrame()];state.frameIndex=0;state.layerIndex=0;
  display.width=preview.width=state.width;display.height=preview.height=state.height;
  if(bg!=='transparent'){
    const ctx=activeCtx();ctx.fillStyle=bg==='white'?'#ffffff':state.primary;ctx.fillRect(0,0,state.width,state.height);
  }
  resetHistory();fitZoom();renderAll();say(`Created ${state.name}`,'ok');
}
function compositeFrame(f=frame(),target=dctx){
  target.clearRect(0,0,state.width,state.height);
  target.imageSmoothingEnabled=!state.pixelPerfect;
  for(const l of f.layers){
    if(!l.visible)continue;
    target.save();target.globalAlpha=l.opacity;target.drawImage(l.canvas,0,0);target.restore();
  }
}
function renderCanvas(){compositeFrame();pctx.clearRect(0,0,state.width,state.height)}
function thumbnailForFrame(f){
  const c=document.createElement('canvas');c.width=state.width;c.height=state.height;compositeFrame(f,c.getContext('2d'));return c.toDataURL('image/png');
}
function renderLayers(){
  const root=$('#layerList');root.innerHTML='';
  [...frame().layers].map((l,i)=>({l,i})).reverse().forEach(({l,i})=>{
    const row=document.createElement('div');row.className='draw-layer-item'+(i===state.layerIndex?' is-active':'');
    row.innerHTML=`<img class="draw-layer-thumb" alt=""><div><b></b><small>${Math.round(l.opacity*100)}% OPACITY</small></div><button class="draw-layer-visibility" type="button">${l.visible?'●':'○'}</button>`;
    row.querySelector('img').src=l.canvas.toDataURL('image/png');row.querySelector('b').textContent=l.name;
    row.addEventListener('click',e=>{if(e.target.closest('.draw-layer-visibility'))return;state.layerIndex=i;renderLayers();syncLayerProps()});
    row.querySelector('.draw-layer-visibility').addEventListener('click',e=>{e.stopPropagation();pushHistory();l.visible=!l.visible;renderAll()});
    root.appendChild(row);
  });
}
function renderFrames(){
  const root=$('#frameList');root.innerHTML='';
  state.frames.forEach((f,i)=>{
    const row=document.createElement('div');row.className='draw-frame-item'+(i===state.frameIndex?' is-active':'');
    row.innerHTML=`<img class="draw-frame-thumb" alt=""><div><b>FRAME ${String(i+1).padStart(2,'0')}</b><small>${f.layers.length} LAYER${f.layers.length===1?'':'S'}</small></div>`;
    row.querySelector('img').src=thumbnailForFrame(f);
    row.addEventListener('click',()=>{state.frameIndex=i;state.layerIndex=Math.min(state.layerIndex,frame().layers.length-1);renderAll()});
    root.appendChild(row);
  });
  $('#activeFrameNumber').textContent=String(state.frameIndex+1).padStart(2,'0');
}
function syncLayerProps(){$('#layerOpacity').value=layer()?.opacity??1}
function renderAll(){
  $('#documentName').textContent=state.name.toUpperCase();
  $('#documentDimensions').textContent=`${state.width} × ${state.height}`;
  $('#docWidth').value=state.width;$('#docHeight').value=state.height;
  renderCanvas();renderLayers();renderFrames();syncLayerProps();applyZoom();updateHistoryButtons();
}
function applyZoom(){
  const holder=$('#canvasHolder'),scale=state.zoom;
  holder.style.width=`${state.width*scale}px`;holder.style.height=`${state.height*scale}px`;
  holder.style.setProperty('--grid-size',`${scale}px`);
  $('#zoomReadout').textContent=`${Math.round(scale*100)}%`;
  $('#zoomSlider').value=Math.round(scale*100);
  const show=$('#showGrid').checked&&scale>=4;
  $('#pixelGrid').classList.toggle('is-hidden',!show);
}
function setZoom(percent){
  state.zoom=clamp(percent,25,1600)/100;applyZoom();
}
function fitZoom(){
  const stage=$('#drawStage'),rect=stage.getBoundingClientRect();
  const scale=Math.min((Math.max(180,rect.width)-70)/state.width,(Math.max(180,rect.height)-70)/state.height,8);
  state.zoom=Math.max(.25,Math.floor(scale*4)/4);applyZoom();
}
function canvasPoint(e){
  const rect=display.getBoundingClientRect();
  return {
    x:clamp(Math.floor((e.clientX-rect.left)/rect.width*state.width),0,state.width-1),
    y:clamp(Math.floor((e.clientY-rect.top)/rect.height*state.height),0,state.height-1)
  };
}
function prepareCtx(ctx,erase=false){
  ctx.globalAlpha=state.toolOpacity;ctx.lineWidth=state.brushSize;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle=state.primary;ctx.fillStyle=state.primary;ctx.globalCompositeOperation=erase?'destination-out':'source-over';
  ctx.imageSmoothingEnabled=!state.pixelPerfect;
}
function drawDot(ctx,p,erase=false){
  prepareCtx(ctx,erase);ctx.beginPath();ctx.arc(p.x+.5,p.y+.5,Math.max(.5,state.brushSize/2),0,Math.PI*2);ctx.fill();
}
function drawSegment(ctx,a,b,erase=false){
  prepareCtx(ctx,erase);ctx.beginPath();ctx.moveTo(a.x+.5,a.y+.5);ctx.lineTo(b.x+.5,b.y+.5);ctx.stroke();
}
function constrainPoint(a,b,tool,e){
  if(!e.shiftKey)return b;
  const dx=b.x-a.x,dy=b.y-a.y;
  if(tool==='line'){
    const angle=Math.atan2(dy,dx),step=Math.PI/4,q=Math.round(angle/step)*step,len=Math.hypot(dx,dy);
    return {x:Math.round(a.x+Math.cos(q)*len),y:Math.round(a.y+Math.sin(q)*len)};
  }
  const size=Math.max(Math.abs(dx),Math.abs(dy));
  return {x:a.x+Math.sign(dx||1)*size,y:a.y+Math.sign(dy||1)*size};
}
function previewShape(tool,a,b,e){
  b=constrainPoint(a,b,tool,e);pctx.clearRect(0,0,state.width,state.height);prepareCtx(pctx,false);
  pctx.globalAlpha=state.toolOpacity;
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
  if(tool==='line'){pctx.beginPath();pctx.moveTo(a.x+.5,a.y+.5);pctx.lineTo(b.x+.5,b.y+.5);pctx.stroke()}
  if(tool==='rect'){state.fillShapes?pctx.fillRect(x,y,w||1,h||1):pctx.strokeRect(x+.5,y+.5,w,h)}
  if(tool==='ellipse'){pctx.beginPath();pctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.max(.5,w/2),Math.max(.5,h/2),0,0,Math.PI*2);state.fillShapes?pctx.fill():pctx.stroke()}
  return b;
}
function commitShape(tool,a,b,e){
  const ctx=activeCtx();b=constrainPoint(a,b,tool,e);prepareCtx(ctx,false);
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(b.x-a.x),h=Math.abs(b.y-a.y);
  if(tool==='line'){ctx.beginPath();ctx.moveTo(a.x+.5,a.y+.5);ctx.lineTo(b.x+.5,b.y+.5);ctx.stroke()}
  if(tool==='rect'){state.fillShapes?ctx.fillRect(x,y,w||1,h||1):ctx.strokeRect(x+.5,y+.5,w,h)}
  if(tool==='ellipse'){ctx.beginPath();ctx.ellipse((a.x+b.x)/2,(a.y+b.y)/2,Math.max(.5,w/2),Math.max(.5,h/2),0,0,Math.PI*2);state.fillShapes?ctx.fill():ctx.stroke()}
}
function colorAt(p){
  const data=dctx.getImageData(p.x,p.y,1,1).data;
  return '#'+[data[0],data[1],data[2]].map(n=>n.toString(16).padStart(2,'0')).join('');
}
function floodFill(ctx,x,y,hex){
  const img=ctx.getImageData(0,0,state.width,state.height),data=img.data,idx=(y*state.width+x)*4;
  const target=[data[idx],data[idx+1],data[idx+2],data[idx+3]],fill=hexToRgba(hex,Math.round(255*state.toolOpacity));
  if(target.every((v,i)=>v===fill[i]))return;
  const match=i=>data[i]===target[0]&&data[i+1]===target[1]&&data[i+2]===target[2]&&data[i+3]===target[3];
  const stack=[[x,y]],seen=new Uint8Array(state.width*state.height);
  while(stack.length){
    const [px,py]=stack.pop();if(px<0||py<0||px>=state.width||py>=state.height)continue;
    const si=py*state.width+px;if(seen[si])continue;seen[si]=1;const i=si*4;if(!match(i))continue;
    data[i]=fill[0];data[i+1]=fill[1];data[i+2]=fill[2];data[i+3]=fill[3];
    stack.push([px+1,py],[px-1,py],[px,py+1],[px,py-1]);
  }
  ctx.putImageData(img,0,0);
}
function hexToRgba(hex,a=255){
  const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255,a];
}
function setTool(tool){
  state.tool=tool;$$('[data-tool]').forEach(b=>b.classList.toggle('is-active',b.dataset.tool===tool));
  $('#activeToolLabel').textContent=tool.toUpperCase();display.style.cursor=tool==='eyedropper'?'crosshair':tool==='text'?'text':'crosshair';
}
function textTool(p){
  const text=prompt('Text to place:','TEXT');if(!text)return;
  const size=Math.max(4,state.brushSize*4),ctx=activeCtx();prepareCtx(ctx,false);
  ctx.font=`700 ${size}px sans-serif`;ctx.textBaseline='top';ctx.fillText(text,p.x,p.y);renderAll();
}
function pointerDown(e){
  if(e.button!==0&&e.pointerType!=='touch')return;
  e.preventDefault();display.setPointerCapture?.(e.pointerId);
  const p=canvasPoint(e);state.start=p;state.last=p;
  if(state.tool==='eyedropper'){state.primary=colorAt(p);$('#primaryColor').value=state.primary;say(`Picked ${state.primary}`,'ok');return}
  if(state.tool==='fill'){pushHistory();floodFill(activeCtx(),p.x,p.y,state.primary);renderAll();return}
  if(state.tool==='text'){pushHistory();textTool(p);return}
  pushHistory();state.drawing=true;
  if(state.tool==='pencil'||state.tool==='eraser'){drawDot(activeCtx(),p,state.tool==='eraser');renderCanvas()}
}
function pointerMove(e){
  const p=canvasPoint(e);$('#cursorPosition').textContent=`X ${p.x} // Y ${p.y}`;
  if(!state.drawing)return;
  if(state.tool==='pencil'||state.tool==='eraser'){
    drawSegment(activeCtx(),state.last,p,state.tool==='eraser');state.last=p;renderCanvas();
  }else previewShape(state.tool,state.start,p,e);
}
function pointerUp(e){
  if(!state.drawing)return;const p=canvasPoint(e);state.drawing=false;
  if(['line','rect','ellipse'].includes(state.tool))commitShape(state.tool,state.start,p,e);
  pctx.clearRect(0,0,state.width,state.height);renderAll();
}
function addLayer(){
  pushHistory();frame().layers.push(makeLayer(`Layer ${frame().layers.length+1}`));state.layerIndex=frame().layers.length-1;renderAll()
}
function duplicateLayer(){
  const src=layer();if(!src)return;pushHistory();const copy=makeLayer(`${src.name} Copy`);copy.opacity=src.opacity;copy.visible=src.visible;copy.canvas.getContext('2d').drawImage(src.canvas,0,0);
  frame().layers.splice(state.layerIndex+1,0,copy);state.layerIndex++;renderAll()
}
function deleteLayer(){
  if(frame().layers.length<=1){say('A frame must keep at least one layer','error');return}
  pushHistory();frame().layers.splice(state.layerIndex,1);state.layerIndex=Math.min(state.layerIndex,frame().layers.length-1);renderAll()
}
function moveLayer(dir){
  const target=state.layerIndex+dir;if(target<0||target>=frame().layers.length)return;pushHistory();
  const arr=frame().layers,[item]=arr.splice(state.layerIndex,1);arr.splice(target,0,item);state.layerIndex=target;renderAll()
}
function addFrame(copy=false){
  pushHistory();const f=makeFrame(copy?frame():null);state.frames.splice(state.frameIndex+1,0,f);state.frameIndex++;state.layerIndex=0;renderAll()
}
function deleteFrame(){
  if(state.frames.length<=1){say('A project must keep at least one frame','error');return}
  pushHistory();state.frames.splice(state.frameIndex,1);state.frameIndex=Math.min(state.frameIndex,state.frames.length-1);state.layerIndex=0;renderAll()
}
function loadImageFile(file,mode='document'){
  if(!file)return;const reader=new FileReader();
  reader.onload=()=>{
    const img=new Image();img.onload=()=>{
      if(mode==='document'){
        state.name=file.name.replace(/\.[^.]+$/,'');state.width=img.naturalWidth;state.height=img.naturalHeight;state.frames=[makeFrame()];state.frameIndex=0;state.layerIndex=0;
        display.width=preview.width=state.width;display.height=preview.height=state.height;activeCtx().drawImage(img,0,0);resetHistory();fitZoom();renderAll();say(`Opened ${file.name}`,'ok');
      }else{
        pushHistory();const l=makeLayer(file.name.replace(/\.[^.]+$/,''));l.canvas.getContext('2d').drawImage(img,0,0,state.width,state.height);
        frame().layers.push(l);state.layerIndex=frame().layers.length-1;renderAll();say(`Imported ${file.name}`,'ok');
      }
    };img.src=String(reader.result)
  };reader.readAsDataURL(file)
}
function drawDataUrl(canvas,url){
  return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{canvas.getContext('2d').drawImage(img,0,0);resolve()};img.onerror=reject;img.src=url})
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)
}
function canvasBlob(canvas,type='image/png'){return new Promise(resolve=>canvas.toBlob(resolve,type))}
async function exportPng(){
  const c=document.createElement('canvas');c.width=state.width;c.height=state.height;compositeFrame(frame(),c.getContext('2d'));
  downloadBlob(await canvasBlob(c),`${fileSafe(state.name)}_frame_${String(state.frameIndex+1).padStart(2,'0')}.png`);say('PNG exported','ok')
}
async function exportSheet(){
  const cols=Math.round(clamp($('#sheetColumns').value,1,64)),rows=Math.ceil(state.frames.length/cols);
  const c=document.createElement('canvas');c.width=state.width*cols;c.height=state.height*rows;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
  state.frames.forEach((f,i)=>{const fc=document.createElement('canvas');fc.width=state.width;fc.height=state.height;compositeFrame(f,fc.getContext('2d'));ctx.drawImage(fc,(i%cols)*state.width,Math.floor(i/cols)*state.height)});
  downloadBlob(await canvasBlob(c),`${fileSafe(state.name)}_spritesheet.png`);say(`Spritesheet exported // ${cols} columns`,'ok')
}
function projectObject(){
  return {
    format:'eras.draw',version:1,name:state.name,width:state.width,height:state.height,
    frames:state.frames.map(f=>({id:f.id,layers:f.layers.map(l=>({id:l.id,name:l.name,visible:l.visible,opacity:l.opacity,png:l.canvas.toDataURL('image/png')}))}))
  }
}
function saveProject(){
  downloadBlob(new Blob([JSON.stringify(projectObject())],{type:'application/json'}),`${fileSafe(state.name)}.erasdraw.json`);say('Project saved','ok')
}
async function openProjectFile(file){
  try{
    const raw=JSON.parse(await file.text());if(raw.format!=='eras.draw'||raw.version!==1||!Array.isArray(raw.frames))throw new Error('Unsupported DRAW project');
    state.name=String(raw.name||'DRAW Project');state.width=Math.round(clamp(raw.width,1,4096));state.height=Math.round(clamp(raw.height,1,4096));state.frames=[];
    display.width=preview.width=state.width;display.height=preview.height=state.height;
    for(const rf of raw.frames){
      const f={id:rf.id||crypto.randomUUID(),layers:[]};
      for(const rl of rf.layers||[]){
        const l=makeLayer(rl.name||'Layer');l.id=rl.id||crypto.randomUUID();l.visible=rl.visible!==false;l.opacity=clamp(rl.opacity??1,0,1);
        if(rl.png)await drawDataUrl(l.canvas,rl.png);f.layers.push(l);
      }
      if(!f.layers.length)f.layers.push(makeLayer('Layer 1'));state.frames.push(f);
    }
    if(!state.frames.length)state.frames=[makeFrame()];
    state.frameIndex=0;state.layerIndex=0;resetHistory();fitZoom();renderAll();say(`Opened ${file.name}`,'ok')
  }catch(err){console.error(err);say(`Could not open project: ${err.message}`,'error')}
}

$$('[data-tool]').forEach(btn=>btn.addEventListener('click',()=>setTool(btn.dataset.tool)));
$('#primaryColor').addEventListener('input',e=>state.primary=e.target.value);
$('#secondaryColor').addEventListener('input',e=>state.secondary=e.target.value);
$('#swapColors').addEventListener('click',()=>{[state.primary,state.secondary]=[state.secondary,state.primary];$('#primaryColor').value=state.primary;$('#secondaryColor').value=state.secondary});
$('#brushSize').addEventListener('input',e=>{state.brushSize=Number(e.target.value);$('#brushSizeOut').textContent=`${state.brushSize} px`});
$('#toolOpacity').addEventListener('input',e=>{state.toolOpacity=Number(e.target.value);$('#toolOpacityOut').textContent=`${Math.round(state.toolOpacity*100)}%`});
$('#shapeFill').addEventListener('change',e=>state.fillShapes=e.target.checked);
$('#pixelPerfect').addEventListener('change',e=>{state.pixelPerfect=e.target.checked;renderCanvas()});
$('#showGrid').addEventListener('change',applyZoom);
$('#zoomSlider').addEventListener('input',e=>setZoom(e.target.value));
$('#zoomOut').addEventListener('click',()=>setZoom(state.zoom*100-50));
$('#zoomIn').addEventListener('click',()=>setZoom(state.zoom*100+50));
$('#fitCanvas').addEventListener('click',fitZoom);
$('#newDocument').addEventListener('click',()=>$('#newDialog').showModal());
$('#createDocument').addEventListener('click',e=>{e.preventDefault();newDocument($('#newName').value,$('#newWidth').value,$('#newHeight').value,$('#newBackground').value);$('#newDialog').close()});
$('#openProject').addEventListener('click',()=>$('#projectFileInput').click());
$('#openImage').addEventListener('click',()=>$('#imageFileInput').click());
$('#importLayer').addEventListener('click',()=>$('#layerFileInput').click());
$('#saveProject').addEventListener('click',saveProject);
$('#exportPng').addEventListener('click',exportPng);
$('#exportSheet').addEventListener('click',exportSheet);
$('#undoButton').addEventListener('click',undo);$('#redoButton').addEventListener('click',redo);
$('#addLayer').addEventListener('click',addLayer);$('#duplicateLayer').addEventListener('click',duplicateLayer);$('#deleteLayer').addEventListener('click',deleteLayer);
$('#layerUp').addEventListener('click',()=>moveLayer(1));$('#layerDown').addEventListener('click',()=>moveLayer(-1));
$('#layerOpacity').addEventListener('input',e=>{pushHistory();layer().opacity=Number(e.target.value);renderAll()});
$('#addFrame').addEventListener('click',()=>addFrame(false));$('#duplicateFrame').addEventListener('click',()=>addFrame(true));$('#deleteFrame').addEventListener('click',deleteFrame);
$('#resizeDocument').addEventListener('click',()=>{pushHistory();setDocumentSize($('#docWidth').value,$('#docHeight').value,true);say('Canvas resized','ok')});
$$('[data-size]').forEach(b=>b.addEventListener('click',()=>{$('#docWidth').value=b.dataset.size;$('#docHeight').value=b.dataset.size}));
$('#projectFileInput').addEventListener('change',e=>{openProjectFile(e.target.files?.[0]);e.target.value=''});
$('#imageFileInput').addEventListener('change',e=>{loadImageFile(e.target.files?.[0],'document');e.target.value=''});
$('#layerFileInput').addEventListener('change',e=>{loadImageFile(e.target.files?.[0],'layer');e.target.value=''});

display.addEventListener('pointerdown',pointerDown);display.addEventListener('pointermove',pointerMove);display.addEventListener('pointerup',pointerUp);display.addEventListener('pointercancel',pointerUp);
display.addEventListener('contextmenu',e=>e.preventDefault());

document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return}
  if(mod&&e.code==='KeyY'){e.preventDefault();redo();return}
  const map={KeyB:'pencil',KeyE:'eraser',KeyL:'line',KeyR:'rect',KeyO:'ellipse',KeyG:'fill',KeyI:'eyedropper',KeyT:'text'};
  if(map[e.code]){e.preventDefault();setTool(map[e.code]);return}
  if(e.code==='BracketLeft'){state.brushSize=Math.max(1,state.brushSize-1);$('#brushSize').value=state.brushSize;$('#brushSizeOut').textContent=`${state.brushSize} px`}
  if(e.code==='BracketRight'){state.brushSize=Math.min(64,state.brushSize+1);$('#brushSize').value=state.brushSize;$('#brushSizeOut').textContent=`${state.brushSize} px`}
  if(e.code==='Equal'||e.code==='NumpadAdd'){e.preventDefault();setZoom(state.zoom*100+50)}
  if(e.code==='Minus'||e.code==='NumpadSubtract'){e.preventDefault();setZoom(state.zoom*100-50)}
});

newDocument('Untitled Sprite',128,128,'transparent');
setTool('pencil');
