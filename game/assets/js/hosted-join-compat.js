import { db, fs } from '/game/assets/js/eras-data.js';
import * as modern from '/game/assets/js/hosted-join.js?v=1.2.0';

const legacySlime=lobby=>lobby?.settings?.modeId==='slime-smash'&&lobby?.gameStyle==='arcade-topdown'&&lobby?.mapId==='slime-yard';
export const membershipLeaseRemainingMs=modern.membershipLeaseRemainingMs;
export const obtainLobbyEntitlement=modern.obtainLobbyEntitlement;

export async function createLobbyMembership(lobby,profileId,entitlementId=''){
  if(!legacySlime(lobby))return modern.createLobbyMembership(lobby,profileId,entitlementId);
  if(!lobby?.id||!profileId)throw new Error('Lobby and profile are required.');
  if(lobby.accessOfferId)throw new Error('Slime Smash compatibility hosting currently supports free access only.');
  const ref=fs.doc(db,'gameLobbies',lobby.id,'members',profileId);
  const snap=await fs.getDoc(ref);
  if(snap.exists()){
    await fs.updateDoc(ref,{lastSeenAt:fs.serverTimestamp()});
    return snap.data();
  }
  const member={profileId,role:lobby.hostProfileId===profileId?'host':'player',accessEntitlementId:'',joinedAt:fs.serverTimestamp(),lastSeenAt:fs.serverTimestamp()};
  await fs.setDoc(ref,member);
  return member;
}

export function maintainLobbyMembership(lobby,profileId,{onExpired,onError}={}){
  if(!legacySlime(lobby))return modern.maintainLobbyMembership(lobby,profileId,{onExpired,onError});
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
