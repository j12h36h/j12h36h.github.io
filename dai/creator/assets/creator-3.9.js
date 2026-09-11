(() => {
  const bundle = window.DAI_CREATOR_39;
  if (!bundle || document.body.dataset.daiWeb39 === '1') return;
  document.body.dataset.daiWeb39 = '1';
  const schemas = bundle.schemas || {};
  const presets = bundle.presets || {};
  const $ = (s,r=document)=>r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const slug = v => String(v||'definition').trim().toLowerCase().replace(/\\/g,'/').replace(/[^a-z0-9._/-]+/g,'_').replace(/^[/_.-]+|[/_.-]+$/g,'') || 'definition';
  const ns = () => slug($('#namespace')?.value || 'my_dai_pack').replace(/\//g,'_');
  const clone = o => JSON.parse(JSON.stringify(o ?? {}));
  const merge = (a,b) => { for (const [k,v] of Object.entries(b||{})){ if(v&&typeof v==='object'&&!Array.isArray(v)){ a[k]=a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k])?a[k]:{}; merge(a[k],v); } else a[k]=clone(v); } return a; };
  const getPath=(o,path)=>String(path||'').split('.').reduce((x,k)=>x&&x[k],o);
  const setPath=(o,path,val)=>{const ks=String(path||'').split('.');let x=o;ks.slice(0,-1).forEach(k=>x=x[k]??=( {} ));x[ks.at(-1)]=val;};
  const typeFor = s => { const t=s.fields?.find(f=>f.path==='enabled'&&f.type==='boolean'); return t; };
  const railOrder=['experience','standalone'];
  const catOrder=['PRESENTATION','STORY','SYSTEMS','WORLD','CONTENT','GAMEPLAY','MEDIA','ECONOMY'];
  const orderedSchemas=()=>Object.entries(schemas).sort((a,b)=>{
    const ar=railOrder.indexOf(a[1].rail), br=railOrder.indexOf(b[1].rail); if(ar!==br)return ar-br;
    const ac=catOrder.indexOf(a[1].category), bc=catOrder.indexOf(b[1].category); if(ac!==bc)return ac-bc;
    return (b[1].priority||0)-(a[1].priority||0) || a[1].display_name.localeCompare(b[1].display_name);
  });

  // Extend the legacy Runtime Definitions picker too, so both Creator paths understand 3.9 folders.
  try {
    if (typeof RUNTIME_DEFINITION_TYPES !== 'undefined') {
      for (const [id,s] of orderedSchemas()) if (!RUNTIME_DEFINITION_TYPES[id]) RUNTIME_DEFINITION_TYPES[id]={label:`DAI 3.9 ${s.display_name}`,folder:s.folder,sample:clone(s.template||{})};
      const picker=$('#runtimeTypePicker'); if(picker) picker.innerHTML=Object.entries(RUNTIME_DEFINITION_TYPES).map(([k,v])=>`<option value="${esc(k)}">${esc(v.label)} · ${esc(v.folder)}</option>`).join('');
    }
  } catch(e){ console.debug('DAI 3.9 runtime picker extension unavailable',e); }

  const sidebar=$('.sidebar .panel-body');
  if(sidebar && !sidebar.querySelector('[data-view="studio39"]')){
    const label=document.createElement('div'); label.className='section-label datapack-only'; label.textContent='DAI 3.9';
    const btn=document.createElement('button'); btn.className='nav-btn datapack-only'; btn.dataset.view='studio39'; btn.dataset.search='3.9 visual studio scene screen story input creator schema preset modules'; btn.textContent='3.9 Visual Studio';
    const pack=$('.nav-btn[data-view="pack"]'); pack?.after(label,btn);
    btn.addEventListener('click',()=>{ try{switchView('studio39')}catch{document.querySelectorAll('.editor-section').forEach(x=>x.classList.toggle('active',x.id==='view-studio39'));} });
  }

  const dashboardGrid=$('#view-dashboard .start-grid.datapack-only');
  if(dashboardGrid && !dashboardGrid.querySelector('[data-studio39-card]')){
    const card=document.createElement('button'); card.type='button'; card.className='start-card'; card.dataset.studio39Card='1';
    card.innerHTML='<strong>DAI 3.9 Visual Studio</strong><span>Scenes, screens, story archives, input profiles and every schema-defined module.</span>';
    card.addEventListener('click',()=>{ try{switchView('studio39')}catch{} }); dashboardGrid.prepend(card);
  }

  const main=$('.creator-layout main');
  if(main && !$('#view-studio39')){
    const sec=document.createElement('section'); sec.className='editor-section panel datapack-only'; sec.id='view-studio39';
    sec.innerHTML=`<div class="panel-head"><strong>DAI 3.9 Visual Studio</strong><small>Schema-driven authoring for every current DAI module</small></div><div class="panel-body studio39-body">
      <div class="studio39-hero"><div><span class="system-tag">DAI 3.9 / DATA-DRIVEN</span><h2>Choose what you want to create.</h2><p>The browser Creator now reads the same module concepts as the in-game 3.9 Creator. Pick a category, type and optional preset; Basic shows only the fields needed to begin.</p></div><span class="version-chip">47 authoring types</span></div>
      <div class="studio39-mode"><button class="btn primary" data-s39-level="0">Basic</button><button class="btn" data-s39-level="1">More</button><button class="btn" data-s39-level="2">All</button><a class="btn" href="/dai/guides/version-3-9/" target="_blank">3.9 Guide ↗</a></div>
      <div class="studio39-workspace">
        <aside class="studio39-browser"><div class="studio39-rail"><button data-s39-rail="experience" class="active">GAME</button><button data-s39-rail="standalone">PARTS</button></div><div class="studio39-cats" id="s39Cats"></div><div class="studio39-types" id="s39Types"></div><div class="studio39-presets" id="s39Presets"></div></aside>
        <section class="studio39-preview"><span class="system-tag" id="s39Folder"></span><h3 id="s39Title"></h3><p id="s39Desc"></p><pre id="s39Preview"></pre></section>
        <aside class="studio39-inspector"><div class="field"><label>Definition ID / path</label><input id="s39Id" value="definition"/></div><div class="studio39-fields" id="s39Fields"></div><details><summary>Raw JSON</summary><textarea id="s39Raw" spellcheck="false"></textarea></details><div class="studio39-actions"><button class="btn primary" id="s39Save" type="button">Add / Update Definition</button><button class="btn" id="s39Reset" type="button">Reset</button><button class="btn" id="s39OpenFiles" type="button">Universal Files</button></div><div class="passthrough" id="s39Status">Ready.</div></aside>
      </div></div>`;
    const dash=$('#view-dashboard'); dash?.before(sec) || main.appendChild(sec);
  }

  let rail='experience', category='PRESENTATION', schemaId='scene_environment', level=0, draft={};
  const schema=()=>schemas[schemaId]||Object.values(schemas)[0];
  const matchingPresets=()=>Object.entries(presets).filter(([,p])=>String(p.schema||'').split(':').pop()===schemaId).sort((a,b)=>(b[1].priority||0)-(a[1].priority||0));
  const targetPath=()=>`data/${ns()}/${schema().folder}/${slug($('#s39Id')?.value||schemaId)}.json`;
  const defaultId=()=>schemaId.replace(/_profile$/,'').replace(/_environment$/,'').replace(/_override$/,'')+'_1';
  const parseVal=(f,v)=> f.type==='boolean' ? (v==='true'||v===true) : f.type==='number' ? (Number(v)||0) : v;
  function renderCats(){ const cats=[...new Set(orderedSchemas().filter(([,s])=>s.rail===rail).map(([,s])=>s.category))]; if(!cats.includes(category))category=cats[0]||'SYSTEMS'; $('#s39Cats').innerHTML=cats.map(c=>`<button class="${c===category?'active':''}" data-cat="${esc(c)}">${esc(c[0]+c.slice(1).toLowerCase())}</button>`).join(''); $$('#s39Cats button').forEach(b=>b.onclick=()=>{category=b.dataset.cat; const first=orderedSchemas().find(([,s])=>s.rail===rail&&s.category===category); if(first){schemaId=first[0]; reset();} renderAll();}); }
  function $$(s,r=document){return [...r.querySelectorAll(s)]}
  function renderTypes(){ const list=orderedSchemas().filter(([,s])=>s.rail===rail&&s.category===category); $('#s39Types').innerHTML='<strong>Types</strong>'+list.map(([id,s])=>`<button class="${id===schemaId?'active':''}" data-type="${id}">${esc(s.short_name||s.display_name)}</button>`).join(''); $$('#s39Types button').forEach(b=>b.onclick=()=>{schemaId=b.dataset.type; reset(); renderAll();}); }
  function renderPresets(){ const list=matchingPresets(); $('#s39Presets').innerHTML='<strong>Presets</strong>'+(list.length?list.map(([id,p])=>`<button data-preset="${id}">${esc(p.display_name)}</button>`).join(''):'<span class="studio39-empty">No preset needed.</span>'); $$('#s39Presets button').forEach(b=>b.onclick=()=>{merge(draft,presets[b.dataset.preset].patch||{}); sync();}); }
  function renderFields(){ const fs=(schema().fields||[]).filter(f=>(f.level||0)<=level); $('#s39Fields').innerHTML=fs.map((f,i)=>{const v=getPath(draft,f.path); const id='s39f'+i; const input=f.type==='boolean'?`<select id="${id}" data-path="${esc(f.path)}" data-type="boolean"><option value="true"${v===true?' selected':''}>true</option><option value="false"${v===false?' selected':''}>false</option></select>`:`<input id="${id}" data-path="${esc(f.path)}" data-type="${esc(f.type||'text')}" type="${f.type==='number'?'number':'text'}" value="${esc(v??f.default??'')}"/>`; return `<div class="field"><label for="${id}">${esc(f.label||f.path)}</label>${input}<span class="help">${esc(f.path)}</span></div>`;}).join('') || '<div class="empty">Use Raw JSON for this definition.</div>'; $$('#s39Fields [data-path]').forEach(inp=>{const evt=inp.tagName==='SELECT'?'change':'input'; inp.addEventListener(evt,()=>{setPath(draft,inp.dataset.path,parseVal({type:inp.dataset.type},inp.value)); sync(false);});}); }
  function sync(rebuild=true){ if(rebuild)renderFields(); $('#s39Raw').value=JSON.stringify(draft,null,2); $('#s39Preview').textContent=JSON.stringify(draft,null,2); $('#s39Folder').textContent=`${schema().folder} · ${rail==='experience'?'GAME':'PART'}`; $('#s39Title').textContent=schema().display_name; $('#s39Desc').textContent=schema().description||''; }
  function reset(){ draft=clone(schema().template||{}); const id=$('#s39Id'); if(id)id.value=defaultId(); }
  function renderAll(){ renderCats(); renderTypes(); renderPresets(); sync(); $$('.studio39-rail button').forEach(b=>b.classList.toggle('active',b.dataset.s39Rail===rail)); $$('[data-s39-level]').forEach(b=>b.classList.toggle('primary',Number(b.dataset.s39Level)===level)); }
  $$('.studio39-rail button').forEach(b=>b.onclick=()=>{rail=b.dataset.s39Rail; const first=orderedSchemas().find(([,s])=>s.rail===rail); if(first){category=first[1].category;schemaId=first[0];reset();}renderAll();});
  $$('[data-s39-level]').forEach(b=>b.onclick=()=>{level=Number(b.dataset.s39Level);renderAll();});
  $('#s39Raw')?.addEventListener('input',()=>{try{draft=JSON.parse($('#s39Raw').value);$('#s39Status').textContent='JSON valid.';$('#s39Preview').textContent=JSON.stringify(draft,null,2);renderFields();}catch{$('#s39Status').textContent='JSON is not valid yet.';}});
  $('#s39Reset')?.addEventListener('click',()=>{reset();renderAll();});
  $('#s39OpenFiles')?.addEventListener('click',()=>$('.nav-btn[data-view="files"]')?.click());
  $('#s39Save')?.addEventListener('click',()=>{
    try{draft=JSON.parse($('#s39Raw').value); const path=targetPath(); if(typeof state==='undefined')throw new Error('Creator project state is unavailable.'); state.extraFiles ||= {}; state.extraFiles[path]=JSON.stringify(draft,null,2)+'\n'; if(typeof renderUniversalFiles==='function')renderUniversalFiles(); if(typeof refreshAll==='function')refreshAll(); $('#s39Status').innerHTML=`<strong>Saved</strong><span>${esc(path)}</span>`;}catch(e){$('#s39Status').textContent=`Could not save: ${e.message||e}`;}
  });
  $('#namespace')?.addEventListener('input',()=>sync(false));
  reset(); renderAll();
})();
