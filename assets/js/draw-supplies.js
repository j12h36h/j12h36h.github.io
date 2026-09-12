const DB_NAME = 'eras_draw_supplies_v1';
const DB_VERSION = 1;
const STORE_NAME = 'items';
const CHANNEL_NAME = 'eras_draw_supplies';

let dbPromise = null;
let channel = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded = () => {
      const db=request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store=db.createObjectStore(STORE_NAME,{keyPath:'id'});
        store.createIndex('kind','kind',{unique:false});
        store.createIndex('packId','packId',{unique:false});
        store.createIndex('installedAt','installedAt',{unique:false});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error('Could not open local DRAW Supplies database.'));
  });
  return dbPromise;
}

function txPromise(mode,callback) {
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,mode);
    const store=tx.objectStore(STORE_NAME);
    let result;
    try { result=callback(store,tx); }
    catch (error) { reject(error); return; }
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error || new Error('DRAW Supplies database transaction failed.'));
    tx.onabort=()=>reject(tx.error || new Error('DRAW Supplies database transaction was aborted.'));
  }));
}

function notifyChanged() {
  try {
    if (!channel && 'BroadcastChannel' in window) channel=new BroadcastChannel(CHANNEL_NAME);
    channel?.postMessage({type:'changed',at:Date.now()});
  } catch (_) {}
  window.dispatchEvent(new CustomEvent('eras-draw-supplies-changed'));
}

export function onDrawSuppliesChanged(callback) {
  if (typeof callback !== 'function') return () => {};
  const local=()=>callback();
  window.addEventListener('eras-draw-supplies-changed',local);

  let bc=null;
  try {
    if ('BroadcastChannel' in window) {
      bc=new BroadcastChannel(CHANNEL_NAME);
      bc.addEventListener('message',event=>{
        if (event?.data?.type==='changed') callback();
      });
    }
  } catch (_) {}

  return ()=>{
    window.removeEventListener('eras-draw-supplies-changed',local);
    try { bc?.close(); } catch (_) {}
  };
}

export function normalizeSupplyKind(value='image') {
  const kind=String(value||'').trim().toLowerCase();
  if (['brush','brushes','stamp','stamps'].includes(kind)) return 'brush';
  if (['sprite','sprites'].includes(kind)) return 'sprite';
  return 'image';
}

function safeToken(value='supply') {
  return String(value||'supply')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,96) || 'supply';
}

function randomId(prefix='device') {
  return `${prefix}:${Date.now().toString(36)}:${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
}

function requestResult(request) {
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error('IndexedDB request failed.'));
  });
}

export async function listDrawSupplies() {
  const db=await openDb();
  const tx=db.transaction(STORE_NAME,'readonly');
  const items=await requestResult(tx.objectStore(STORE_NAME).getAll());
  return (items||[]).sort((a,b)=>{
    const ak=String(a.kind||'image'),bk=String(b.kind||'image');
    if (ak!==bk) return ak.localeCompare(bk);
    return String(a.name||'').localeCompare(String(b.name||''),undefined,{numeric:true,sensitivity:'base'});
  });
}

export async function getDrawSupply(id='') {
  if (!id) return null;
  const db=await openDb();
  const tx=db.transaction(STORE_NAME,'readonly');
  return await requestResult(tx.objectStore(STORE_NAME).get(String(id))) || null;
}

export async function deleteDrawSupply(id='') {
  if (!id) return false;
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).delete(String(id));
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error || new Error('Could not delete local Supply.'));
  });
  notifyChanged();
  return true;
}

async function imageFromBlob(blob) {
  if (!blob) throw new Error('Image blob is missing.');
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob); } catch (_) {}
  }
  const url=URL.createObjectURL(blob);
  try {
    const image=new Image();
    image.decoding='async';
    image.src=url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function normalizeBrushBlob(blob) {
  const image=await imageFromBlob(blob);
  const maxSide=256;
  const scale=Math.min(1,maxSide/Math.max(1,image.width||image.naturalWidth,image.height||image.naturalHeight));
  const width=Math.max(1,Math.round((image.width||image.naturalWidth)*scale));
  const height=Math.max(1,Math.round((image.height||image.naturalHeight)*scale));
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.clearRect(0,0,width,height);
  ctx.drawImage(image,0,0,width,height);

  const pixels=ctx.getImageData(0,0,width,height);
  const data=pixels.data;
  let hasTransparency=false;
  for (let i=3;i<data.length;i+=4) {
    if (data[i]<250) { hasTransparency=true; break; }
  }

  if (hasTransparency) {
    for (let i=0;i<data.length;i+=4) {
      data[i]=255; data[i+1]=255; data[i+2]=255;
    }
  } else {
    // For ordinary black-on-white brush images, convert luminance to alpha.
    for (let i=0;i<data.length;i+=4) {
      const luminance=Math.round(data[i]*0.2126 + data[i+1]*0.7152 + data[i+2]*0.0722);
      data[i]=255; data[i+1]=255; data[i+2]=255;
      data[i+3]=255-luminance;
    }
  }

  ctx.putImageData(pixels,0,0);
  return await new Promise((resolve,reject)=>{
    canvas.toBlob(result=>result?resolve(result):reject(new Error('Could not normalize brush image.')),'image/png');
  });
}

async function storeItem(record) {
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error || new Error('Could not store local Supply.'));
  });
  notifyChanged();
  return record;
}

export async function importDrawSupplyFiles(files,kind='image') {
  const normalizedKind=normalizeSupplyKind(kind);
  const results=[];
  for (const file of Array.from(files||[])) {
    if (!file || !String(file.type||'').startsWith('image/')) {
      results.push({ok:false,name:file?.name||'Unknown file',error:'Only image files can be imported as DRAW Supplies.'});
      continue;
    }
    try {
      const blob=normalizedKind==='brush' ? await normalizeBrushBlob(file) : file.slice(0,file.size,file.type||'image/png');
      const record={
        id:randomId('device'),
        name:String(file.name||'Local Supply').replace(/\.[^.]+$/,'').slice(0,120),
        kind:normalizedKind,
        origin:'device',
        packId:'',
        packName:'',
        sourceName:String(file.name||''),
        mimeType:blob.type||file.type||'image/png',
        blob,
        installedAt:Date.now()
      };
      await storeItem(record);
      results.push({ok:true,item:record});
    } catch (error) {
      results.push({ok:false,name:file.name,error:String(error?.message||error)});
    }
  }
  return results;
}

export function supplyItemCount(asset) {
  const items=asset?.supplyData?.items;
  return Array.isArray(items) ? items.length : 0;
}

export async function isDrawSupplyPackInstalled(packId='') {
  if (!packId) return false;
  const items=await listDrawSupplies();
  return items.some(item=>String(item.packId||'')===String(packId));
}

export async function installDrawSupplyPack(asset) {
  const packId=String(asset?.id||'').trim();
  const packName=String(asset?.displayName||asset?.name||'Supplies Pack').trim() || 'Supplies Pack';
  const entries=Array.isArray(asset?.supplyData?.items) ? asset.supplyData.items : [];
  if (!packId || !entries.length) throw new Error('This Supplies asset has no installable items.');

  const results=[];
  for (const entry of entries) {
    const source=String(entry?.source||'').trim();
    if (!source) {
      results.push({ok:false,name:String(entry?.name||'Supply'),error:'Missing source.'});
      continue;
    }

    try {
      const response=await fetch(source,{cache:'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let blob=await response.blob();
      const kind=normalizeSupplyKind(entry?.kind);
      if (kind==='brush') blob=await normalizeBrushBlob(blob);

      const record={
        id:`public:${safeToken(packId)}:${safeToken(entry?.id || entry?.name || source)}`,
        name:String(entry?.name||source.split('/').pop()||'Supply').replace(/\.[^.]+$/,'').slice(0,120),
        kind,
        origin:'public',
        packId,
        packName,
        sourceName:source,
        mimeType:blob.type||'image/png',
        blob,
        installedAt:Date.now()
      };
      await storeItem(record);
      results.push({ok:true,item:record});
    } catch (error) {
      results.push({ok:false,name:String(entry?.name||source),error:String(error?.message||error)});
    }
  }

  const installed=results.filter(result=>result.ok).length;
  if (!installed) {
    throw new Error(results[0]?.error || 'No Supplies could be installed.');
  }

  notifyChanged();
  return {
    ok:true,
    installed,
    failed:results.length-installed,
    results,
    packId,
    packName
  };
}
