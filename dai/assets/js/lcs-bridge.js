(() => {
  // DAI participates in the same site-wide accessibility runtime as the rest
  // of E.R.A.S., even though DAI does not load the shared account module.
  import('/assets/js/accessibility.js?v=20260906-a11y1')
    .catch(error => console.debug('Optional E.R.A.S. accessibility runtime unavailable', error));

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
  addModule('/dai/assets/js/dai-version.js?v=20260909-v38', 'version');
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

  // Level 0 documentation recovery path. Every page using the shared DAI bridge
  // gains a consistent "Start From Zero" entry without duplicating sidebar edits
  // across dozens of static guide files. Tutorial leaves also get a prerequisite
  // notice when they otherwise assume datapack/JSON/file literacy.
  const wireFoundationNavigation = () => {
    if (!path.startsWith('/dai/guides/')) return;
    const foundationHref = '/dai/guides/tutorials/start-here/';
    document.querySelectorAll('.guide-sidebar').forEach(sidebar => {
      const heading = sidebar.querySelector(':scope > strong');
      const addGuideLink = (href, text, key, title) => {
        if (sidebar.querySelector(`a[href="${href}"], [data-dai-guide-link="${key}"]`)) return null;
        const link = document.createElement('a');
        link.href = href;
        link.textContent = text;
        link.dataset.daiGuideLink = key;
        if (title) link.title = title;
        return link;
      };
      const foundation = addGuideLink(foundationHref, 'Start From Zero', 'foundations', 'No coding, JSON, datapack or packaging knowledge required');
      const howto = addGuideLink('/dai/guides/how-to/', 'How-To Guide Index', 'howto', 'Build a DAI capability from scratch');
      const capabilities = addGuideLink('/dai/guides/capabilities/', 'Complete 3.8 Capabilities', 'capabilities', 'Source-derived DAI 3.8 runtime inventory');
      const links = [foundation, howto, capabilities].filter(Boolean);
      if (!links.length) return;
      if (heading) {
        let anchor = heading;
        links.forEach(link => { anchor.after(link); anchor = link; });
      } else {
        links.reverse().forEach(link => sidebar.prepend(link));
      }
    });

    const isFoundation = path.startsWith('/dai/guides/tutorials/start-here/');
    const tutorialLeaf = path.startsWith('/dai/guides/tutorials/') &&
      path !== '/dai/guides/tutorials/' && path !== '/dai/guides/tutorials' && !isFoundation;
    const firstMenu = path.includes('/dai/guides/modules/first-menu');
    if ((tutorialLeaf || firstMenu) && !document.querySelector('[data-dai-zero-banner]')) {
      const hero = document.querySelector('.guide-content .guide-hero');
      if (hero) {
        const notice = document.createElement('div');
        notice.className = 'guide-callout';
        notice.dataset.daiZeroBanner = '1';
        notice.innerHTML = '<strong>New to coding or datapacks?</strong> If <code>pack.mcmeta</code>, namespaces, JSON, <code>.mcfunction</code>, load/tick tags or ZIP roots are unfamiliar, complete <a href="' + foundationHref + '">Start From Zero</a> first. This guide can then focus only on the feature you came to build.';
        hero.after(notice);
      }
    }
  };
  wireFoundationNavigation();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireFoundationNavigation, { once: true });
  }

  // DAI 3.8 home-page capability refresh without duplicating the large universe page.
  // The static page keeps the existing world/project constellation; this shared layer
  // upgrades the engine summary and exposes the new source-derived documentation.
  const wire38Home = () => {
    if (path !== '/dai/' && path !== '/dai') return;
    const heroCopy = document.querySelector('.universe-hero-copy p');
    if (heroCopy && !heroCopy.dataset.dai38Summary) {
      heroCopy.dataset.dai38Summary = '1';
      heroCopy.textContent = 'DAI 3.8 turns datapacks, resource packs and JSON into a reusable Minecraft game-development layer for complete experiences, addons, native/custom content, typed state and capabilities, reusable references, server-authoritative skills, Sapphire learning agents, ERAS cinematics, actions, conditions, reactions, automation, UI, world generation, physics, vehicles, projectiles, portals, fluids and open Mojang data bridges.';
    }
    const actions = document.querySelector('.universe-hero-copy .hero-actions');
    if (actions && !actions.querySelector('a[href="/dai/guides/capabilities/"]')) {
      const link = document.createElement('a');
      link.className = 'button';
      link.href = '/dai/guides/capabilities/';
      link.textContent = 'DAI 3.8 Capabilities';
      actions.appendChild(link);
    }
    const releaseGrid = document.querySelector('.universe-release-grid, .release-grid');
    if (releaseGrid && !releaseGrid.querySelector('[data-dai38-release]')) {
      const card = document.createElement('div');
      card.className = 'release-item';
      card.dataset.dai38Release = '1';
      card.innerHTML = '<span class="system-tag">DAI 3.8</span><strong>State, skills, learning and cinematics are first-class runtime systems</strong><p>Typed state/capabilities, reusable references, server skill casting, Sapphire learning agents and retained 2D/3D ERAS cinematic projects now sit beside the existing content, world and automation runtimes.</p>';
      releaseGrid.prepend(card);
    }
  };
  wire38Home();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire38Home, { once: true });

  const title = (document.querySelector('h1')?.textContent || document.title || 'DAI').trim().replace(/\s+/g,' ').slice(0,140);
  const touchMobile = matchMedia('(max-width: 820px)').matches && (navigator.maxTouchPoints || 0) > 0;
  const lcsBase = touchMobile ? '/lcs-mobile/' : '/logicalcommunicationservice/';
  const rules = [
    ['distribution','distribution'],['global-datapacks','distribution'],['packs/','experiences'],['experiences-worldgen','worlds'],['persistent-content-state','worlds'],
    ['menus','presentation'],['overlays','presentation'],['branding-loading','presentation'],['input-ui','presentation'],['recognition-perception','presentation'],
    ['actions','gameplay'],['conditions','gameplay'],['objectives-sequences-flow','gameplay'],['directional-combat','gameplay'],['gameplay-tester','gameplay'],
    ['learning-agents','gameplay'],['state-capabilities','gameplay'],['skills','gameplay'],['cinematics','presentation'],['capabilities','engine'],['custom-content','content'],['recipes','content'],['native-minecraft-bridge','content'],['native-runtime-exposure','content'],
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
