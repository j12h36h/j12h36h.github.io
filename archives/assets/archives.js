import { ACCOUNT_CONFIG } from '/account/assets/js/config.js';
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { watchIdentity } from '/game/assets/js/eras-data.js?v=1.7.3';

const APP_NAME = 'site-account';
const app = getApps().find(item => item.name === APP_NAME) || initializeApp(ACCOUNT_CONFIG.firebase, APP_NAME);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const els = {
  count: $('entryCount'), search: $('archiveSearch'), categories: $('categoryList'), list: $('entryList'), reader: $('archiveReader'),
  status: $('founderStatus'), actions: $('adminActions'), editor: $('archiveEditor'), title: $('entryTitle'), author: $('entryAuthor'), category: $('entryCategory'), summary: $('entrySummary'), id: $('entryId'), json: $('entryJson'), editorStatus: $('editorStatus'),
  delete: $('deleteEntry'), save: $('saveEntry'), voice: $('entryVoice'), categoryOptions: $('archiveCategoryOptions')
};
let entries = [];
let selectedCategory = '*';
let selectedId = '';
let editingId = '';
let founder = false;
let draft = null;
let voices = [];
let selectedBookKey = '';
let audioSession = null;
let audioGeneration = 0;
let pendingEntryId = new URL(location.href).searchParams.get('entry') || '';

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,84) || `entry-${Date.now()}`;
const safeImage = value => {
  const src = String(value || '').trim();
  return /^(https:\/\/|\/)(?!\/)/i.test(src) && !/[\u0000-\u001f]/.test(src) ? src : '';
};
const template = (id='new-entry', title='New Archive Entry', author='', category='Uncategorized') => ({
  schemaVersion:1,id,title,author,category,summary:'',order:entries.length,status:'published',series:'',chapter:0,
  visual:{pageBackgroundColor:'#f0e8d7',pageTextColor:'#29251f',accentColor:'#7c3f26',fontFamily:'Georgia, serif',icon:{type:'emoji',value:'✦',animation:'none'},animation:{type:'fade',durationMs:500},characters:[]},
  content:[]
});

function flattenedText(entry){
  const parts=[entry.title,entry.author,entry.category,entry.summary];
  for(const block of entry.content||[]) if(typeof block.text==='string') parts.push(block.text);
  return parts.join(' ').toLocaleLowerCase();
}
function bookKey(entry){return String(entry.series||'').trim()||String(entry.title||entry.id||'Archive');}
function entryOrder(entry){const order=Number(entry.order);return Number.isFinite(order)?order:(Number(entry.chapter)||0);}
function orderedEntries(items){return [...items].sort((a,b)=>entryOrder(a)-entryOrder(b)||String(a.title).localeCompare(String(b.title)));}
function bookGroups(source=entries){
  const groups=new Map();
  for(const entry of source){const key=bookKey(entry);if(!groups.has(key))groups.set(key,{key,title:key,entries:[]});groups.get(key).entries.push(entry);}
  return [...groups.values()].map(group=>({...group,entries:orderedEntries(group.entries)}))
    .sort((a,b)=>entryOrder(a.entries[0]||{})-entryOrder(b.entries[0]||{})||a.title.localeCompare(b.title));
}
function visibleEntries(){
  const q=els.search.value.trim().toLocaleLowerCase();
  return entries.filter(entry=>(selectedCategory==='*'||entry.category===selectedCategory)&&(!q||flattenedText(entry).includes(q)))
    .sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.title).localeCompare(String(b.title)));
}
function renderCategories(){
  const counts=new Map(); for(const group of bookGroups()) {const cat=group.entries[0]?.category||'Uncategorized';counts.set(cat,(counts.get(cat)||0)+1);}
  const categories=['*',...Array.from(counts.keys()).sort((a,b)=>a.localeCompare(b))];
  els.categories.innerHTML=categories.map(cat=>`<button type="button" class="${selectedCategory===cat?'active':''}" data-category="${escape(cat)}">${cat==='*'?'All books':escape(cat)} <span>${cat==='*'?bookGroups().length:counts.get(cat)}</span></button>`).join('')||'<p class="archive-no-entries">No categories yet.</p>';
  els.categories.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{selectedCategory=button.dataset.category;renderCategories();renderEntries();}));
  els.categoryOptions.innerHTML=Array.from(counts.keys()).sort().map(cat=>`<option value="${escape(cat)}"></option>`).join('');
}
function renderEntries(){
  const groups=bookGroups(visibleEntries());
  els.count.textContent=`${groups.length} ${groups.length===1?'book':'books'} · ${entries.length} entries`;
  els.list.innerHTML=groups.length?groups.map(group=>{
    const authors=[...new Set(group.entries.map(entry=>entry.author).filter(Boolean))].join(', ')||'Unknown author';
    const count=group.entries.length;
    return `<button type="button" data-book="${escape(group.key)}" class="${selectedBookKey===group.key?'active':''}">${escape(group.title)}<span>${escape(authors)} · ${count} ${count===1?'entry':'chapters'}</span></button>`;
  }).join(''):'<p class="archive-no-entries">No books match this search.</p>';
  els.list.querySelectorAll('[data-book]').forEach(button=>button.addEventListener('click',()=>openBook(button.dataset.book)));
}
function addText(parent,tag,text,className='') { const el=document.createElement(tag); if(className) el.className=className; el.textContent=String(text??''); parent.append(el); return el; }
function setSafeColor(element,property,value,fallback){const color=String(value||''); if(/^#[0-9a-f]{3,8}$/i.test(color)||/^rgba?\([\d\s,.%/+-]+\)$/i.test(color)||/^hsla?\([\d\s,.%/+-]+\)$/i.test(color)) element.style.setProperty(property,color); else element.style.setProperty(property,fallback);}
function iconNode(visual){
  const icon=visual?.icon||{};
  if(icon.type==='image'&&safeImage(icon.value)){const img=document.createElement('img');img.src=safeImage(icon.value);img.alt='';img.className='reader-icon';img.dataset.iconAnimation=['pulse','rotate','float'].includes(icon.animation)?icon.animation:'none';return img;}
  const node=document.createElement('span');node.className='reader-icon';node.dataset.iconAnimation=['pulse','rotate','float'].includes(icon.animation)?icon.animation:'none';node.textContent=icon.value||'✦';return node;
}
function appendCharacter(parent,src,alt,placement='inline'){
  const safe=safeImage(src);if(!safe)return;
  const img=document.createElement('img');img.src=safe;img.alt=alt||'';
  img.className=placement==='float-left'?'character-float-left':placement==='float-right'?'character-float-right':'character-inline';
  img.loading='lazy'; parent.append(img);
}
function renderBlock(parent,block){
  if(!block||typeof block!=='object')return;
  if(block.type==='title'){addText(parent,'h3',block.text);return;}
  if(block.type==='paragraph'){
    const p=document.createElement('p');p.textContent=String(block.text||'');
    if(['left','center','right','justify'].includes(block.align))p.style.textAlign=block.align;
    if(block.character?.position==='before')appendCharacter(p,block.character.src,block.character.alt,block.character.placement||'inline');
    parent.append(p);
    if(block.character?.position!=='before'&&block.character) appendCharacter(p,block.character.src,block.character.alt,block.character.placement||'inline');
    return;
  }
  if(block.type==='quote'){const q=document.createElement('blockquote');q.textContent=String(block.text||'');if(block.cite)addText(q,'cite',block.cite);parent.append(q);return;}
  if(block.type==='character'){appendCharacter(parent,block.src,block.alt,block.placement||'float-right');if(block.caption)addText(parent,'p',block.caption);return;}
  if(block.type==='image'){
    const src=safeImage(block.src);if(!src)return;const figure=document.createElement('figure'),img=document.createElement('img');img.src=src;img.alt=String(block.alt||'');img.loading='lazy';figure.append(img);if(block.caption)addText(figure,'figcaption',block.caption);parent.append(figure);return;
  }
  if(block.type==='divider'){const hr=document.createElement('hr');hr.className='reader-divider';parent.append(hr);return;}
  if(block.type==='pagebreak'){const div=document.createElement('div');div.className='reader-pagebreak';div.textContent=block.label||'✦';parent.append(div);return;}
}
function fullText(entry){return (entry.content||[]).map(b=>[b.text,b.cite,b.caption].filter(Boolean).join(' — ')).join('\n\n');}
function speechChunks(items){
  const chunks=[];
  for(const entry of items){
    const text=[entry.title,entry.author,fullText(entry)].filter(Boolean).join('. ');
    for(const paragraph of text.split(/\n\s*\n/)){
      let remaining=paragraph.trim();
      while(remaining){if(remaining.length<=220){chunks.push(remaining);break;}
        let cut=Math.max(remaining.lastIndexOf('. ',220),remaining.lastIndexOf('? ',220),remaining.lastIndexOf('! ',220),remaining.lastIndexOf(' ',220));
        if(cut<100)cut=220;chunks.push(remaining.slice(0,cut).trim());remaining=remaining.slice(cut).trim();}
    }
  }
  return chunks.filter(Boolean);
}
function runAudioChunk(session){
  if(audioSession!==session||session.paused)return;
  if(session.index>=session.chunks.length){session.playButton.textContent=session.label;audioSession=null;return;}
  if(!('speechSynthesis'in window)){session.playButton.textContent='SPEECH UNAVAILABLE';audioSession=null;return;}
  const chunk=session.chunks[session.index].slice(session.offset||0);if(!chunk){session.index++;session.offset=0;runAudioChunk(session);return;}
  const utterance=new SpeechSynthesisUtterance(chunk);session.utterance=utterance;session.offsetBase=session.offset||0;const runId=session.runId=(session.runId||0)+1;
  const voice=els.voice.value;if(voice!=='default'){const found=voices.find(item=>item.name===voice);if(found)utterance.voice=found;}
  utterance.onboundary=event=>{if(audioSession===session&&session.runId===runId&&!session.paused&&Number.isFinite(event.charIndex))session.offset=session.offsetBase+event.charIndex;};
  utterance.onend=()=>{if(audioSession!==session||session.runId!==runId||session.paused)return;session.index++;session.offset=0;setTimeout(()=>runAudioChunk(session),30);};
  utterance.onerror=event=>{if(audioSession!==session||session.runId!==runId||session.paused)return;session.playButton.textContent=session.label;audioSession=null;};
  session.playButton.textContent='PLAYING…';window.speechSynthesis.speak(utterance);
}
function startAudio(items,button,label){
  stopAudio();const chunks=speechChunks(items);if(!chunks.length)return;
  const session={chunks,index:0,offset:0,paused:false,playButton:button,label,generation:++audioGeneration};audioSession=session;setTimeout(()=>runAudioChunk(session),50);
}
function pauseAudio(){if(!audioSession||audioSession.paused)return;audioSession.paused=true;audioSession.runId=(audioSession.runId||0)+1;window.speechSynthesis?.cancel();audioSession.playButton.textContent='PAUSED';}
function resumeAudio(){if(!audioSession||!audioSession.paused)return;audioSession.paused=false;const session=audioSession;setTimeout(()=>runAudioChunk(session),50);}
function stopAudio(){if(audioSession){audioSession.playButton.textContent=audioSession.label;audioSession=null;}audioGeneration++;window.speechSynthesis?.cancel();}
function audioControls(parent,items,playLabel){
  const tools=document.createElement('div');tools.className='reader-tools';
  const play=addText(tools,'button',playLabel);play.type='button';play.addEventListener('click',()=>startAudio(items,play,playLabel));
  const pause=addText(tools,'button','PAUSE');pause.type='button';pause.addEventListener('click',pauseAudio);
  const resume=addText(tools,'button','RESUME');resume.type='button';resume.addEventListener('click',resumeAudio);
  const stop=addText(tools,'button','STOP');stop.type='button';stop.addEventListener('click',stopAudio);
  const voicePicker=document.createElement('select');voicePicker.setAttribute('aria-label','Choose browser speech voice');voicePicker.innerHTML='<option value="default">VOICE: BROWSER DEFAULT</option>'+voices.map(v=>`<option value="${escape(v.name)}">${escape(v.name)} (${escape(v.lang)})</option>`).join('');voicePicker.value=els.voice.value;voicePicker.addEventListener('change',()=>{els.voice.value=voicePicker.value;});tools.append(voicePicker);parent.append(tools);return tools;
}
function renderEntry(entry,preview=false){
  els.reader.replaceChildren();const visual=entry.visual||{}, page=document.createElement('div');page.className='reader-content';
  setSafeColor(page,'--reader-bg',visual.pageBackgroundColor,'#f0e8d7');setSafeColor(page,'--reader-text',visual.pageTextColor,'#29251f');setSafeColor(page,'--reader-accent',visual.accentColor,'#7c3f26');
  page.style.setProperty('--reader-font',/^[-\w ,"']{1,90}$/.test(String(visual.fontFamily||''))?visual.fontFamily:'Georgia, serif');
  const motion=['fade','rise','none'].includes(visual.animation?.type)?visual.animation.type:'fade';page.dataset.animation=motion;
  for(const character of (visual.characters||[]).slice(0,8)) if(character&&['top-left','top-right','bottom-left','bottom-right'].includes(character.placement)&&safeImage(character.src)){const img=document.createElement('img');img.className=`reader-character ${character.placement}`;img.src=safeImage(character.src);img.alt=character.alt||'';page.append(img);}
  const head=document.createElement('header');head.className='reader-head';const topline=document.createElement('div');topline.className='reader-topline';topline.append(iconNode(visual),addText(document.createElement('span'),'span',entry.category||'Archive'));head.append(topline);
  addText(head,'h2',entry.title||'Untitled');addText(head,'div',[entry.author,entry.series,entry.chapter?`Chapter ${entry.chapter}`:''].filter(Boolean).join(' · '),'reader-byline');
  const tools=audioControls(head,[entry],'READ CHAPTER');
  if(!preview){const copy=addText(tools,'button','COPY DIRECT LINK');copy.type='button';copy.addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('entry',entry.id);try{await navigator.clipboard.writeText(url.href);copy.textContent='LINK COPIED';setTimeout(()=>copy.textContent='COPY DIRECT LINK',1600);}catch(_){copy.textContent='COPY UNAVAILABLE';}});}
  if(preview) tools.prepend(addText(document.createElement('span'),'span','PREVIEW','reader-byline'));
  page.append(head);
  if(entry.summary)addText(page,'p',entry.summary,'reader-body');
  const body=document.createElement('div');body.className='reader-body';for(const block of entry.content||[])renderBlock(body,block);page.append(body);
  if(!preview){const nav=chapterNavigation(entry);if(nav)page.append(nav);}
  els.reader.append(page);
  if(founder&&!preview){const edit=document.createElement('button');edit.type='button';edit.className='archive-edit-current';edit.textContent='EDIT THIS JSON';edit.addEventListener('click',()=>openEditor(entry));els.reader.append(edit);}
}
function chapterNavigation(entry){
  const siblings=orderedEntries(entries.filter(item=>bookKey(item)===bookKey(entry))),index=siblings.findIndex(item=>item.id===entry.id);
  const previous=(entry.previousChapterId&&entries.find(item=>item.id===entry.previousChapterId))||siblings[index-1];
  const next=(entry.nextChapterId&&entries.find(item=>item.id===entry.nextChapterId))||siblings[index+1];
  if(!previous&&!next)return null;
  const nav=document.createElement('nav');nav.className='chapter-nav';nav.setAttribute('aria-label','Chapter navigation');
  const book=addText(nav,'button','ALL CHAPTERS');book.type='button';book.addEventListener('click',()=>openBook(bookKey(entry)));
  const spacer=document.createElement('span');spacer.className='chapter-nav-spacer';nav.append(spacer);
  if(previous){const button=addText(nav,'button',`← PREVIOUS · ${previous.title}`);button.type='button';button.addEventListener('click',()=>openEntry(previous.id));}
  if(next){const button=addText(nav,'button',`NEXT · ${next.title} →`);button.type='button';button.addEventListener('click',()=>openEntry(next.id));}
  return nav;
}
function renderBook(group){
  els.reader.replaceChildren();const first=group.entries[0]||{},visual=first.visual||{},page=document.createElement('div');page.className='reader-content';
  setSafeColor(page,'--reader-bg',visual.pageBackgroundColor,'#f0e8d7');setSafeColor(page,'--reader-text',visual.pageTextColor,'#29251f');setSafeColor(page,'--reader-accent',visual.accentColor,'#7c3f26');
  page.style.setProperty('--reader-font',/^[-\w ,"']{1,90}$/.test(String(visual.fontFamily||''))?visual.fontFamily:'Georgia, serif');
  const head=document.createElement('header');head.className='reader-head';const topline=document.createElement('div');topline.className='reader-topline';topline.append(iconNode(visual),addText(document.createElement('span'),'span',first.category||'Archive'));head.append(topline);
  const title=group.entries.length===1?(first.title||group.title):group.title;addText(head,'h2',title);
  const authors=[...new Set(group.entries.map(item=>item.author).filter(Boolean))].join(', ');addText(head,'div',[authors,`${group.entries.length} ${group.entries.length===1?'entry':'chapters'}`].filter(Boolean).join(' · '),'reader-byline');
  audioControls(head,group.entries,'PLAY ALL');page.append(head);
  const body=document.createElement('div');body.className='reader-body';addText(body,'h3','Contents');const list=document.createElement('ol');list.className='book-toc';
  for(const entry of group.entries){const li=document.createElement('li');const label=Number(entry.chapter)>0?`Chapter ${entry.chapter} — ${entry.title||'Untitled'}`:(entry.title||'Untitled');const button=addText(li,'button',label);button.type='button';button.addEventListener('click',()=>openEntry(entry.id));list.append(li);}
  body.append(list);page.append(body);els.reader.append(page);
  if(founder){const edit=document.createElement('button');edit.type='button';edit.className='archive-edit-current';edit.textContent='EDIT FIRST ENTRY JSON';edit.addEventListener('click',()=>openEditor(first));els.reader.append(edit);}
}
function openBook(key){const group=bookGroups(entries).find(item=>item.key===key);if(!group)return;selectedBookKey=key;selectedId='';renderEntries();renderBook(group);const url=new URL(location.href);url.searchParams.delete('entry');history.replaceState({},'',url.pathname+url.search+url.hash);}
function openEntry(id){const entry=entries.find(item=>item.id===id);if(!entry)return;selectedId=id;selectedBookKey=bookKey(entry);renderEntries();renderEntry(entry);const url=new URL(location.href);url.searchParams.set('entry',entry.id);history.replaceState({},'',url.pathname+url.search+url.hash);}
function updateDraftFromFields(){if(!draft)return;draft.title=els.title.value.trim();draft.author=els.author.value.trim();draft.category=els.category.value.trim()||'Uncategorized';draft.summary=els.summary.value.trim();draft.id=slugify(els.id.value||draft.title);draft.status='published';els.id.value=draft.id;try{els.json.value=JSON.stringify(draft,null,2);}catch(_){} }
function loadDraftToFields(entry){draft=structuredClone(entry);els.title.value=entry.title||'';els.author.value=entry.author||'';els.category.value=entry.category||'';els.summary.value=entry.summary||'';els.id.value=entry.id||slugify(entry.title);els.json.value=JSON.stringify(draft,null,2);}
function openEditor(entry=null){if(!founder)return;editingId=entry?.id||'';const base=entry||template();loadDraftToFields(base);$('editorTitle').textContent=entry?'Edit archive entry':'New archive entry';els.delete.hidden=!entry;els.save.textContent=entry?'SAVE CHANGES':'PUBLISH ENTRY';els.editor.hidden=false;els.editor.scrollIntoView({behavior:'smooth',block:'start'});els.editorStatus.textContent='Edit entry text and design in JSON. Preview changes without publishing.';}
function freshDokkodo(){const value=template('dokkodo-the-way-of-walking-alone','Dokkōdō — The Way of Walking Alone','Miyamoto Musashi','Japanese Strategy & Philosophy');value.summary='';value.series='Dokkōdō';value.content=[];openEditor(value);}
function nextFiveRings(){const existing=entries.filter(e=>e.series==='The Book of Five Rings');const names=['The Ground Book','The Water Book','The Fire Book','The Wind Book','The Book of the Void'];const next=names.findIndex((_,i)=>!existing.some(entry=>Number(entry.chapter)===i+1));const chapter=(next<0?5:next)+1;const value=template(`book-of-five-rings-${chapter}`,`The Book of Five Rings — ${names[chapter-1]}`,'Miyamoto Musashi','Japanese Strategy & Philosophy');value.series='The Book of Five Rings';value.chapter=chapter;value.summary=`Chapter ${chapter} of five. Add the text you want to publish; this template is private to the editor until you publish it.`;value.content=[];openEditor(value);}
function clearEditor(){els.editor.hidden=true;draft=null;editingId='';}
function parseEditorJson(){try{const value=JSON.parse(els.json.value);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Entry JSON must be an object.');return value;}catch(error){throw Error(error.message||'JSON is invalid.');}}
function preview(){try{draft=parseEditorJson();els.title.value=draft.title||'';els.author.value=draft.author||'';els.category.value=draft.category||'';els.summary.value=draft.summary||'';els.id.value=draft.id||slugify(draft.title);els.editorStatus.textContent='Preview only. Nothing has been published.';renderEntry(draft,true);}catch(error){els.editorStatus.textContent=error.message;}}
async function save(){try{
  const value=parseEditorJson();value.id=slugify(els.id.value||value.id||value.title);value.title=els.title.value.trim()||String(value.title||'').trim();value.author=els.author.value.trim()||String(value.author||'').trim();value.category=els.category.value.trim()||String(value.category||'Uncategorized').trim();value.summary=els.summary.value.trim()||String(value.summary||'').trim();value.schemaVersion=1;value.status='published';value.updatedAt=serverTimestamp();if(!Array.isArray(value.content))throw Error('Content must be an array of blocks.');
  if(!founder)throw Error('Founder permission is required.');if(!value.title||!value.author)throw Error('Add a title and author before publishing.');if(!value.content.some(block=>['paragraph','quote','title','image','character'].includes(block?.type)&&String(block.text||block.src||'').trim()))throw Error('Add at least one non-empty content block before publishing.');
  els.save.disabled=true;els.editorStatus.textContent='Publishing…';await setDoc(doc(db,'founderArchives',value.id),value);selectedId=value.id;editingId=value.id;els.editorStatus.textContent='Published. Readers can now open this entry.';clearEditor();
 }catch(error){els.editorStatus.textContent=String(error?.message||error);}finally{els.save.disabled=false;}}
async function remove(){if(!founder||!editingId)return;if(!confirm('Delete this archive entry?'))return;try{await deleteDoc(doc(db,'founderArchives',editingId));clearEditor();selectedId='';els.reader.innerHTML='<div class="reader-empty"><div class="empty-glyph">✳</div><h2>Entry removed</h2><p>This entry is no longer in the archive.</p></div>';}catch(error){els.editorStatus.textContent=String(error?.message||error);}}
function installSpeechVoices(){if(!('speechSynthesis'in window)){for(const button of document.querySelectorAll('.reader-tools button'))button.disabled=true;return;}const update=()=>{voices=window.speechSynthesis.getVoices();const selected=els.voice.value;const options='<option value="default">Browser default</option>'+voices.map(v=>`<option value="${escape(v.name)}">${escape(v.name)} (${escape(v.lang)})</option>`).join('');els.voice.innerHTML=options;els.voice.value=voices.some(v=>v.name===selected)?selected:'default';for(const picker of document.querySelectorAll('.reader-tools select')){const choice=picker.value;picker.innerHTML=options;picker.value=voices.some(v=>v.name===choice)?choice:els.voice.value;}};update();window.speechSynthesis.addEventListener?.('voiceschanged',update);}

$('newEntryButton').addEventListener('click',()=>openEditor());$('dokkodoTemplateButton').addEventListener('click',freshDokkodo);$('fiveRingsTemplateButton').addEventListener('click',nextFiveRings);$('closeEditor').addEventListener('click',clearEditor);$('previewEntry').addEventListener('click',preview);els.save.addEventListener('click',save);els.delete.addEventListener('click',remove);els.search.addEventListener('input',renderEntries);
for(const field of [els.title,els.author,els.category,els.summary,els.id])field.addEventListener('input',updateDraftFromFields);
$('formatJson').addEventListener('click',()=>{try{els.json.value=JSON.stringify(JSON.parse(els.json.value),null,2);els.editorStatus.textContent='JSON formatted.';}catch(error){els.editorStatus.textContent=String(error.message||error);}});
$('applyJson').addEventListener('click',()=>{try{draft=parseEditorJson();els.title.value=draft.title||'';els.author.value=draft.author||'';els.category.value=draft.category||'';els.summary.value=draft.summary||'';els.id.value=draft.id||slugify(draft.title);els.editorStatus.textContent='JSON applied to entry fields.';}catch(error){els.editorStatus.textContent=String(error.message||error);}});

onSnapshot(collection(db,'founderArchives'),snapshot=>{
  entries=snapshot.docs.map(s=>({id:s.id,...s.data()})).filter(entry=>entry.status==='published');renderCategories();renderEntries();
  if(pendingEntryId&&entries.some(entry=>entry.id===pendingEntryId)){const id=pendingEntryId;pendingEntryId='';openEntry(id);}
  else if(selectedId&&entries.some(entry=>entry.id===selectedId))openEntry(selectedId);
  else if(selectedBookKey&&bookGroups().some(group=>group.key===selectedBookKey))openBook(selectedBookKey);
  else if(entries.length)openBook(bookGroups()[0].key);
},error=>{els.status.textContent=`Archive connection unavailable: ${error.message||error}`;});
watchIdentity(async identity=>{
  founder=false;els.actions.hidden=true;
  if(!identity?.user){els.status.innerHTML='Founder tools require an E.R.A.S. account. <a href="/logicalcommunicationservice/">Sign in</a>.';return;}
  els.status.textContent='Verifying Founder authority…';
  try{await getDoc(doc(db,'systemAuthority','founderProbe'));founder=true;els.status.textContent='Founder access verified. Edits publish to the shared archive.';els.actions.hidden=false;if(selectedId)openEntry(selectedId);}
  catch(error){els.status.textContent=error?.code==='permission-denied'?'Read-only archive. Founder publishing tools are private.':`Founder check unavailable: ${error.message||error}`;}
});
installSpeechVoices();
