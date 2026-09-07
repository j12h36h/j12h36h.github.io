const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const db = getFirestore();
const STEP = 5000;
const ALLOWED = Object.freeze(['surface-discovery','jeng-stroid','sunball','soldoku','galactic-dominion']);

async function callerProfileId(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated','Sign in first.');
  const account = await db.doc(`privateAccounts/${uid}`).get();
  const profileId = account.data()?.publicProfileId;
  if (!profileId) throw new HttpsError('failed-precondition','E.R.A.S. public profile is not linked.');
  return profileId;
}
function clean(value,max=40){return String(value||'').trim().slice(0,max);}
function token(profileId){return String(profileId||'').replace(/[^0-9a-zA-Z-]/g,'').slice(0,64);}
function scoreRef(gameId,profileId){return db.doc(`gameActions/${gameId}-best__${token(profileId)}`);}
function assertBase(gameId,action,profileId){
  if(!action||String(action.actorProfileId||'')!==profileId||action.status!=='resolved'||action.actionType!=='interact'||action.targetType!=='object')
    throw new HttpsError('failed-precondition','A verified Global score is required before Credits can be awarded.');
  if(action.worldId!==`global-${gameId}`||action.targetId!==`${gameId}-global-score`)
    throw new HttpsError('failed-precondition','The Global score record does not match this game.');
}
function verifiedScore(gameId,action,profileId){
  assertBase(gameId,action,profileId);
  const label=String(action.targetLabel||'');let m,score;
  if(gameId==='surface-discovery'){
    m=label.match(/^SUR:(\d+):(\d+):([01])$/);if(!m)throw new HttpsError('failed-precondition','Surface score payload is invalid.');
    score=Number(m[1]);const discoveries=Number(m[2]),complete=Number(m[3]);
    if(!Number.isInteger(discoveries)||discoveries<0||discoveries>10000||score!==discoveries*100+complete*5000)throw new HttpsError('failed-precondition','Surface score does not match the fixed Global ruleset.');
  }else if(gameId==='jeng-stroid'){
    m=label.match(/^JNG:(\d+):(\d+)$/);if(!m)throw new HttpsError('failed-precondition','Jeng-stroid score payload is invalid.');
    score=Number(m[1]);const removed=Number(m[2]);
    if(!Number.isInteger(removed)||removed<0||removed>1000||score!==removed*500)throw new HttpsError('failed-precondition','Jeng-stroid score does not match the fixed Global ruleset.');
  }else if(gameId==='sunball'){
    m=label.match(/^SUN:(\d+):(\d+)$/);if(!m)throw new HttpsError('failed-precondition','Sunball score payload is invalid.');
    score=Number(m[1]);const bumpers=Number(m[2]);
    if(!Number.isInteger(bumpers)||bumpers<0||bumpers>8000000||score!==bumpers*250)throw new HttpsError('failed-precondition','Sunball score does not match the fixed Global ruleset.');
  }else if(gameId==='soldoku'){
    m=label.match(/^SDK:(\d+):(\d+):(\d+):([01])$/);if(!m)throw new HttpsError('failed-precondition','Soldoku score payload is invalid.');
    score=Number(m[1]);const correct=Number(m[2]),mistakes=Number(m[3]),complete=Number(m[4]);
    const expected=Math.max(0,correct*100-mistakes*100+complete*5000);
    if(!Number.isInteger(correct)||correct<0||correct>81||!Number.isInteger(mistakes)||mistakes<0||mistakes>1000||score!==expected)throw new HttpsError('failed-precondition','Soldoku score does not match the fixed Global ruleset.');
  }else if(gameId==='galactic-dominion'){
    m=label.match(/^GAL:(\d+):(\d+):(\d+)$/);if(!m)throw new HttpsError('failed-precondition','Galactic Dominion score payload is invalid.');
    score=Number(m[1]);const netWorth=Number(m[2]),turns=Number(m[3]);
    if(turns!==40||!Number.isInteger(netWorth)||netWorth<0||netWorth>1000000000||score!==netWorth*2)throw new HttpsError('failed-precondition','Galactic Dominion score does not match the fixed Global ruleset.');
  }else throw new HttpsError('invalid-argument','Unsupported Global premade game.');
  if(!Number.isInteger(score)||score<0||score>2000000000)throw new HttpsError('failed-precondition','Global score is outside the accepted range.');
  return score;
}
function milestone(score){
  const level=Math.max(0,Math.floor(Number(score||0)/STEP));
  const total=level*(level+1)/2;
  return{level,total,reached:level*STEP,next:(level+1)*STEP,nextReward:level+1};
}

exports.claimGlobalPremadeMilestones = onCall(async request=>{
  const profileId=await callerProfileId(request);
  const gameId=clean(request.data?.gameId,40);
  if(!ALLOWED.includes(gameId))throw new HttpsError('invalid-argument','Unsupported Global premade game.');
  const sRef=scoreRef(gameId,profileId);
  const rewardId=`${gameId}__${profileId}`.replace(/[^0-9a-zA-Z_-]/g,'_').slice(0,180);
  const rewardRef=db.doc(`globalArcadeRewardClaims/${rewardId}`);
  const walletRef=db.doc(`creditWallets/${profileId}`);
  const now=Timestamp.now();let response=null;

  await db.runTransaction(async tx=>{
    const [scoreSnap,rewardSnap,walletSnap]=await Promise.all([tx.get(sRef),tx.get(rewardRef),tx.get(walletRef)]);
    if(!scoreSnap.exists)throw new HttpsError('failed-precondition','Finish a verified Global run before claiming milestone Credits.');
    const score=verifiedScore(gameId,scoreSnap.data(),profileId),m=milestone(score);
    const prior=rewardSnap.exists?rewardSnap.data():{};
    const priorLevel=Math.max(0,Math.floor(Number(prior.claimedLevel||0)));
    const priorCredits=Math.max(0,Math.floor(Number(prior.totalCreditsGranted||0)),priorLevel*(priorLevel+1)/2);
    const creditsAwarded=Math.max(0,m.total-priorCredits);

    if(creditsAwarded>0){
      const wallet=walletSnap.exists?walletSnap.data():{};
      tx.set(walletRef,{
        profileId,
        balance:Math.max(0,Number(wallet.balance||0))+creditsAwarded,
        totalEarned:Math.max(0,Number(wallet.totalEarned||0))+creditsAwarded,
        totalLost:Math.max(0,Number(wallet.totalLost||0)),
        lastEventId:`global_arcade_${gameId}_${m.level}`.slice(0,180),
        lastEventType:'global_arcade_milestone',
        createdAt:walletSnap.exists?(wallet.createdAt||now):now,
        updatedAt:now
      },{merge:true});
    }
    tx.set(rewardRef,{
      profileId,gameId,milestoneStep:STEP,
      claimedLevel:Math.max(priorLevel,m.level),
      totalCreditsGranted:Math.max(priorCredits,m.total),
      highestVerifiedScore:Math.max(0,Number(prior.highestVerifiedScore||0),score),
      lastAwardCredits:creditsAwarded,lastVerifiedScore:score,
      createdAt:rewardSnap.exists?(prior.createdAt||now):now,updatedAt:now
    },{merge:true});
    response={ok:true,gameId,score,creditsAwarded,milestoneLevel:m.level,milestoneScore:m.reached,totalCreditsGranted:Math.max(priorCredits,m.total),nextMilestoneScore:m.next,nextMilestoneReward:m.nextReward};
  });
  return response||{ok:true,gameId,creditsAwarded:0};
});
