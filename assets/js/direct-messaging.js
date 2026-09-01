const LANGUAGES = Object.freeze([
  ['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['pt','Português'],['it','Italiano'],
  ['ja','日本語'],['ko','한국어'],['zh','中文'],['ru','Русский'],['ar','العربية'],['hi','हिन्दी']
]);
const SAFETY_TEXT = 'Treat every chat exactly like a public post or public message. Do not send your real name, address, phone/email, passwords, payment information, private account details, precise location, or anything you would not want publicly visible. Chats may be stored, reviewed, copied, shared, or become publicly accessible.';
const html = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const docId = (...parts) => parts.map(x => String(x || '').replace(/[^a-zA-Z0-9_-]/g,'_')).join('__').slice(0,1400);
const timeMs = ts => ts?.toMillis ? ts.toMillis() : (ts instanceof Date ? ts.getTime() : Number(ts || 0));
const timeLabel = ts => { const n=timeMs(ts); return n ? new Date(n).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'sending…'; };
const baseLanguage = tag => String(tag || 'en').toLowerCase().split('-')[0];
const browserLanguage = () => { const code=baseLanguage(navigator.language || 'en'); return LANGUAGES.some(([x])=>x===code)?code:'en'; };
function initials(name='Member'){return String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'M';}
function languageOptions(selected){return LANGUAGES.map(([code,label])=>`<option value="${code}" ${code===selected?'selected':''}>${html(label)}</option>`).join('');}
function threadIdFor(a,b){return docId(...[a,b].sort());}
function isLcsSurface(){return /^\/(logicalcommunicationservice|lcs-mobile)(?:\/|$)/.test(location.pathname);}

export function createDirectMessenger({ db, fs, getCurrentProfileId, getProfile, listContacts, avatarMarkup = null, onError = console.error }) {
  if (!db || !fs) throw new Error('Chat requires Firestore db + helpers.');
  const required=['doc','getDoc','setDoc','collection','query','where','onSnapshot','serverTimestamp','limit','orderBy'];
  for(const key of required) if(typeof fs[key]!=='function') throw new Error(`Chat missing Firestore helper: ${key}`);
  const state={root:null,threadUnsub:null,messageUnsub:null,messageThreadId:'',threads:[],contacts:[],profiles:new Map(),activeProfileId:'',messages:[],writingLanguage:browserLanguage(),targetLanguage:browserLanguage(),translationEnabled:false,translators:new Map(),busy:false};

  function currentId(){return String(getCurrentProfileId?.() || '');}
  async function profile(id){
    if(!id)return null;
    if(state.profiles.has(id))return state.profiles.get(id);
    try{const p=await getProfile(id); if(p)state.profiles.set(id,p); return p||{id,displayName:`Member-${id.slice(0,6)}`};}
    catch(e){onError(e);return {id,displayName:`Member-${id.slice(0,6)}`};}
  }
  function avatar(p){
    if(avatarMarkup){try{return avatarMarkup(p)||html(initials(p?.displayName));}catch{}}
    return html(initials(p?.displayName));
  }
  function buildRoot(){
    if(state.root)return state.root;
    const root=document.createElement('div');root.className=`eras-dm-root${isLcsSurface()?' eras-dm-lcs':''}`;root.hidden=true;
    root.innerHTML=`<section class="eras-dm-window" role="dialog" aria-modal="true" aria-label="Chats">
      <header class="eras-dm-header"><div class="eras-dm-header-copy"><b>CHATS</b><span id="erasDmPeer">SELECT A CONNECTION</span></div><button class="eras-dm-close" type="button" aria-label="Close chats">×</button></header>
      <aside class="eras-dm-sidebar"><div class="eras-dm-sidebar-title">CHATS + CONNECTIONS</div><div class="eras-dm-list" id="erasDmList"></div></aside>
      <main class="eras-dm-main"><div class="eras-dm-toolbar"><label for="erasDmWritingLanguage">I WRITE IN</label><select id="erasDmWritingLanguage">${languageOptions(state.writingLanguage)}</select><label for="erasDmTargetLanguage">TRANSLATE TO</label><select id="erasDmTargetLanguage">${languageOptions(state.targetLanguage)}</select><label class="eras-dm-translate-toggle"><input id="erasDmTranslateToggle" type="checkbox"> LIVE BROWSER TRANSLATION</label><span class="eras-dm-translation-status" id="erasDmTranslationStatus">Original chat text is always shown. Translation stays in your browser when the browser Translator API is available.</span></div><div class="eras-dm-messages" id="erasDmMessages"><div class="eras-dm-no-thread">Choose an accepted connection to open a chat.</div></div><form class="eras-dm-compose" id="erasDmCompose"><textarea id="erasDmText" maxlength="2000" placeholder="Write a chat…" disabled></textarea><button class="eras-dm-send" type="submit" disabled>SEND</button></form></main>
      <footer class="eras-dm-safety"><b>CHAT SAFETY:</b> ${html(SAFETY_TEXT)}</footer>
    </section>`;
    document.body.appendChild(root); state.root=root;
    root.querySelector('.eras-dm-close').addEventListener('click',close);
    root.addEventListener('click',e=>{if(e.target===root)close();const person=e.target.closest('[data-dm-profile]');if(person)activateProfile(person.dataset.dmProfile);const translate=e.target.closest('[data-dm-translate]');if(translate)translateOne(translate.dataset.dmTranslate);});
    root.querySelector('#erasDmCompose').addEventListener('submit',sendMessage);
    root.querySelector('#erasDmWritingLanguage').addEventListener('change',e=>{state.writingLanguage=e.target.value;});
    root.querySelector('#erasDmTargetLanguage').addEventListener('change',e=>{state.targetLanguage=e.target.value;state.translators.forEach(t=>{try{t.destroy?.();}catch{}});state.translators.clear();prepareVisibleTranslations();renderMessages();});
    root.querySelector('#erasDmTranslateToggle').addEventListener('change',e=>{state.translationEnabled=e.target.checked;if(state.translationEnabled)prepareVisibleTranslations();renderMessages();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden)close();});
    return root;
  }
  function status(text,error=false){const el=state.root?.querySelector('#erasDmTranslationStatus');if(el){el.textContent=text;el.classList.toggle('eras-dm-error',error);}}
  function setComposeEnabled(enabled){const text=state.root?.querySelector('#erasDmText'),send=state.root?.querySelector('.eras-dm-send');if(text)text.disabled=!enabled;if(send)send.disabled=!enabled;}
  async function loadContacts(){
    try{const ids=[...new Set((await listContacts?.())||[])].filter(id=>id&&id!==currentId());state.contacts=ids;await Promise.all(ids.slice(0,100).map(profile));renderSidebar();}
    catch(e){onError(e);state.contacts=[];renderSidebar();}
  }
  function otherMember(thread){return (thread.members||[]).find(id=>id!==currentId())||'';}
  function existingThread(otherId){const id=threadIdFor(currentId(),otherId);return state.threads.find(t=>t.id===id)||null;}
  async function renderSidebar(){
    if(!state.root)return; const root=state.root.querySelector('#erasDmList'); if(!root)return;
    const threadMap=new Map(state.threads.map(t=>[otherMember(t),t]));const ids=[...new Set(state.contacts)].filter(Boolean);
    if(!ids.length){root.innerHTML='<div class="eras-dm-empty">No accepted connections yet. Add a friend in LCS before starting a chat.</div>';return;}
    await Promise.all(ids.map(profile));
    root.innerHTML=ids.map(id=>{const p=state.profiles.get(id)||{displayName:'Member'},thread=threadMap.get(id),active=id===state.activeProfileId;return `<button class="eras-dm-person ${active?'is-active':''}" type="button" data-dm-profile="${html(id)}"><span class="eras-dm-person-avatar">${avatar(p)}</span><span class="eras-dm-person-copy"><b>${html(p.displayName||'Member')}</b><small>${html(thread?.lastMessagePreview||'Start a chat')}</small></span></button>`;}).join('');
  }
  function startThreads(){
    stopThreads();const pid=currentId();if(!pid)return;
    const q=fs.query(fs.collection(db,'directMessageThreads'),fs.where('members','array-contains',pid),fs.limit(100));
    state.threadUnsub=fs.onSnapshot(q,s=>{state.threads=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>timeMs(b.updatedAt)-timeMs(a.updatedAt));renderSidebar();syncActiveThread();},e=>{onError(e);status('Chat list could not be loaded.',true);});
  }
  function stopThreads(){try{state.threadUnsub?.();}catch{}state.threadUnsub=null;}
  function stopMessages(){try{state.messageUnsub?.();}catch{}state.messageUnsub=null;state.messageThreadId='';state.messages=[];}
  function subscribeMessages(threadId){
    if(!threadId||state.messageThreadId===threadId)return;
    stopMessages();state.messageThreadId=threadId;
    const q=fs.query(fs.collection(db,'directMessageThreads',threadId,'messages'),fs.orderBy('createdAt','desc'),fs.limit(200));
    state.messageUnsub=fs.onSnapshot(q,s=>{state.messages=s.docs.map(d=>({id:d.id,...d.data()})).reverse();renderMessages();if(state.translationEnabled)prepareVisibleTranslations();},e=>{onError(e);const root=state.root?.querySelector('#erasDmMessages');if(root)root.innerHTML='<div class="eras-dm-no-thread">Unable to load this chat.</div>';});
  }
  function syncActiveThread(){
    if(!state.activeProfileId||!state.root)return;
    const thread=existingThread(state.activeProfileId);
    if(thread){subscribeMessages(thread.id);return;}
    if(state.messageThreadId)stopMessages();
    const root=state.root.querySelector('#erasDmMessages');if(root)root.innerHTML='<div class="eras-dm-no-thread">No chats yet. Send the first chat to create this conversation.</div>';
  }
  async function ensureThreadForSend(otherId){
    const pid=currentId();if(!pid||!otherId||pid===otherId)throw new Error('Invalid chat participants.');
    const members=[pid,otherId].sort(),id=threadIdFor(pid,otherId),ref=fs.doc(db,'directMessageThreads',id);
    const known=existingThread(otherId);if(known)return {id,ref,members:known.members||members};
    try{
      await fs.setDoc(ref,{members,createdAt:fs.serverTimestamp(),updatedAt:fs.serverTimestamp(),lastMessageAt:null,lastMessageSenderProfileId:'',lastMessagePreview:''});
      state.threads=[...state.threads.filter(t=>t.id!==id),{id,members,createdAt:Date.now(),updatedAt:Date.now(),lastMessageAt:null,lastMessageSenderProfileId:'',lastMessagePreview:''}];
      renderSidebar();subscribeMessages(id);return {id,ref,members};
    }catch(createError){
      // A simultaneous first send from the other participant may have created the deterministic thread.
      // Only probe after create fails: participant reads are valid for an existing thread, while we never
      // make the old permission-denied read against a nonexistent document during normal activation.
      try{const snap=await fs.getDoc(ref);if(snap.exists()){const data=snap.data();if(Array.isArray(data.members)&&data.members.includes(pid)&&data.members.includes(otherId)){state.threads=[...state.threads.filter(t=>t.id!==id),{id,...data}];renderSidebar();subscribeMessages(id);return {id,ref,members:data.members};}}}catch(readError){onError(readError);}
      throw createError;
    }
  }
  async function activateProfile(otherId){
    if(!otherId||otherId===currentId())return;
    buildRoot();state.activeProfileId=otherId;stopMessages();renderSidebar();
    const p=await profile(otherId);state.root.querySelector('#erasDmPeer').textContent=p?.displayName||'CHAT';
    setComposeEnabled(true);syncActiveThread();
    const textarea=state.root.querySelector('#erasDmText');try{textarea?.focus({preventScroll:true});}catch{textarea?.focus();}
  }
  function translatorKey(source,target){return `${source}>${target}`;}
  async function ensureTranslator(source,target){
    source=baseLanguage(source);target=baseLanguage(target);if(!source||source===target)return null;const key=translatorKey(source,target);if(state.translators.has(key))return state.translators.get(key);
    if(!('Translator' in globalThis)){status('Live browser translation is not supported by this browser. Original text remains available.',true);return null;}
    try{const availability=await globalThis.Translator.availability({sourceLanguage:source,targetLanguage:target});if(availability==='unavailable'){status(`Browser translation is unavailable for ${source.toUpperCase()} → ${target.toUpperCase()}. Original text remains available.`,true);return null;}const promise=globalThis.Translator.create({sourceLanguage:source,targetLanguage:target});state.translators.set(key,promise);const translator=await promise;state.translators.set(key,translator);status('Live translation ready. Translation is generated in-browser; original chat text remains visible.');return translator;}
    catch(e){state.translators.delete(key);status('Browser translation could not start. Click “TRANSLATE” on a chat to retry after a user interaction.',true);return null;}
  }
  function prepareVisibleTranslations(){
    if(!state.translationEnabled)return;const sources=[...new Set(state.messages.map(m=>baseLanguage(m.language)).filter(x=>x&&x!==state.targetLanguage))];
    for(const source of sources){ensureTranslator(source,state.targetLanguage).then(()=>renderMessages()).catch(()=>{});}
  }
  async function translationFor(msg){
    const source=baseLanguage(msg.language),target=baseLanguage(state.targetLanguage);if(!state.translationEnabled||!source||source===target)return '';
    const cached=state.translators.get(translatorKey(source,target));const translator=cached instanceof Promise?await cached:cached;if(!translator)return '';
    try{return await translator.translate(String(msg.text||''));}catch(e){onError(e);return '';}
  }
  async function translateOne(id){
    const msg=state.messages.find(x=>x.id===id);if(!msg)return;state.translationEnabled=true;const toggle=state.root?.querySelector('#erasDmTranslateToggle');if(toggle)toggle.checked=true;const translator=await ensureTranslator(msg.language,state.targetLanguage);if(translator)renderMessages();
  }
  async function renderMessages(){
    if(!state.root)return;const root=state.root.querySelector('#erasDmMessages');if(!root)return;
    if(!state.activeProfileId){root.innerHTML='<div class="eras-dm-no-thread">Choose an accepted connection to open a chat.</div>';return;}
    if(!state.messageThreadId){root.innerHTML='<div class="eras-dm-no-thread">No chats yet. Send the first chat to create this conversation.</div>';return;}
    if(!state.messages.length){root.innerHTML='<div class="eras-dm-no-thread">No chats yet. The safety notice below applies to every chat in this window.</div>';return;}
    const pid=currentId();root.innerHTML=state.messages.map(msg=>`<article class="eras-dm-message ${msg.senderProfileId===pid?'is-own':''}" data-dm-message="${html(msg.id)}"><div class="eras-dm-message-meta"><span>${msg.senderProfileId===pid?'YOU':'THEM'}</span><span>${html(String(msg.language||'').toUpperCase())}</span><span>${html(timeLabel(msg.createdAt))}</span></div><p class="eras-dm-message-text">${html(msg.text||'')}</p><p class="eras-dm-translation" hidden></p><button class="eras-dm-translate-one" type="button" data-dm-translate="${html(msg.id)}" ${!state.translationEnabled||baseLanguage(msg.language)===state.targetLanguage?'hidden':''}>TRANSLATE</button></article>`).join('');
    if(state.translationEnabled){for(const msg of state.messages){const article=root.querySelector(`[data-dm-message="${CSS.escape(msg.id)}"]`);if(!article)continue;const translated=await translationFor(msg);if(translated){const out=article.querySelector('.eras-dm-translation');out.textContent=translated;out.hidden=false;article.querySelector('.eras-dm-translate-one').hidden=true;}}}
    root.scrollTop=root.scrollHeight;
  }
  async function sendMessage(e){
    e.preventDefault();if(state.busy||!state.activeProfileId)return;const textarea=state.root.querySelector('#erasDmText'),text=textarea.value.trim();if(!text)return;const pid=currentId();if(!pid)return;state.busy=true;setComposeEnabled(false);
    try{const thread=await ensureThreadForSend(state.activeProfileId),messageId=crypto.randomUUID(),messageRef=fs.doc(db,'directMessageThreads',thread.id,'messages',messageId);await fs.setDoc(messageRef,{senderProfileId:pid,recipientProfileId:state.activeProfileId,text:text.slice(0,2000),language:state.writingLanguage,createdAt:fs.serverTimestamp()});await fs.setDoc(thread.ref,{members:thread.members,updatedAt:fs.serverTimestamp(),lastMessageAt:fs.serverTimestamp(),lastMessageSenderProfileId:pid,lastMessagePreview:text.replace(/\s+/g,' ').slice(0,120)},{merge:true});textarea.value='';status('Chat sent.');}
    catch(e2){onError(e2);status('Chat could not be sent. Check your connection, account status, or friendship state.',true);}
    finally{state.busy=false;setComposeEnabled(true);textarea.focus();}
  }
  async function openInbox(){const root=buildRoot();root.hidden=false;startThreads();await loadContacts();syncActiveThread();}
  async function openProfile(profileId){await openInbox();await activateProfile(profileId);}
  function close(){if(!state.root)return;state.root.hidden=true;stopMessages();stopThreads();}
  function destroy(){close();state.translators.forEach(t=>{try{if(!(t instanceof Promise))t.destroy?.();}catch{}});state.translators.clear();state.root?.remove();state.root=null;}
  return {openInbox,openProfile,close,destroy,refreshContacts:loadContacts};
}
