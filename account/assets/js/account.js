import { ACCOUNT_CONFIG } from './config.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';

const $ = (s, root=document) => root.querySelector(s);
const state = {
  auth: null,
  authMod: null,
  db: null,
  fs: null,
  user: null,
  profileId: '',
  profile: null,
  statuses: [],
  profileUnsub: null,
  statusUnsub: null,
  creditUnsub: null,
  creditBalance: 0,
  ready: false
};

const STATUS_META = {
  founder: ['✦','Founder'],
  moderator: ['◆','Moderator'],
  member: ['●','Member'],
  timeout: ['⏳','Timeout']
};
const AVATAR_FONTS = ['Arial','Verdana','Georgia','Courier New','Trebuchet MS','Times New Roman','system-ui','monospace','sans-serif','serif'];
const AVATAR_WEIGHTS = [400,700,900];
const AVATAR_ALIGNS = ['start','middle','end'];

function escapeHtml(v='') { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function initials(name='Member') { return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase() || 'M'; }
function generatedName(id='') { return `Member-${String(id).replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase() || 'NEW'}`; }
function normalizeHex(value,label='color') { const v=String(value||'').trim(); if(!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${label} must be a six-digit hex color such as #7dcd4f.`); return v.toLowerCase(); }
function defaultAvatar(profile=null) {
  return {version:1,background:'#34264c',layers:[{char:initials(profile?.displayName||'Member'),x:64,y:66,fontSize:42,color:'#ffffff',fontFamily:'Arial',fontWeight:900,rotation:0,scaleX:1,scaleY:1,skewX:0,skewY:0,opacity:1,align:'middle'}]};
}
function validateAvatar(input) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw new Error('The root JSON value must be an object.');
  if(input.version!==1) throw new Error('version must be 1.');
  const background=normalizeHex(input.background,'background');
  if(!Array.isArray(input.layers) || input.layers.length<1 || input.layers.length>96) throw new Error('layers must contain between 1 and 96 character layers.');
  const layers=input.layers.map((raw,i)=>{
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) throw new Error(`Layer ${i+1} must be an object.`);
    const text=String(raw.char??'').normalize('NFC');
    if(!text || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text)) throw new Error(`Layer ${i+1} char is invalid.`);
    const graphemes=typeof Intl!=='undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(p=>p.segment) : Array.from(text);
    if(graphemes.length<1 || graphemes.length>4 || graphemes.every(g=>/^\s+$/u.test(g))) throw new Error(`Layer ${i+1} char must contain 1–4 visible characters.`);
    const num=(key,min,max,fallback)=>{const v=raw[key]??fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error(`Layer ${i+1} ${key} must be between ${min} and ${max}.`);return v;};
    const fontFamily=String(raw.fontFamily??'Arial'); if(!AVATAR_FONTS.includes(fontFamily)) throw new Error(`Layer ${i+1} fontFamily is not allowed.`);
    const fontWeight=Number(raw.fontWeight??700); if(!AVATAR_WEIGHTS.includes(fontWeight)) throw new Error(`Layer ${i+1} fontWeight must be 400, 700, or 900.`);
    const align=String(raw.align??'middle'); if(!AVATAR_ALIGNS.includes(align)) throw new Error(`Layer ${i+1} align must be start, middle, or end.`);
    return {char:text,x:num('x',-64,192,64),y:num('y',-64,192,64),fontSize:num('fontSize',4,192,42),color:normalizeHex(raw.color??'#ffffff',`Layer ${i+1} color`),fontFamily,fontWeight,rotation:num('rotation',-360,360,0),scaleX:num('scaleX',-4,4,1),scaleY:num('scaleY',-4,4,1),skewX:num('skewX',-75,75,0),skewY:num('skewY',-75,75,0),opacity:num('opacity',0,1,1),align};
  });
  return {version:1,background,layers};
}
function avatarSpec(profile) { try { return profile?.avatarJson ? validateAvatar(JSON.parse(profile.avatarJson)) : defaultAvatar(profile); } catch { return defaultAvatar(profile); } }
function avatarSvg(spec) {
  const safe=validateAvatar(spec);
  const layers=safe.layers.map(l=>`<g transform="translate(${l.x} ${l.y}) rotate(${l.rotation}) skewX(${l.skewX}) skewY(${l.skewY}) scale(${l.scaleX} ${l.scaleY})"><text x="0" y="0" fill="${l.color}" font-family="${escapeHtml(l.fontFamily)}" font-size="${l.fontSize}" font-weight="${l.fontWeight}" opacity="${l.opacity}" text-anchor="${l.align}" dominant-baseline="middle">${escapeHtml(l.char)}</text></g>`).join('');
  return `<svg viewBox="0 0 128 128" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" fill="${safe.background}"/>${layers}</svg>`;
}
function avatarMarkup(profile, cls='portal-avatar') { return `<span class="${cls}" aria-hidden="true">${avatarSvg(avatarSpec(profile))}</span>`; }
function activeStatuses() {
  const now=Date.now();
  return state.statuses.filter(s=>s.active===true && (!s.expiresAt?.toMillis || s.expiresAt.toMillis()>now));
}
function publicGlobalBadges() {
  return activeStatuses().filter(s=>s.visibility==='public' && s.scopeType==='global').map(s=>{
    const [symbol,label]=STATUS_META[s.status]||['•',s.status];
    return `<span class="portal-status portal-status-${escapeHtml(s.status)}">${symbol} ${escapeHtml(label)}</span>`;
  }).join('');
}
function setMessage(text,tone='') {
  const el=$('#accountMessage'); if(!el)return; el.textContent=text; el.dataset.tone=tone;
}
function toast(text) {
  let r=$('#accountToastRegion'); if(!r){r=document.createElement('div');r.id='accountToastRegion';r.className='account-toast-region';document.body.appendChild(r);}
  const n=document.createElement('div');n.className='account-toast';n.textContent=text;r.appendChild(n);setTimeout(()=>n.remove(),3200);
}
function renderHeader() {
  const area=$('#portalAuthArea'); if(!area)return;
  if(!state.ready){area.innerHTML='<div class="portal-auth-loading">CHECKING ACCOUNT…</div>';return;}
  if(!state.user){area.innerHTML='<button class="portal-signin portal-google-signin" data-account-signin type="button"><span class="portal-google-mark" aria-hidden="true">G</span><span>SIGN IN WITH GOOGLE</span></button>';return;}
  if(!state.profileId || !state.profile){area.innerHTML='<div class="portal-auth-loading">LINKING PROFILE…</div>';return;}
  const name=state.profile.displayName||generatedName(state.profileId);
  area.innerHTML=`<div class="portal-auth-user"><a class="portal-account-main" href="/account/">${avatarMarkup(state.profile,'portal-auth-avatar')}<span class="portal-account-copy"><b>${escapeHtml(name)}</b><small>${publicGlobalBadges()||'ACCOUNT'} · ◈ ${formatCredits(state.creditBalance)}</small></span></a><button class="portal-signout" data-account-signout type="button" aria-label="Sign out">↪</button></div>`;
}
function renderPage() {
  const page=$('#accountApp'); if(!page)return;
  const loading=$('#accountLoading'), signedOut=$('#accountSignedOut'), signedIn=$('#accountSignedIn');
  loading.hidden=state.ready; signedOut.hidden=!state.ready||Boolean(state.user); signedIn.hidden=!state.ready||!state.user;
  if(!state.user || !state.profile)return;
  const name=state.profile.displayName||generatedName(state.profileId);
  $('#accountAvatar').innerHTML=avatarMarkup(state.profile,'account-avatar-art');
  $('#accountNamePreview').textContent=name;
  $('#accountBioPreview').textContent=state.profile.bio||'No public bio yet.';
  if(document.activeElement!==$('#accountDisplayName')) $('#accountDisplayName').value=name;
  if(document.activeElement!==$('#accountBio')) $('#accountBio').value=state.profile.bio||'';
  $('#accountBioCount').textContent=`${($('#accountBio').value||'').length} / 240`;
  $('#accountPublicId').textContent=state.profileId;
  const creditEl=$('#accountCreditBalance'); if(creditEl) creditEl.textContent=formatCredits(state.creditBalance);
  $('#accountStatusList').innerHTML=activeStatuses().length ? activeStatuses().map(s=>{const [symbol,label]=STATUS_META[s.status]||['•',s.status];const scope=s.scopeType==='global'?'Global':`${s.scopeType}: ${s.scopeId}`;return `<span class="account-status-chip status-${escapeHtml(s.status)}">${symbol} ${escapeHtml(label)} <small>${escapeHtml(scope)}</small></span>`;}).join('') : '<span class="account-muted">No active Status assignments.</span>';
  const editor=$('#avatarJsonEditor'); if(editor && !editor.dataset.touched){editor.value=JSON.stringify(avatarSpec(state.profile),null,2);renderAvatarPreview();}
}
function renderAll(){renderHeader();renderPage();}

async function ensureIdentity(){
  if(!state.user||!state.db)return;
  const {doc,getDoc,setDoc,serverTimestamp,onSnapshot,collection,query,where,limit}=state.fs;
  const accountRef=doc(state.db,'privateAccounts',state.user.uid);
  let account=await getDoc(accountRef); let pid=account.exists()?account.data().publicProfileId:'';
  if(!pid){pid=crypto.randomUUID();await setDoc(accountRef,{publicProfileId:pid,securityVersion:6,createdAt:serverTimestamp()});}
  state.profileId=pid;
  const profileRef=doc(state.db,'publicProfiles',pid); let profileSnap=await getDoc(profileRef);
  if(!profileSnap.exists()){
    await setDoc(profileRef,{displayName:generatedName(pid),bio:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
    profileSnap=await getDoc(profileRef);
  }
  state.profile={id:pid,...profileSnap.data()};
  state.profileUnsub?.(); state.statusUnsub?.(); state.creditUnsub?.();
  state.profileUnsub=onSnapshot(profileRef,s=>{if(s.exists()){state.profile={id:s.id,...s.data()};renderAll();}});
  const statusQ=query(collection(state.db,'statusAssignments'),where('profileId','==',pid),limit(200));
  state.statusUnsub=onSnapshot(statusQ,s=>{state.statuses=s.docs.map(d=>({id:d.id,...d.data()}));renderAll();},e=>{console.debug('Account Status subscription',e?.code||e);state.statuses=[];renderAll();});
  state.creditUnsub=watchCreditWallet(state.db,state.fs,pid,balance=>{state.creditBalance=balance;renderAll();},e=>console.debug('Account credit wallet',e?.code||e));
  renderAll();
}

async function waitForFirebaseAuthUser(timeoutMs=7000){
  if(state.auth?.currentUser)return state.auth.currentUser;
  return await new Promise(resolve=>{
    let settled=false;
    let unsubscribe=()=>{};
    const finish=user=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      try{unsubscribe();}catch{}
      resolve(user||state.auth?.currentUser||null);
    };
    const timer=setTimeout(()=>finish(state.auth?.currentUser||null),timeoutMs);
    unsubscribe=state.authMod.onAuthStateChanged(state.auth,user=>{if(user)finish(user);},()=>finish(null));
  });
}

async function signIn(){
  if(!state.auth||!state.authMod){
    setMessage('Google sign-in is still loading. Try again in a moment.','error');
    return;
  }
  try{
    setMessage('Opening Google account selection…');

    // Keep this deliberately identical to the working LCS authentication path:
    // GoogleAuthProvider -> browserLocalPersistence -> signInWithPopup.
    const provider=new state.authMod.GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    await state.authMod.setPersistence(state.auth,state.authMod.browserLocalPersistence);
    const result=await state.authMod.signInWithPopup(state.auth,provider);
    if(typeof state.auth.authStateReady==='function')await state.auth.authStateReady();

    const user=state.auth.currentUser||result?.user||await waitForFirebaseAuthUser(7000);
    if(!user){
      const error=new Error('Google returned successfully, but Firebase did not retain the authenticated browser session.');
      error.code='auth/session-not-retained';
      throw error;
    }

    state.user=user;
    await ensureIdentity();
    setMessage('Signed in with Google.','ok');
    toast('Signed in with Google.');
  }catch(e){
    console.error('Account Google sign-in',e);
    const code=String(e?.code||'');
    let detail=code||e?.message||'unknown error';
    if(code.includes('popup-blocked'))detail='The browser blocked the Google sign-in popup. Allow popups for j12h36h.github.io and try again.';
    else if(code.includes('unauthorized-domain'))detail='j12h36h.github.io is not authorized in Firebase Authentication.';
    else if(code.includes('internal-error'))detail='Firebase returned an internal Google sign-in error.';
    setMessage(`Google sign-in failed: ${detail}`,'error');
  }
}
async function signOut(){if(!state.auth)return;await state.authMod.signOut(state.auth);toast('Signed out.');}

async function saveProfile(e){
  e?.preventDefault(); if(!state.profileId||!state.profile)return;
  const name=$('#accountDisplayName').value.trim().replace(/\s+/g,' '), bio=$('#accountBio').value.trim();
  if(name.length<2){setMessage('Display name must contain at least 2 characters.','error');return;}
  try{setMessage('Saving public profile…');await state.fs.updateDoc(state.fs.doc(state.db,'publicProfiles',state.profileId),{displayName:name.slice(0,40),bio:bio.slice(0,240),updatedAt:state.fs.serverTimestamp()});setMessage('Public profile saved.','ok');toast('Profile saved.');}catch(e){console.error(e);setMessage(`Profile save failed: ${e?.code||e?.message||'unknown error'}`,'error');}
}
function renderAvatarPreview(){
  const raw=$('#avatarJsonEditor')?.value||''; const err=$('#avatarJsonError'); const preview=$('#avatarEditorPreview');
  try{const spec=validateAvatar(JSON.parse(raw));preview.innerHTML=avatarSvg(spec);err.textContent='Valid avatar JSON';err.dataset.tone='ok';$('#saveAvatarButton').disabled=false;return spec;}catch(e){preview.innerHTML='';err.textContent=e?.message||'Invalid avatar JSON';err.dataset.tone='error';$('#saveAvatarButton').disabled=true;return null;}
}
async function saveAvatar(){
  if(!state.profileId)return;const spec=renderAvatarPreview();if(!spec)return;const canonical=JSON.stringify(spec,null,2);if(canonical.length>32000){setMessage('Avatar JSON exceeds the 32,000-character profile limit.','error');return;}
  try{setMessage('Saving profile image…');await state.fs.updateDoc(state.fs.doc(state.db,'publicProfiles',state.profileId),{avatarJson:canonical,updatedAt:state.fs.serverTimestamp()});$('#avatarJsonEditor').dataset.touched='';setMessage('Profile image saved.','ok');toast('Profile image saved.');}catch(e){console.error(e);setMessage(`Avatar save failed: ${e?.code||e?.message||'unknown error'}`,'error');}
}

function bind(){
  document.addEventListener('click',e=>{const t=e.target.closest('[data-account-signin],[data-account-signout]');if(!t)return;if(t.matches('[data-account-signin]'))signIn();else signOut();});
  $('#accountProfileForm')?.addEventListener('submit',saveProfile);
  $('#accountBio')?.addEventListener('input',()=>{$('#accountBioCount').textContent=`${$('#accountBio').value.length} / 240`;});
  $('#avatarJsonEditor')?.addEventListener('input',e=>{e.currentTarget.dataset.touched='1';renderAvatarPreview();});
  $('#saveAvatarButton')?.addEventListener('click',saveAvatar);
  $('#resetAvatarButton')?.addEventListener('click',()=>{const ed=$('#avatarJsonEditor');ed.value=JSON.stringify(defaultAvatar(state.profile),null,2);ed.dataset.touched='1';renderAvatarPreview();});
  $('#copyPublicId')?.addEventListener('click',async()=>{if(!state.profileId)return;try{await navigator.clipboard.writeText(state.profileId);toast('Public profile ID copied.');}catch{toast('Copy failed; select the ID manually.');}});
}

async function init(){
  bind();renderAll();
  try{
    const [appMod,authMod,fs]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js')
    ]);
    const app=appMod.getApps().some(item=>item.name==='site-account') ? appMod.getApp('site-account') : appMod.initializeApp(ACCOUNT_CONFIG.firebase,'site-account');
    state.auth=authMod.getAuth(app);state.authMod=authMod;state.db=fs.getFirestore(app);state.fs=fs;
    authMod.useDeviceLanguage(state.auth);
    try{await authMod.setPersistence(state.auth,authMod.browserLocalPersistence);}catch(e){console.debug('Account persistence',e?.code||e);}
    authMod.onAuthStateChanged(state.auth,async user=>{state.user=user||null;state.ready=true;if(!user){state.profileId='';state.profile=null;state.statuses=[];state.creditBalance=0;state.profileUnsub?.();state.statusUnsub?.();state.creditUnsub?.();renderAll();return;}renderAll();try{await ensureIdentity();}catch(e){console.error('Identity restore',e);setMessage(`Could not restore LCS profile: ${e?.code||e?.message||'unknown error'}`,'error');}});
    if(typeof state.auth.authStateReady==='function')await state.auth.authStateReady();
  }catch(e){console.error('Account Firebase init',e);state.ready=true;renderAll();setMessage('Could not connect to Firebase.','error');}
}

init();
