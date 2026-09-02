import { db, fs } from '/game/assets/js/eras-data.js';
import { purchaseHostedOffer, entitlementUsable } from '/game/assets/js/hosted-commerce.js?v=1.1.0';

const FREE_LEASE_SECONDS = 600;
const SESSION_LEASE_SECONDS = 21600;
const PLAYTIME_CHUNK_SECONDS = 60;

async function ownerEntitlements(profileId){
  if(!profileId)return[];
  const q=fs.query(fs.collection(db,'hostedEntitlements'),fs.where('ownerProfileId','==',profileId),fs.limit(100));
  const snap=await fs.getDocs(q);
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
function entitlementCanEnterLobby(e,lobby){
  if(!e||!lobby||!entitlementUsable(e)||e.lobbyId!==lobby.id)return false;
  return e.offerId===lobby.accessOfferId || e.offerType==='bundle';
}
function offerSummary(o){const p=[];if(o.playCount)p.push(`${o.playCount} play${o.playCount===1?'':'s'}`);if(o.lifeCount)p.push(`${o.lifeCount} ${o.lifeCount===1?'life':'lives'}`);if(o.minutes)p.push(`${o.minutes} minutes`);if(o.permanent)p.push('permanent access');return p.join(' + ')||o.billing;}
function timestampMillis(value){try{return Number(value?.toMillis?.()||0);}catch(_){return 0;}}
export function membershipLeaseRemainingMs(member,now=Date.now()){
  const started=timestampMillis(member?.accessStartedAt), seconds=Math.max(0,Math.floor(Number(member?.accessLeaseSeconds)||0));
  return started&&seconds ? started + seconds*1000 - Number(now||Date.now()) : -1;
}

export async function obtainLobbyEntitlement(lobby,profileId){
  if(!lobby?.accessOfferId || lobby?.hostProfileId===profileId)return '';
  const owned=(await ownerEntitlements(profileId)).filter(e=>entitlementCanEnterLobby(e,lobby));
  if(owned.length){
    owned.sort((a,b)=>Number(b.offerId===lobby.accessOfferId)-Number(a.offerId===lobby.accessOfferId)
      || Number(b.permanent===true)-Number(a.permanent===true)
      || (Number(b.remainingPlays||0)+Number(b.remainingLives||0)+Number(b.remainingSeconds||0))-(Number(a.remainingPlays||0)+Number(a.remainingLives||0)+Number(a.remainingSeconds||0)));
    return owned[0].id;
  }
  const offerRef=fs.doc(db,'hostedOffers',lobby.accessOfferId),snap=await fs.getDoc(offerRef);
  if(!snap.exists()||snap.data().active!==true)throw new Error('The host access offer is unavailable.');
  const offer={id:snap.id,...snap.data()};
  const ok=confirm(`PAID HOSTED GAME\n\n${offer.title}\n${offerSummary(offer)}\n${Number(offer.priceCredits||0).toLocaleString()} Credits\n\nPurchase access and join?`);
  if(!ok)throw new Error('Purchase cancelled.');
  const result=await purchaseHostedOffer({offerId:offer.id,buyerProfileId:profileId});return result.entitlementId;
}

function entitlementLease(entitlement){
  if(entitlement?.permanent===true)return {seconds:FREE_LEASE_SECONDS,patch:null};
  if(entitlement?.billing==='per_play'){
    const n=Math.floor(Number(entitlement.remainingPlays)||0);if(n<1)throw new Error('No plays remain.');
    return {seconds:SESSION_LEASE_SECONDS,patch:{remainingPlays:n-1}};
  }
  if(entitlement?.billing==='per_life'){
    const n=Math.floor(Number(entitlement.remainingLives)||0);if(n<1)throw new Error('No lives remain.');
    return {seconds:SESSION_LEASE_SECONDS,patch:{remainingLives:n-1}};
  }
  if(entitlement?.billing==='playtime'){
    const n=Math.floor(Number(entitlement.remainingSeconds)||0);if(n<1)throw new Error('No playtime remains.');
    const spend=Math.min(PLAYTIME_CHUNK_SECONDS,n);return {seconds:spend,patch:{remainingSeconds:n-spend}};
  }
  if(entitlement?.billing==='bundle'){
    if(entitlement.permanent===true)return {seconds:FREE_LEASE_SECONDS,patch:null};
    const plays=Math.floor(Number(entitlement.remainingPlays)||0);if(plays>0)return {seconds:SESSION_LEASE_SECONDS,patch:{remainingPlays:plays-1}};
    const lives=Math.floor(Number(entitlement.remainingLives)||0);if(lives>0)return {seconds:SESSION_LEASE_SECONDS,patch:{remainingLives:lives-1}};
    const seconds=Math.floor(Number(entitlement.remainingSeconds)||0);if(seconds>0){const spend=Math.min(PLAYTIME_CHUNK_SECONDS,seconds);return {seconds:spend,patch:{remainingSeconds:seconds-spend}};}
    throw new Error('This bundle has no hosted-game access remaining.');
  }
  throw new Error('Unsupported hosted access entitlement.');
}

export async function createLobbyMembership(lobby,profileId,entitlementId=''){
  if(!lobby?.id||!profileId)throw new Error('Lobby and profile are required.');
  const memberRef=fs.doc(db,'gameLobbies',lobby.id,'members',profileId);
  return fs.runTransaction(db,async tx=>{
    const memberSnap=await tx.get(memberRef), existing=memberSnap.exists()?memberSnap.data():null;
    const isHost=lobby.hostProfileId===profileId, paid=!isHost&&!!lobby.accessOfferId;
    const existingHasLease=!!timestampMillis(existing?.accessStartedAt)&&Math.floor(Number(existing?.accessLeaseSeconds)||0)>0;
    if(existing&&existingHasLease&&(!paid||membershipLeaseRemainingMs(existing)>1000)){
      tx.update(memberRef,{lastSeenAt:fs.serverTimestamp()});
      return existing;
    }
    let accessEntitlementId='', leaseSeconds=FREE_LEASE_SECONDS, entitlementPatch=null, entRef=null;
    if(paid){
      accessEntitlementId=String(entitlementId||existing?.accessEntitlementId||'');
      if(!accessEntitlementId)throw new Error('Paid access entitlement is required.');
      entRef=fs.doc(db,'hostedEntitlements',accessEntitlementId);
      const es=await tx.get(entRef);if(!es.exists())throw new Error('Access entitlement no longer exists.');
      const entitlement=es.data();
      if(entitlement.ownerProfileId!==profileId||entitlement.lobbyId!==lobby.id)throw new Error('Access entitlement does not match this lobby.');
      if(entitlement.offerId!==lobby.accessOfferId&&entitlement.offerType!=='bundle')throw new Error('This entitlement does not grant access to this lobby.');
      const lease=entitlementLease(entitlement);leaseSeconds=lease.seconds;entitlementPatch=lease.patch;
    }
    if(entRef&&entitlementPatch)tx.update(entRef,{...entitlementPatch,updatedAt:fs.serverTimestamp()});
    const member={
      profileId,
      role:isHost?'host':'player',
      accessEntitlementId,
      accessStartedAt:fs.serverTimestamp(),
      accessLeaseSeconds:leaseSeconds,
      joinedAt:existing?.joinedAt||fs.serverTimestamp(),
      lastSeenAt:fs.serverTimestamp()
    };
    if(existing)tx.set(memberRef,member);else tx.set(memberRef,member);
    return member;
  });
}

// Keeps paid playtime/permanent leases valid using Firestore server-time leases.
// A modified browser can stop this timer, but that only causes its authority to
// expire; it cannot preserve access without a valid server-approved renewal.
export function maintainLobbyMembership(lobby,profileId,{onExpired,onError}={}){
  let stopped=false,timer=0,busy=false,member=null,entitlementId='';
  const schedule=(ms=1000)=>{clearTimeout(timer);if(!stopped)timer=setTimeout(tick,ms);};
  const tick=async()=>{
    if(stopped||busy)return;busy=true;
    try{
      const ref=fs.doc(db,'gameLobbies',lobby.id,'members',profileId), snap=await fs.getDoc(ref);
      if(!snap.exists()){onExpired?.();return;}
      member=snap.data();entitlementId=member.accessEntitlementId||entitlementId;
      if(lobby.hostProfileId===profileId||!lobby.accessOfferId){
        if(Date.now()-(timestampMillis(member.lastSeenAt)||0)>30000)await fs.updateDoc(ref,{lastSeenAt:fs.serverTimestamp()});
        schedule(15000);return;
      }
      const remaining=membershipLeaseRemainingMs(member);
      if(remaining<=1200){
        try{await createLobbyMembership(lobby,profileId,entitlementId);}
        catch(error){
          if(error?.code==='permission-denied'&&remaining>0){schedule(Math.max(500,remaining+250));return;}
          onExpired?.(error);return;
        }
        schedule(1000);return;
      }
      if(remaining>0){schedule(Math.min(5000,Math.max(750,remaining-900)));return;}
      onExpired?.();
    }catch(error){onError?.(error);schedule(5000);}finally{busy=false;}
  };
  tick();
  return ()=>{stopped=true;clearTimeout(timer);};
}
