import { db, fs } from '/game/assets/js/eras-data.js';
import * as modern from '/game/assets/js/hosted-join.js?v=1.2.0';

export const membershipLeaseRemainingMs=modern.membershipLeaseRemainingMs;
export const obtainLobbyEntitlement=modern.obtainLobbyEntitlement;

const isPermissionDenied=error=>error?.code==='permission-denied';
const timestampMillis=value=>{try{return Number(value?.toMillis?.()||0);}catch(_){return 0;}};
const hasModernLease=member=>!!timestampMillis(member?.accessStartedAt)&&Math.floor(Number(member?.accessLeaseSeconds)||0)>0;

function legacyEntitlementPatch(entitlement){
  if(entitlement?.permanent===true)return null;
  if(entitlement?.billing==='per_play'){
    const n=Math.floor(Number(entitlement.remainingPlays)||0);if(n<1)throw new Error('No plays remain.');
    return {remainingPlays:n-1};
  }
  if(entitlement?.billing==='per_life'){
    const n=Math.floor(Number(entitlement.remainingLives)||0);if(n<1)throw new Error('No lives remain.');
    return {remainingLives:n-1};
  }
  if(entitlement?.billing==='playtime'){
    const n=Math.floor(Number(entitlement.remainingSeconds)||0);if(n<1)throw new Error('No playtime remains.');
    return null; // Legacy rules validated playtime access without decrementing the entitlement on member creation.
  }
  if(entitlement?.billing==='bundle'){
    if(entitlement.permanent===true)return null;
    const plays=Math.floor(Number(entitlement.remainingPlays)||0);if(plays>0)return {remainingPlays:plays-1};
    const lives=Math.floor(Number(entitlement.remainingLives)||0);if(lives>0)return {remainingLives:lives-1};
    const seconds=Math.floor(Number(entitlement.remainingSeconds)||0);if(seconds>0)return null;
    throw new Error('This bundle has no hosted-game access remaining.');
  }
  throw new Error('Unsupported hosted access entitlement.');
}

async function createLegacyMembership(lobby,profileId,entitlementId=''){
  if(!lobby?.id||!profileId)throw new Error('Lobby and profile are required.');
  const memberRef=fs.doc(db,'gameLobbies',lobby.id,'members',profileId);
  return fs.runTransaction(db,async tx=>{
    const memberSnap=await tx.get(memberRef),existing=memberSnap.exists()?memberSnap.data():null;
    if(existing){
      tx.update(memberRef,{lastSeenAt:fs.serverTimestamp()});
      return existing;
    }
    const isHost=lobby.hostProfileId===profileId,paid=!isHost&&!!lobby.accessOfferId;
    let accessEntitlementId='';
    if(paid){
      accessEntitlementId=String(entitlementId||'');
      if(!accessEntitlementId)throw new Error('Paid access entitlement is required.');
      const entRef=fs.doc(db,'hostedEntitlements',accessEntitlementId),snap=await tx.get(entRef);
      if(!snap.exists())throw new Error('Access entitlement no longer exists.');
      const entitlement=snap.data();
      if(entitlement.ownerProfileId!==profileId||entitlement.lobbyId!==lobby.id)throw new Error('Access entitlement does not match this lobby.');
      if(entitlement.offerId!==lobby.accessOfferId&&entitlement.offerType!=='bundle')throw new Error('This entitlement does not grant access to this lobby.');
      const patch=legacyEntitlementPatch(entitlement);
      if(patch)tx.update(entRef,{...patch,updatedAt:fs.serverTimestamp()});
    }
    const member={profileId,role:isHost?'host':'player',accessEntitlementId,joinedAt:fs.serverTimestamp(),lastSeenAt:fs.serverTimestamp()};
    tx.set(memberRef,member);
    return member;
  });
}

export async function createLobbyMembership(lobby,profileId,entitlementId=''){
  try{return await modern.createLobbyMembership(lobby,profileId,entitlementId);}
  catch(error){
    if(!isPermissionDenied(error))throw error;
    // A failed modern transaction is atomic, so it is safe to retry using the
    // legacy member shape used by the currently deployed pre-lease rules.
    return createLegacyMembership(lobby,profileId,entitlementId);
  }
}

function legacyHeartbeat(lobby,profileId,{onExpired,onError}={}){
  let stopped=false,timer=0,busy=false;
  const schedule=(ms=15000)=>{clearTimeout(timer);if(!stopped)timer=setTimeout(tick,ms);};
  const tick=async()=>{
    if(stopped||busy)return;busy=true;
    try{
      const ref=fs.doc(db,'gameLobbies',lobby.id,'members',profileId),snap=await fs.getDoc(ref);
      if(!snap.exists()){onExpired?.();return;}
      await fs.updateDoc(ref,{lastSeenAt:fs.serverTimestamp()});
      schedule();
    }catch(error){onError?.(error);schedule(5000);}finally{busy=false;}
  };
  schedule(1000);
  return()=>{stopped=true;clearTimeout(timer);};
}

export function maintainLobbyMembership(lobby,profileId,{onExpired,onError}={}){
  let stopped=false,innerStop=null;
  (async()=>{
    try{
      const ref=fs.doc(db,'gameLobbies',lobby.id,'members',profileId),snap=await fs.getDoc(ref);
      if(stopped)return;
      if(!snap.exists()){onExpired?.();return;}
      // Free/host lobbies only need a heartbeat under either rule generation.
      if(lobby.hostProfileId===profileId||!lobby.accessOfferId||!hasModernLease(snap.data()))
        innerStop=legacyHeartbeat(lobby,profileId,{onExpired,onError});
      else
        innerStop=modern.maintainLobbyMembership(lobby,profileId,{onExpired,onError});
    }catch(error){if(!stopped)onError?.(error);}
  })();
  return()=>{stopped=true;innerStop?.();};
}
