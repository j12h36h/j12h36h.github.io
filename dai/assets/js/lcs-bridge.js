(() => {
  const path = location.pathname.toLowerCase();
  const title = (document.querySelector('h1')?.textContent || document.title || 'DAI').trim().replace(/\s+/g,' ').slice(0,140);
  const touchMobile = matchMedia('(max-width: 820px)').matches && (navigator.maxTouchPoints || 0) > 0;
  const lcsBase = touchMobile ? '/lcs-mobile/' : '/logicalcommunicationservice/';
  const rules = [
    ['distribution','distribution'],['global-datapacks','distribution'],['packs/','experiences'],['experiences-worldgen','worlds'],['persistent-content-state','worlds'],
    ['menus','presentation'],['overlays','presentation'],['branding-loading','presentation'],['input-ui','presentation'],['recognition-perception','presentation'],
    ['actions','gameplay'],['conditions','gameplay'],['objectives-sequences-flow','gameplay'],['directional-combat','gameplay'],['gameplay-tester','gameplay'],
    ['custom-content','content'],['recipes','content'],['native-minecraft-bridge','content'],['native-runtime-exposure','content'],
    ['creator-workflow','creator'],['/creator/','creator'],['architecture','engine'],['runtime-dispatch','engine'],['/info/','engine']
  ];
  const context = (rules.find(([needle]) => path.includes(needle)) || [null,'ecosystem'])[1];
  const labelMap = {experiences:'Experiences',addons:'Addons',entities:'Entities',gameplay:'Gameplay',presentation:'Presentation',worlds:'Worlds',content:'Content',distribution:'Distribution',creator:'Creator',engine:'Engine',ecosystem:'DAI ecosystem'};
  const makeUrl = (mode='explore', explicit=context, explicitTopic=title) => `${lcsBase}?source=dai&context=${encodeURIComponent(explicit)}&mode=${encodeURIComponent(mode)}&topic=${encodeURIComponent(explicitTopic)}`;

  const dock = document.createElement('aside');
  dock.className = 'lcs-correlation-dock';
  dock.innerHTML = `<div class="lcs-correlation-head"><span>DAI ↔ LCS</span><b>${labelMap[context] || 'DAI ecosystem'}</b></div><p>Carry context into LCS as a suggestion. Nothing is auto-posted, auto-categorized, or forced into a relationship.</p><div class="lcs-correlation-actions"><a href="${makeUrl('explore')}">Explore</a><a href="${makeUrl('test')}">Test</a><a href="${makeUrl('create')}">Create</a><a href="${makeUrl('collaborate')}">Collaborate</a></div><button class="lcs-correlation-min" type="button" aria-label="Minimize LCS bridge">−</button>`;
  dock.querySelector('.lcs-correlation-min')?.addEventListener('click', () => dock.classList.toggle('minimized'));
  document.body.appendChild(dock);

  const matrixMap = {Experiences:'experiences',Addons:'addons',Entities:'entities',Gameplay:'gameplay',Presentation:'presentation',Worlds:'worlds',Content:'content',Distribution:'distribution'};
  document.querySelectorAll('.system-matrix > div').forEach(card => {
    const name = card.querySelector('strong')?.textContent?.trim(); const c = matrixMap[name]; if(!c || card.querySelector('.matrix-lcs-link')) return;
    const a = document.createElement('a'); a.className='matrix-lcs-link'; a.href=makeUrl(c==='gameplay'?'test':'explore',c,`DAI ${name}`); a.textContent='CORRELATE IN LCS →'; card.appendChild(a);
  });

  document.querySelectorAll('.guide-content h1, .panel-head strong').forEach(el => {
    if(el.closest('.lcs-context-inline')) return;
  });
})();
