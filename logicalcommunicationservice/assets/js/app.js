import { LCS_CONFIG } from './config.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const state = {
  user: null,
  firebaseReady: false,
  firebase: null,
  posts: [],
  objects: [],
  activeType: 'unclassified',
  activeFilter: 'all',
  activeView: 'home',
  spaces: ['Open Commons', 'DAI', 'Game Design', 'Research'],
  profiles: {},
  publicProfile: null,
  profilePrompted: false,
  unsubPosts: null,
  unsubObjects: null,
  unsubProfiles: null
};

const reasoning = {
  observation: { plain: 'I noticed', formal: 'Observation', symbol: '👀', description: 'Something you directly saw, measured, heard, or recorded.', example: 'Three new people asked the same setup question today.' },
  premise: { plain: 'We know', formal: 'Premise', symbol: '📌', description: 'A starting fact, rule, or point everyone in the discussion is accepting.', example: 'The current build only supports one active profile.' },
  deduction: { plain: 'This follows', formal: 'Deduction', symbol: '→', description: 'A conclusion that follows from the stated facts or premises.', example: 'If every account needs its own profile, one active profile cannot represent two accounts at once.' },
  assumption: { plain: "I'm assuming", formal: 'Assumption', symbol: '☁', description: 'Something being treated as true even though it has not been established yet.', example: 'I am assuming most people want to sign in with Google.' },
  hypothesis: { plain: 'Maybe', formal: 'Hypothesis', symbol: '🧪', description: 'A possible explanation or solution that can be tested.', example: 'Maybe people lose project context because decisions are separated from chat.' },
  question: { plain: 'I need to know', formal: 'Question', symbol: '?', description: 'Missing information that could change the conclusion.', example: 'How many people need private projects?' },
  unclassified: { plain: 'Just say it', formal: 'Unclassified', symbol: '💬', description: 'Normal communication with no reasoning label required.', example: 'I have an idea for a better project page.' }
};

const seedObjects = [
  { id:'obj-1', kind:'idea', title:'A network organized around ideas', description:'Follow ideas, problems, and projects instead of forcing every conversation into a server or feed.', tags:['collaboration','social'], authorName:'LCS', createdAt:Date.now()-7200000, x:48, y:42 },
  { id:'obj-2', kind:'problem', title:'Decisions lose their reasons', description:'Teams often remember what they decided but lose the evidence, alternatives, and reasoning that produced the decision.', tags:['communication','history'], authorName:'LCS', createdAt:Date.now()-6800000, x:20, y:24 },
  { id:'obj-3', kind:'project', title:'Logical Communication Service', description:'A browser-based place where ordinary conversation can preserve ideas, evidence, assumptions, decisions, and work.', tags:['web','open'], authorName:'J12H36H', createdAt:Date.now()-6200000, x:71, y:22 },
  { id:'obj-4', kind:'idea', title:'Plain language reasoning', description:'Show “I noticed” before “Observation” so formal logic becomes learnable without becoming a barrier.', tags:['ux','learning'], authorName:'LCS', createdAt:Date.now()-5400000, x:77, y:63 },
  { id:'obj-5', kind:'problem', title:'Complex tools hide depth', description:'Beginner-friendly interfaces often remove capabilities instead of revealing them only when they become useful.', tags:['ux','tools'], authorName:'LCS', createdAt:Date.now()-5000000, x:29, y:70 },
  { id:'obj-6', kind:'project', title:'DAI Universe', description:'An example constellation of projects that can live inside a larger network without defining the network itself.', tags:['minecraft','ecosystem'], authorName:'J12H36H', createdAt:Date.now()-4300000, x:49, y:78 }
];

const seedPosts = [
  { id:'post-1', text:'I keep seeing project discussions preserve the final decision but lose why the decision made sense at the time.', reasoningType:'observation', kind:'problem', space:'Open Commons', authorName:'Mira', authorPhoto:'', createdAt:Date.now()-1000*60*17 },
  { id:'post-2', text:'Maybe the interface should never force someone to choose a formal reasoning type. The label can be optional until structure becomes useful.', reasoningType:'hypothesis', kind:'idea', space:'Open Commons', authorName:'Theo', authorPhoto:'', createdAt:Date.now()-1000*60*42 },
  { id:'post-3', text:'I am assuming “easy access” means fewer visible choices. That might be wrong — a spatial interface could expose more choices while making their relationships easier to understand.', reasoningType:'assumption', kind:'idea', space:'Game Design', authorName:'Ari', authorPhoto:'', createdAt:Date.now()-1000*60*71 },
  { id:'post-4', text:'If an assumption is displayed as an assumption instead of being silently promoted into a fact, disagreement becomes much easier to locate.', reasoningType:'deduction', kind:'project', space:'Open Commons', authorName:'LCS', authorPhoto:'', createdAt:Date.now()-1000*60*128 }
];

function isFirebaseConfigured(){
  const f = LCS_CONFIG.firebase || {};
  return Boolean(f.apiKey && f.projectId && f.appId && !f.apiKey.includes('YOUR_'));
}

function escapeHtml(value=''){
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function timeAgo(ts){
  const n = typeof ts === 'number' ? ts : ts?.toMillis ? ts.toMillis() : Date.now();
  const s = Math.max(1, Math.floor((Date.now()-n)/1000));
  if(s<60) return `${s}s ago`; const m=Math.floor(s/60); if(m<60) return `${m}m ago`; const h=Math.floor(m/60); if(h<24) return `${h}h ago`; return `${Math.floor(h/24)}d ago`;
}

function toast(message){
  const el=document.createElement('div'); el.className='toast'; el.textContent=message; $('#toastRegion').appendChild(el); setTimeout(()=>el.remove(),3200);
}

function setBackendStatus(title,text){ $('#backendStatusTitle').textContent=title; $('#backendStatusText').textContent=text; }

function clearAuthError(){
  const box=$('#authErrorBox');
  if(!box) return;
  box.hidden=true;
  $('#authErrorTitle').textContent='';
  $('#authErrorText').textContent='';
  $('#authErrorCode').textContent='';
}

function authErrorMessage(error){
  const code=String(error?.code||'auth/unknown');
  const message=String(error?.message||'');
  const firebaseAuthDomain=LCS_CONFIG.firebase?.authDomain||'the Firebase auth domain';

  if(code==='auth/unauthorized-domain'){
    return {
      title:'This website is not authorized yet',
      text:`Add ${location.hostname} in Firebase Console → Authentication → Settings → Authorized domains, then try again.`
    };
  }

  if(code==='auth/operation-not-allowed'){
    return {
      title:'Google sign-in is not enabled yet',
      text:'Enable Google in Firebase Console → Authentication → Sign-in method, save it, then try again.'
    };
  }

  if(code==='auth/configuration-not-found'){
    return {
      title:'Firebase Authentication needs setup',
      text:'Open Firebase Console for this project and initialize Authentication, then enable the Google provider.'
    };
  }

  if(code.includes('requests-from-referer') || /Requests from referer/i.test(message) || /PERMISSION_DENIED/i.test(message)){
    return {
      title:'The Firebase browser key is blocking the auth popup',
      text:`In Google Cloud → APIs & Services → Credentials, edit the Firebase Web API key. If Website/HTTP-referrer restrictions are enabled, allow both https://${location.hostname}/* and https://${firebaseAuthDomain}/*. Keep the key restricted to the Firebase APIs required by this app.`
    };
  }

  if(['auth/api-key-not-valid','auth/invalid-api-key'].includes(code)){
    return {
      title:'The Firebase Web API key is invalid',
      text:'Re-copy the Firebase Web App configuration from Firebase Console → Project settings → Your apps → SDK setup and configuration.'
    };
  }

  if(code==='auth/popup-blocked'){
    return {
      title:'The browser blocked the Google window',
      text:'Allow popups for this site and press Continue with Google again.'
    };
  }

  if(code==='auth/popup-closed-by-user'){
    return {
      title:'Google sign-in closed before completion',
      text:`If you did not close it yourself, verify Google is enabled, ${location.hostname} is an Authorized domain, and any Website restrictions on the Firebase key also allow https://${firebaseAuthDomain}/*.`
    };
  }

  if(code==='auth/network-request-failed'){
    return {
      title:'Google sign-in could not reach Firebase',
      text:'Check the connection, browser privacy/ad-blocking settings, and then try again.'
    };
  }

  return {
    title:'Google sign-in did not complete',
    text:'The exact Firebase error is shown below so the configuration can be corrected instead of silently closing the popup.'
  };
}

function showAuthError(error){
  const box=$('#authErrorBox');
  if(!box) return;
  const details=authErrorMessage(error);
  $('#authErrorTitle').textContent=details.title;
  $('#authErrorText').textContent=details.text;
  $('#authErrorCode').textContent=String(error?.code||error?.message||'auth/unknown');
  box.hidden=false;
}

function generatedPublicName(user){
  const suffix=String(user?.uid||'member').replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase()||'NEW';
  return `Member-${suffix}`;
}

function fallbackPublicProfile(user=state.user){
  return {
    displayName: generatedPublicName(user),
    bio: '',
    useGooglePhoto: false,
    photoURL: ''
  };
}

function ownPublicProfile(){
  if(!state.user) return null;
  return state.publicProfile || state.profiles[state.user.uid] || fallbackPublicProfile(state.user);
}

function publicIdentityForContent(content={}){
  const profile=content.authorUid ? state.profiles[content.authorUid] : null;
  return {
    displayName: profile?.displayName || content.authorName || 'Member',
    photoURL: profile ? (profile.photoURL||'') : (content.authorPhoto||''),
    bio: profile?.bio || ''
  };
}

function initialsFor(name='Member'){
  return String(name).trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'ME';
}

function profileAvatarMarkup(profile, className='auth-fallback-avatar'){
  if(profile?.photoURL) return `<img src="${escapeHtml(profile.photoURL)}" alt="" referrerpolicy="no-referrer">`;
  return `<span class="${className}">${escapeHtml(initialsFor(profile?.displayName))}</span>`;
}

function updateAccountPreview(){
  const input=$('#accountDisplayName');
  if(!input) return;
  const name=input.value.trim() || ownPublicProfile()?.displayName || 'Member';
  const bio=$('#accountBio').value.trim();
  const usePhoto=$('#accountUseGooglePhoto').checked;
  const photo=usePhoto ? (state.user?.photoURL||'') : '';
  $('#accountPreviewName').textContent=name;
  $('#accountPreviewBio').textContent=bio || 'No public bio yet.';
  $('#accountBioCounter').textContent=`${$('#accountBio').value.length} / 240`;
  $('#accountPublicAvatar').innerHTML=photo
    ? `<img src="${escapeHtml(photo)}" alt="" referrerpolicy="no-referrer">`
    : escapeHtml(initialsFor(name));
}

function renderAccount(){
  const signedOut=$('#accountSignedOut');
  const signedIn=$('#accountSignedIn');
  if(!signedOut || !signedIn) return;

  if(!state.user){
    signedOut.hidden=false;
    signedIn.hidden=true;
    return;
  }

  signedOut.hidden=true;
  signedIn.hidden=false;
  const profile=ownPublicProfile();
  $('#accountDisplayName').value=profile.displayName||generatedPublicName(state.user);
  $('#accountBio').value=profile.bio||'';
  $('#accountUseGooglePhoto').checked=Boolean(profile.useGooglePhoto && state.user.photoURL);
  $('#accountProviderName').textContent=state.user.displayName||'Not provided';
  $('#accountProviderEmail').textContent=state.user.email||'Not provided';
  $('#accountSaveStatus').textContent='';
  updateAccountPreview();
}

async function ensurePublicProfile(user){
  if(!user) return;

  if(!state.firebaseReady){
    state.publicProfile=state.profiles[user.uid] || fallbackPublicProfile(user);
    state.profiles[user.uid]=state.publicProfile;
    renderAuth(); renderAccount(); renderFeed();
    return;
  }

  const {db,fsMod}=state.firebase;
  const ref=fsMod.doc(db,'users',user.uid);
  try{
    const snap=await fsMod.getDoc(ref);
    if(snap.exists()){
      state.publicProfile={id:snap.id,...snap.data()};
      state.profiles[user.uid]=state.publicProfile;
    }else{
      const profile={
        displayName:generatedPublicName(user),
        bio:'',
        useGooglePhoto:false,
        photoURL:'',
        createdAt:fsMod.serverTimestamp(),
        updatedAt:fsMod.serverTimestamp()
      };
      await fsMod.setDoc(ref,profile);
      state.publicProfile={...profile,createdAt:Date.now(),updatedAt:Date.now()};
      state.profiles[user.uid]=state.publicProfile;
      if(!state.profilePrompted){
        state.profilePrompted=true;
        setView('account');
        toast('Choose the public name people should know you by.');
      }
    }
  }catch(error){
    console.error('Could not load/create public profile:',error);
    state.publicProfile=fallbackPublicProfile(user);
    state.profiles[user.uid]=state.publicProfile;
    toast('Signed in, but the public profile could not be loaded yet.');
  }
  renderAuth(); renderAccount(); renderFeed(); renderCatalogs();
}

async function syncAuthoredContentProfile(profile){
  if(!state.firebaseReady || !state.user) return 0;
  const {db,fsMod}=state.firebase;
  const batch=fsMod.writeBatch(db);
  let changed=0;
  for(const collectionName of ['posts','objects']){
    const q=fsMod.query(
      fsMod.collection(db,collectionName),
      fsMod.where('authorUid','==',state.user.uid),
      fsMod.limit(200)
    );
    const snap=await fsMod.getDocs(q);
    snap.forEach(docSnap=>{
      batch.update(docSnap.ref,{authorName:profile.displayName,authorPhoto:profile.photoURL||''});
      changed++;
    });
  }
  if(changed) await batch.commit();
  return changed;
}

async function savePublicProfile(event){
  event.preventDefault();
  if(!state.user){
    $('#authDialog').showModal();
    return;
  }

  const name=$('#accountDisplayName').value.trim().replace(/\s+/g,' ');
  const bio=$('#accountBio').value.trim();
  const useGooglePhoto=$('#accountUseGooglePhoto').checked && Boolean(state.user.photoURL);
  if(name.length<2 || name.length>40){
    toast('Display name must be 2–40 characters.');
    $('#accountDisplayName').focus();
    return;
  }
  if(/[\u0000-\u001F\u007F]/.test(name)){
    toast('Display name contains unsupported control characters.');
    return;
  }
  if(bio.length>240){
    toast('Public bio must be 240 characters or less.');
    return;
  }

  const profile={displayName:name,bio,useGooglePhoto,photoURL:useGooglePhoto?(state.user.photoURL||''):''};
  const button=$('#accountSaveButton');
  const previous=button.textContent;
  button.disabled=true;
  button.textContent='Saving…';
  $('#accountSaveStatus').textContent='Saving public identity…';

  try{
    if(state.firebaseReady){
      const {db,fsMod}=state.firebase;
      const ref=fsMod.doc(db,'users',state.user.uid);
      const existing=state.publicProfile || state.profiles[state.user.uid];
      const payload={...profile,updatedAt:fsMod.serverTimestamp()};
      if(!existing?.createdAt) payload.createdAt=fsMod.serverTimestamp();
      await fsMod.setDoc(ref,payload,{merge:true});
    }

    state.publicProfile={...(state.publicProfile||{}),...profile,updatedAt:Date.now()};
    state.profiles[state.user.uid]=state.publicProfile;
    renderAuth(); renderFeed(); renderCatalogs(); updateAccountPreview();

    let migrated=0;
    try{ migrated=await syncAuthoredContentProfile(profile); }
    catch(error){ console.warn('Profile saved, but authored-content identity sync was incomplete:',error); }

    $('#accountSaveStatus').textContent=migrated?`Saved · updated ${migrated} existing item${migrated===1?'':'s'}`:'Saved';
    toast('Public profile saved. Your Google account name stays private.');
  }catch(error){
    console.error('Could not save public profile:',error);
    $('#accountSaveStatus').textContent='Could not save';
    toast('Could not save the public profile. Check Firestore rules and try again.');
  }finally{
    button.disabled=false;
    button.textContent=previous;
  }
}

function renderSpaces(){
  $('#spaceList').innerHTML = state.spaces.map(s=>`<div class="space-item"><i></i><span>${escapeHtml(s)}</span></div>`).join('');
  $('#postSpace').innerHTML = state.spaces.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
}

function avatarMarkup(identity){
  if(identity.photoURL) return `<img src="${escapeHtml(identity.photoURL)}" alt="" referrerpolicy="no-referrer" />`;
  return `<span class="fallback-avatar">${escapeHtml(initialsFor(identity.displayName))}</span>`;
}

function renderFeed(){
  let posts=[...state.posts];
  if(state.activeFilter!=='all') posts=posts.filter(p=>p.kind===state.activeFilter);
  const q=$('#globalSearch').value.trim().toLowerCase();
  if(q) posts=posts.filter(p=>{
    const identity=publicIdentityForContent(p);
    return `${p.text} ${identity.displayName} ${p.space} ${p.kind}`.toLowerCase().includes(q);
  });
  if(!posts.length){ $('#feed').innerHTML='<div class="empty-state">Nothing matches that yet. Try another search or publish the first one.</div>'; return; }
  $('#feed').innerHTML=posts.map(p=>{
    const r=reasoning[p.reasoningType]||reasoning.unclassified;
    const identity=publicIdentityForContent(p);
    return `<article class="post-card">
      <div class="post-head"><div class="post-author">${avatarMarkup(identity)}<span class="post-author-copy"><b>${escapeHtml(identity.displayName||'Unknown')}</b><small>${escapeHtml(p.space||'Open Commons')}</small></span></div><span class="post-time">${timeAgo(p.createdAt)}</span></div>
      <div class="post-text">${escapeHtml(p.text)}</div>
      <div class="post-meta"><span class="type-pill type-${escapeHtml(p.reasoningType||'unclassified')}">${escapeHtml(r.plain)} · ${escapeHtml(r.formal)}</span><span class="kind-pill">${escapeHtml(p.kind||'idea')}</span></div>
      <div class="post-actions"><button type="button" data-react="${escapeHtml(p.id)}">♡ Helpful</button><button type="button" data-connect="${escapeHtml(p.id)}">↗ Connect</button><button type="button" data-reason="${escapeHtml(p.reasoningType||'unclassified')}">Why this label?</button></div>
    </article>`;
  }).join('');
  $$('[data-reason]').forEach(b=>b.addEventListener('click',()=>openLogicGuide(b.dataset.reason)));
  $$('[data-react]').forEach(b=>b.addEventListener('click',()=>{b.textContent='♥ Helpful'; toast('Marked helpful.');}));
  $$('[data-connect]').forEach(b=>b.addEventListener('click',()=>toast('Connection tools are staged for the next backend pass.')));
}

function renderCatalogs(){
  ['idea','problem','project'].forEach(kind=>{
    const root=$(`#${kind}Catalog`); const items=state.objects.filter(o=>o.kind===kind);
    root.innerHTML=items.length?items.map(o=>`<article class="catalog-card"><span class="object-type">${kind}</span><h3>${escapeHtml(o.title)}</h3><p>${escapeHtml(o.description)}</p><div class="tag-row">${(o.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div></article>`).join(''):'<div class="empty-state">Nothing here yet.</div>';
  });
}

function renderTrends(){
  const pairs=[['Reasoning ↔ UI','18 links'],['Projects ↔ Decisions','12 links'],['Ideas ↔ Problems','9 links']];
  $('#trendList').innerHTML=pairs.map(([a,b])=>`<div class="trend-item"><span>${a}</span><b>${b}</b></div>`).join('');
}

function renderUniverse(){
  const canvas=$('#universeCanvas'), svg=$('#universeLines');
  canvas.innerHTML=state.objects.slice(0,9).map((o,i)=>`<button class="universe-node node-${o.kind}" style="left:calc(${o.x??(15+(i*13)%70)}% - 56px);top:calc(${o.y??(20+(i*17)%60)}% - 56px)" data-object="${escapeHtml(o.id)}" type="button"><b>${escapeHtml(o.title)}</b><small>${escapeHtml(o.kind)}</small></button>`).join('');
  const rect=canvas.getBoundingClientRect(); if(!rect.width) return;
  const objs=state.objects.slice(0,9); const connections=[[0,1],[0,2],[0,3],[1,4],[2,5],[3,5],[4,5]];
  svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML=connections.filter(([a,b])=>objs[a]&&objs[b]).map(([a,b])=>{
    const A=objs[a],B=objs[b]; return `<line x1="${rect.width*(A.x/100)}" y1="${rect.height*(A.y/100)}" x2="${rect.width*(B.x/100)}" y2="${rect.height*(B.y/100)}" stroke="rgba(210,190,255,.18)" stroke-width="1.3" stroke-dasharray="4 6" />`;
  }).join('');
  $$('.universe-node').forEach(n=>n.addEventListener('click',()=>{const o=state.objects.find(x=>x.id===n.dataset.object); if(o) toast(`${o.kind.toUpperCase()}: ${o.title}`);}));
}

function renderAuth(){
  const area=$('#authArea');
  if(state.user){
    const profile=ownPublicProfile();
    area.innerHTML=`<div class="auth-user"><button class="auth-account-main" id="openAccountButton" data-open-account type="button" title="Open account" aria-label="Open account settings for ${escapeHtml(profile.displayName||'your profile')}">${profileAvatarMarkup(profile)}<span>${escapeHtml(profile.displayName||'Account')}</span></button><button id="signOutButton" type="button" title="Sign out" aria-label="Sign out">↪</button></div>`;
    $('#signOutButton').addEventListener('click',signOutUser);
    $('#composerName').textContent=profile.displayName||'Share a thought';
    $('#composerHint').textContent='This is your public LCS identity. Your Google name and email stay private.';
    $('#composerAvatar').innerHTML=profile.photoURL?`<img src="${escapeHtml(profile.photoURL)}" alt="" referrerpolicy="no-referrer">`:escapeHtml(initialsFor(profile.displayName));
  }else{
    area.innerHTML='<button class="ghost-button signin-button" id="openAuthButton" type="button"><span>G</span> Sign in</button>';
    $('#openAuthButton').addEventListener('click',()=>{ clearAuthError(); $('#authDialog').showModal(); });
    $('#composerName').textContent='Share a thought'; $('#composerHint').textContent='Sign in to publish to the shared network.'; $('#composerAvatar').textContent='You';
  }
  renderAccount();
}

function openLogicGuide(type){
  const d=$('#logicDialog'); const title=$('#logicDialogTitle'), body=$('#logicDialogBody');
  if(type && reasoning[type]){
    const r=reasoning[type]; title.textContent=`${r.plain} — ${r.formal}`;
    body.innerHTML=`<div class="guide-block"><h3>${r.symbol} ${escapeHtml(r.plain)}</h3><p>${escapeHtml(r.description)}</p><div class="guide-example"><b>Example:</b> ${escapeHtml(r.example)}</div></div>`;
  }else{
    title.textContent='Six useful thought types';
    body.innerHTML=Object.entries(reasoning).filter(([k])=>k!=='unclassified').map(([,r])=>`<div class="guide-block"><h3>${r.symbol} ${escapeHtml(r.plain)} <small>(${escapeHtml(r.formal)})</small></h3><p>${escapeHtml(r.description)}</p><div class="guide-example">${escapeHtml(r.example)}</div></div>`).join('');
  }
  d.showModal();
}

function setView(view){
  state.activeView=view; $$('.view').forEach(v=>v.classList.remove('active-view')); $(`#view-${view}`)?.classList.add('active-view'); $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='universe') requestAnimationFrame(renderUniverse);
}

async function initFirebase(){
  if(!isFirebaseConfigured()){
    state.posts=[...seedPosts]; state.objects=[...seedObjects];
    setBackendStatus('Local demo mode','The interface works now, but shared posts and Google identity turn on after you add the Firebase web config.');
    $('#authSetupWarning').hidden=false; $('#localGuestButton').hidden=false; renderAll(); return;
  }
  try{
    const [appMod, authMod, fsMod] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);
    const app=appMod.initializeApp(LCS_CONFIG.firebase); const auth=authMod.getAuth(app); const db=fsMod.getFirestore(app);
    authMod.useDeviceLanguage(auth);
    try{ await authMod.setPersistence(auth,authMod.browserLocalPersistence); }catch(e){ console.warn('Auth persistence setup failed:',e); }
    state.firebase={app,auth,db,authMod,fsMod}; state.firebaseReady=true;
    authMod.onAuthStateChanged(auth,async user=>{
      state.user=user;
      if(user){
        clearAuthError();
        await ensurePublicProfile(user);
      }else{
        state.publicProfile=null;
        state.profilePrompted=false;
        renderAuth();
        if(state.activeView==='account') renderAccount();
      }
    });
    state.unsubProfiles=fsMod.onSnapshot(fsMod.query(fsMod.collection(db,'users'),fsMod.limit(250)),snap=>{
      const next={};
      snap.docs.forEach(d=>{next[d.id]={id:d.id,...d.data()};});
      state.profiles=next;
      if(state.user && next[state.user.uid]) state.publicProfile=next[state.user.uid];
      renderAuth(); renderFeed(); renderCatalogs();
    },err=>console.warn('Public profile directory unavailable:',err));
    state.unsubPosts=fsMod.onSnapshot(fsMod.query(fsMod.collection(db,'posts'),fsMod.orderBy('createdAt','desc'),fsMod.limit(80)),snap=>{
      state.posts=snap.docs.map(d=>({id:d.id,...d.data()})); if(!state.posts.length) state.posts=[...seedPosts]; renderFeed();
    },err=>{console.warn(err); state.posts=[...seedPosts];renderFeed();toast('Shared feed could not be loaded. Showing examples.');});
    state.unsubObjects=fsMod.onSnapshot(fsMod.query(fsMod.collection(db,'objects'),fsMod.orderBy('createdAt','desc'),fsMod.limit(100)),snap=>{
      const remote=snap.docs.map(d=>({id:d.id,...d.data()})); state.objects=remote.length?remote:[...seedObjects]; renderCatalogs(); if(state.activeView==='universe')renderUniverse();
    },err=>{console.warn(err);state.objects=[...seedObjects];renderCatalogs();});
    setBackendStatus('Live network ready','Google identity and Firestore realtime data are connected.');
  }catch(error){
    console.error(error); state.posts=[...seedPosts];state.objects=[...seedObjects];setBackendStatus('Could not connect','Firebase configuration exists, but initialization failed. Check the browser console and authorized domains.');renderAll();
  }
}

async function signInGoogle(){
  clearAuthError();
  if(!state.firebaseReady){
    $('#authSetupWarning').hidden=false;
    showAuthError({code:'auth/configuration-not-found'});
    return;
  }

  const {auth,authMod}=state.firebase;
  const provider=new authMod.GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});

  const button=$('#googleSignInButton');
  const previous=button.innerHTML;
  button.disabled=true;
  button.innerHTML='<span class="google-g">G</span>Opening Google…';

  try{
    const result=await authMod.signInWithPopup(auth,provider);
    state.user=result.user;
    renderAuth();
    $('#authDialog').close();
    toast('Signed in with Google.');
  }catch(error){
    console.error('LCS Google sign-in failed:',error);
    showAuthError(error);

    // LCS is served from GitHub Pages. Firebase recommends popup auth for apps
    // hosted outside Firebase when redirect auth has not been proxied/self-hosted,
    // because modern browsers can block the cross-origin redirect helper storage.
    // Do not silently replace a failed popup with a redirect that may fail again.
    toast('Google sign-in needs attention. See the message in the sign-in window.');
  }finally{
    button.disabled=false;
    button.innerHTML=previous;
  }
}

async function signOutUser(){
  if(state.firebaseReady) await state.firebase.authMod.signOut(state.firebase.auth);
  state.user=null; state.publicProfile=null; state.profilePrompted=false;
  if(state.activeView==='account') setView('home');
  renderAuth(); toast('Signed out.');
}

async function publishPost(){
  const text=$('#composerText').value.trim(); if(!text){toast('Write something first.');return;} if(text.length>LCS_CONFIG.maxPostLength){toast('That post is too long.');return;}
  if(!state.user){$('#authDialog').showModal();return;}
  const profile=ownPublicProfile();
  const payload={text,reasoningType:state.activeType,kind:'idea',space:$('#postSpace').value||'Open Commons',authorUid:state.user.uid,authorName:profile.displayName||'Member',authorPhoto:profile.photoURL||'',createdAt:Date.now()};
  if(state.firebaseReady){
    const {db,fsMod}=state.firebase; await fsMod.addDoc(fsMod.collection(db,'posts'),{...payload,createdAt:fsMod.serverTimestamp()});
  }else{ payload.id=`local-${Date.now()}`;state.posts.unshift(payload);renderFeed(); }
  $('#composerText').value='';$('#charCounter').textContent='0 / 1200';toast('Published.');
}

function openCreate(kind='idea'){
  const d=$('#createDialog'); const radio=$(`input[name="kind"][value="${kind}"]`,d); if(radio) radio.checked=true; d.showModal();
}

async function createObject(event){
  event.preventDefault(); if(!state.user){$('#createDialog').close();$('#authDialog').showModal();return;}
  const kind=$('input[name="kind"]:checked',$('#createForm')).value; const title=$('#createTitle').value.trim(); const description=$('#createDescription').value.trim(); const tags=$('#createTags').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,8);
  if(!title||!description)return;
  const profile=ownPublicProfile();
  const payload={kind,title,description,tags,authorUid:state.user.uid,authorName:profile.displayName||'Member',authorPhoto:profile.photoURL||'',createdAt:Date.now(),x:15+Math.random()*70,y:15+Math.random()*70};
  if(state.firebaseReady){const {db,fsMod}=state.firebase;await fsMod.addDoc(fsMod.collection(db,'objects'),{...payload,createdAt:fsMod.serverTimestamp()});}
  else{payload.id=`local-obj-${Date.now()}`;state.objects.unshift(payload);renderCatalogs();}
  $('#createForm').reset();$('#createDialog').close();setView(`${kind}s`);toast(`${kind[0].toUpperCase()+kind.slice(1)} created.`);
}

function renderAll(){renderSpaces();renderFeed();renderCatalogs();renderTrends();renderAuth();renderAccount();}

function bindUI(){
  $('#authArea').addEventListener('click',event=>{
    const accountButton=event.target.closest('[data-open-account]');
    if(!accountButton) return;
    event.preventDefault();
    setView('account');
    window.scrollTo({top:0,behavior:'smooth'});
  });
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $$('.thought-chip').forEach(b=>b.addEventListener('click',()=>{$$('.thought-chip').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.activeType=b.dataset.type;}));
  $$('.segment').forEach(b=>b.addEventListener('click',()=>{$$('.segment').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.activeFilter=b.dataset.filter;renderFeed();}));
  $('#composerText').addEventListener('input',e=>$('#charCounter').textContent=`${e.target.value.length} / ${LCS_CONFIG.maxPostLength}`);
  $('#publishButton').addEventListener('click',()=>publishPost().catch(e=>{console.error(e);toast('Could not publish.');}));
  $('#googleSignInButton').addEventListener('click',()=>signInGoogle().catch(console.error));
  $('#accountSignInButton').addEventListener('click',()=>{clearAuthError();$('#authDialog').showModal();});
  $('#accountSignOutButton').addEventListener('click',()=>signOutUser().catch(console.error));
  $('#accountProfileForm').addEventListener('submit',e=>savePublicProfile(e).catch(console.error));
  $('#accountDisplayName').addEventListener('input',updateAccountPreview);
  $('#accountBio').addEventListener('input',updateAccountPreview);
  $('#accountUseGooglePhoto').addEventListener('change',updateAccountPreview);
  $('#localGuestButton').addEventListener('click',()=>{ state.user={uid:'local-demo-user',displayName:'Local Guest',email:'',photoURL:''}; state.publicProfile={displayName:'Local Guest',bio:'',useGooglePhoto:false,photoURL:''}; state.profiles[state.user.uid]=state.publicProfile; renderAuth(); $('#authDialog').close(); setView('account'); toast('Local demo identity enabled. Nothing is uploaded.'); });
  $('#openLogicGuide').addEventListener('click',()=>openLogicGuide()); $('#explainButton').addEventListener('click',()=>openLogicGuide());
  $$('[data-guide]').forEach(b=>b.addEventListener('click',()=>openLogicGuide(b.dataset.guide)));
  $$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $('#newSpaceButton').addEventListener('click',()=>openCreate('project')); $$('.quick-create').forEach(b=>b.addEventListener('click',()=>openCreate(b.dataset.kind)));
  $('#createForm').addEventListener('submit',e=>createObject(e).catch(err=>{console.error(err);toast('Could not create that.');}));
  $('#globalSearch').addEventListener('input',renderFeed); document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#globalSearch').focus();}});
  $('#focusMapButton').addEventListener('click',renderUniverse); window.addEventListener('resize',()=>{if(state.activeView==='universe')renderUniverse();});
}

bindUI(); renderSpaces(); renderTrends(); renderAuth(); initFirebase();
