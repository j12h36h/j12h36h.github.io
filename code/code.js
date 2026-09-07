const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

const editor=$('#codeEditor');
const highlightCode=$('#highlightLayer code');
const highlightLayer=$('#highlightLayer');
const lineNumbers=$('#lineNumbers');
const minimap=$('#minimap');

const state={
  files:[],
  activeFileId:'',
  languages:new Map(),
  activeLanguageId:'plaintext',
  bottomTab:'output',
  bottomCollapsed:false,
  tabWidth:2,
  fontSize:14,
  wordWrap:false,
  showMinimap:true,
  autoClose:true,
  output:['CODE editor initialized.'],
  problems:[]
};

function say(message,tone=''){
  const el=$('#codeFeedback');if(!el)return;
  el.textContent=String(message).toUpperCase();el.dataset.tone=tone;
}
function escapeHtml(value=''){
  return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fileId(){return crypto.randomUUID()}
function activeFile(){return state.files.find(f=>f.id===state.activeFileId)||null}
function activeLanguage(){return state.languages.get(state.activeLanguageId)||state.languages.get('plaintext')}
function extOf(name=''){
  const m=String(name).toLowerCase().match(/(\.[a-z0-9_-]+)$/);return m?m[1]:'';
}
function languageForFile(name=''){
  const ext=extOf(name);
  for(const lang of state.languages.values()){
    if((lang.extensions||[]).map(x=>String(x).toLowerCase()).includes(ext))return lang.id;
  }
  return 'plaintext';
}
function normalizeLanguage(raw={}){
  const id=String(raw.id||'custom').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').slice(0,48)||'custom';
  const list=value=>Array.isArray(value)?value.map(v=>String(v)).filter(Boolean).slice(0,500):[];
  return {
    id,
    name:String(raw.name||id).trim().slice(0,80)||id,
    extensions:list(raw.extensions).map(x=>x.startsWith('.')?x:'.'+x),
    lineComment:String(raw.lineComment||'').slice(0,8),
    blockComment:{
      start:String(raw.blockComment?.start||'').slice(0,12),
      end:String(raw.blockComment?.end||'').slice(0,12)
    },
    stringQuotes:list(raw.stringQuotes).map(x=>x.slice(0,1)).filter(Boolean).slice(0,8),
    keywords:list(raw.keywords),
    literals:list(raw.literals),
    builtins:list(raw.builtins),
    operators:list(raw.operators).slice(0,120),
    highlightNumbers:raw.highlightNumbers!==false,
    caseSensitive:raw.caseSensitive!==false
  };
}
async function loadLanguages(){
  try{
    const manifest=await fetch('./languages/languages.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()});
    for(const entry of manifest.languages||[]){
      try{
        const lang=normalizeLanguage(await fetch(entry.path,{cache:'no-store'}).then(r=>r.json()));
        state.languages.set(lang.id,lang);
      }catch(err){state.output.push(`Language load failed: ${entry.id||entry.path} // ${err.message}`)}
    }
  }catch(err){
    state.output.push(`Language manifest unavailable // ${err.message}`);
  }
  if(!state.languages.has('plaintext'))state.languages.set('plaintext',normalizeLanguage({id:'plaintext',name:'Plain Text',extensions:['.txt'],highlightNumbers:false}));
  renderLanguageLibrary();renderLanguageSelect();
}
function createFile(name='untitled.txt',content=''){
  const file={id:fileId(),name:String(name||'untitled.txt').slice(0,180),content:String(content),savedContent:String(content),dirty:false,languageId:languageForFile(name)};
  state.files.push(file);state.activeFileId=file.id;state.activeLanguageId=file.languageId;
  renderAll();return file;
}
function setActiveFile(id){
  const current=activeFile();if(current)current.content=editor.value;
  const target=state.files.find(f=>f.id===id);if(!target)return;
  state.activeFileId=id;state.activeLanguageId=target.languageId||languageForFile(target.name);
  editor.value=target.content;renderAll();
}
function closeFile(id){
  const index=state.files.findIndex(f=>f.id===id);if(index<0)return;
  const file=state.files[index];
  if(file.dirty&&!confirm(`Close ${file.name} without saving?`))return;
  state.files.splice(index,1);
  if(!state.files.length){createFile('untitled.txt','');return}
  if(state.activeFileId===id){
    const next=state.files[Math.min(index,state.files.length-1)];
    state.activeFileId=next.id;state.activeLanguageId=next.languageId;editor.value=next.content;
  }
  renderAll();
}
function renderFileTree(){
  const root=$('#fileTree');root.innerHTML='';
  for(const file of state.files){
    const row=document.createElement('div');
    row.className='code-file-item'+(file.id===state.activeFileId?' is-active':'');
    row.innerHTML=`<i>◇</i><b></b><small></small>`;
    row.querySelector('b').textContent=file.name;
    row.querySelector('small').textContent=file.dirty?'●':'';
    row.querySelector('small').className=file.dirty?'code-file-dirty':'';
    row.addEventListener('click',()=>setActiveFile(file.id));
    root.appendChild(row);
  }
}
function renderTabs(){
  const root=$('#editorTabs');root.innerHTML='';
  for(const file of state.files){
    const tab=document.createElement('div');tab.className='code-tab'+(file.id===state.activeFileId?' is-active':'');
    tab.setAttribute('role','tab');tab.innerHTML=`<i>${file.dirty?'●':''}</i><b></b><button type="button" aria-label="Close file">×</button>`;
    tab.querySelector('b').textContent=file.name;
    tab.addEventListener('click',e=>{if(!e.target.closest('button'))setActiveFile(file.id)});
    tab.querySelector('button').addEventListener('click',e=>{e.stopPropagation();closeFile(file.id)});
    root.appendChild(tab);
  }
}
function renderLanguageLibrary(){
  const root=$('#languageList');root.innerHTML='';
  [...state.languages.values()].sort((a,b)=>a.name.localeCompare(b.name)).forEach(lang=>{
    const row=document.createElement('div');row.className='code-language-item'+(lang.id===state.activeLanguageId?' is-active':'');
    row.innerHTML='<b></b><small></small>';row.querySelector('b').textContent=lang.name;
    row.querySelector('small').textContent=(lang.extensions||[]).slice(0,3).join(' ');
    row.addEventListener('click',()=>{state.activeLanguageId=lang.id;const file=activeFile();if(file)file.languageId=lang.id;renderAll()});
    root.appendChild(row);
  });
}
function renderLanguageSelect(){
  const select=$('#languageSelect'),old=select.value;select.innerHTML='';
  [...state.languages.values()].sort((a,b)=>a.name.localeCompare(b.name)).forEach(lang=>{
    const option=document.createElement('option');option.value=lang.id;option.textContent=lang.name;select.appendChild(option);
  });
  select.value=state.languages.has(state.activeLanguageId)?state.activeLanguageId:(old||'plaintext');
}
function syncInspector(){
  const lang=activeLanguage();if(!lang)return;
  $('#languageInspectorName').textContent=lang.name.toUpperCase();
  $('#langId').value=lang.id;$('#langName').value=lang.name;$('#langExtensions').value=(lang.extensions||[]).join(', ');
  $('#langLineComment').value=lang.lineComment||'';$('#langBlockStart').value=lang.blockComment?.start||'';$('#langBlockEnd').value=lang.blockComment?.end||'';
  $('#langKeywords').value=(lang.keywords||[]).join('\n');$('#langLiterals').value=(lang.literals||[]).join('\n');$('#langBuiltins').value=(lang.builtins||[]).join('\n');
  $('#langQuotes').value=(lang.stringQuotes||[]).join(' ');$('#langOperators').value=(lang.operators||[]).join(' ');
  $('#langNumbers').checked=lang.highlightNumbers!==false;$('#langCaseSensitive').checked=lang.caseSensitive!==false;
  $('#languageSelect').value=lang.id;
}
function updateLanguageFromInspector(){
  const old=activeLanguage();if(!old)return;
  const lines=id=>String($(id).value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const updated=normalizeLanguage({
    id:$('#langId').value,
    name:$('#langName').value,
    extensions:String($('#langExtensions').value||'').split(',').map(x=>x.trim()).filter(Boolean),
    lineComment:$('#langLineComment').value,
    blockComment:{start:$('#langBlockStart').value,end:$('#langBlockEnd').value},
    stringQuotes:String($('#langQuotes').value||'').split(/\s+/).filter(Boolean),
    keywords:lines('#langKeywords'),literals:lines('#langLiterals'),builtins:lines('#langBuiltins'),
    operators:String($('#langOperators').value||'').split(/\s+/).filter(Boolean),
    highlightNumbers:$('#langNumbers').checked,caseSensitive:$('#langCaseSensitive').checked
  });
  if(updated.id!==old.id)state.languages.delete(old.id);
  state.languages.set(updated.id,updated);state.activeLanguageId=updated.id;
  const file=activeFile();if(file)file.languageId=updated.id;
  renderLanguageLibrary();renderLanguageSelect();scheduleHighlight();updateStatus();
}
function sortedTokens(lang){
  const gather=(items,cls)=>items.map(value=>({value:String(value),cls}));
  return [
    ...gather(lang.keywords||[],'keyword'),
    ...gather(lang.literals||[],'literal'),
    ...gather(lang.builtins||[],'builtin')
  ].sort((a,b)=>b.value.length-a.value.length);
}
function isWordChar(ch){return !!ch&&/[A-Za-z0-9_$]/.test(ch)}
function startsWithAt(text,pos,token,caseSensitive=true){
  if(!token)return false;
  const slice=text.slice(pos,pos+token.length);
  return caseSensitive?slice===token:slice.toLowerCase()===token.toLowerCase();
}
function matchWordToken(text,pos,token,caseSensitive){
  if(!startsWithAt(text,pos,token.value,caseSensitive))return false;
  const before=text[pos-1],after=text[pos+token.value.length];
  if(/^[A-Za-z0-9_$]+$/.test(token.value)){
    if(isWordChar(before)||isWordChar(after))return false;
  }
  return true;
}
function highlight(text,lang){
  if(!lang)return escapeHtml(text);
  const out=[],tokens=sortedTokens(lang),operators=[...(lang.operators||[])].sort((a,b)=>b.length-a.length);
  const quotes=new Set(lang.stringQuotes||[]),line=lang.lineComment||'',blockStart=lang.blockComment?.start||'',blockEnd=lang.blockComment?.end||'';
  let i=0;
  while(i<text.length){
    if(line&&startsWithAt(text,i,line,true)){
      const end=text.indexOf('\n',i);const stop=end<0?text.length:end;
      out.push(`<span class="code-token comment">${escapeHtml(text.slice(i,stop))}</span>`);i=stop;continue;
    }
    if(blockStart&&blockEnd&&startsWithAt(text,i,blockStart,true)){
      const found=text.indexOf(blockEnd,i+blockStart.length);const stop=found<0?text.length:found+blockEnd.length;
      out.push(`<span class="code-token comment">${escapeHtml(text.slice(i,stop))}</span>`);i=stop;continue;
    }
    const ch=text[i];
    if(quotes.has(ch)){
      let j=i+1,escaped=false;
      while(j<text.length){
        const cj=text[j];
        if(escaped){escaped=false;j++;continue}
        if(cj==='\\'){escaped=true;j++;continue}
        if(cj===ch){j++;break}
        if(ch!=='`'&&cj==='\n')break;
        j++;
      }
      out.push(`<span class="code-token string">${escapeHtml(text.slice(i,j))}</span>`);i=j;continue;
    }
    if(lang.highlightNumbers!==false&&/[0-9]/.test(ch)&&!isWordChar(text[i-1])){
      const m=text.slice(i).match(/^(?:0x[0-9a-f]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i);
      if(m){out.push(`<span class="code-token number">${escapeHtml(m[0])}</span>`);i+=m[0].length;continue}
    }
    let matched=null;
    for(const token of tokens){if(matchWordToken(text,i,token,lang.caseSensitive!==false)){matched=token;break}}
    if(matched){out.push(`<span class="code-token ${matched.cls}">${escapeHtml(text.slice(i,i+matched.value.length))}</span>`);i+=matched.value.length;continue}
    const op=operators.find(value=>startsWithAt(text,i,value,true));
    if(op){out.push(`<span class="code-token operator">${escapeHtml(op)}</span>`);i+=op.length;continue}
    out.push(escapeHtml(ch));i++;
  }
  return out.join('');
}
let highlightTimer=0;
function scheduleHighlight(){clearTimeout(highlightTimer);highlightTimer=setTimeout(renderEditorLayers,20)}
function renderEditorLayers(){
  const text=editor.value,lang=activeLanguage();
  highlightCode.innerHTML=highlight(text,lang)+(text.endsWith('\n')?'\n':'');
  const lineCount=Math.max(1,text.split('\n').length);
  lineNumbers.textContent=Array.from({length:lineCount},(_,i)=>i+1).join('\n');
  minimap.textContent=text.slice(0,40000);
  syncScroll();
  updateStatus();
  analyzeDocument();
}
function syncScroll(){
  highlightLayer.scrollTop=editor.scrollTop;highlightLayer.scrollLeft=editor.scrollLeft;
  lineNumbers.scrollTop=editor.scrollTop;minimap.scrollTop=Math.max(0,editor.scrollTop/(Math.max(1,editor.scrollHeight-editor.clientHeight))*Math.max(0,minimap.scrollHeight-minimap.clientHeight));
}
function updateFileContent(){
  const file=activeFile();if(!file)return;
  file.content=editor.value;file.dirty=file.content!==file.savedContent;
  renderTabs();renderFileTree();scheduleHighlight();
}
function cursorInfo(){
  const pos=editor.selectionStart,before=editor.value.slice(0,pos),lines=before.split('\n');
  return {line:lines.length,col:lines[lines.length-1].length+1};
}
function updateStatus(){
  const file=activeFile(),pos=cursorInfo(),sel=Math.abs(editor.selectionEnd-editor.selectionStart),lang=activeLanguage();
  $('#statusFile').textContent=(file?.name||'UNTITLED').toUpperCase();
  $('#statusPosition').textContent=`LN ${pos.line} // COL ${pos.col}`;
  $('#statusSelection').textContent=`SEL ${sel}`;
  $('#statusIndent').textContent=`SPACES: ${state.tabWidth}`;
  $('#statusLanguage').textContent=(lang?.name||'Plain Text').toUpperCase();
}
function analyzeDocument(){
  const text=editor.value,lang=activeLanguage(),problems=[];
  if(lang?.id==='json'&&text.trim()){
    try{JSON.parse(text)}catch(err){problems.push(err.message)}
  }
  const openers={'{':'}','[':']','(':')'},stack=[];
  let quote='',escaped=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quote){
      if(escaped){escaped=false;continue}
      if(ch==='\\'){escaped=true;continue}
      if(ch===quote)quote='';
      continue;
    }
    if(['"',"'","`"].includes(ch)){quote=ch;continue}
    if(openers[ch])stack.push({ch,pos:i});
    else if(Object.values(openers).includes(ch)){
      const last=stack.pop();if(!last||openers[last.ch]!==ch){problems.push(`Unmatched closing ${ch}`);break}
    }
  }
  if(stack.length)problems.push(`${stack.length} unmatched opening bracket${stack.length===1?'':'s'}`);
  state.problems=problems;$('#problemCount').textContent=String(problems.length);
  if(state.bottomTab==='problems')renderBottomPanel();
}
function renderBottomPanel(){
  const root=$('#bottomPanelContent');
  if(state.bottomTab==='output')root.textContent=state.output.slice(-100).join('\n');
  if(state.bottomTab==='problems')root.textContent=state.problems.length?state.problems.join('\n'):'No problems detected by the lightweight browser analyzer.';
  if(state.bottomTab==='stats'){
    const text=editor.value,lines=text.split('\n').length,words=(text.match(/\S+/g)||[]).length;
    root.textContent=`FILE: ${activeFile()?.name||'—'}\nLANGUAGE: ${activeLanguage()?.name||'—'}\nLINES: ${lines}\nWORDS: ${words}\nCHARACTERS: ${text.length}\nBYTES (UTF-8): ${new TextEncoder().encode(text).length}`;
  }
}
function renderAll(){
  const file=activeFile();if(file&&editor.value!==file.content)editor.value=file.content;
  renderFileTree();renderTabs();renderLanguageLibrary();renderLanguageSelect();syncInspector();
  document.documentElement.style.setProperty('--editor-font-size',`${state.fontSize}px`);
  document.documentElement.style.setProperty('--tab-width',String(state.tabWidth));
  editor.classList.toggle('is-wrap',state.wordWrap);highlightLayer.classList.toggle('is-wrap',state.wordWrap);
  minimap.classList.toggle('is-hidden',!state.showMinimap);
  renderEditorLayers();renderBottomPanel();
}
function downloadText(text,name,type='text/plain'){
  const blob=new Blob([text],{type:`${type};charset=utf-8`}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}
function saveActiveFile(){
  const file=activeFile();if(!file)return;
  file.content=editor.value;downloadText(file.content,file.name);
  file.savedContent=file.content;file.dirty=false;state.output.push(`Saved ${file.name}`);renderAll();say(`Saved ${file.name}`,'ok');
}
async function openFileObjects(files){
  for(const file of files){
    try{
      const text=await file.text();createFile(file.webkitRelativePath||file.name,text);
      const f=activeFile();f.savedContent=text;f.dirty=false;
    }catch(err){state.output.push(`Open failed: ${file.name} // ${err.message}`)}
  }
  renderAll();say(`Opened ${files.length} file${files.length===1?'':'s'}`,'ok');
}
function showSearch(replace=false){
  $('#searchPanel').hidden=false;$('#replaceField').hidden=!replace;$('#replaceOne').hidden=!replace;$('#replaceAll').hidden=!replace;
  $('#findInput').focus();$('#findInput').select();
}
function searchOptions(){
  return {term:$('#findInput').value,caseSensitive:$('#caseSensitive').checked,wholeWord:$('#wholeWord').checked};
}
function findMatch(direction=1){
  const {term,caseSensitive,wholeWord}=searchOptions();if(!term)return false;
  const text=editor.value,source=caseSensitive?text:text.toLowerCase(),needle=caseSensitive?term:term.toLowerCase();
  const start=direction>0?editor.selectionEnd:Math.max(0,editor.selectionStart-1);
  let index=direction>0?source.indexOf(needle,start):source.lastIndexOf(needle,start);
  if(index<0)index=direction>0?source.indexOf(needle,0):source.lastIndexOf(needle,source.length);
  while(index>=0&&wholeWord&&(isWordChar(source[index-1])||isWordChar(source[index+needle.length]))){
    index=direction>0?source.indexOf(needle,index+1):source.lastIndexOf(needle,index-1);
  }
  if(index<0){say('No match','error');return false}
  editor.focus();editor.setSelectionRange(index,index+term.length);updateStatus();return true;
}
function replaceSelection(){
  const {term,caseSensitive}=searchOptions(),selected=editor.value.slice(editor.selectionStart,editor.selectionEnd);
  const matches=caseSensitive?selected===term:selected.toLowerCase()===term.toLowerCase();
  if(!matches){findMatch(1);return}
  editor.setRangeText($('#replaceInput').value,editor.selectionStart,editor.selectionEnd,'end');updateFileContent();findMatch(1);
}
function replaceAll(){
  const {term,caseSensitive,wholeWord}=searchOptions();if(!term)return;
  const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pattern=wholeWord?`\\b${escaped}\\b`:escaped;
  const re=new RegExp(pattern,caseSensitive?'g':'gi'),before=editor.value;
  editor.value=before.replace(re,$('#replaceInput').value);updateFileContent();
  say(`Replaced ${before===editor.value?0:(before.match(re)||[]).length} occurrence(s)`,'ok');
}
function gotoLine(){
  const max=editor.value.split('\n').length,value=prompt(`Go to line (1–${max}):`,String(cursorInfo().line));if(value===null)return;
  const line=Math.max(1,Math.min(max,Number(value)||1)),parts=editor.value.split('\n');let pos=0;
  for(let i=0;i<line-1;i++)pos+=parts[i].length+1;
  editor.focus();editor.setSelectionRange(pos,pos);const ratio=(line-1)/Math.max(1,max-1);editor.scrollTop=ratio*Math.max(0,editor.scrollHeight-editor.clientHeight);syncScroll();updateStatus();
}
function formatDocument(){
  const file=activeFile(),lang=activeLanguage();if(!file)return;
  if(lang?.id==='json'){
    try{editor.value=JSON.stringify(JSON.parse(editor.value),null,state.tabWidth);updateFileContent();say('JSON formatted','ok')}
    catch(err){say(`Format failed: ${err.message}`,'error')}
    return;
  }
  const lines=editor.value.split('\n'),trimmed=lines.map(line=>line.replace(/[ \t]+$/,'')).join('\n');
  editor.value=trimmed;updateFileContent();say('Trailing whitespace removed','ok');
}
function autoIndentNewline(e){
  const start=editor.selectionStart,end=editor.selectionEnd,text=editor.value,before=text.slice(0,start),line=before.slice(before.lastIndexOf('\n')+1);
  const indent=(line.match(/^\s*/)||[''])[0],last=line.trim().slice(-1),extra=['{','[','(',':'].includes(last)?' '.repeat(state.tabWidth):'';
  e.preventDefault();editor.setRangeText('\n'+indent+extra,start,end,'end');updateFileContent();
}
function insertTab(e){
  e.preventDefault();const spaces=' '.repeat(state.tabWidth);editor.setRangeText(spaces,editor.selectionStart,editor.selectionEnd,'end');updateFileContent();
}
function autoClosePair(e){
  if(!state.autoClose)return false;
  const pairs={'(' : ')','[':']','{':'}','"':'"',"'":"'","`":"`"};
  const close=pairs[e.key];if(!close)return false;
  const start=editor.selectionStart,end=editor.selectionEnd,selected=editor.value.slice(start,end);
  e.preventDefault();editor.setRangeText(e.key+selected+close,start,end,'select');
  if(!selected)editor.setSelectionRange(start+1,start+1);
  updateFileContent();return true;
}
function newLanguage(){
  const id='custom-'+Date.now().toString(36);
  const lang=normalizeLanguage({id,name:'Custom Language',extensions:['.custom'],lineComment:'//',blockComment:{start:'/*',end:'*/'},stringQuotes:['"',"'"],keywords:[],literals:[],builtins:[],operators:['=','+','-','*','/'],highlightNumbers:true,caseSensitive:true});
  state.languages.set(id,lang);state.activeLanguageId=id;const file=activeFile();if(file)file.languageId=id;renderAll();say('Custom language created','ok');
}
function saveLanguage(){
  const lang=activeLanguage();if(!lang)return;downloadText(JSON.stringify(lang,null,2),`${lang.id}.eraslang.json`,'application/json');say(`Saved ${lang.name}`,'ok');
}
async function loadLanguageFile(file){
  try{const lang=normalizeLanguage(JSON.parse(await file.text()));state.languages.set(lang.id,lang);state.activeLanguageId=lang.id;const f=activeFile();if(f)f.languageId=lang.id;renderAll();say(`Loaded language ${lang.name}`,'ok')}
  catch(err){say(`Language load failed: ${err.message}`,'error')}
}
const COMMANDS=[
  ['New File','Ctrl+N',()=>$('#newFileDialog').showModal()],
  ['Open Files','Ctrl+O',()=>$('#fileInput').click()],
  ['Save File','Ctrl+S',saveActiveFile],
  ['Find','Ctrl+F',()=>showSearch(false)],
  ['Replace','Ctrl+H',()=>showSearch(true)],
  ['Go To Line','Ctrl+G',gotoLine],
  ['Format Document','Ctrl+Shift+F',formatDocument],
  ['New Language Definition','',newLanguage],
  ['Save Language Definition','',saveLanguage],
  ['Toggle Word Wrap','Alt+Z',()=>{$('#wordWrap').click()}],
  ['Toggle Minimap','',()=>{$('#showMinimap').click()}]
];
function renderCommands(filter=''){
  const root=$('#commandList'),needle=filter.toLowerCase();root.innerHTML='';
  COMMANDS.filter(([name])=>name.toLowerCase().includes(needle)).forEach(([name,key,run])=>{
    const row=document.createElement('button');row.type='button';row.className='code-command-item';row.innerHTML='<b></b><kbd></kbd>';row.querySelector('b').textContent=name;row.querySelector('kbd').textContent=key;
    row.addEventListener('click',()=>{$('#commandDialog').close();run()});root.appendChild(row);
  });
}
function openCommands(){
  renderCommands();$('#commandDialog').showModal();requestAnimationFrame(()=>{$('#commandSearch').value='';$('#commandSearch').focus()});
}

editor.addEventListener('input',updateFileContent);
editor.addEventListener('scroll',syncScroll);
editor.addEventListener('click',updateStatus);
editor.addEventListener('keyup',updateStatus);
editor.addEventListener('keydown',e=>{
  if(e.key==='Tab'){insertTab(e);return}
  if(e.key==='Enter'){autoIndentNewline(e);return}
  if(autoClosePair(e))return;
});
document.addEventListener('keydown',e=>{
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&e.code==='KeyN'){e.preventDefault();$('#newFileDialog').showModal()}
  if(mod&&e.code==='KeyO'){e.preventDefault();$('#fileInput').click()}
  if(mod&&e.code==='KeyS'){e.preventDefault();saveActiveFile()}
  if(mod&&e.code==='KeyF'&&!e.shiftKey){e.preventDefault();showSearch(false)}
  if(mod&&e.code==='KeyH'){e.preventDefault();showSearch(true)}
  if(mod&&e.code==='KeyG'){e.preventDefault();gotoLine()}
  if(mod&&e.shiftKey&&e.code==='KeyF'){e.preventDefault();formatDocument()}
  if(mod&&e.shiftKey&&e.code==='KeyP'){e.preventDefault();openCommands()}
  if(e.altKey&&e.code==='KeyZ'){e.preventDefault();$('#wordWrap').click()}
});

$('#newFileButton').addEventListener('click',()=>$('#newFileDialog').showModal());
$('#explorerNewFile').addEventListener('click',()=>$('#newFileDialog').showModal());
$('#createFileButton').addEventListener('click',e=>{e.preventDefault();createFile($('#newFileName').value||'untitled.txt','');$('#newFileDialog').close();editor.focus()});
$('#openFilesButton').addEventListener('click',()=>$('#fileInput').click());
$('#explorerImport').addEventListener('click',()=>$('#fileInput').click());
$('#openFolderButton').addEventListener('click',()=>$('#folderInput').click());
$('#saveFileButton').addEventListener('click',saveActiveFile);
$('#fileInput').addEventListener('change',e=>{openFileObjects([...e.target.files]);e.target.value=''});
$('#folderInput').addEventListener('change',e=>{openFileObjects([...e.target.files]);e.target.value=''});
$('#findButton').addEventListener('click',()=>showSearch(false));
$('#replaceButton').addEventListener('click',()=>showSearch(true));
$('#gotoLineButton').addEventListener('click',gotoLine);
$('#formatButton').addEventListener('click',formatDocument);
$('#commandButton').addEventListener('click',openCommands);
$('#closeSearch').addEventListener('click',()=>$('#searchPanel').hidden=true);
$('#findNext').addEventListener('click',()=>findMatch(1));$('#findPrevious').addEventListener('click',()=>findMatch(-1));
$('#findInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();findMatch(e.shiftKey?-1:1)}});
$('#replaceOne').addEventListener('click',replaceSelection);$('#replaceAll').addEventListener('click',replaceAll);
$('#languageSelect').addEventListener('change',e=>{state.activeLanguageId=e.target.value;const f=activeFile();if(f)f.languageId=e.target.value;renderAll()});
$('#newLanguageButton').addEventListener('click',newLanguage);
$('#saveLanguageButton').addEventListener('click',saveLanguage);
$('#loadLanguageButton').addEventListener('click',()=>$('#languageFileInput').click());
$('#languageFileInput').addEventListener('change',e=>{loadLanguageFile(e.target.files?.[0]);e.target.value=''});
['#langId','#langName','#langExtensions','#langLineComment','#langBlockStart','#langBlockEnd','#langKeywords','#langLiterals','#langBuiltins','#langQuotes','#langOperators'].forEach(id=>$(id).addEventListener('change',updateLanguageFromInspector));
$('#langNumbers').addEventListener('change',updateLanguageFromInspector);$('#langCaseSensitive').addEventListener('change',updateLanguageFromInspector);
$('#fontSize').addEventListener('input',e=>{state.fontSize=Number(e.target.value);$('#fontSizeOut').textContent=`${state.fontSize} PX`;renderAll()});
$('#tabWidth').addEventListener('input',e=>{state.tabWidth=Number(e.target.value);$('#tabWidthOut').textContent=String(state.tabWidth);renderAll()});
$('#wordWrap').addEventListener('change',e=>{state.wordWrap=e.target.checked;renderAll()});
$('#showMinimap').addEventListener('change',e=>{state.showMinimap=e.target.checked;renderAll()});
$('#autoClose').addEventListener('change',e=>state.autoClose=e.target.checked);
$$('[data-bottom-tab]').forEach(btn=>btn.addEventListener('click',()=>{state.bottomTab=btn.dataset.bottomTab;$$('[data-bottom-tab]').forEach(b=>b.classList.toggle('is-active',b===btn));renderBottomPanel()}));
$('#toggleBottomPanel').addEventListener('click',()=>{state.bottomCollapsed=!state.bottomCollapsed;$('.code-bottom-panel').classList.toggle('is-collapsed',state.bottomCollapsed);$('#toggleBottomPanel').textContent=state.bottomCollapsed?'SHOW':'HIDE'});
$('#commandSearch').addEventListener('input',e=>renderCommands(e.target.value));

(async()=>{
  await loadLanguages();
  createFile('welcome.js',`// E.R.A.S. CODE
// Modular browser text editor / IDE foundation.

const moduleName = "CODE";
const languageSystem = {
  builtIn: true,
  customDefinitions: true,
  browserFirst: true
};

function bootEditor() {
  console.log(\`\${moduleName} ready.\`);
}

bootEditor();
`);
  state.output.push('Loaded built-in modular language definitions.');
  renderAll();
  editor.focus();
})();
