import { auth, db, fs, watchIdentity } from '/game/assets/js/eras-data.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';
import { openOptionPicker } from '/game/assets/js/hosted-option-picker.js?v=1.0.0';
import { assetPreviewUrl, assetIsTintable, assetDefaultTint, assetOption, assetPriceCredits, renderAssetCanvas, safeAssetTint } from '/game/assets/js/catalog-assets.js?v=1.1.0';

const $ = s => document.querySelector(s);
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeTint = value => safeAssetTint(value, '#ffffff');
const state = { identity:null, catalog:{assets:[]}, asset:null, inventoryUnsub:null, creditUnsub:null, creditBalance:0, holdings:[], archiveView:false };

function say(message, tone='') { const el=$('#assetFeedback'); if(!el)return; el.textContent=String(message).toUpperCase(); el.dataset.tone=tone; }
function assetById(id){ return state.catalog.assets.find(a=>a.id===id) || null; }
function categoryLabel(asset){ return `${String(asset?.type||'asset').toUpperCase()} // ${String(asset?.category||'general').replace(/[-_]/g,' ').toUpperCase()}`; }
function holdingArchived(holding){ return holding?.archived === true; }
function selectedTint(asset=state.asset){ return assetIsTintable(asset) ? safeTint($('#assetTint')?.value || assetDefaultTint(asset)) : safeTint(assetDefaultTint(asset)); }
function sameVariant(holding,asset,tint=selectedTint(asset)){
  if(!holding||!asset||holding.assetId!==asset.id)return false;
  return !assetIsTintable(asset) || safeTint(holding.tint)===safeTint(tint);
}
function existingVariant(asset=state.asset,tint=selectedTint(asset)){
  const matches=state.holdings.filter(holding=>sameVariant(holding,asset,tint));
  return matches.find(holding=>!holdingArchived(holding)) || matches[0] || null;
}
function marketHoldingId(asset,tint){
  const base=`market__${state.identity.profileId}__${asset.id}`;
  return assetIsTintable(asset)?`${base}__${safeTint(tint)}`:base;
}

function updateObtainState(){
  const asset=state.asset, button=$('#obtainAsset'); if(!asset||!button)return;
  const price=assetPriceCredits(asset);
  if(!state.identity?.profileId){button.disabled=true;button.textContent='ADD TO ASSET INVENTORY';say('Sign in to save ownership to your profile.');return;}
  if(price>0){button.disabled=true;button.textContent=`◈ ${formatCredits(price)} CREDITS — PRICING LOCKED`;say('Paid catalog pricing is reserved for a later signed marketplace price release.','');return;}
  const existing=existingVariant(asset);
  if(existing){
    button.disabled=true;
    button.textContent=holdingArchived(existing)?(assetIsTintable(asset)?'VARIANT IN ARCHIVE':'ASSET IN ARCHIVE'):(assetIsTintable(asset)?'VARIANT IN INVENTORY':'ASSET IN INVENTORY');
    say(holdingArchived(existing)?'This exact asset is archived. Restore it from Asset Archive.':'This exact asset already belongs to your inventory.','ok');
    return;
  }
  button.disabled=false; button.textContent='ADD TO ASSET INVENTORY';
  say(assetIsTintable(asset)?'This tint will be locked permanently when obtained.':'Free asset ready to obtain.','ok');
}

async function renderSelectedAsset(){
  const asset=state.asset; if(!asset)return;
  $('#assetName').textContent=asset.name||asset.id; $('#assetDescription').textContent=asset.description||''; $('#assetType').textContent=categoryLabel(asset);
  $('#assetTags').innerHTML=(asset.tags||[]).slice(0,8).map(t=>`<span>${escapeHtml(String(t).toUpperCase())}</span>`).join('');
  const price=assetPriceCredits(asset), tag=$('#assetPriceTag'); tag.textContent=price?`◈ ${formatCredits(price)} CREDITS`:'FREE'; tag.classList.toggle('is-paid',price>0);
  const tintable=assetIsTintable(asset), tint=safeTint(assetDefaultTint(asset)); $('#assetTint').value=tint; $('#assetTintControls').hidden=!tintable;
  const canvas=$('#assetCanvas'), img=$('#assetImagePreview');
  canvas.hidden=!tintable; img.hidden=tintable;
  if(tintable) await renderAssetCanvas(canvas,asset,tint);
  else { img.src=assetPreviewUrl(asset); img.alt=`${asset.name||'Asset'} preview`; }
  updateObtainState();
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
    renderAssetCanvas(canvas,asset,tint).catch(()=>{});
  } else { const img=document.createElement('img'); img.src=assetPreviewUrl(asset); img.alt=''; wrap.appendChild(img); }
  return wrap;
}

function updateStorageHeader(){
  const active=state.holdings.filter(item=>!holdingArchived(item)), archived=state.holdings.filter(holdingArchived);
  $('#ownedCount').textContent=String(active.length).padStart(2,'0');
  $('#inventoryViewCount').textContent=String(active.length).padStart(2,'0');
  $('#archiveCount').textContent=String(archived.length).padStart(2,'0');
  $('#inventoryPanelTitle').textContent=state.archiveView?'ASSET ARCHIVE':'YOUR INVENTORY';
  $('#inventoryViewButton')?.classList.toggle('is-active',!state.archiveView);
  $('#archiveViewButton')?.classList.toggle('is-active',state.archiveView);
  $('#inventoryViewButton')?.setAttribute('aria-selected',String(!state.archiveView));
  $('#archiveViewButton')?.setAttribute('aria-selected',String(state.archiveView));
  const note=$('#inventoryArchiveNote'); if(note)note.textContent=state.archiveView?'ARCHIVED ASSETS ARE RECOVERABLE BUT CANNOT BE USED OR TRADED.':'ARCHIVING HIDES AN ASSET WITHOUT DESTROYING IT.';
}

async function setHoldingArchived(item,archived){
  if(!state.identity?.profileId||item.ownerProfileId!==state.identity.profileId)return say('That holding does not belong to this profile.','error');
  try{
    await fs.updateDoc(fs.doc(db,'assetHoldings',item.id),{
      archived,
      archivedAt:archived?fs.serverTimestamp():null,
      updatedAt:fs.serverTimestamp()
    });
    say(archived?'Asset moved to your recoverable archive.':'Asset restored to your inventory.','ok');
  }catch(error){console.error('Asset archive',error);say(`Could not ${archived?'archive':'restore'} asset: ${error.code||error.message}`,'error');}
}

function renderInventoryList(){
  const list=$('#inventoryList'); if(!list)return;
  updateStorageHeader(); list.innerHTML='';
  if(!state.identity?.profileId){list.innerHTML='<p class="inventory-empty">SIGN IN TO LOAD YOUR ASSETS.</p>';return;}
  const items=state.holdings.filter(item=>holdingArchived(item)===state.archiveView);
  if(!items.length){list.innerHTML=`<p class="inventory-empty">${state.archiveView?'NO ARCHIVED ASSETS.':'NO ASSETS OBTAINED YET.'}</p>`;return;}
  for(const item of items){
    const asset=assetById(item.assetId)||{id:item.assetId,name:item.assetId,type:'asset',defaultTint:'#ffffff',tintable:false};
    const tint=safeTint(item.tint||assetDefaultTint(asset));
    const row=document.createElement('article'); row.className=`inventory-item${holdingArchived(item)?' is-archived':''}`;
    const preview=inventoryPreview(asset,tint);
    const copy=document.createElement('div'); copy.className='inventory-copy';
    copy.innerHTML=`<strong>${escapeHtml(asset.name||item.assetId)}</strong><small>${holdingArchived(item)?'ARCHIVED // RECOVERABLE':`OWNED // ${escapeHtml(String(asset.type||'asset').toUpperCase())} // TRADEABLE`}</small>`;
    if(assetIsTintable(asset)){
      const locked=document.createElement('div'); locked.className='inventory-locked-tint';
      locked.innerHTML=`<span>TINT LOCKED</span><i style="--holding-tint:${escapeHtml(tint)}"></i><b>${escapeHtml(tint.toUpperCase())}</b>`;
      copy.appendChild(locked);
    }
    const action=document.createElement('button'); action.type='button'; action.className=holdingArchived(item)?'inventory-restore':'inventory-archive'; action.textContent=holdingArchived(item)?'RESTORE':'ARCHIVE';
    action.addEventListener('click',()=>setHoldingArchived(item,!holdingArchived(item)));
    copy.appendChild(action); row.append(preview,copy); list.appendChild(row);
  }
}

// Legacy per-profile assetInventory documents are read-only after the zero-trust
// hardening pass. Existing migrated holdings remain valid; official free assets
// are acquired as immutable holdings. Tintable variants use deterministic IDs
// keyed by exact tint so obtaining one variant never mutates another.
function watchInventory(){
  state.inventoryUnsub?.(); state.holdings=[]; renderInventoryList();
  if(!state.identity?.profileId){$('#obtainAsset').disabled=true;say('Sign in to save ownership to your profile.');return;}
  const inventoryRef=fs.query(fs.collection(db,'assetHoldings'),fs.where('ownerProfileId','==',state.identity.profileId),fs.limit(200));
  state.inventoryUnsub=fs.onSnapshot(inventoryRef,snapshot=>{
    state.holdings=snapshot.docs.map(d=>({id:d.id,...d.data()}));
    renderInventoryList(); updateObtainState();
  },error=>{console.error('Inventory subscription',error);const list=$('#inventoryList');if(list)list.innerHTML='<p class="inventory-empty">INVENTORY COULD NOT BE LOADED.</p>';say(`Inventory error: ${error.code||error.message}`,'error');});
}

function watchCredits(){state.creditUnsub?.();state.creditBalance=0;const el=$('#marketCreditBalance');if(!state.identity?.profileId){if(el)el.textContent='00';return;}state.creditUnsub=watchCreditWallet(db,fs,state.identity.profileId,balance=>{state.creditBalance=balance;if(el)el.textContent=formatCredits(balance);},error=>console.debug('Marketplace credit wallet',error?.code||error));}

async function obtainAsset(){
  if(!state.identity?.profileId||!auth.currentUser)return say('Sign in with Google first.','error'); const asset=state.asset;if(!asset)return;
  if(assetPriceCredits(asset)>0)return say('Paid catalog pricing is not enabled for this release.','error');
  const tint=selectedTint(asset), existing=existingVariant(asset,tint);
  if(existing)return say(holdingArchived(existing)?'This exact asset is archived. Restore it instead of obtaining a duplicate.':'This exact asset variant is already owned.','ok');
  try{
    const holdingRef=fs.doc(db,'assetHoldings',marketHoldingId(asset,tint));
    await fs.setDoc(holdingRef,{ownerProfileId:state.identity.profileId,assetId:asset.id,tint,acquiredAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp(),lastEventId:'',lastEventType:'market_acquire',archived:false,archivedAt:null});
    say(`${asset.name}${assetIsTintable(asset)?` ${tint.toUpperCase()}`:''} added as an immutable tradeable holding.`,'ok');
  }catch(error){console.error('Obtain asset',error);say(`Could not obtain asset: ${error.code||error.message}`,'error');}
}

function setArchiveView(archive){state.archiveView=archive===true;renderInventoryList();}

$('#chooseAsset')?.addEventListener('click',chooseAsset);
$('#assetTint')?.addEventListener('input',event=>{renderAssetCanvas($('#assetCanvas'),state.asset,event.target.value).catch(console.error);updateObtainState();});
document.querySelectorAll('[data-tint]').forEach(button=>button.addEventListener('click',()=>{$('#assetTint').value=button.dataset.tint;renderAssetCanvas($('#assetCanvas'),state.asset,button.dataset.tint).catch(console.error);updateObtainState();}));
$('#obtainAsset')?.addEventListener('click',obtainAsset);
$('#inventoryViewButton')?.addEventListener('click',()=>setArchiveView(false));
$('#archiveViewButton')?.addEventListener('click',()=>setArchiveView(true));
watchIdentity(identity=>{state.identity=identity;watchInventory();watchCredits();});
loadCatalog().catch(error=>{console.error(error);say(`Marketplace failed to load: ${error.message}`,'error');});
