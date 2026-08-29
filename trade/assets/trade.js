import { auth, db, fs, watchIdentity, profileById, avatarSvg, safeText } from '/game/assets/js/eras-data.js?v=1.7.3';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';
import { writeBatch, increment } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
  recipientTimers: new Map()
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

async function migrateLegacyInventory() {
  if(!state.identity?.profileId) return;
  try {
    const legacy=await fs.getDocs(fs.collection(db,'assetInventory',state.identity.profileId,'items'));
    if(legacy.empty)return;
    for(const d of legacy.docs){
      const item=d.data();
      const holdingRef=fs.doc(db,'assetHoldings',`legacy_${state.identity.profileId}_${d.id}`);
      const existing=await fs.getDoc(holdingRef);
      if(existing.exists())continue;
      await fs.setDoc(holdingRef,{
        ownerProfileId:state.identity.profileId,
        assetId:item.assetId,
        tint:item.tint||'#ffffff',
        acquiredAt:item.acquiredAt||fs.serverTimestamp(),
        updatedAt:fs.serverTimestamp(),
        lastEventId:'legacy-migration',
        lastEventType:'migration'
      });
    }
  } catch(error) { console.debug('Legacy inventory migration',error?.code||error); }
}

function watchHoldings() {
  state.holdingsUnsub?.(); state.holdings=[]; renderInventory(); refreshAssetSelects();
  if(!state.identity?.profileId)return;
  const q=fs.query(fs.collection(db,'assetHoldings'),fs.where('ownerProfileId','==',state.identity.profileId),fs.limit(200));
  state.holdingsUnsub=fs.onSnapshot(q,s=>{
    state.holdings=s.docs.map(d=>({id:d.id,...d.data()}));
    renderInventory(); refreshAssetSelects(); renderTradeBook();
  },e=>console.error('Trade holdings',e));
  migrateLegacyInventory().catch(console.debug);
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
  root.innerHTML=state.holdings.map(h=>{const meta=assetMeta(h.assetId);return `<article class="holding-card"><div class="holding-preview" style="--asset-tint:${escapeHtml(h.tint||'#ffffff')}"><img src="${escapeHtml(meta.source||'')}" alt=""></div><div><b>${escapeHtml(meta.name||h.assetId)}</b><small>${escapeHtml(h.assetId)}<br>TINT ${escapeHtml(h.tint||'#ffffff')}<br>HOLDING ${escapeHtml(h.id.slice(0,10))}…</small></div></article>`;}).join('');
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
    await validRecipient(to); if(amount<1)throw new Error('Transfer at least 1 Credit.'); if(amount>state.creditBalance)throw new Error('You do not have enough Credits.');
    const id=crypto.randomUUID(), transferRef=fs.doc(db,'creditTransfers',id), fromWallet=fs.doc(db,'creditWallets',state.identity.profileId), toWallet=fs.doc(db,'creditWallets',to);
    const commitTransfer = async createRecipientWallet => {
      const batch=writeBatch(db);
      batch.set(transferRef,{fromProfileId:state.identity.profileId,toProfileId:to,amount,note,createdAt:fs.serverTimestamp()});
      batch.update(fromWallet,{balance:increment(-amount),lastEventId:id,lastEventType:'player_transfer_out',updatedAt:fs.serverTimestamp()});
      if(createRecipientWallet){
        batch.set(toWallet,{profileId:to,balance:amount,totalEarned:0,totalLost:0,lastEventId:id,lastEventType:'player_transfer_in',createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
      }else{
        batch.update(toWallet,{balance:increment(amount),lastEventId:id,lastEventType:'player_transfer_in',updatedAt:fs.serverTimestamp()});
      }
      await batch.commit();
    };
    try{ await commitTransfer(false); }
    catch(firstError){
      try{ await commitTransfer(true); }
      catch(secondError){ throw secondError || firstError; }
    }
    feedback('#transferFeedback',`${amount} Credits sent to ${profileName(to)}.`,'ok'); toast(`Sent ${amount} Credits to ${profileName(to)}`); $('#transferAmount').value='1';$('#transferNote').value='';
  } catch(error) { console.error('Credit transfer',error); feedback('#transferFeedback',error?.message||error?.code||'Transfer failed.','error'); }
}

async function createTrade(event) {
  event.preventDefault();
  if(!state.identity?.profileId)return feedback('#tradeFeedback','Sign in first.','error');
  const to=$('#tradeRecipient').value.trim(), credits=clampCredits($('#offerCredits').value), holdingId=$('#offerAsset').value;
  try {
    await validRecipient(to); if(credits>state.creditBalance)throw new Error('You do not have enough Credits for that offer.');
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
  } catch(error) { console.error('Create trade',error);feedback('#tradeFeedback',error?.message||error?.code||'Could not create trade.','error'); }
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

function bind() {
  scheduleRecipientLookup('#transferRecipient','#transferRecipientPreview');scheduleRecipientLookup('#tradeRecipient','#tradeRecipientPreview');
  $('#creditTransferForm')?.addEventListener('submit',sendCredits);$('#createTradeForm')?.addEventListener('submit',createTrade);
  document.addEventListener('click',e=>{const t=e.target.closest('[data-trade-filter],[data-lock-trade],[data-decline-trade],[data-cancel-trade],[data-complete-trade]');if(!t)return;
    if(t.dataset.tradeFilter){state.filter=t.dataset.tradeFilter;document.querySelectorAll('[data-trade-filter]').forEach(b=>b.classList.toggle('is-active',b===t));renderTradeBook();return;}
    if(t.dataset.lockTrade)lockRecipientSide(t.dataset.lockTrade);if(t.dataset.declineTrade)closeTrade(t.dataset.declineTrade,'declined');if(t.dataset.cancelTrade)closeTrade(t.dataset.cancelTrade,'cancelled');if(t.dataset.completeTrade)completeTrade(t.dataset.completeTrade);
  });
}

async function init() {
  bind();await loadCatalog();
  const prefill=new URLSearchParams(location.search).get('with')||'';if(PROFILE_RE.test(prefill)){['#transferRecipient','#tradeRecipient'].forEach(s=>{const el=$(s);if(el){el.value=prefill;el.dispatchEvent(new Event('input'));}});}
  watchIdentity(identity=>{
    state.identity=identity; if(identity?.profileId&&identity.profile)state.profileCache.set(identity.profileId,identity.profile);
    watchCredits();watchHoldings();watchTrades();
    if(!identity?.profileId){feedback('#transferFeedback','Sign in to send Credits.');feedback('#tradeFeedback','Sign in to create trades.');}
  });
}
init().catch(console.error);
