import { auth, db, fs, watchIdentity, profileById, avatarSvg, safeText } from '/game/assets/js/eras-data.js?v=1.7.3';
import { ensureCreditWallet, watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';
import { writeBatch, increment } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { openOptionPicker } from '/game/assets/js/hosted-option-picker.js?v=1.0.0';
import { createHostedOffer, publicBundleOffers, purchaseHostedOffer } from '/game/assets/js/hosted-commerce.js?v=1.0.0';
import { assetPreviewUrl, hydrateVariantPreviewImage } from '/game/assets/js/catalog-assets.js?v=1.1.0';

const $ = s => document.querySelector(s);
const state = {
  identity: null,
  creditBalance: 0,
  creditUnsub: null,
  holdings: [],
  holdingsUnsub: null,
  trades: [],
  tradeUnsubs: [],
  profileCache: new Map(),
  catalog: { assets: [] },
  filter: 'active',
  recipientTimers: new Map(),
  connections: [],
  connectionsUnsub: null,
  connectionFilter: '',
  selectedConnectionId: '',
  bundleAssetIds: [],
  bundleOffers: []
};

const TRADE_ACTIVE = new Set(['pending','locked']);
const PROFILE_RE = /^[0-9a-fA-F-]{36}$/;

function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function clampCredits(v) { return Math.max(0, Math.min(1000000, Math.floor(Number(v) || 0))); }
function assetMeta(assetId='') { return state.catalog.assets?.find(a => a.id === assetId) || { id:assetId, name:assetId || 'No asset', source:'/public-assets/textures/slime_monochrome.png' }; }
function profileName(id='') { return state.profileCache.get(id)?.displayName || `Member-${id.replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase()}`; }
function shortId(id='') { return id ? `${id.slice(0,8)}…${id.slice(-4)}` : '—'; }
function timeLabel(ts) { const ms=ts?.toMillis?.() || 0; if(!ms)return 'NOW'; const d=Math.max(0,Date.now()-ms),m=Math.floor(d/60000); if(m<1)return 'NOW'; if(m<60)return `${m}M`; const h=Math.floor(m/60); if(h<24)return `${h}H`; return `${Math.floor(h/24)}D`; }
function toast(message) { const root=$('#tradeToastRegion'); if(!root)return; const el=document.createElement('div');el.className='trade-toast';el.textContent=String(message).toUpperCase();root.appendChild(el);setTimeout(()=>el.remove(),4200); }
function feedback(selector,message,tone='') { const el=$(selector); if(!el)return; el.textContent=String(message).toUpperCase();el.dataset.tone=tone; }

async function loadCatalog() {
  try { const r=await fetch('/public-assets/catalog.json',{cache:'no-store'}); if(r.ok)state.catalog=await r.json(); } catch(_) {}
}

async function hydrateProfile(profileId) {
  if(!profileId || state.profileCache.has(profileId)) return state.profileCache.get(profileId) || null;
  try { const p=await profileById(profileId); if(p){state.profileCache.set(profileId,p);renderTradeBook();} return p; } catch(_) { return null; }
}

function recipientPreview(elId, profile) {
  const el=$(elId); if(!el)return;
  if(!profile){el.className='recipient-preview';el.textContent='PROFILE NOT FOUND.';return;}
  el.className='recipient-preview is-valid';
  el.innerHTML=`<span class="mini-avatar">${avatarSvg(profile)}</span><span><b>${escapeHtml(profile.displayName||'Member')}</b>${escapeHtml(shortId(profile.id))}</span>`;
}

function scheduleRecipientLookup(inputId, previewId) {
  const input=$(inputId); if(!input)return;
  input.addEventListener('input',()=>{
    clearTimeout(state.recipientTimers.get(inputId));
    const id=input.value.trim();
    if(!PROFILE_RE.test(id)){const el=$(previewId);if(el){el.className='recipient-preview';el.textContent=id?'ENTER A COMPLETE 36-CHARACTER PUBLIC PROFILE ID.':'ENTER AN LCS PUBLIC PROFILE ID.';}return;}
    const timer=setTimeout(async()=>{
      if(id===state.identity?.profileId){const el=$(previewId);if(el){el.className='recipient-preview';el.textContent='YOU CANNOT TRADE WITH YOURSELF.';}return;}
      recipientPreview(previewId,await hydrateProfile(id));
    },220);
    state.recipientTimers.set(inputId,timer);
  });
}

function connectionRows() {
  const needle=state.connectionFilter.trim().toLowerCase();
  return state.connections
    .map(id=>({id,profile:state.profileCache.get(id)||null}))
    .filter(row=>!needle || row.id.toLowerCase().includes(needle) || String(row.profile?.displayName||'').toLowerCase().includes(needle))
    .sort((a,b)=>String(a.profile?.displayName||a.id).localeCompare(String(b.profile?.displayName||b.id)));
}

function renderConnections() {
  const root=$('#tradeConnections'), count=$('#connectionCount'); if(!root)return;
  if(!state.identity?.profileId){if(count)count.textContent='0';root.innerHTML='<p class="trade-empty">SIGN IN TO LOAD YOUR LCS CONNECTIONS.</p>';return;}
  if(count)count.textContent=String(state.connections.length);
  if(!state.connections.length){root.innerHTML='<p class="trade-empty">NO ACCEPTED LCS CONNECTIONS YET.</p>';return;}
  const rows=connectionRows();
  if(!rows.length){root.innerHTML='<p class="trade-empty">NO CONNECTIONS MATCH THAT SEARCH.</p>';return;}
  root.innerHTML=rows.map(({id,profile})=>`<button class="connection-card ${state.selectedConnectionId===id?'is-selected':''}" type="button" data-select-connection="${escapeHtml(id)}" aria-label="Use ${escapeHtml(profile?.displayName||profileName(id))} as trade recipient"><span class="connection-avatar">${profile?avatarSvg(profile):'<span class="connection-avatar-loading">…</span>'}</span><span class="connection-copy"><b>${escapeHtml(profile?.displayName||profileName(id))}</b><small>${escapeHtml(shortId(id))}</small></span><span class="connection-use">USE</span></button>`).join('');
}

async function hydrateConnections(ids) {
  await Promise.all(ids.map(id=>hydrateProfile(id)));
  renderConnections();
}

function watchConnections() {
  state.connectionsUnsub?.(); state.connections=[]; state.selectedConnectionId=''; renderConnections();
  const pid=state.identity?.profileId; if(!pid)return;
  const q=fs.query(fs.collection(db,'privateFriendships'),fs.where('members','array-contains',pid),fs.limit(250));
  state.connectionsUnsub=fs.onSnapshot(q,s=>{
    state.connections=[...new Set(s.docs.flatMap(d=>(d.data().members||[]).filter(id=>id&&id!==pid)))];
    if(state.selectedConnectionId&&!state.connections.includes(state.selectedConnectionId))state.selectedConnectionId='';
    renderConnections(); hydrateConnections(state.connections).catch(e=>console.debug('Trade connection profiles',e?.code||e));
  },e=>{console.error('Trade connections',e);const root=$('#tradeConnections');if(root)root.innerHTML='<p class="trade-empty">COULD NOT LOAD LCS CONNECTIONS.</p>';});
}

async function selectConnection(profileId) {
  if(!profileId||profileId===state.identity?.profileId)return;
  const profile=await hydrateProfile(profileId); if(!profile)return toast('Connection profile is unavailable');
  state.selectedConnectionId=profileId; renderConnections();
  [['#transferRecipient','#transferRecipientPreview'],['#tradeRecipient','#tradeRecipientPreview']].forEach(([inputId,previewId])=>{
    clearTimeout(state.recipientTimers.get(inputId));
    const input=$(inputId); if(input)input.value=profileId;
    recipientPreview(previewId,profile);
  });
  toast(`${profile.displayName||'Connection'} selected`);
}

// Legacy assetInventory migration is intentionally closed after security hardening.
function watchHoldings() {
  state.holdingsUnsub?.(); state.holdings=[]; renderInventory(); refreshAssetSelects();
  if(!state.identity?.profileId)return;
  const q=fs.query(fs.collection(db,'assetHoldings'),fs.where('ownerProfileId','==',state.identity.profileId),fs.limit(200));
  state.holdingsUnsub=fs.onSnapshot(q,s=>{
    state.holdings=s.docs.map(d=>({id:d.id,...d.data()})).filter(h=>h.archived!==true);
    renderInventory(); refreshAssetSelects(); renderTradeBook();
  },e=>console.error('Trade holdings',e));
}

function holdingOption(h) { const meta=assetMeta(h.assetId); return `<option value="${escapeHtml(h.id)}">${escapeHtml(meta.name)} // ${escapeHtml(h.tint||'#ffffff')}</option>`; }
function refreshAssetSelects() {
  const options='<option value="">NO ASSET</option>'+state.holdings.map(holdingOption).join('');
  const offer=$('#offerAsset'); if(offer){const current=offer.value;offer.innerHTML=options;if([...offer.options].some(o=>o.value===current))offer.value=current;}
  document.querySelectorAll('[data-recipient-asset-select]').forEach(sel=>{const current=sel.value;sel.innerHTML=options;if([...sel.options].some(o=>o.value===current))sel.value=current;});
}

function renderInventory() {
  const root=$('#tradeInventory'); if(!root)return;
  if(!state.identity?.profileId){root.innerHTML='<p class="trade-empty">SIGN IN TO LOAD YOUR INVENTORY.</p>';return;}
  if(!state.holdings.length){root.innerHTML='<p class="trade-empty">NO TRADEABLE ASSETS YET. VISIT CONTENT TO OBTAIN ONE.</p>';return;}
  root.innerHTML=state.holdings.map(h=>{const meta=assetMeta(h.assetId);return `<article class="holding-card"><div class="holding-preview"><img data-holding-preview="${escapeHtml(h.id)}" src="${escapeHtml(assetPreviewUrl(meta))}" alt=""></div><div><b>${escapeHtml(meta.name||h.assetId)}</b><small>${escapeHtml(h.assetId)}<br>TINT ${escapeHtml(h.tint||'#ffffff')}<br>HOLDING ${escapeHtml(h.id.slice(0,10))}…</small></div></article>`;}).join('');
  for(const h of state.holdings){const img=root.querySelector(`[data-holding-preview="${CSS.escape(h.id)}"]`);if(img)hydrateVariantPreviewImage(img,assetMeta(h.assetId),h.tint||'#ffffff',96);}
}

function watchCredits() {
  state.creditUnsub?.(); state.creditBalance=0; $('#tradeCreditBalance').textContent='0';
  if(!state.identity?.profileId)return;
  state.creditUnsub=watchCreditWallet(db,fs,state.identity.profileId,balance=>{state.creditBalance=balance;$('#tradeCreditBalance').textContent=formatCredits(balance);},e=>console.error('Trade wallet',e));
}

function mergeTrades(a,b) { return [...new Map([...a,...b].map(x=>[x.id,x])).values()].sort((x,y)=>(y.updatedAt?.toMillis?.()||0)-(x.updatedAt?.toMillis?.()||0)); }
function watchTrades() {
  state.tradeUnsubs.splice(0).forEach(fn=>{try{fn();}catch{}}); state.trades=[];renderTradeBook();
  const pid=state.identity?.profileId;if(!pid)return;
  let outgoing=[],incoming=[]; const apply=()=>{state.trades=mergeTrades(outgoing,incoming);state.trades.forEach(t=>hydrateProfile(t.initiatorProfileId));state.trades.forEach(t=>hydrateProfile(t.recipientProfileId));renderTradeBook();};
  const oq=fs.query(fs.collection(db,'playerTrades'),fs.where('initiatorProfileId','==',pid),fs.limit(100));
  const iq=fs.query(fs.collection(db,'playerTrades'),fs.where('recipientProfileId','==',pid),fs.limit(100));
  state.tradeUnsubs.push(fs.onSnapshot(oq,s=>{outgoing=s.docs.map(d=>({id:d.id,...d.data()}));apply();},e=>console.error('Outgoing trades',e)));
  state.tradeUnsubs.push(fs.onSnapshot(iq,s=>{incoming=s.docs.map(d=>({id:d.id,...d.data()}));apply();},e=>console.error('Incoming trades',e)));
}

function sideMarkup(trade, side) {
  const isInit=side==='initiator'; const pid=trade[`${side}ProfileId`];
  const credits=clampCredits(trade[`${side}Credits`]); const assetId=trade[`${side}AssetId`]||''; const tint=trade[`${side}AssetTint`]||'';
  return `<div class="party-side"><small>${isInit?'INITIATOR':'RECIPIENT'}</small><b>${escapeHtml(profileName(pid))}</b><em>◈ ${formatCredits(credits)} CREDITS</em><small>${assetId?`${escapeHtml(assetMeta(assetId).name)} // ${escapeHtml(tint)}`:'NO ASSET'}</small></div>`;
}

function tradeCard(trade) {
  const mine=state.identity?.profileId; const initiator=mine===trade.initiatorProfileId; const recipient=mine===trade.recipientProfileId;
  const active=TRADE_ACTIVE.has(trade.status); const counterpart=initiator?trade.recipientProfileId:trade.initiatorProfileId;
  let actions='';
  if(trade.status==='pending'&&recipient){
    actions=`<div class="recipient-side-form"><input data-recipient-credits="${trade.id}" type="number" min="0" max="1000000" step="1" value="0" aria-label="Your Credits"><select data-recipient-asset-select="${trade.id}" aria-label="Your asset"><option value="">NO ASSET</option>${state.holdings.map(holdingOption).join('')}</select><button class="trade-primary" data-lock-trade="${trade.id}" type="button">LOCK MY SIDE</button></div><div class="trade-card-actions"><button class="trade-danger" data-decline-trade="${trade.id}" type="button">DECLINE</button></div>`;
  } else if(trade.status==='pending'&&initiator){ actions=`<div class="trade-card-actions"><button class="trade-danger" data-cancel-trade="${trade.id}" type="button">CANCEL OFFER</button></div>`; }
  else if(trade.status==='locked'&&initiator){ actions=`<div class="trade-card-actions"><button class="trade-primary" data-complete-trade="${trade.id}" type="button">FINALIZE ATOMIC TRADE</button><button class="trade-danger" data-cancel-trade="${trade.id}" type="button">CANCEL</button></div>`; }
  else if(trade.status==='locked'&&recipient){ actions=`<div class="trade-card-actions"><button class="trade-secondary" type="button" disabled>YOUR SIDE IS LOCKED</button><button class="trade-danger" data-decline-trade="${trade.id}" type="button">DECLINE</button></div>`; }
  return `<article class="trade-card" data-status="${escapeHtml(trade.status)}"><div class="trade-card-head"><div><b>${initiator?'WITH':'FROM'} ${escapeHtml(profileName(counterpart))}</b><p class="trade-note">${escapeHtml(shortId(counterpart))} // ${timeLabel(trade.updatedAt)}</p></div><span class="trade-status ${escapeHtml(trade.status)}">${escapeHtml(trade.status.toUpperCase())}</span></div><div class="trade-parties">${sideMarkup(trade,'initiator')}<span class="trade-arrow">⇄</span>${sideMarkup(trade,'recipient')}</div>${active?actions:`<p class="trade-note">${trade.status==='completed'?'EXCHANGE COMPLETED ATOMICALLY.':'NO ASSETS OR CREDITS WERE MOVED.'}</p>`}</article>`;
}

function renderTradeBook() {
  const root=$('#tradeBook'); if(!root)return;
  if(!state.identity?.profileId){root.innerHTML='<p class="trade-empty">SIGN IN TO LOAD PLAYER TRADES.</p>';return;}
  const rows=state.trades.filter(t=>state.filter==='active'?TRADE_ACTIVE.has(t.status):!TRADE_ACTIVE.has(t.status));
  root.innerHTML=rows.length?rows.map(tradeCard).join(''):`<p class="trade-empty">NO ${state.filter==='active'?'ACTIVE':'COMPLETED / CLOSED'} TRADES.</p>`;
}

async function validRecipient(profileId) {
  if(!PROFILE_RE.test(profileId))throw new Error('Enter a complete LCS public profile ID.');
  if(profileId===state.identity?.profileId)throw new Error('You cannot exchange with yourself.');
  const p=await hydrateProfile(profileId);if(!p)throw new Error('That public profile does not exist.');return p;
}

async function sendCredits(event) {
  event.preventDefault();
  if(!state.identity?.profileId||!auth.currentUser)return feedback('#transferFeedback','Sign in first.','error');
  const to=$('#transferRecipient').value.trim(), amount=clampCredits($('#transferAmount').value), note=$('#transferNote').value.trim().slice(0,120);
  try {
    await validRecipient(to);
    await ensureCreditWallet(db,fs,state.identity.profileId);
    if(amount<1)throw new Error('Transfer at least 1 Credit.');
    if(amount>state.creditBalance)throw new Error('You do not have enough Credits.');

    const id=crypto.randomUUID(), transferRef=fs.doc(db,'creditTransfers',id), fromWallet=fs.doc(db,'creditWallets',state.identity.profileId), toWallet=fs.doc(db,'creditWallets',to);
    // v1.8.3: signed-in players may read game Credit wallets, so determine
    // whether the recipient wallet exists before building the atomic write.
    // This removes the old permission-error fallback that could choose the
    // wrong create/update path and mask the real Firestore failure.
    const recipientSnap=await fs.getDoc(toWallet);
    const batch=writeBatch(db);
    batch.set(transferRef,{fromProfileId:state.identity.profileId,toProfileId:to,amount,note,createdAt:fs.serverTimestamp()});
    batch.update(fromWallet,{balance:increment(-amount),lastEventId:id,lastEventType:'player_transfer_out',updatedAt:fs.serverTimestamp()});
    if(recipientSnap.exists()){
      batch.update(toWallet,{balance:increment(amount),lastEventId:id,lastEventType:'player_transfer_in',updatedAt:fs.serverTimestamp()});
    }else{
      batch.set(toWallet,{profileId:to,balance:amount,totalEarned:0,totalLost:0,lastEventId:id,lastEventType:'player_transfer_in',createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
    }
    await batch.commit();

    feedback('#transferFeedback',`${amount} Credits sent to ${profileName(to)}.`,'ok'); toast(`Sent ${amount} Credits to ${profileName(to)}`); $('#transferAmount').value='1';$('#transferNote').value='';
  } catch(error) {
    console.error('Credit transfer',error);
    const code=String(error?.code||'');
    const msg=code.includes('permission-denied')?'Transfer was blocked by Firestore rules. Publish v0.9.17 and retry.':(error?.message||code||'Transfer failed.');
    feedback('#transferFeedback',msg,'error');
  }
}

async function createTrade(event) {
  event.preventDefault();
  if(!state.identity?.profileId)return feedback('#tradeFeedback','Sign in first.','error');
  const to=$('#tradeRecipient').value.trim(), credits=clampCredits($('#offerCredits').value), holdingId=$('#offerAsset').value;
  try {
    await validRecipient(to);
    await ensureCreditWallet(db,fs,state.identity.profileId);
    if(credits>state.creditBalance)throw new Error('You do not have enough Credits for that offer.');
    const holding=holdingId?state.holdings.find(h=>h.id===holdingId):null;if(holdingId&&!holding)throw new Error('That asset is no longer in your inventory.');
    const id=crypto.randomUUID();
    await fs.setDoc(fs.doc(db,'playerTrades',id),{
      initiatorProfileId:state.identity.profileId,recipientProfileId:to,
      initiatorCredits:credits,recipientCredits:0,
      initiatorHoldingId:holding?.id||'',initiatorAssetId:holding?.assetId||'',initiatorAssetTint:holding?.tint||'',
      recipientHoldingId:'',recipientAssetId:'',recipientAssetTint:'',
      status:'pending',createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp(),completedAt:null
    });
    feedback('#tradeFeedback',`Trade created for ${profileName(to)}.`,'ok');toast('Trade offer created');$('#offerCredits').value='0';$('#offerAsset').value='';
  } catch(error) {
    console.error('Create trade',error);
    const code=String(error?.code||'');
    const msg=code.includes('permission-denied')?'Trade creation was blocked by Firestore rules. Publish v0.9.17 and retry.':(error?.message||code||'Could not create trade.');
    feedback('#tradeFeedback',msg,'error');
  }
}

async function lockRecipientSide(tradeId) {
  const trade=state.trades.find(t=>t.id===tradeId);if(!trade||trade.recipientProfileId!==state.identity?.profileId||trade.status!=='pending')return;
  const credits=clampCredits(document.querySelector(`[data-recipient-credits="${CSS.escape(tradeId)}"]`)?.value),holdingId=document.querySelector(`[data-recipient-asset-select="${CSS.escape(tradeId)}"]`)?.value||'';
  try {
    if(credits>state.creditBalance)throw new Error('You do not have enough Credits.');
    const holding=holdingId?state.holdings.find(h=>h.id===holdingId):null;if(holdingId&&!holding)throw new Error('That asset is no longer owned by you.');
    if(!trade.initiatorCredits&&!trade.initiatorAssetId&&!credits&&!holding)throw new Error('An empty trade cannot be locked.');
    if(holding&&holding.id===trade.initiatorHoldingId)throw new Error('The same asset holding cannot be on both sides.');
    await fs.updateDoc(fs.doc(db,'playerTrades',tradeId),{
      recipientCredits:credits,recipientHoldingId:holding?.id||'',recipientAssetId:holding?.assetId||'',recipientAssetTint:holding?.tint||'',status:'locked',updatedAt:fs.serverTimestamp()
    });
    toast('Your trade side is locked');
  } catch(error) { console.error('Lock trade',error);toast(error?.message||'Could not lock trade'); }
}

async function closeTrade(tradeId,status) {
  const trade=state.trades.find(t=>t.id===tradeId);if(!trade)return;
  try { await fs.updateDoc(fs.doc(db,'playerTrades',tradeId),{status,updatedAt:fs.serverTimestamp()});toast(status==='cancelled'?'Trade cancelled':'Trade declined'); }
  catch(error){console.error('Close trade',error);toast(error?.message||'Could not close trade');}
}

async function completeTrade(tradeId) {
  const trade=state.trades.find(t=>t.id===tradeId);if(!trade||trade.initiatorProfileId!==state.identity?.profileId||trade.status!=='locked')return;
  try {
    const ownDelta=-clampCredits(trade.initiatorCredits)+clampCredits(trade.recipientCredits), otherDelta=-clampCredits(trade.recipientCredits)+clampCredits(trade.initiatorCredits);
    if(state.creditBalance+ownDelta<0)throw new Error('You no longer have enough Credits to complete this trade.');
    const batch=writeBatch(db), tradeRef=fs.doc(db,'playerTrades',tradeId), settlementRef=fs.doc(db,'tradeSettlements',tradeId);
    batch.update(tradeRef,{status:'completed',completedAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
    batch.set(settlementRef,{
      initiatorProfileId:trade.initiatorProfileId,recipientProfileId:trade.recipientProfileId,
      initiatorCredits:clampCredits(trade.initiatorCredits),recipientCredits:clampCredits(trade.recipientCredits),
      initiatorHoldingId:trade.initiatorHoldingId||'',initiatorAssetId:trade.initiatorAssetId||'',initiatorAssetTint:trade.initiatorAssetTint||'',
      recipientHoldingId:trade.recipientHoldingId||'',recipientAssetId:trade.recipientAssetId||'',recipientAssetTint:trade.recipientAssetTint||'',
      createdAt:fs.serverTimestamp()
    });
    batch.update(fs.doc(db,'creditWallets',trade.initiatorProfileId),{balance:increment(ownDelta),lastEventId:tradeId,lastEventType:'trade',updatedAt:fs.serverTimestamp()});
    batch.update(fs.doc(db,'creditWallets',trade.recipientProfileId),{balance:increment(otherDelta),lastEventId:tradeId,lastEventType:'trade',updatedAt:fs.serverTimestamp()});
    if(trade.initiatorHoldingId) batch.update(fs.doc(db,'assetHoldings',trade.initiatorHoldingId),{ownerProfileId:trade.recipientProfileId,lastEventId:tradeId,lastEventType:'trade',updatedAt:fs.serverTimestamp()});
    if(trade.recipientHoldingId) batch.update(fs.doc(db,'assetHoldings',trade.recipientHoldingId),{ownerProfileId:trade.initiatorProfileId,lastEventId:tradeId,lastEventType:'trade',updatedAt:fs.serverTimestamp()});
    await batch.commit(); toast('Trade completed');
  } catch(error) { console.error('Complete trade',error);toast('Trade could not complete. A balance, asset, or trade term changed.'); }
}


function bundlePickerOptions(){return state.holdings.map(h=>{const m=assetMeta(h.assetId);return{id:h.id,name:m.name,description:`${h.assetId} // TINT ${h.tint||'#ffffff'}`,image:assetPreviewUrl(m),tags:['OWNED','LICENSE']};});}
function renderBundleAssetSummary(){const root=$('#bundleAssetSummary');if(!root)return;const rows=state.holdings.filter(h=>state.bundleAssetIds.includes(h.id));root.innerHTML=rows.length?rows.map(h=>`<b>${escapeHtml(assetMeta(h.assetId).name)} // ${escapeHtml(h.tint||'#ffffff')}</b>`).join(''):'NO ASSETS SELECTED.';}
function chooseBundleAssets(){openOptionPicker({title:'Select bundle assets',options:bundlePickerOptions(),selected:state.bundleAssetIds,multi:true,max:4,onSelect:ids=>{state.bundleAssetIds=ids;renderBundleAssetSummary();}});}
function bundleContents(o){const p=[];if(o.playCount)p.push(`${o.playCount} PLAY${o.playCount===1?'':'S'}`);if(o.lifeCount)p.push(`${o.lifeCount} ${o.lifeCount===1?'LIFE':'LIVES'}`);if(o.minutes)p.push(`${o.minutes} MIN`);if(o.permanent)p.push('PERMANENT');if((o.assetHoldingIds||[]).length)p.push(`${o.assetHoldingIds.length} ICON LICENSE${o.assetHoldingIds.length===1?'':'S'}`);return p.join(' + ')||'HOSTED USAGE RIGHTS';}
async function refreshBundles(){const root=$('#bundleMarketplace');if(!root)return;root.innerHTML='<p class="trade-empty">LOADING BUNDLES…</p>';try{state.bundleOffers=(await publicBundleOffers()).filter(o=>o.sellerProfileId!==state.identity?.profileId);root.innerHTML=state.bundleOffers.length?state.bundleOffers.map(o=>`<article class="bundle-offer-card"><b>${escapeHtml(o.title)}</b><small>${escapeHtml(o.description||'Player-created hosted usage bundle.')}<br>${escapeHtml(bundleContents(o))}</small><strong>◈ ${formatCredits(o.priceCredits)} CREDITS</strong><button type="button" data-buy-bundle="${escapeHtml(o.id)}">PURCHASE BUNDLE</button></article>`).join(''):'<p class="trade-empty">NO PLAYER BUNDLES ARE LISTED.</p>';}catch(e){console.error('Bundle marketplace',e);root.innerHTML='<p class="trade-empty">BUNDLES COULD NOT BE LOADED.</p>';}}
async function createBundle(event){event.preventDefault();if(!state.identity?.profileId)return feedback('#bundleFeedback','Sign in first.','error');const selected=state.holdings.filter(h=>state.bundleAssetIds.includes(h.id));if(!selected.length)return feedback('#bundleFeedback','Select at least one owned asset.','error');try{const offer=await createHostedOffer({sellerProfileId:state.identity.profileId,lobbyId:'',offerType:'bundle',billing:'bundle',title:$('#bundleName').value.trim(),description:$('#bundleDescription').value.trim(),priceCredits:clampCredits($('#bundlePrice').value),permanent:true,assetHoldingIds:selected.map(h=>h.id)});state.bundleAssetIds=[];renderBundleAssetSummary();feedback('#bundleFeedback',`Bundle listed: ${offer.title}.`,'ok');toast('Bundle listed');await refreshBundles();}catch(e){console.error('Create bundle',e);feedback('#bundleFeedback',e?.message||e?.code||'Could not list bundle.','error');}}
async function buyBundle(id){if(!state.identity?.profileId)return toast('Sign in first');const offer=state.bundleOffers.find(o=>o.id===id);if(!offer)return;const ok=confirm(`PURCHASE BUNDLE?\n\n${offer.title}\n${bundleContents(offer)}\n${formatCredits(offer.priceCredits)} Credits\n\nThe seller keeps ownership of source assets; you receive the listed hosted-usage licenses.`);if(!ok)return;try{await purchaseHostedOffer({offerId:id,buyerProfileId:state.identity.profileId});toast('Bundle purchased');await refreshBundles();}catch(e){console.error('Buy bundle',e);toast(e?.message||'Bundle purchase failed');}}

function bind() {
  scheduleRecipientLookup('#transferRecipient','#transferRecipientPreview');scheduleRecipientLookup('#tradeRecipient','#tradeRecipientPreview');
  $('#creditTransferForm')?.addEventListener('submit',sendCredits);$('#createTradeForm')?.addEventListener('submit',createTrade);$('#createBundleForm')?.addEventListener('submit',createBundle);$('#bundleAssetPicker')?.addEventListener('click',chooseBundleAssets);$('#refreshBundles')?.addEventListener('click',refreshBundles);
  $('#connectionSearch')?.addEventListener('input',e=>{state.connectionFilter=e.target.value||'';renderConnections();});
  document.addEventListener('click',e=>{const t=e.target.closest('[data-select-connection],[data-trade-filter],[data-lock-trade],[data-decline-trade],[data-cancel-trade],[data-complete-trade],[data-buy-bundle]');if(!t)return;
    if(t.dataset.selectConnection){selectConnection(t.dataset.selectConnection);return;}
    if(t.dataset.tradeFilter){state.filter=t.dataset.tradeFilter;document.querySelectorAll('[data-trade-filter]').forEach(b=>b.classList.toggle('is-active',b===t));renderTradeBook();return;}
    if(t.dataset.buyBundle){buyBundle(t.dataset.buyBundle);return;}if(t.dataset.lockTrade)lockRecipientSide(t.dataset.lockTrade);if(t.dataset.declineTrade)closeTrade(t.dataset.declineTrade,'declined');if(t.dataset.cancelTrade)closeTrade(t.dataset.cancelTrade,'cancelled');if(t.dataset.completeTrade)completeTrade(t.dataset.completeTrade);
  });
}

function focusPrefilledMode(params) {
  const mode=params.get('mode')||'';
  const target=mode==='credits'?$('#transferRecipient'):mode==='trade'?$('#tradeRecipient'):null;
  if(!target)return;
  const panel=target.closest('.trade-panel');
  panel?.classList.add('is-profile-target');
  setTimeout(()=>{panel?.scrollIntoView({behavior:'smooth',block:'center'});target.focus({preventScroll:true});setTimeout(()=>panel?.classList.remove('is-profile-target'),2400);},120);
}

async function init() {
  bind();await loadCatalog();renderBundleAssetSummary();await refreshBundles();
  const params=new URLSearchParams(location.search),prefill=params.get('with')||'';if(PROFILE_RE.test(prefill)){['#transferRecipient','#tradeRecipient'].forEach(s=>{const el=$(s);if(el){el.value=prefill;el.dispatchEvent(new Event('input'));}});focusPrefilledMode(params);}
  watchIdentity(identity=>{
    state.identity=identity; if(identity?.profileId&&identity.profile)state.profileCache.set(identity.profileId,identity.profile);
    watchCredits();watchHoldings();watchTrades();watchConnections();refreshBundles();
    if(!identity?.profileId){feedback('#transferFeedback','Sign in to send Credits.');feedback('#tradeFeedback','Sign in to create trades.');}
  });
}
init().catch(console.error);
