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
  unsubPosts: null,
  unsubObjects: null
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

function renderSpaces(){
  $('#spaceList').innerHTML = state.spaces.map(s=>`<div class="space-item"><i></i><span>${escapeHtml(s)}</span></div>`).join('');
  $('#postSpace').innerHTML = state.spaces.map(s=>`<option>${escapeHtml(s)}</option>`).join('');
}

function avatarMarkup(post){
  if(post.authorPhoto) return `<img src="${escapeHtml(post.authorPhoto)}" alt="" referrerpolicy="no-referrer" />`;
  const initials=(post.authorName||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  return `<span class="fallback-avatar">${escapeHtml(initials)}</span>`;
}

function renderFeed(){
  let posts=[...state.posts];
  if(state.activeFilter!=='all') posts=posts.filter(p=>p.kind===state.activeFilter);
  const q=$('#globalSearch').value.trim().toLowerCase();
  if(q) posts=posts.filter(p=>`${p.text} ${p.authorName} ${p.space} ${p.kind}`.toLowerCase().includes(q));
  if(!posts.length){ $('#feed').innerHTML='<div class="empty-state">Nothing matches that yet. Try another search or publish the first one.</div>'; return; }
  $('#feed').innerHTML=posts.map(p=>{
    const r=reasoning[p.reasoningType]||reasoning.unclassified;
    return `<article class="post-card">
      <div class="post-head"><div class="post-author">${avatarMarkup(p)}<span class="post-author-copy"><b>${escapeHtml(p.authorName||'Unknown')}</b><small>${escapeHtml(p.space||'Open Commons')}</small></span></div><span class="post-time">${timeAgo(p.createdAt)}</span></div>
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
    area.innerHTML=`<div class="auth-user">${state.user.photoURL?`<img src="${escapeHtml(state.user.photoURL)}" alt="" referrerpolicy="no-referrer">`:''}<span>${escapeHtml(state.user.displayName||'Signed in')}</span><button id="signOutButton" type="button" title="Sign out">↪</button></div>`;
    $('#signOutButton').addEventListener('click',signOutUser);
    $('#composerName').textContent=state.user.displayName||'Share a thought';
    $('#composerHint').textContent='Your post will carry your account identity.';
    $('#composerAvatar').innerHTML=state.user.photoURL?`<img src="${escapeHtml(state.user.photoURL)}" alt="" referrerpolicy="no-referrer">`:(state.user.displayName||'You').slice(0,2);
  }else{
    area.innerHTML='<button class="ghost-button signin-button" id="openAuthButton" type="button"><span>G</span> Sign in</button>';
    $('#openAuthButton').addEventListener('click',()=>$('#authDialog').showModal());
    $('#composerName').textContent='Share a thought'; $('#composerHint').textContent='Sign in to publish to the shared network.'; $('#composerAvatar').textContent='You';
  }
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
    authMod.useDeviceLanguage(auth); state.firebase={app,auth,db,authMod,fsMod}; state.firebaseReady=true;
    try{ await authMod.getRedirectResult(auth); }catch(e){ console.warn(e); }
    authMod.onAuthStateChanged(auth,user=>{state.user=user;renderAuth();});
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
  if(!state.firebaseReady){ $('#authSetupWarning').hidden=false; return; }
  const {auth,authMod}=state.firebase; const provider=new authMod.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
  try{ await authMod.signInWithPopup(auth,provider); $('#authDialog').close(); toast('Signed in with Google.'); }
  catch(error){
    console.warn(error);
    if(['auth/popup-blocked','auth/operation-not-supported-in-this-environment','auth/cancelled-popup-request'].includes(error.code)){
      toast('Opening Google sign-in…'); await authMod.signInWithRedirect(auth,provider); return;
    }
    toast(error.code==='auth/unauthorized-domain'?'This domain must be added to Firebase Authorized domains.':'Google sign-in did not complete.');
  }
}

async function signOutUser(){
  if(state.firebaseReady) await state.firebase.authMod.signOut(state.firebase.auth); state.user=null;renderAuth();toast('Signed out.');
}

async function publishPost(){
  const text=$('#composerText').value.trim(); if(!text){toast('Write something first.');return;} if(text.length>LCS_CONFIG.maxPostLength){toast('That post is too long.');return;}
  if(!state.user){$('#authDialog').showModal();return;}
  const payload={text,reasoningType:state.activeType,kind:'idea',space:$('#postSpace').value||'Open Commons',authorUid:state.user.uid,authorName:state.user.displayName||'Member',authorPhoto:state.user.photoURL||'',createdAt:Date.now()};
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
  const payload={kind,title,description,tags,authorUid:state.user.uid,authorName:state.user.displayName||'Member',createdAt:Date.now(),x:15+Math.random()*70,y:15+Math.random()*70};
  if(state.firebaseReady){const {db,fsMod}=state.firebase;await fsMod.addDoc(fsMod.collection(db,'objects'),{...payload,createdAt:fsMod.serverTimestamp()});}
  else{payload.id=`local-obj-${Date.now()}`;state.objects.unshift(payload);renderCatalogs();}
  $('#createForm').reset();$('#createDialog').close();setView(`${kind}s`);toast(`${kind[0].toUpperCase()+kind.slice(1)} created.`);
}

function renderAll(){renderSpaces();renderFeed();renderCatalogs();renderTrends();renderAuth();}

function bindUI(){
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $$('.thought-chip').forEach(b=>b.addEventListener('click',()=>{$$('.thought-chip').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.activeType=b.dataset.type;}));
  $$('.segment').forEach(b=>b.addEventListener('click',()=>{$$('.segment').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.activeFilter=b.dataset.filter;renderFeed();}));
  $('#composerText').addEventListener('input',e=>$('#charCounter').textContent=`${e.target.value.length} / ${LCS_CONFIG.maxPostLength}`);
  $('#publishButton').addEventListener('click',()=>publishPost().catch(e=>{console.error(e);toast('Could not publish.');}));
  $('#googleSignInButton').addEventListener('click',()=>signInGoogle().catch(console.error));
  $('#localGuestButton').addEventListener('click',()=>{ state.user={uid:'local-demo-user',displayName:'Local Guest',photoURL:''}; renderAuth(); $('#authDialog').close(); toast('Local demo identity enabled. Nothing is uploaded.'); });
  $('#openLogicGuide').addEventListener('click',()=>openLogicGuide()); $('#explainButton').addEventListener('click',()=>openLogicGuide());
  $$('[data-guide]').forEach(b=>b.addEventListener('click',()=>openLogicGuide(b.dataset.guide)));
  $$('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  $('#newSpaceButton').addEventListener('click',()=>openCreate('project')); $$('.quick-create').forEach(b=>b.addEventListener('click',()=>openCreate(b.dataset.kind)));
  $('#createForm').addEventListener('submit',e=>createObject(e).catch(err=>{console.error(err);toast('Could not create that.');}));
  $('#globalSearch').addEventListener('input',renderFeed); document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#globalSearch').focus();}});
  $('#focusMapButton').addEventListener('click',renderUniverse); window.addEventListener('resize',()=>{if(state.activeView==='universe')renderUniverse();});
}

bindUI(); renderSpaces(); renderTrends(); renderAuth(); initFirebase();
