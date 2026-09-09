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

  // DAI 3.8 Creator parity layer.
  // The legacy Creator core remains intact; this bridge adds the 3.8-only
  // authoring surfaces and a source-derived live registry without duplicating
  // the 189 KB Creator runtime.
  const wireCreator38 = () => {
    if (path !== '/dai/creator/' && path !== '/dai/creator') return;
    if (document.body.dataset.daiCreator38 === '1') return;
    document.body.dataset.daiCreator38 = '1';

    const cleanNamespace = value => {
      const normalized = String(value || 'my_dai_pack').trim().toLowerCase()
        .replace(/[^a-z0-9_.-]+/g, '_').replace(/^[_\-.]+|[_\-.]+$/g, '');
      return normalized || 'my_dai_pack';
    };
    const cleanLocalId = value => {
      const normalized = String(value || 'definition').trim().toLowerCase()
        .replace(/\\/g, '/').replace(/[^a-z0-9._/-]+/g, '_')
        .replace(/^[/_.-]+|[/_.-]+$/g, '');
      return normalized || 'definition';
    };
    const currentNamespace = () => cleanNamespace(document.querySelector('#namespace')?.value);

    // Make the static 3.3 shell read correctly even before/without dai-version.js.
    document.title = document.title.replace(/3\.3/g, '3.8');
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = metaDescription.content.replace(/3\.3/g, '3.8');
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const staleTextNodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue?.includes('3.3')) staleTextNodes.push(walker.currentNode);
    }
    staleTextNodes.forEach(node => { node.nodeValue = node.nodeValue.replace(/3\.3/g, '3.8'); });

    const starterDefinitions = {
      state: {
        label: 'State & Capabilities',
        folder: 'dai_state',
        defaultId: 'stamina',
        guide: '/dai/guides/tutorials/create-anything/state-capabilities/',
        summary: 'Typed boolean/number/string state across client session, player, entity, dimension, world and server scopes.',
        json: () => ({
          type: 'number',
          scope: 'player',
          default_number: 100,
          persistent: true,
          sync: true,
          client_writable: false
        })
      },
      skill: {
        label: 'Server Skill',
        folder: 'dai_skills',
        defaultId: 'arc_shot',
        guide: '/dai/guides/tutorials/create-anything/skills/',
        summary: 'Server-authoritative cooldown/resource/job/rank/tag-gated abilities with projectile and function/command dispatch.',
        json: ns => ({
          display_name: 'Arc Shot',
          description: 'A stamina-gated projectile skill.',
          properties: {
            resource_state: `${ns}:stamina`,
            level_state: `${ns}:level`,
            rank_state: `${ns}:arc_shot_rank`,
            projectile: `${ns}:arc_bolt`,
            cooldown_group: `${ns}:ranged_skill`
          },
          numbers: {
            resource_cost: 20,
            required_level: 3,
            required_rank: 1,
            cooldown_ticks: 40,
            projectile_count: 1,
            projectile_speed: 1.6
          },
          events: { cast: `function:${ns}:skills/arc_shot` }
        })
      },
      agent: {
        label: 'Sapphire Learning Agent',
        folder: 'learning/agents',
        defaultId: 'sapphire',
        guide: '/dai/guides/tutorials/create-anything/learning-agents/',
        summary: 'Persistent learning definitions with observations, choices, rewards, imitation, dialogue, grounding and knowledge.',
        json: ns => ({
          name: 'Sapphire',
          enabled: true,
          autonomy_default: false,
          decision_interval: 10,
          learning_rate: 0.15,
          discount: 0.90,
          exploration: 0.10,
          success_reward: 0.25,
          failure_reward: -0.50,
          observations: [
            { id: 'hungry', condition: { type: 'player_hunger', operator: '<', number_value: 8 } }
          ],
          choices: [
            { id: 'eat', action: `${ns}:eat_food`, demonstrations: ['eat'] }
          ],
          rewards: [
            { id: 'fed', condition: { type: 'player_hunger', operator: '>=', number_value: 18 }, value: 1.0 }
          ],
          imitation: { enabled: true, weight: 0.5 },
          dialogue: { enabled: true, greeting: 'Hello.' },
          grounding: { enabled: true, weight: 1.0, confidence: 0.75 },
          knowledge: {
            enabled: true,
            learn_from_chat: true,
            inference_enabled: true,
            max_inference_depth: 6,
            import_folder: 'dai_learning/knowledge_inbox',
            allow_grounding_imports: true
          }
        })
      },
      cinematic: {
        label: 'ERAS Cinematic',
        folder: 'dai_cinematics',
        defaultId: 'intro',
        guide: '/dai/guides/tutorials/create-anything/cinematics/',
        summary: 'Retained 2D/3D Simple Animation Designer projects with camera, post, lighting, objects, sounds, clips and timing.',
        json: () => ({
          version: 1,
          title: 'Intro',
          mode: '2D',
          duration: 4.0,
          loop: false,
          canvas: { width: 960, height: 540, background: '#02090b' },
          assets: {},
          objects: [],
          sounds: [],
          clips: {},
          timing: {},
          post: {},
          lighting: {},
          camera: {}
        })
      }
    };

    const addUniversalTextFile = (zipPath, contents) => {
      const root = document.querySelector('#universalFileList');
      const addButton = document.querySelector('#addTextFile');
      if (!root || !addButton) throw new Error('Universal Files is unavailable in this Creator build.');

      const inputs = () => [...root.querySelectorAll('input[data-path]')];
      const existing = inputs().find(input => input.value === zipPath);
      if (existing) {
        const card = existing.closest('.universal-file-card');
        const textarea = card?.querySelector('textarea[data-content]');
        if (!textarea) throw new Error('The existing target is not an editable text file.');
        if (!window.confirm(`Replace existing ${zipPath}?`)) return false;
        textarea.value = contents;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }

      const before = new Set(inputs().map(input => input.value));
      addButton.click();
      let created = inputs().find(input => !before.has(input.value));
      if (!created) created = inputs().at(-1);
      if (!created) throw new Error('Creator did not create the Universal File placeholder.');

      created.value = zipPath;
      created.dispatchEvent(new Event('change', { bubbles: true }));

      const renamed = inputs().find(input => input.value === zipPath);
      const textarea = renamed?.closest('.universal-file-card')?.querySelector('textarea[data-content]');
      if (!renamed || !textarea) throw new Error(`Creator could not bind ${zipPath}.`);
      textarea.value = contents;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    };

    // Add a dedicated 3.8 navigation surface after the normal runtime/reference tools.
    const sidebar = document.querySelector('.sidebar .panel-body');
    const referenceButton = sidebar?.querySelector('.nav-btn[data-view="reference"]');
    if (sidebar && !sidebar.querySelector('[data-dai38-nav]')) {
      const sectionLabel = document.createElement('div');
      sectionLabel.className = 'section-label datapack-only';
      sectionLabel.dataset.dai38Nav = '1';
      sectionLabel.textContent = 'DAI 3.8 Systems';
      const navButton = document.createElement('button');
      navButton.className = 'nav-btn datapack-only';
      navButton.type = 'button';
      navButton.dataset.view = 'dai38';
      navButton.dataset.search = '3.8 state capabilities references skills sapphire learning agents cinematics eras registry minecraft bridge';
      navButton.dataset.dai38Nav = '1';
      navButton.textContent = '3.8 Systems & Definitions';
      if (referenceButton) referenceButton.after(sectionLabel, navButton);
      else sidebar.append(sectionLabel, navButton);
    }

    const main = document.querySelector('.creator-layout main');
    if (main && !document.querySelector('#view-dai38')) {
      const panel = document.createElement('section');
      panel.className = 'editor-section panel datapack-only';
      panel.id = 'view-dai38';
      panel.dataset.dai38CreatorPanel = '1';
      panel.innerHTML = `
        <div class="panel-head"><strong>DAI 3.8 Systems</strong><small>Source-aligned authoring for the systems added after the 3.3 Creator</small></div>
        <div class="panel-body">
          <div class="dashboard-hero">
            <div><span class="system-tag">DAI 3.8 / CREATOR PARITY</span><h2>Author the 3.8 runtime directly.</h2><p>The legacy visual editors remain available. This workspace adds the 3.8 state, reference, skill, learning-agent and ERAS cinematic surfaces without narrowing Universal Files.</p></div>
            <span class="version-chip">DAI 3.8</span>
          </div>
          <div class="release-console"><div><strong>3.8 source inventory</strong><span>266 registered actions · 273 registered conditions · 34 first-class DAI definition kinds · 43 direct Mojang bridge folders.</span></div><a class="btn small" href="/dai/guides/capabilities/" target="_blank" rel="noopener">Complete capability index ↗</a></div>

          <div class="dai38-system-grid" data-dai38-system-grid>
            <button class="dai38-system-card" type="button" data-dai38-load="state"><span>dai_state</span><strong>State & Capabilities</strong><small>Typed, scoped, persistent/synchronized state plus named capabilities.</small></button>
            <a class="dai38-system-card" href="/dai/guides/tutorials/create-anything/references/" target="_blank" rel="noopener"><span>reference store</span><strong>Reusable References</strong><small>Remember ENTITY, BLOCK and POSITION context for later actions/conditions.</small></a>
            <button class="dai38-system-card" type="button" data-dai38-load="skill"><span>dai_skills</span><strong>Server Skills</strong><small>Cooldown, progression, resources, tags, projectiles and cast dispatch.</small></button>
            <button class="dai38-system-card" type="button" data-dai38-load="agent"><span>learning/agents</span><strong>Sapphire Learning</strong><small>Observations, choices, rewards, imitation, dialogue, grounding and knowledge.</small></button>
            <button class="dai38-system-card" type="button" data-dai38-load="cinematic"><span>dai_cinematics</span><strong>ERAS Cinematics</strong><small>Retained 2D/3D Simple Animation Designer projects and playback actions.</small></button>
            <a class="dai38-system-card" href="/dai/guides/native-minecraft-bridge/" target="_blank" rel="noopener"><span>43 bridge folders</span><strong>Minecraft Bridge</strong><small>Native registry/Data Component discovery plus dai_registry and dai_data escape hatches.</small></a>
          </div>

          <h3 class="subsection-title">3.8 Definition Builder</h3>
          <div class="passthrough"><strong>Export-safe:</strong> Create Definition writes through the Creator's existing Universal Files state, so the generated JSON is included by the normal validator/exporter rather than stored only in this page.</div>
          <div class="form-grid dai38-builder-grid">
            <div class="field"><label for="dai38DefinitionType">Definition Type</label><select id="dai38DefinitionType"><option value="state">State & Capabilities</option><option value="skill">Server Skill</option><option value="agent">Sapphire Learning Agent</option><option value="cinematic">ERAS Cinematic</option></select></div>
            <div class="field"><label for="dai38DefinitionId">Definition ID / path</label><input id="dai38DefinitionId" value="stamina"/><span class="help">Lowercase resource path; subfolders are allowed.</span></div>
            <div class="field full"><label>Target ZIP path</label><code class="dai38-target-path" id="dai38TargetPath"></code></div>
            <div class="field full"><label for="dai38DefinitionJson">Definition JSON</label><textarea id="dai38DefinitionJson" spellcheck="false" style="min-height:360px"></textarea></div>
          </div>
          <div class="toolbar">
            <button class="btn primary" id="dai38CreateDefinition" type="button">Create Definition</button>
            <button class="btn" id="dai38ResetTemplate" type="button">Reset Starter</button>
            <button class="btn" id="dai38OpenUniversal" type="button">Open Universal Files</button>
            <a class="btn" id="dai38OpenGuide" href="/dai/guides/tutorials/create-anything/state-capabilities/" target="_blank" rel="noopener">Open Guide ↗</a>
          </div>
          <div class="passthrough" id="dai38DefinitionStatus" hidden></div>
          <div class="passthrough"><strong>Cinematic resource-pack route:</strong> DAI 3.8 also reads <code>assets/&lt;namespace&gt;/dai/cinematics/&lt;path&gt;.json</code> from resource packs. The builder above targets the datapack-native <code>dai_cinematics</code> route.</div>
        </div>`;
      const referenceView = document.querySelector('#view-reference');
      if (referenceView) referenceView.after(panel);
      else main.appendChild(panel);
    }

    // Keep the injected view usable even though creator.js registered its nav
    // listeners before this bridge-created button existed.
    const show38 = () => {
      document.querySelectorAll('.nav-btn').forEach(button => button.classList.toggle('active', button.dataset.view === 'dai38'));
      document.querySelectorAll('.editor-section').forEach(section => section.classList.toggle('active', section.id === 'view-dai38'));
      const heading = document.querySelector('#workspaceHeading');
      const description = document.querySelector('#workspaceDescription');
      if (heading) heading.textContent = 'DAI 3.8 Systems';
      if (description) description.textContent = 'Create 3.8 state, skills, Sapphire learning agents and ERAS cinematics, then use the live source registry and Universal Files for the complete runtime surface.';
    };
    document.querySelector('[data-dai38-nav].nav-btn')?.addEventListener('click', show38);

    // Add a dashboard entry point without modifying the large static index.
    const dashboardGrid = document.querySelector('#view-dashboard .start-grid.datapack-only');
    if (dashboardGrid && !dashboardGrid.querySelector('[data-dai38-dashboard-card]')) {
      const card = document.createElement('button');
      card.className = 'start-card';
      card.type = 'button';
      card.dataset.dai38DashboardCard = '1';
      card.innerHTML = '<strong>DAI 3.8 Systems</strong><span>State, references, skills, Sapphire learning agents, ERAS cinematics and the complete source registry.</span>';
      card.addEventListener('click', show38);
      dashboardGrid.prepend(card);
    }

    const typeSelect = document.querySelector('#dai38DefinitionType');
    const idInput = document.querySelector('#dai38DefinitionId');
    const jsonInput = document.querySelector('#dai38DefinitionJson');
    const targetPath = document.querySelector('#dai38TargetPath');
    const guideLink = document.querySelector('#dai38OpenGuide');
    const status = document.querySelector('#dai38DefinitionStatus');

    const selectedDefinition = () => starterDefinitions[typeSelect?.value] || starterDefinitions.state;
    const computePath = () => `data/${currentNamespace()}/${selectedDefinition().folder}/${cleanLocalId(idInput?.value)}.json`;
    const refreshTarget = () => {
      if (targetPath) targetPath.textContent = computePath();
      if (guideLink) guideLink.href = selectedDefinition().guide;
    };
    const resetTemplate = (resetId = false) => {
      const def = selectedDefinition();
      if (resetId && idInput) idInput.value = def.defaultId;
      if (jsonInput) jsonInput.value = JSON.stringify(def.json(currentNamespace()), null, 2);
      refreshTarget();
    };
    const setStatus = (message, error = false) => {
      if (!status) return;
      status.hidden = false;
      status.innerHTML = `<strong>${error ? 'Could not create definition' : 'Definition added'}</strong><span>${message}</span>`;
      status.classList.toggle('error', error);
    };

    typeSelect?.addEventListener('change', () => resetTemplate(true));
    idInput?.addEventListener('input', refreshTarget);
    document.querySelector('#namespace')?.addEventListener('input', () => {
      refreshTarget();
      // Namespace-dependent starter IDs are intentionally not rewritten while
      // the user is editing custom JSON; Reset Starter will regenerate them.
    });
    document.querySelector('#dai38ResetTemplate')?.addEventListener('click', () => resetTemplate(false));
    document.querySelector('#dai38OpenUniversal')?.addEventListener('click', () => document.querySelector('.nav-btn[data-view="files"]')?.click());
    document.querySelectorAll('[data-dai38-load]').forEach(button => button.addEventListener('click', () => {
      if (typeSelect) typeSelect.value = button.dataset.dai38Load;
      resetTemplate(true);
      document.querySelector('#dai38DefinitionJson')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    document.querySelector('#dai38CreateDefinition')?.addEventListener('click', () => {
      try {
        const parsed = JSON.parse(jsonInput?.value || '{}');
        if (selectedDefinition() === starterDefinitions.cinematic) {
          if (!['2D', '3D'].includes(parsed.mode)) throw new Error('Cinematic mode must be "2D" or "3D".');
          if (!(Number(parsed.duration) > 0)) throw new Error('Cinematic duration must be greater than zero.');
        }
        const target = computePath();
        if (addUniversalTextFile(target, JSON.stringify(parsed, null, 2) + '\n')) {
          setStatus(`${target} is now part of the active Creator project.`);
        }
      } catch (error) {
        setStatus(error?.message || String(error), true);
      }
    });
    resetTemplate(true);

    // Mirror the source-derived 3.8 capability inventory inside the existing
    // Creator reference page. This supplements the older parameter catalog and
    // always follows the generated 3.8 guide rather than hardcoding 539 IDs here.
    const referenceBody = document.querySelector('#view-reference .panel-body');
    if (referenceBody && !referenceBody.querySelector('[data-dai38-live-registry]')) {
      const registry = document.createElement('section');
      registry.dataset.dai38LiveRegistry = '1';
      registry.className = 'dai38-live-registry';
      registry.innerHTML = `
        <div class="reference-hero dai38-reference-hero"><div><span class="system-tag">DAI 3.8 / SOURCE REGISTRY</span><h2>Complete live action + condition inventory</h2><p>Loaded from the source-derived 3.8 capability page so Creator lookup includes the post-3.3 registry.</p></div><div class="reference-count" id="dai38RegistryCount">Loading…</div></div>
        <div class="reference-controls"><div class="field full"><label for="dai38RegistrySearch">Search the 3.8 registry</label><input id="dai38RegistrySearch" type="search" placeholder="Try: skill_cast, state, cinematic, reference, capability…"/></div></div>
        <div class="dai38-registry-results" id="dai38RegistryResults"><div class="empty">Loading source-derived DAI 3.8 capabilities…</div></div>
        <div class="toolbar"><a class="btn" href="/dai/guides/capabilities/" target="_blank" rel="noopener">Open Complete 3.8 Index ↗</a><a class="btn" href="/dai/guides/version-3-8/" target="_blank" rel="noopener">What Changed in 3.8 ↗</a></div>`;
      referenceBody.prepend(registry);

      const search = registry.querySelector('#dai38RegistrySearch');
      const resultRoot = registry.querySelector('#dai38RegistryResults');
      const count = registry.querySelector('#dai38RegistryCount');
      let registryItems = [];
      const renderRegistry = () => {
        const query = String(search?.value || '').trim().toLowerCase();
        const matches = registryItems.filter(item => !query || item.id.includes(query) || item.kind.includes(query));
        if (count) count.textContent = `${matches.length} of ${registryItems.length}`;
        if (!resultRoot) return;
        const visible = matches.slice(0, 160);
        resultRoot.innerHTML = visible.length
          ? visible.map(item => `<a class="dai38-cap-chip" href="/dai/guides/capabilities/" target="_blank" rel="noopener"><span>${item.kind}</span><code>${item.id}</code></a>`).join('')
          : '<div class="empty">No 3.8 registry IDs match that search.</div>';
        if (matches.length > visible.length) {
          resultRoot.insertAdjacentHTML('beforeend', `<div class="empty">Showing first ${visible.length} matches. Refine the search to narrow the registry.</div>`);
        }
      };
      search?.addEventListener('input', renderRegistry);
      fetch('/dai/guides/capabilities/')
        .then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then(html => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const collect = (selector, kind) => [...doc.querySelectorAll(selector)]
            .map(node => ({ id: node.textContent.trim().toLowerCase(), kind }))
            .filter(item => item.id);
          registryItems = [
            ...collect('[data-cap-section="actions"] .cap-id[data-cap]', 'action'),
            ...collect('[data-cap-section="conditions"] .cap-id[data-cap]', 'condition')
          ];
          const unique = new Map(registryItems.map(item => [`${item.kind}:${item.id}`, item]));
          registryItems = [...unique.values()];
          renderRegistry();
        })
        .catch(error => {
          if (count) count.textContent = 'Registry unavailable';
          if (resultRoot) resultRoot.innerHTML = `<div class="empty">Could not load the live registry (${String(error.message || error)}). Use the Complete 3.8 Index button below.</div>`;
        });
    }

    // Styling is local to the injected 3.8 surface so the existing Creator CSS
    // and all non-Creator DAI pages remain untouched.
    if (!document.querySelector('style[data-dai38-creator-style]')) {
      const style = document.createElement('style');
      style.dataset.dai38CreatorStyle = '1';
      style.textContent = `
        .dai38-system-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:18px 0 24px}
        .dai38-system-card{appearance:none;text-align:left;display:flex;flex-direction:column;gap:7px;min-height:132px;padding:16px;border:1px solid var(--line,#29434c);border-radius:12px;background:var(--panel-2,#0b171c);color:inherit;text-decoration:none;cursor:pointer;font:inherit}
        .dai38-system-card:hover,.dai38-system-card:focus-visible{border-color:var(--accent,#52c7b8);transform:translateY(-1px)}
        .dai38-system-card span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.68}.dai38-system-card strong{font-size:16px}.dai38-system-card small{line-height:1.45;opacity:.78}
        .dai38-target-path{display:block;padding:10px 12px;border:1px solid var(--line,#29434c);border-radius:8px;overflow-wrap:anywhere;background:rgba(0,0,0,.15)}
        #dai38DefinitionJson{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.45;tab-size:2}
        .dai38-live-registry{margin:0 0 22px;padding:0 0 22px;border-bottom:1px solid var(--line,#29434c)}
        .dai38-reference-hero{margin-bottom:14px}.dai38-registry-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px;max-height:480px;overflow:auto;margin:10px 0 14px;padding-right:4px}
        .dai38-cap-chip{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--line,#29434c);border-radius:8px;text-decoration:none;color:inherit;background:rgba(0,0,0,.12)}
        .dai38-cap-chip:hover{border-color:var(--accent,#52c7b8)}.dai38-cap-chip span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;opacity:.6}.dai38-cap-chip code{overflow-wrap:anywhere}
        #dai38DefinitionStatus{margin-top:12px}#dai38DefinitionStatus.error{border-color:#a84a4a}
        @media (max-width:720px){.dai38-system-grid,.dai38-registry-results{grid-template-columns:1fr}.dai38-registry-results{max-height:380px}}
      `;
      document.head.appendChild(style);
    }
  };
  wireCreator38();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireCreator38, { once: true });
})();
