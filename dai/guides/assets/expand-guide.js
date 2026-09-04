(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MODULES = [
    {id:'menus',label:'Menus, Input & Keybind Gameplay',guide:'/dai/guides/tutorials/create-anything/menus-input/',summary:'Menus, action choices, keybind-driven UI and player input.',patterns:[/\/menus\//,/dai_keybinds/,/keybind/,/input/]},
    {id:'logic',label:'Logic, Objectives & Sequences',guide:'/dai/guides/tutorials/create-anything/logic-objectives/',summary:'Action definitions, conditions, objectives, sequences and flow.',patterns:[/\/logics\//,/\/objectives\//,/\/actions\//,/\/conditions\//,/definitions/]},
    {id:'reactions',label:'Reactions & Event-Driven Gameplay',guide:'/dai/guides/tutorials/create-anything/reactions-events/',summary:'Gameplay events mapped to deterministic responses.',patterns:[/\/reactions\//,/reaction_events/,/event_handlers/]},
    {id:'items',label:'Custom Items',guide:'/dai/guides/tutorials/create-anything/items/',summary:'Item identities, data/components and item behavior.',patterns:[/dai_items/,/\/items\//]},
    {id:'blocks',label:'Custom Blocks',guide:'/dai/guides/tutorials/create-anything/blocks/',summary:'Blocks, states, collision, interaction and lifecycle.',patterns:[/dai_blocks/,/\/blocks\//]},
    {id:'weapons',label:'Weapons & Combat Items',guide:'/dai/guides/tutorials/create-anything/weapons/',summary:'Melee/ranged weapons, costs, cooldowns and hit rules.',patterns:[/dai_weapons/,/\/weapons\//]},
    {id:'armor',label:'Armor & Equipment',guide:'/dai/guides/tutorials/create-anything/armor/',summary:'Armor/equipment identities and abilities.',patterns:[/dai_armor/,/\/armor\//]},
    {id:'attributes',label:'Attributes & Modifiers',guide:'/dai/guides/tutorials/create-anything/attributes/',summary:'Reusable numeric state and attribute modifiers.',patterns:[/dai_attributes/,/\/attributes\//]},
    {id:'effects',label:'Effects & Potions',guide:'/dai/guides/tutorials/create-anything/effects-potions/',summary:'Status effects, potions and application/removal behavior.',patterns:[/dai_effects/,/dai_potions/,/\/effects\//,/\/potions\//]},
    {id:'projectiles',label:'Projectiles',guide:'/dai/guides/tutorials/create-anything/projectiles/',summary:'Projectile speed, gravity, collision and special physics.',patterns:[/dai_projectiles/,/\/projectiles\//]},
    {id:'particles',label:'Particles & Visual FX',guide:'/dai/guides/tutorials/create-anything/particles/',summary:'Reusable particles and event-driven visual feedback.',patterns:[/dai_particles/,/\/particles\//]},
    {id:'entities',label:'Native Entities & AI',guide:'/dai/guides/tutorials/create-anything/entities/',summary:'Entities, stats, AI/behavior sequences and spawning.',patterns:[/dai_entities/,/\/entities\//,/entity_behaviors/,/entity_ai/]},
    {id:'animation',label:'Animations & Rendering',guide:'/dai/guides/tutorials/create-anything/animations-rendering/',summary:'Animation state, render profiles and visual model behavior.',patterns:[/dai_animations/,/dai_render_profiles/,/\/animations\//,/render_profiles/]},
    {id:'audio',label:'Sounds & Music',guide:'/dai/guides/tutorials/create-anything/sound-music/',summary:'Sound/music definitions and event-driven audio.',patterns:[/dai_sounds/,/dai_music/,/\/sounds\//,/\/music\//]},
    {id:'ui',label:'HUD, Overlays & Data Screens',guide:'/dai/guides/tutorials/create-anything/hud-ui/',summary:'HUD, overlays, data screens, title/screen presentation.',patterns:[/dai_screens/,/screen_profiles/,/title_screens/,/\/overlays\//,/\/hud\//]},
    {id:'persistent',label:'Persistent Content State',guide:'/dai/guides/tutorials/create-anything/persistent-content-state/',summary:'Persistent item components, block state and inventories.',patterns:[/data_components/,/block_entities/,/persistent/,/state_store/]},
    {id:'structures',label:'Structures & Modular Rooms',guide:'/dai/guides/tutorials/create-anything/structures-modules/',summary:'Structures, modules, sockets, placement and repair.',patterns:[/dai_structures/,/\/structures\//,/modules/,/sockets/]},
    {id:'biomes',label:'Features & Biomes',guide:'/dai/guides/tutorials/create-anything/features-biomes/',summary:'Features, biomes and environment generation.',patterns:[/dai_biomes/,/\/worldgen\/biome/,/\/worldgen\/configured_feature/,/\/worldgen\/placed_feature/,/dai_features/]},
    {id:'loot',label:'Loot, Recipes & Processing',guide:'/dai/guides/tutorials/create-anything/loot-recipes/',summary:'Loot tables, crafting and DAI processing recipes.',patterns:[/loot_tables/,/dai_recipes/,/\/recipe\//,/\/recipes\//]},
    {id:'social',label:'Economy & Social Systems',guide:'/dai/guides/tutorials/create-anything/economy-social/',summary:'Currencies, shops, dialogues, quests and factions.',patterns:[/currenc/,/shops?\//,/dialog/,/quests?\//,/factions?\//]},
    {id:'dimensions',label:'Dimensions, Timelines & Environments',guide:'/dai/guides/tutorials/create-anything/dimensions-timelines/',summary:'Dimensions, world identity, timelines and environments.',patterns:[/\/dimension\//,/dimension_type/,/dai_timelines/,/environments?\//,/world_presets?\//]},
    {id:'physics',label:'Rules & Physics',guide:'/dai/guides/tutorials/create-anything/rules-physics/',summary:'Rules, gravity, movement and environmental modifiers.',patterns:[/dai_physics/,/physics/,/game_rules/,/environment_modifiers/]},
    {id:'vehicles',label:'Vehicles',guide:'/dai/guides/tutorials/create-anything/vehicles/',summary:'Vehicles, input, seats, acceleration and steering.',patterns:[/dai_vehicles/,/\/vehicles\//]},
    {id:'portals',label:'Portals & Interactive Volumes',guide:'/dai/guides/tutorials/create-anything/portals-interactives/',summary:'Portals, interactive volumes, triggers and cooldowns.',patterns:[/dai_portals/,/dai_interactives/,/\/portals\//,/\/interactives\//]},
    {id:'fluids',label:'Fluids',guide:'/dai/guides/tutorials/create-anything/fluids/',summary:'Fluid behavior, movement, damage and interaction.',patterns:[/dai_fluids/,/\/fluids\//]},
    {id:'recognition',label:'Recognition & Perception',guide:'/dai/guides/tutorials/create-anything/recognition/',summary:'Recognition definitions, groups, targets and structural perception.',patterns:[/recognition/,/perception/,/recognition_groups/]},
    {id:'automation',label:'Automation & Autonomous Behavior',guide:'/dai/guides/tutorials/create-anything/automation/',summary:'Automation that perceives, selects, acts and stops.',patterns:[/automation/,/autonomous/]},
    {id:'experience',label:'Experiences & Worldgen',guide:'/dai/guides/tutorials/create-anything/experiences-worldgen/',summary:'MAIN experiences, save bootstrap, world construction and resume.',patterns:[/experiences?\//,/worldgen_profiles?/,/dai_worldgen/,/startup_profiles?/]},
    {id:'multiplayer',label:'Multiplayer, Checkpoints & Migrations',guide:'/dai/guides/tutorials/create-anything/multiplayer-migrations/',summary:'Ownership, checkpoints, recovery and version migrations.',patterns:[/migrations?\//,/checkpoints?\//,/player_state/,/multiplayer/]},
    {id:'branding',label:'Branding & Loading',guide:'/dai/guides/tutorials/create-anything/branding-loading/',summary:'Title, loading, application and experience branding.',patterns:[/branding/,/loading/,/title_screens/]}
  ];
  const DAI_REPO = 'j12h36h/decisions_and_impulses';
  const DAI_DATA_API = `https://api.github.com/repos/${DAI_REPO}/contents/data?ref=main`;
  const FRIENDLY_PROJECTS = [
    ['AutoCraft_MineShaft','AutoCraft MineShaft'],
    ['Boxhead_Data','Boxhead'],
    ['ClayGrounds_Data','ClayGrounds'],
    ['DAI_ComicEffects_Data','DAI Comic Effects'],
    ['DAI_Damage_Indicators','DAI Damage Indicators'],
    ['DAI_Fun','DAI Fun Survival'],
    ['DAI_Kittys_Dagger_Data',"Kitty's Dagger"],
    ['DAI_Survival_Interface','DAI Survival Interface'],
    ['DirtBikeLife_Data','DirtBikeLife'],
    ['EchoTime','Echo Time'],
    ['HollowSpiral_Data','Hollow Spiral'],
    ['MineTrigger_Data','MineTrigger'],
    ['MusashiStory_Data','Musashi Story'],
    ['Patch_and_Release_DAI','Patch & Release'],
    ['Space_Between_Blocks_Data','Space Between Blocks'],
    ['TamaCrafti_Data','TamaCrafti'],
    ['Tower_of_DLC_Data','Tower of DLC'],
    ['World_of_Addons_Data','World of Addons']
  ];
  let registry = null, selectedPack = null, selectedComponent = null, zipEntries = [], detected = [], lastPlanText = '';

  function status(msg, level=''){ const el=$('#expandStatus'); el.className=`expand-status ${level}`; el.textContent=msg; }
  function versionFromFile(name=''){
    const m=String(name).match(/_v(\d+(?:\.\d+){1,3})(?:_([A-Za-z0-9.-]+))?\.zip$/i);
    return m ? `${m[1]}${m[2] ? ` ${m[2]}` : ''}` : 'GitHub snapshot';
  }
  function friendlyProjectName(fileName=''){
    const hit=FRIENDLY_PROJECTS.find(([prefix])=>String(fileName).startsWith(prefix));
    if(hit)return hit[1];
    return String(fileName).replace(/\.zip$/i,'').replace(/_Data(?=_v|$)/i,'').replace(/_DAI(?=_v|$)/i,'').replace(/_v\d+(?:\.\d+){1,3}.*$/i,'').replace(/^DAI_/,'DAI ').replace(/_/g,' ');
  }
  function packIdFor(fileName=''){
    return `repo:${String(fileName).replace(/\.zip$/i,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')}`;
  }
  function githubPackFromFile(file){
    return {
      id: packIdFor(file.name),
      name: friendlyProjectName(file.name),
      version: versionFromFile(file.name),
      type: 'datapack',
      featured: true,
      summary: `Current public DAI repository snapshot: ${file.name}`,
      info_url: file.html_url || `https://github.com/${DAI_REPO}/blob/main/data/${encodeURIComponent(file.name)}`,
      components: [{
        id: packIdFor(file.name)+':data',
        type: 'datapack',
        file_name: file.name,
        source: 'github',
        source_url: file.download_url || `https://raw.githubusercontent.com/${DAI_REPO}/main/data/${encodeURIComponent(file.name)}`,
        source_page: file.html_url || `https://github.com/${DAI_REPO}/blob/main/data/${encodeURIComponent(file.name)}`
      }]
    };
  }
  async function loadLiveRepoPacks(){
    const r=await fetch(DAI_DATA_API,{cache:'no-store',headers:{'Accept':'application/vnd.github+json'}});
    if(!r.ok)throw new Error(`GitHub repository HTTP ${r.status}`);
    const files=await r.json();
    if(!Array.isArray(files))throw new Error('GitHub repository listing was not an array.');
    const packs=files.filter(f=>f?.type==='file' && /\.zip$/i.test(f.name||'')).map(githubPackFromFile)
      .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
    if(!packs.length)throw new Error('No datapack ZIPs were found in the DAI repository data folder.');
    return {schema:2,source:'github-live',repository:`https://github.com/${DAI_REPO}`,packs};
  }
  async function loadStaticGithubFallback(){
    const r=await fetch('/dai/api/public-bases.json',{cache:'no-store'});
    if(!r.ok)throw new Error(`fallback registry HTTP ${r.status}`);
    const data=await r.json();
    data.packs=(data.packs||[]).map(p=>({...p,components:(p.components||[]).filter(c=>(c.type||'datapack')==='datapack' && /github(?:usercontent)?\.com/i.test(c.source_url||c.github_raw_url||''))})).filter(p=>p.components.length);
    if(!data.packs.length)throw new Error('The fallback registry contains no GitHub datapack sources.');
    return data;
  }
  async function loadRegistry(){
    try{
      try{
        registry=await loadLiveRepoPacks();
        status(`Loaded ${registry.packs.length} current datapack ZIPs directly from the DAI GitHub repository. No CurseForge file lookup is used.`,'ok');
      }catch(liveError){
        console.warn('Live DAI repository listing failed; using the website GitHub snapshot registry.',liveError);
        registry=await loadStaticGithubFallback();
        status(`Live GitHub listing was unavailable (${liveError.message}). Using the website's GitHub-only snapshot registry instead.`,'warn');
      }
      const packs=(registry.packs||[]).filter(p=>(p.components||[]).some(c=>(c.type||'datapack')==='datapack'));
      $('#expandPack').innerHTML=packs.map((p,i)=>`<option value="${esc(p.id)}"${i===0?' selected':''}>${esc(p.name)} · ${esc(p.version||'')}</option>`).join('');
      populateComponents();
    }catch(e){ status(`Could not load DAI repository sources: ${e.message}`,'error'); }
  }
  function populateComponents(){
    selectedPack=(registry?.packs||[]).find(p=>p.id===$('#expandPack').value)||null;
    const comps=(selectedPack?.components||[]).filter(c=>(c.type||'datapack')==='datapack');
    $('#expandComponent').innerHTML=comps.map((c,i)=>`<option value="${i}">${esc(c.file_name||c.id||`Datapack ${i+1}`)}</option>`).join('') || '<option>No datapack component</option>';
    selectedComponent=comps[0]||null;
  }
  function componentUrl(c){ return c?.source_url||c?.github_raw_url||''; }
  function readZipNames(buffer){
    const bytes=new Uint8Array(buffer), dv=new DataView(buffer);
    let eocd=-1; for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){ if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;} }
    if(eocd<0) throw new Error('ZIP central directory was not found.');
    const count=dv.getUint16(eocd+10,true), offset=dv.getUint32(eocd+16,true), dec=new TextDecoder();
    let p=offset; const out=[];
    for(let i=0;i<count;i++){
      if(dv.getUint32(p,true)!==0x02014b50) throw new Error('Unexpected ZIP central-directory entry.');
      const nameLen=dv.getUint16(p+28,true), extraLen=dv.getUint16(p+30,true), commentLen=dv.getUint16(p+32,true);
      const name=dec.decode(bytes.slice(p+46,p+46+nameLen)).replace(/\\/g,'/');
      if(name && !name.endsWith('/')) out.push(name);
      p+=46+nameLen+extraLen+commentLen;
    }
    return out;
  }
  function classify(entries){
    return MODULES.map(m=>({...m,files:entries.filter(path=>m.patterns.some(re=>re.test(path.toLowerCase())))})).filter(m=>m.files.length).sort((a,b)=>b.files.length-a.files.length);
  }
  function renderDetected(){
    const root=$('#detectedModules');
    root.innerHTML=detected.map(m=>`<article class="detected-module"><label><input type="checkbox" class="module-check" value="${esc(m.id)}"><span><strong>${esc(m.label)}</strong><p>${esc(m.summary)}</p><small>${m.files.length} matching source file${m.files.length===1?'':'s'}</small></span></label><details><summary>Example source paths</summary>${m.files.slice(0,8).map(f=>`<div><code>${esc(f)}</code></div>`).join('')}${m.files.length>8?`<div>…and ${m.files.length-8} more</div>`:''}</details></article>`).join('');
    $('#moduleCount').textContent=`${detected.length} module${detected.length===1?'':'s'} detected from ${zipEntries.length} files.`;
    $('#moduleStep').hidden=false; $('#planStep').hidden=false; $('#expandPlan').innerHTML=''; $('#downloadPlan').hidden=true;
  }
  async function scan(){
    const comps=(selectedPack?.components||[]).filter(c=>(c.type||'datapack')==='datapack');
    selectedComponent=comps[Number($('#expandComponent').value||0)]||comps[0]||null;
    const url=componentUrl(selectedComponent); if(!url){status('The selected datapack does not have a direct public source URL.','error');return;}
    status(`Reading ${selectedComponent.file_name||selectedPack.name} directly from the DAI GitHub repository only long enough to inspect its file tree…`);
    try{
      const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error(`source ZIP HTTP ${r.status}`);
      zipEntries=readZipNames(await r.arrayBuffer()); detected=classify(zipEntries); renderDetected();
      status(`Scan complete: ${detected.length} recognizable DAI module types detected. Nothing was copied into your project.`,'ok');
    }catch(e){ status(`Could not scan this DAI repository snapshot: ${e.message}. Refresh the page to re-read the live GitHub data directory; the scanner does not use CurseForge file URLs.`,'error'); }
  }
  function selectedModules(){ const ids=[...document.querySelectorAll('.module-check:checked')].map(x=>x.value); return detected.filter(m=>ids.includes(m.id)); }
  function buildPlan(){
    const mods=selectedModules(); if(!mods.length){status('Select at least one detected module before building the guide.','error');return;}
    const name=selectedPack?.name||'Public DAI Pack';
    let html=`<div class="expand-status ok"><strong>${esc(name)}</strong> → ${mods.length} selected module${mods.length===1?'':'s'}. This plan recreates those systems in your own namespace instead of copying the entire source pack.</div>`;
    const lines=[`DAI Expand Guide — ${name}`,`Source component: ${selectedComponent?.file_name||''}`,'','Selected modules:'];
    mods.forEach((m,i)=>{
      const examples=m.files.slice(0,5);
      html+=`<div class="expand-plan-step"><div class="plan-n">${i+1}</div><div><h3>${esc(m.label)}</h3><p><strong>Study only this slice:</strong> inspect the matching source files, identify the minimum IDs/state/actions it depends on, then recreate the behavior under your own namespace using the module guide.</p><p>${examples.map(f=>`<span class="file-pill">${esc(f)}</span>`).join('')}</p><a href="${esc(m.guide)}">Open ${esc(m.label)} Module Guide →</a></div></div>`;
      lines.push(`- ${m.label}`,`  Guide: ${location.origin}${m.guide}`,`  Source examples:`,...examples.map(f=>`    - ${f}`));
    });
    html+=`<div class="expand-plan-step"><div class="plan-n">✓</div><div><h3>Integration pass</h3><p>After the selected modules work independently, connect them together one dependency at a time. Do not recreate unselected systems unless a real dependency proves they are required.</p><a href="/dai/creator/">Open DAI Creator →</a></div></div>`;
    lines.push('','Integration:','- Recreate each selected module under your own namespace.','- Test each module independently.','- Add only dependencies that are actually required.','- Review the source project license before copying any third-party code/assets.');
    $('#expandPlan').innerHTML=html; lastPlanText=lines.join('\n'); $('#downloadPlan').hidden=false; status('Focused guide generated. Work top-to-bottom and ignore the rest of the source pack unless a selected module actually depends on it.','ok');
  }
  function downloadPlan(){ if(!lastPlanText)return; const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([lastPlanText],{type:'text/plain'})); a.download=`DAI_Expand_Guide_${(selectedPack?.name||'plan').replace(/[^a-z0-9]+/gi,'_')}.txt`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  $('#expandPack')?.addEventListener('change',()=>{populateComponents();$('#moduleStep').hidden=true;$('#planStep').hidden=true;});
  $('#expandComponent')?.addEventListener('change',()=>{});
  $('#scanPack')?.addEventListener('click',scan);
  $('#selectAll')?.addEventListener('click',()=>document.querySelectorAll('.module-check').forEach(x=>x.checked=true));
  $('#clearAll')?.addEventListener('click',()=>document.querySelectorAll('.module-check').forEach(x=>x.checked=false));
  $('#buildPlan')?.addEventListener('click',buildPlan); $('#downloadPlan')?.addEventListener('click',downloadPlan);
  loadRegistry();
})();
