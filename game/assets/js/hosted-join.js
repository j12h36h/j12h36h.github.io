import { db, fs } from '/game/assets/js/eras-data.js';
import { purchaseHostedOffer, entitlementUsable } from '/game/assets/js/hosted-commerce.js?v=1.0.1';

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
export async function obtainLobbyEntitlement(lobby,profileId){
  if(!lobby?.accessOfferId)return '';
  const owned=(await ownerEntitlements(profileId)).filter(e=>entitlementCanEnterLobby(e,lobby));
  if(owned.length){
    // Prefer the explicit access offer, then permanent access, then the entitlement
    // with the most remaining session capacity.
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
export async function createLobbyMembership(lobby,profileId,entitlementId=''){
  const memberRef=fs.doc(db,'gameLobbies',lobby.id,'members',profileId);const existing=await fs.getDoc(memberRef);if(existing.exists())return existing.data();
  await fs.runTransaction(db,async tx=>{
    const member=await tx.get(memberRef);if(member.exists())return;
    if(lobby.accessOfferId){
      if(!entitlementId)throw new Error('Paid access entitlement is required.');
      const entRef=fs.doc(db,'hostedEntitlements',entitlementId),es=await tx.get(entRef);
      if(!es.exists())throw new Error('Access entitlement no longer exists.');
      const entitlement=es.data();
      if(entitlement.ownerProfileId!==profileId||entitlement.lobbyId!==lobby.id)throw new Error('Access entitlement does not match this lobby.');
      if(entitlement.offerId!==lobby.accessOfferId&&entitlement.offerType!=='bundle')throw new Error('This entitlement does not grant access to this lobby.');
      if(entitlement.permanent!==true){
        if(entitlement.billing==='per_play'){
          if(Number(entitlement.remainingPlays||0)<1)throw new Error('No plays remain.');
          tx.update(entRef,{remainingPlays:Number(entitlement.remainingPlays)-1,updatedAt:fs.serverTimestamp()});
        }else if(entitlement.billing==='per_life'){
          if(Number(entitlement.remainingLives||0)<1)throw new Error('No lives remain.');
          tx.update(entRef,{remainingLives:Number(entitlement.remainingLives)-1,updatedAt:fs.serverTimestamp()});
        }else if(entitlement.billing==='playtime'){
          if(Number(entitlement.remainingSeconds||0)<1)throw new Error('No playtime remains.');
        }else if(entitlement.billing==='bundle'){
          if(Number(entitlement.remainingPlays||0)>0){
            tx.update(entRef,{remainingPlays:Number(entitlement.remainingPlays)-1,updatedAt:fs.serverTimestamp()});
          }else if(Number(entitlement.remainingLives||0)>0){
            tx.update(entRef,{remainingLives:Number(entitlement.remainingLives)-1,updatedAt:fs.serverTimestamp()});
          }else if(Number(entitlement.remainingSeconds||0)<1){
            throw new Error('This bundle has no hosted-game access remaining.');
          }
        }else throw new Error('Unsupported hosted access entitlement.');
      }
    }
    tx.set(memberRef,{profileId,role:lobby.hostProfileId===profileId?'host':'player',accessEntitlementId:lobby.accessOfferId?entitlementId:'',joinedAt:fs.serverTimestamp(),lastSeenAt:fs.serverTimestamp()});
  });
}
