(() => {
  // DAI-wide shared services. Creator, Guides, Packs, Info and every page that
  // loads the bridge inherit these without each surface maintaining its own copy.
  const addModule = (src, key) => {
    if (document.querySelector(`script[data-dai-shared="${key}"]`)) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    script.dataset.daiShared = key;
    document.head.appendChild(script);
  };
  addModule('/dai/assets/js/dai-version.js?v=20260904-v35', 'version');
  addModule('/assets/js/site-presence.js?v=20260904-p1', 'presence');

  // DAI shell navigation rule:
  // the top-left DAI brand always returns to the E.R.A.S. network root.
  // The normal "Home" navigation item remains /dai/.
  const wireErasHome = () => {
    document.querySelectorAll('.site-header a.brand').forEach(brand => {
      brand.href = '/';
      brand.setAttribute('aria-label', 'Return to E.R.A.S. main page');
      brand.setAttribute('title', 'Return to E.R.A.S.');
      brand.dataset.erasHome = '1';
    });
  };
  wireErasHome();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireErasHome, { once: true });
  }

  // Capture the brand click as a safety net in case another DAI surface
  // dynamically rebuilds its header after the bridge runs.
  document.addEventListener('click', event => {
    const brand = event.target instanceof Element
      ? event.target.closest('.site-header a.brand')
      : null;
    if (!brand) return;
    event.preventDefault();
    location.href = '/';
  }, true);

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
