import { auth, db, fs, ensureIdentity } from '/game/assets/js/eras-data.js';

const $=s=>document.querySelector(s);
const isHostPage=()=>location.pathname==='/game/host/'||location.pathname==='/game/host/index.html'||location.pathname==='/game-mobile/host/'||location.pathname==='/game-mobile/host/index.html';
const code=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let out='';for(let i=0;i<6;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;};
const say=(message,tone='')=>{const el=$('#hostFeedback');if(el){el.textContent=String(message).toUpperCase();el.dataset.tone=tone;}};

function slimeSettings(){
  return {
    version:2,
    player:{maxHp:5,energyPerTurn:1,maxWalkDistance:50},
    currency:{mode:'local',name:'TOKENS',symbol:'◆',startingBalance:0,deathLossCap:10},
    galactic:{startSalary:200,maxRounds:50,developmentEnabled:true},
    modeId:'slime-smash',
    modeSettings:{startingSeconds:15,timeGainSeconds:.35,scorePerSlime:100},
    areas:[],items:[],mobs:[],terminals:[]
  };
}

async function createLegacyCompatibleSlimeLobby(event){
  if($('#gameStyle')?.value!=='slime-smash')return;
  event.preventDefault();
  event.stopImmediatePropagation();

  if($('#accessModel')?.value && $('#accessModel').value!=='free'){
    say('Slime Smash compatibility hosting currently requires FREE access.','error');
    return;
  }

  const identity=await ensureIdentity(auth.currentUser).catch(()=>null);
  if(!identity?.profileId){say('Sign in with Google first.','error');return;}

  const lobbyId=crypto.randomUUID();
  const joinCode=code();
  const name=($('#lobbyName')?.value||'My E.R.A.S. Game').trim().slice(0,50)||'My E.R.A.S. Game';
  const visibility=$('#visibility')?.value||'public';
  const maxPlayers=Math.min(8,Math.max(2,Number($('#maxPlayers')?.value)||8));
  const description=($('#description')?.value||'').trim().slice(0,240);
  const now=fs.serverTimestamp();
  const lobby={
    name,
    code:joinCode,
    hostProfileId:identity.profileId,
    visibility,
    maxPlayers,
    mapId:'slime-yard',
    gameStyle:'arcade-topdown',
    description,
    settings:slimeSettings(),
    hostAssets:[],
    accessOfferId:'',
    status:'open',
    createdAt:now,
    updatedAt:now,
    lastHeartbeatAt:now
  };

  let created=false;
  try{
    say('Creating Slime Smash…');
    await fs.setDoc(fs.doc(db,'gameLobbies',lobbyId),lobby);
    created=true;
    const memberRef=fs.doc(db,'gameLobbies',lobbyId,'members',identity.profileId);
    const modernMember={
      profileId:identity.profileId,
      role:'host',
      accessEntitlementId:'',
      accessStartedAt:fs.serverTimestamp(),
      accessLeaseSeconds:600,
      joinedAt:fs.serverTimestamp(),
      lastSeenAt:fs.serverTimestamp()
    };
    try{
      await fs.setDoc(memberRef,modernMember);
    }catch(memberError){
      if(memberError?.code!=='permission-denied')throw memberError;
      await fs.setDoc(memberRef,{
        profileId:identity.profileId,
        role:'host',
        accessEntitlementId:'',
        joinedAt:fs.serverTimestamp(),
        lastSeenAt:fs.serverTimestamp()
      });
    }
    location.href=`/game/slime-smash/?lobby=${encodeURIComponent(lobbyId)}`;
  }catch(error){
    console.error('Slime Smash compatibility host',error);
    if(created){try{await fs.deleteDoc(fs.doc(db,'gameLobbies',lobbyId));}catch(_){}}
    say(`Could not create Slime Smash: ${error?.code||error?.message||error}`,'error');
  }
}

if(isHostPage()){
  const install=()=>$('#hostForm')?.addEventListener('submit',createLegacyCompatibleSlimeLobby,true);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
