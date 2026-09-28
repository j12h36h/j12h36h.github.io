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
  dialog: $('entryDialog'), dialogTitle: $('entryDialogTitle'), dialogBody: $('entryDialogBody'), copyLink: $('copyEntryLink'), closeDialog: $('closeEntryDialog'), linkStatus: $('entryLinkStatus'),
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
let routeEntryId = requestedEntryId();

function requestedEntryId(){
  const url=new URL(location.href),queryId=url.searchParams.get('entry');
  if(queryId)return queryId;
  const match=url.pathname.match(/^\/archives\/([^/]+)\/?$/);
  if(!match)return '';
  try{return decodeURIComponent(match[1]);}catch(_){return match[1];}
}
function directEntryUrl(id){return new URL(`/archives/${encodeURIComponent(id)}`,location.origin).href;}
function setEntryPath(id=''){
  const path=id?`/archives/${encodeURIComponent(id)}`:'/archives/';
  history.replaceState({archiveEntryId:id||''},'',path);
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const slugify = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,84) || `entry-${Date.now()}`;
const safeImage = value => {
  const src = String(value || '').trim();
  return /^(https:\/\/|\/)(?!\/)/i.test(src) && !/[\u0000-\u001f]/.test(src) ? src : '';
};
const template = (id='new-entry', title='New Archive Entry', author='', category='Uncategorized') => ({
  schemaVersion:1,id,title,author,category,summary:'',order:entries.length,status:'published',series:'',chapter:0,previousChapterId:'',nextChapterId:'',
  visual:{pageBackgroundColor:'#f0e8d7',pageTextColor:'#29251f',accentColor:'#7c3f26',fontFamily:'Georgia, serif',icon:{type:'emoji',value:'✦',animation:'none'},animation:{type:'fade',durationMs:500},characters:[]},
  content:[]
});

function flattenedText(entry){
  const parts=[entry.title,entry.author,entry.category,entry.summary];
  for(const block of entry.content||[]) if(typeof block.text==='string') parts.push(block.text);
  return parts.join(' ').toLocaleLowerCase();
}
function visibleEntries(){
  const q=els.search.value.trim().toLocaleLowerCase();
  return entries.filter(entry=>(selectedCategory==='*'||entry.category===selectedCategory)&&(!q||flattenedText(entry).includes(q)))
    .sort((a,b)=>(Number(a.order)||0)-(Number(b.order)||0)||String(a.title).localeCompare(String(b.title)));
}
function renderCategories(){
  const counts=new Map(); for(const entry of entries) counts.set(entry.category||'Uncategorized',(counts.get(entry.category||'Uncategorized')||0)+1);
  const categories=['*',...Array.from(counts.keys()).sort((a,b)=>a.localeCompare(b))];
  els.categories.innerHTML=categories.map(cat=>`<button type="button" class="${selectedCategory===cat?'active':''}" data-category="${escape(cat)}">${cat==='*'?'All entries':escape(cat)} <span>${cat==='*'?entries.length:counts.get(cat)}</span></button>`).join('')||'<p class="archive-no-entries">No categories yet.</p>';
  els.categories.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{selectedCategory=button.dataset.category;renderCategories();renderEntries();}));
  els.categoryOptions.innerHTML=Array.from(counts.keys()).sort().map(cat=>`<option value="${escape(cat)}"></option>`).join('');
}
function renderEntries(){
  const rows=visibleEntries();
  els.count.textContent=`${entries.length} ${entries.length===1?'entry':'entries'}`;
  els.list.innerHTML=rows.length?rows.map(entry=>`<button type="button" data-entry="${escape(entry.id)}" class="${selectedId===entry.id?'active':''}">${escape(entry.title||'Untitled')}<span>${escape(entry.author||'Unknown author')} · ${escape(entry.category||'Uncategorized')}</span></button>`).join(''):'<p class="archive-no-entries">No published entries match here yet.</p>';
  els.list.querySelectorAll('[data-entry]').forEach(button=>button.addEventListener('click',()=>openEntry(button.dataset.entry)));
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
function chapterNeighbors(entry){
  const siblings=entry.series?entries.filter(item=>item.id!==entry.id&&item.series===entry.series&&Number.isFinite(Number(item.chapter))&&Number(item.chapter)>0).sort((a,b)=>Number(a.chapter)-Number(b.chapter)):[];
  const current=Number(entry.chapter),hasNumber=Number.isFinite(current)&&current>0;
  const previousId=String(entry.previousChapterId||entry.previousChapter||'').trim();
  const nextId=String(entry.nextChapterId||entry.nextChapter||'').trim();
  const previous=previousId?entries.find(item=>item.id===previousId):(hasNumber?siblings.find(item=>Number(item.chapter)===current-1):null);
  const next=nextId?entries.find(item=>item.id===nextId):(hasNumber?siblings.find(item=>Number(item.chapter)===current+1):null);
  const isChapter=Boolean(hasNumber||previousId||nextId);
  return isChapter?{previous:previous||null,next:next||null}:null;
}
function speak(button,entry){
  if(!('speechSynthesis'in window)){button.disabled=true;button.textContent='SPEECH UNAVAILABLE';return;}
  window.speechSynthesis.cancel();const text=[entry.title,entry.author,fullText(entry)].filter(Boolean).join('. ');if(!text.trim())return;
  const utterance=new SpeechSynthesisUtterance(text);const voice=els.voice.value;
  if(voice!=='default'){const found=voices.find(item=>item.name===voice);if(found)utterance.voice=found;}
  button.textContent='PLAYING…';utterance.onend=()=>button.textContent='READ ALOUD';utterance.onerror=()=>button.textContent='READ ALOUD';window.speechSynthesis.speak(utterance);
}
function renderEntry(entry,preview=false,target=els.reader){
  target.replaceChildren();const visual=entry.visual||{}, page=document.createElement('div');page.className='reader-content';
  setSafeColor(page,'--reader-bg',visual.pageBackgroundColor,'#f0e8d7');setSafeColor(page,'--reader-text',visual.pageTextColor,'#29251f');setSafeColor(page,'--reader-accent',visual.accentColor,'#7c3f26');
  page.style.setProperty('--reader-font',/^[-\w ,"']{1,90}$/.test(String(visual.fontFamily||''))?visual.fontFamily:'Georgia, serif');
  const motion=['fade','rise','none'].includes(visual.animation?.type)?visual.animation.type:'fade';page.dataset.animation=motion;
  for(const character of (visual.characters||[]).slice(0,8)) if(character&&['top-left','top-right','bottom-left','bottom-right'].includes(character.placement)&&safeImage(character.src)){const img=document.createElement('img');img.className=`reader-character ${character.placement}`;img.src=safeImage(character.src);img.alt=character.alt||'';page.append(img);}
  const head=document.createElement('header');head.className='reader-head';const topline=document.createElement('div');topline.className='reader-topline';topline.append(iconNode(visual),addText(document.createElement('span'),'span',entry.category||'Archive'));head.append(topline);
  addText(head,'h2',entry.title||'Untitled');addText(head,'div',[entry.author,entry.series,entry.chapter?`Chapter ${entry.chapter}`:''].filter(Boolean).join(' · '),'reader-byline');
  const tools=document.createElement('div');tools.className='reader-tools';const play=addText(tools,'button','READ ALOUD');play.type='button';play.addEventListener('click',()=>speak(play,entry));
  const pause=addText(tools,'button','PAUSE');pause.type='button';pause.addEventListener('click',()=>window.speechSynthesis?.pause());
  const resume=addText(tools,'button','RESUME');resume.type='button';resume.addEventListener('click',()=>window.speechSynthesis?.resume());
  const stop=addText(tools,'button','STOP');stop.type='button';stop.addEventListener('click',()=>{window.speechSynthesis?.cancel();play.textContent='READ ALOUD';});
  if(!preview){const share=addText(tools,'button','COPY DIRECT LINK');share.type='button';share.addEventListener('click',()=>copyDirectLink(entry.id));}
  const voicePicker=document.createElement('select');voicePicker.setAttribute('aria-label','Choose browser speech voice');voicePicker.innerHTML='<option value="default">VOICE: BROWSER DEFAULT</option>'+voices.map(v=>`<option value="${escape(v.name)}">${escape(v.name)} (${escape(v.lang)})</option>`).join('');voicePicker.value=els.voice.value;voicePicker.addEventListener('change',()=>{els.voice.value=voicePicker.value;});tools.append(voicePicker);
  if(preview) tools.prepend(addText(document.createElement('span'),'span','PREVIEW','reader-byline'));
  head.append(tools);page.append(head);
  if(entry.summary)addText(page,'p',entry.summary,'reader-body');
  const body=document.createElement('div');body.className='reader-body';for(const block of entry.content||[])renderBlock(body,block);page.append(body);
  const chapter=chapterNeighbors(entry);
  if(chapter){
    const nav=document.createElement('nav');nav.className='archive-chapter-nav';nav.setAttribute('aria-label','Chapter navigation');
    for(const [side,item,label] of [['previous',chapter.previous,'← PREVIOUS CHAPTER'],['next',chapter.next,'NEXT CHAPTER →']]){
      if(!item){const spacer=document.createElement('span');spacer.className='chapter-nav-spacer';nav.append(spacer);continue;}
      const button=document.createElement('button');button.type='button';button.className=`chapter-nav-button chapter-nav-${side}`;button.innerHTML=`<small>${label}</small><b>${escape(item.title||'Untitled')}</b>`;
      button.addEventListener('click',()=>openEntry(item.id,{popup:target===els.dialogBody,updatePath:target===els.dialogBody}));nav.append(button);
    }
    page.append(nav);
  }
  target.append(page);
  if(founder&&!preview){const edit=document.createElement('button');edit.type='button';edit.className='archive-edit-current';edit.textContent='EDIT THIS JSON';edit.addEventListener('click',()=>{if(els.dialog.open)closeEntryDialog();openEditor(entry);});target.append(edit);}
}
function openEntry(id,{popup=false,updatePath=false}={}){
  const entry=entries.find(item=>item.id===id);if(!entry)return false;
  selectedId=id;renderEntries();renderEntry(entry);
  if(popup){els.dialogTitle.textContent=entry.title||'Archive entry';els.linkStatus.textContent='';renderEntry(entry,false,els.dialogBody);if(!els.dialog.open)els.dialog.showModal();if(updatePath)setEntryPath(id);}
  return true;
}
async function copyDirectLink(id){
  const link=directEntryUrl(id);
  try{await navigator.clipboard.writeText(link);els.linkStatus.textContent='Direct archive link copied.';}
  catch(_){const box=document.createElement('textarea');box.value=link;box.setAttribute('readonly','');box.style.position='fixed';box.style.opacity='0';document.body.append(box);box.select();const copied=document.execCommand('copy');box.remove();els.linkStatus.textContent=copied?'Direct archive link copied.':'Copy this link: '+link;}
}
function closeEntryDialog(){if(els.dialog.open)els.dialog.close();routeEntryId='';setEntryPath();}
function showUnavailableEntry(id){
  els.dialogTitle.textContent='Archive entry unavailable';els.dialogBody.replaceChildren();
  const message=document.createElement('div');message.className='reader-empty';message.innerHTML='<div class="empty-glyph">✳</div><h2>Entry not found</h2><p>This archive entry may have been removed or its link may be incorrect.</p>';els.dialogBody.append(message);
  els.linkStatus.textContent=id?`Entry ID: ${id}`:'';if(!els.dialog.open)els.dialog.showModal();
}
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
function installSpeechVoices(){if(!('speechSynthesis'in window)){for(const button of document.querySelectorAll('.reader-tools button'))button.disabled=true;return;}const update=()=>{voices=window.speechSynthesis.getVoices();const selected=els.voice.value;els.voice.innerHTML='<option value="default">Browser default</option>'+voices.map(v=>`<option value="${escape(v.name)}">${escape(v.name)} (${escape(v.lang)})</option>`).join('');els.voice.value=voices.some(v=>v.name===selected)?selected:'default';};update();window.speechSynthesis.addEventListener?.('voiceschanged',update);}

$('newEntryButton').addEventListener('click',()=>openEditor());$('dokkodoTemplateButton').addEventListener('click',freshDokkodo);$('fiveRingsTemplateButton').addEventListener('click',nextFiveRings);$('closeEditor').addEventListener('click',clearEditor);$('previewEntry').addEventListener('click',preview);els.save.addEventListener('click',save);els.delete.addEventListener('click',remove);els.search.addEventListener('input',renderEntries);
els.closeDialog.addEventListener('click',closeEntryDialog);els.dialog.addEventListener('click',event=>{if(event.target===els.dialog)closeEntryDialog();});els.dialog.addEventListener('cancel',event=>{event.preventDefault();closeEntryDialog();});els.copyLink.addEventListener('click',()=>{if(selectedId)copyDirectLink(selectedId);});
for(const field of [els.title,els.author,els.category,els.summary,els.id])field.addEventListener('input',updateDraftFromFields);
$('formatJson').addEventListener('click',()=>{try{els.json.value=JSON.stringify(JSON.parse(els.json.value),null,2);els.editorStatus.textContent='JSON formatted.';}catch(error){els.editorStatus.textContent=String(error.message||error);}});
$('applyJson').addEventListener('click',()=>{try{draft=parseEditorJson();els.title.value=draft.title||'';els.author.value=draft.author||'';els.category.value=draft.category||'';els.summary.value=draft.summary||'';els.id.value=draft.id||slugify(draft.title);els.editorStatus.textContent='JSON applied to entry fields.';}catch(error){els.editorStatus.textContent=String(error.message||error);}});

onSnapshot(collection(db,'founderArchives'),snapshot=>{
  entries=snapshot.docs.map(s=>({id:s.id,...s.data()})).filter(entry=>entry.status==='published');renderCategories();renderEntries();
  if(routeEntryId){if(!openEntry(routeEntryId,{popup:true,updatePath:true}))showUnavailableEntry(routeEntryId);}
  else if(selectedId&&entries.some(e=>e.id===selectedId))openEntry(selectedId);
  else if(!selectedId&&entries.length)openEntry(entries[0].id);
},error=>{els.status.textContent=`Archive connection unavailable: ${error.message||error}`;});
watchIdentity(async identity=>{
  founder=false;els.actions.hidden=true;
  if(!identity?.user){els.status.innerHTML='Founder tools require an E.R.A.S. account. <a href="/logicalcommunicationservice/">Sign in</a>.';return;}
  els.status.textContent='Verifying Founder authority…';
  try{await getDoc(doc(db,'systemAuthority','founderProbe'));founder=true;els.status.textContent='Founder access verified. Edits publish to the shared archive.';els.actions.hidden=false;if(selectedId)openEntry(selectedId,{popup:els.dialog.open});}
  catch(error){els.status.textContent=error?.code==='permission-denied'?'Read-only archive. Founder publishing tools are private.':`Founder check unavailable: ${error.message||error}`;}
});
installSpeechVoices();
