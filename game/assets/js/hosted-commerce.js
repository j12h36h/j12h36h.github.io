import { db, fs } from '/game/assets/js/eras-data.js';
import { ensureCreditWallet } from '/assets/js/credit-system.js';
import { writeBatch, increment } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

export const HOSTED_OFFER_COLLECTION='hostedOffers';
export const HOSTED_PURCHASE_COLLECTION='hostedPurchases';
export const HOSTED_ENTITLEMENT_COLLECTION='hostedEntitlements';
const clamp=(v,min=0,max=1000000)=>Math.max(min,Math.min(max,Math.floor(Number(v)||0)));
const text=(v,max=80)=>String(v??'').trim().replace(/\s+/g,' ').slice(0,max);

export function normalizeOffer(input={}){
  const offerType=['game_access','icon_license','bundle'].includes(input.offerType)?input.offerType:'bundle';
  const billing=['per_play','per_life','playtime','permanent','bundle'].includes(input.billing)?input.billing:(offerType==='bundle'?'bundle':'permanent');
  const assetHoldingIds=[...new Set(Array.isArray(input.assetHoldingIds)?input.assetHoldingIds.map(x=>text(x,180)).filter(Boolean):[])].slice(0,4);
  let playCount=clamp(input.playCount,0,9999),lifeCount=clamp(input.lifeCount,0,9999),minutes=clamp(input.minutes,0,100000),permanent=input.permanent===true;
  if(offerType!=='bundle'){
    playCount=billing==='per_play'?Math.max(1,playCount||1):0;
    lifeCount=billing==='per_life'?Math.max(1,lifeCount||1):0;
    minutes=billing==='playtime'?Math.max(1,minutes||30):0;
    permanent=billing==='permanent';
  }
  return {
    sellerProfileId:text(input.sellerProfileId,36), lobbyId:text(input.lobbyId,80), offerType, billing,
    title:text(input.title||'Hosted Offer',60), description:text(input.description||'',180), priceCredits:clamp(input.priceCredits,1,1000000),
    playCount,lifeCount,minutes,permanent,assetHoldingIds,active:input.active!==false
  };
}

export async function createHostedOffer(input){
  const offer=normalizeOffer(input);
  if(!offer.sellerProfileId)throw new Error('Seller profile is required.');
  await ensureCreditWallet(db,fs,offer.sellerProfileId);
  const id=crypto.randomUUID();
  await fs.setDoc(fs.doc(db,HOSTED_OFFER_COLLECTION,id),{...offer,createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
  return {id,...offer};
}

export async function deactivateHostedOffer(offerId,sellerProfileId){
  const ref=fs.doc(db,HOSTED_OFFER_COLLECTION,offerId);const snap=await fs.getDoc(ref);if(!snap.exists())return;
  if(snap.data().sellerProfileId!==sellerProfileId)throw new Error('Only the seller can close this offer.');
  await fs.updateDoc(ref,{active:false,updatedAt:fs.serverTimestamp()});
}

export async function offersForLobby(lobbyId){
  if(!lobbyId)return[];
  const q=fs.query(fs.collection(db,HOSTED_OFFER_COLLECTION),fs.where('lobbyId','==',lobbyId),fs.limit(50));
  const snap=await fs.getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>o.active!==false);
}
export async function publicBundleOffers(){
  const q=fs.query(fs.collection(db,HOSTED_OFFER_COLLECTION),fs.where('active','==',true),fs.limit(100));
  const snap=await fs.getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()})).filter(o=>o.offerType==='bundle');
}
export async function entitlementForOffer(profileId,offerId){
  if(!profileId||!offerId)return[];
  const q=fs.query(fs.collection(db,HOSTED_ENTITLEMENT_COLLECTION),fs.where('ownerProfileId','==',profileId),fs.where('offerId','==',offerId),fs.limit(50));
  const snap=await fs.getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()}));
}
export function entitlementUsable(e){return !!e&&(e.permanent===true||Number(e.remainingPlays||0)>0||Number(e.remainingLives||0)>0||Number(e.remainingSeconds||0)>0);}

export async function purchaseHostedOffer({offerId,buyerProfileId}){
  if(!offerId||!buyerProfileId)throw new Error('Offer and buyer are required.');
  const offerRef=fs.doc(db,HOSTED_OFFER_COLLECTION,offerId), offerSnap=await fs.getDoc(offerRef);
  if(!offerSnap.exists())throw new Error('That offer no longer exists.');
  const offer={id:offerSnap.id,...offerSnap.data()};
  if(!offer.active)throw new Error('That offer is closed.');
  if(offer.sellerProfileId===buyerProfileId)throw new Error('You cannot buy your own offer.');
  await ensureCreditWallet(db,fs,buyerProfileId);await ensureCreditWallet(db,fs,offer.sellerProfileId);
  const buyerWallet=fs.doc(db,'creditWallets',buyerProfileId), sellerWallet=fs.doc(db,'creditWallets',offer.sellerProfileId);
  const buyerSnap=await fs.getDoc(buyerWallet);if(!buyerSnap.exists()||Number(buyerSnap.data().balance||0)<Number(offer.priceCredits||0))throw new Error('You do not have enough Credits.');
  const id=crypto.randomUUID();const purchaseRef=fs.doc(db,HOSTED_PURCHASE_COLLECTION,id), entitlementRef=fs.doc(db,HOSTED_ENTITLEMENT_COLLECTION,id);
  const snapshot={buyerProfileId,sellerProfileId:offer.sellerProfileId,offerId,lobbyId:offer.lobbyId||'',offerType:offer.offerType,billing:offer.billing,priceCredits:clamp(offer.priceCredits,1,1000000),playCount:clamp(offer.playCount,0,9999),lifeCount:clamp(offer.lifeCount,0,9999),minutes:clamp(offer.minutes,0,100000),permanent:offer.permanent===true,assetHoldingIds:(offer.assetHoldingIds||[]).slice(0,4)};
  const batch=writeBatch(db);
  batch.set(purchaseRef,{...snapshot,createdAt:fs.serverTimestamp()});
  batch.set(entitlementRef,{ownerProfileId:buyerProfileId,sellerProfileId:offer.sellerProfileId,offerId,lobbyId:offer.lobbyId||'',offerType:offer.offerType,billing:offer.billing,remainingPlays:snapshot.playCount,remainingLives:snapshot.lifeCount,remainingSeconds:snapshot.minutes*60,permanent:snapshot.permanent,assetHoldingIds:snapshot.assetHoldingIds,createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp()});
  batch.update(buyerWallet,{balance:increment(-snapshot.priceCredits),lastEventId:id,lastEventType:'hosted_purchase_out',updatedAt:fs.serverTimestamp()});
  batch.update(sellerWallet,{balance:increment(snapshot.priceCredits),lastEventId:id,lastEventType:'hosted_purchase_in',updatedAt:fs.serverTimestamp()});
  await batch.commit();
  return {purchaseId:id,entitlementId:id,offer};
}

export async function consumeEntitlement(entitlementId,kind,amount=1){
  if(!entitlementId)return false;const key=kind==='life'?'remainingLives':kind==='seconds'?'remainingSeconds':'remainingPlays';const qty=Math.max(1,Math.floor(Number(amount)||1));
  return fs.runTransaction(db,async tx=>{const ref=fs.doc(db,HOSTED_ENTITLEMENT_COLLECTION,entitlementId),snap=await tx.get(ref);if(!snap.exists())return false;const d=snap.data();if(d.permanent===true)return true;const before=Math.max(0,Math.floor(Number(d[key])||0));if(before<qty)return false;tx.update(ref,{[key]:before-qty,updatedAt:fs.serverTimestamp()});return true;});
}
