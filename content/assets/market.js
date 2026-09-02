import { auth, db, fs, watchIdentity } from '/game/assets/js/eras-data.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';
import { openOptionPicker } from '/game/assets/js/hosted-option-picker.js?v=1.0.0';
import { assetPreviewUrl, assetIsTintable, assetDefaultTint, assetOption, assetPriceCredits } from '/game/assets/js/catalog-assets.js?v=1.0.0';

const $ = s => document.querySelector(s);
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeTint = value => /^#[0-9a-fA-F]{6}$/.test(String(value||'')) ? String(value) : '#ffffff';
const state = { identity:null, catalog:{assets:[]}, asset:null, inventoryUnsub:null, creditUnsub:null, creditBalance:0, image:null, holdings:[] };

function say(message, tone='') { const el=$('#assetFeedback'); if(!el)return; el.textContent=String(message).toUpperCase(); el.dataset.tone=tone; }
function assetById(id){ return state.catalog.assets.find(a=>a.id===id) || null; }
function categoryLabel(asset){ return `${String(asset?.type||'asset').toUpperCase()} // ${String(asset?.category||'general').replace(/[-_]/g,' ').toUpperCase()}`; }

function renderTint(tint, canvas, image=state.image) {
  if (!image || !canvas) return;
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.drawImage(image,0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation='multiply'; ctx.fillStyle=tint; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation='destination-in'; ctx.drawImage(image,0,0,canvas.width,canvas.height); ctx.globalCompositeOperation='source-over';
}

async function renderSelectedAsset(){
  const asset=state.asset; if(!asset)return;
  $('#assetName').textContent=asset.name||asset.id; $('#assetDescription').textContent=asset.description||''; $('#assetType').textContent=categoryLabel(asset);
  $('#assetTags').innerHTML=(asset.tags||[]).slice(0,8).map(t=>`<span>${escapeHtml(String(t).toUpperCase())}</span>`).join('');
  const price=assetPriceCredits(asset), tag=$('#assetPriceTag'); tag.textContent=price?`◈ ${formatCredits(price)} CREDITS`:'FREE'; tag.classList.toggle('is-paid',price>0);
  const tintable=assetIsTintable(asset), tint=assetDefaultTint(asset); $('#assetTint').value=tint; $('#assetTintControls').hidden=!tintable;
  const canvas=$('#assetCanvas'), img=$('#assetImagePreview');
  canvas.hidden=!tintable; img.hidden=tintable; state.image=null;
  if(tintable){
    const image=new Image(); image.src=asset.source||asset.thumbnail||assetPreviewUrl(asset); await image.decode(); state.image=image; renderTint(tint,canvas,image);
  } else { img.src=assetPreviewUrl(asset); img.alt=`${asset.name||'Asset'} preview`; }
  const owned=state.holdings.some(h=>h.assetId===asset.id), button=$('#obtainAsset');
  button.disabled=!state.identity?.profileId || price>0; button.textContent=owned?'ASSET IN INVENTORY':price>0?`◈ ${formatCredits(price)} CREDITS — PRICING LOCKED`:'ADD TO ASSET INVENTORY';
  if(price>0) say('Paid catalog pricing is reserved for a later signed marketplace price release.','');
  else if(state.identity?.profileId) say(owned?'Asset already belongs to your inventory.':'Free asset ready to obtain.','ok');
}

function chooseAsset(){
  openOptionPicker({ title:'Select marketplace asset', options:state.catalog.assets.map(a=>assetOption(a,[assetPriceCredits(a)?`${assetPriceCredits(a)} CREDITS`:'FREE'])), selected:state.asset?.id||'', onSelect:id=>{const next=assetById(id); if(next){state.asset=next; renderSelectedAsset().catch(console.error);}} });
}

async function loadCatalog(){
  const response=await fetch('/public-assets/catalog.json',{cache:'no-store'}); if(!response.ok)throw new Error(`Catalog HTTP ${response.status}`);
  state.catalog=await response.json(); state.asset=state.catalog.assets?.[0]||null; $('#catalogCount').textContent=String(state.catalog.assets?.length||0).padStart(2,'0');
  const gameCount=state.catalog.assets.filter(a=>a.category==='game-mode-icons').length; $('#gameAssetCount').textContent=String(gameCount).padStart(2,'0');
  if(!state.asset)throw new Error('No public assets are available.'); await renderSelectedAsset(); if(state.identity?.profileId)watchInventory();
}

function inventoryPreview(asset,tint){
  const wrap=document.createElement('div'); wrap.className='inventory-preview';
  if(assetIsTintable(asset)){
    const canvas=document.createElement('canvas'); canvas.width=96; canvas.height=96; wrap.appendChild(canvas);
    const image=new Image(); image.src=asset.source||asset.thumbnail||assetPreviewUrl(asset); image.decode().then(()=>renderTint(tint,canvas,image)).catch(()=>{});
  } else { const img=document.createElement('img'); img.src=assetPreviewUrl(asset); img.alt=''; wrap.appendChild(img); }
  return wrap;
}

// Legacy per-profile assetInventory documents are read-only after the zero-trust
// hardening pass. Existing migrated holdings remain valid; official free assets
// can be reacquired through the authoritative deterministic claim id below.
function watchInventory(){
  state.inventoryUnsub?.(); const list=$('#inventoryList'); state.holdings=[];
  if(!state.identity?.profileId){list.innerHTML='<p class="inventory-empty">SIGN IN TO LOAD YOUR ASSETS.</p>';$('#ownedCount').textContent='00';$('#obtainAsset').disabled=true;say('Sign in to save ownership to your profile.');return;}
  const inventoryRef=fs.query(fs.collection(db,'assetHoldings'),fs.where('ownerProfileId','==',state.identity.profileId),fs.limit(200));
  state.inventoryUnsub=fs.onSnapshot(inventoryRef,snapshot=>{
    const items=snapshot.docs.map(d=>({id:d.id,...d.data()})); state.holdings=items; $('#ownedCount').textContent=String(items.length).padStart(2,'0'); list.innerHTML='';
    if(!items.length)list.innerHTML='<p class="inventory-empty">NO ASSETS OBTAINED YET.</p>';
    for(const item of items){
      const asset=assetById(item.assetId)||{id:item.assetId,name:item.assetId,type:'asset',defaultTint:'#ffffff',tintable:false};
      const row=document.createElement('article'); row.className='inventory-item'; const preview=inventoryPreview(asset,item.tint||assetDefaultTint(asset));
      const copy=document.createElement('div'); copy.className='inventory-copy';
      copy.innerHTML=`<strong>${escapeHtml(asset.name||item.assetId)}</strong><small>OWNED // ${escapeHtml(String(asset.type||'asset').toUpperCase())} // TRADEABLE</small>`;
      if(assetIsTintable(asset)){
        const label=document.createElement('label'); label.innerHTML=`TINT <input type="color" value="${safeTint(item.tint||assetDefaultTint(asset))}" aria-label="Inventory tint">`; const input=label.querySelector('input');
        input.addEventListener('input',()=>{const c=preview.querySelector('canvas'),image=new Image();image.src=asset.source||asset.thumbnail;image.decode().then(()=>renderTint(input.value,c,image)).catch(()=>{});});
        input.addEventListener('change',async()=>{try{await fs.updateDoc(fs.doc(db,'assetHoldings',item.id),{tint:input.value,updatedAt:fs.serverTimestamp()});say('Inventory tint saved.','ok');}catch(error){console.error(error);say('Could not save tint.','error');}}); copy.appendChild(label);
      }
      row.append(preview,copy); list.appendChild(row);
    }
    renderSelectedAsset().catch(console.error);
  },error=>{console.error('Inventory subscription',error);list.innerHTML='<p class="inventory-empty">INVENTORY COULD NOT BE LOADED.</p>';say(`Inventory error: ${error.code||error.message}`,'error');});
}

function watchCredits(){state.creditUnsub?.();state.creditBalance=0;const el=$('#marketCreditBalance');if(!state.identity?.profileId){if(el)el.textContent='00';return;}state.creditUnsub=watchCreditWallet(db,fs,state.identity.profileId,balance=>{state.creditBalance=balance;if(el)el.textContent=formatCredits(balance);},error=>console.debug('Marketplace credit wallet',error?.code||error));}

async function obtainAsset(){
  if(!state.identity?.profileId||!auth.currentUser)return say('Sign in with Google first.','error'); const asset=state.asset;if(!asset)return;
  if(assetPriceCredits(asset)>0)return say('Paid catalog pricing is not enabled for this release.','error');
  const tint=assetIsTintable(asset)?$('#assetTint').value:assetDefaultTint(asset);
  try{const existing=state.holdings.find(item=>item.assetId===asset.id);if(existing){if(assetIsTintable(asset))await fs.updateDoc(fs.doc(db,'assetHoldings',existing.id),{tint,updatedAt:fs.serverTimestamp()});say('Asset already owned.','ok');}else{const holdingRef=fs.doc(db,'assetHoldings',`market__${state.identity.profileId}__${asset.id}`);await fs.setDoc(holdingRef,{ownerProfileId:state.identity.profileId,assetId:asset.id,tint,acquiredAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp(),lastEventId:'',lastEventType:'market_acquire'});say(`${asset.name} added to your tradeable asset inventory.`,'ok');}}catch(error){console.error('Obtain asset',error);say(`Could not obtain asset: ${error.code||error.message}`,'error');}
}

$('#chooseAsset')?.addEventListener('click',chooseAsset);
$('#assetTint')?.addEventListener('input',event=>renderTint(event.target.value,$('#assetCanvas')));
document.querySelectorAll('[data-tint]').forEach(button=>button.addEventListener('click',()=>{$('#assetTint').value=button.dataset.tint;renderTint(button.dataset.tint,$('#assetCanvas'));}));
$('#obtainAsset')?.addEventListener('click',obtainAsset);
watchIdentity(identity=>{state.identity=identity;watchInventory();watchCredits();});
loadCatalog().catch(error=>{console.error(error);say(`Marketplace failed to load: ${error.message}`,'error');});
