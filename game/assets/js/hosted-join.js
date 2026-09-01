import { db, fs } from '/game/assets/js/eras-data.js';
import { purchaseHostedOffer, entitlementUsable } from '/game/assets/js/hosted-commerce.js?v=1.0.0';

async function entitlementsFor(profileId,offerId){const q=fs.query(fs.collection(db,'hostedEntitlements'),fs.where('ownerProfileId','==',profileId),fs.limit(100));const snap=await fs.getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.offerId===offerId&&entitlementUsable(e));}
function offerSummary(o){const p=[];if(o.playCount)p.push(`${o.playCount} play${o.playCount===1?'':'s'}`);if(o.lifeCount)p.push(`${o.lifeCount} ${o.lifeCount===1?'life':'lives'}`);if(o.minutes)p.push(`${o.minutes} minutes`);if(o.permanent)p.push('permanent access');return p.join(' + ')||o.billing;}
export async function obtainLobbyEntitlement(lobby,profileId){
  if(!lobby?.accessOfferId)return '';
  const offerRef=fs.doc(db,'hostedOffers',lobby.accessOfferId),snap=await fs.getDoc(offerRef);if(!snap.exists()||snap.data().active!==true)throw new Error('The host access offer is unavailable.');const offer={id:snap.id,...snap.data()};
  let owned=await entitlementsFor(profileId,offer.id);if(owned.length)return owned[0].id;
  const ok=confirm(`PAID HOSTED GAME\n\n${offer.title}\n${offerSummary(offer)}\n${Number(offer.priceCredits||0).toLocaleString()} Credits\n\nPurchase access and join?`);if(!ok)throw new Error('Purchase cancelled.');
  const result=await purchaseHostedOffer({offerId:offer.id,buyerProfileId:profileId});return result.entitlementId;
}
export async function createLobbyMembership(lobby,profileId,entitlementId=''){
  const memberRef=fs.doc(db,'gameLobbies',lobby.id,'members',profileId);const existing=await fs.getDoc(memberRef);if(existing.exists())return existing.data();
  await fs.runTransaction(db,async tx=>{const member=await tx.get(memberRef);if(member.exists())return;let entitlement=null,entRef=null;if(lobby.accessOfferId){if(!entitlementId)throw new Error('Paid access entitlement is required.');entRef=fs.doc(db,'hostedEntitlements',entitlementId);const es=await tx.get(entRef);if(!es.exists())throw new Error('Access entitlement no longer exists.');entitlement=es.data();if(entitlement.ownerProfileId!==profileId||entitlement.offerId!==lobby.accessOfferId||entitlement.lobbyId!==lobby.id)throw new Error('Access entitlement does not match this lobby.');if(entitlement.permanent!==true){if(entitlement.billing==='per_play'){if(Number(entitlement.remainingPlays||0)<1)throw new Error('No plays remain.');tx.update(entRef,{remainingPlays:Number(entitlement.remainingPlays)-1,updatedAt:fs.serverTimestamp()});}else if(entitlement.billing==='per_life'){if(Number(entitlement.remainingLives||0)<1)throw new Error('No lives remain.');tx.update(entRef,{remainingLives:Number(entitlement.remainingLives)-1,updatedAt:fs.serverTimestamp()});}else if(entitlement.billing==='playtime'&&Number(entitlement.remainingSeconds||0)<1)throw new Error('No playtime remains.');}}
    tx.set(memberRef,{profileId,role:lobby.hostProfileId===profileId?'host':'player',accessEntitlementId:lobby.accessOfferId?entitlementId:'',joinedAt:fs.serverTimestamp(),lastSeenAt:fs.serverTimestamp()});
  });
}
