(() => {
  const body = document.body;
  if (!body || body.dataset.erasMobileWorkspaceReady === '1') return;

  const isAnimation = body.classList.contains('sad-page');
  const isDraw = body.classList.contains('draw-page');
  const isCode = body.classList.contains('code-page');
  if (!isAnimation && !isDraw && !isCode) return;

  body.dataset.erasMobileWorkspaceReady = '1';

  const mobileQuery = window.matchMedia(
    '(pointer: coarse) and (max-width: 900px), ' +
    '(pointer: coarse) and (orientation: landscape) and (max-height: 650px)'
  );

  const configs = isAnimation ? [
    { label: 'View',    symbol: '▣', closeOnly: true },
    { label: 'Actions', symbol: '⌘', target: '.sad-toolbar', side: 'bottom' },
    { label: 'Source',  symbol: '{}', target: '.sad-editor-panel', side: 'left' },
    { label: 'Info',    symbol: '≡', target: '.sad-reference-panel', side: 'right' }
  ] : isDraw ? [
    { label: 'Canvas',  symbol: '▣', closeOnly: true },
    { label: 'Tools',   symbol: '✎', target: '.draw-tools-panel', side: 'left' },
    { label: 'Layers',  symbol: '▤', target: '.draw-properties-panel', side: 'right', scrollTo: '.draw-layers' },
    { label: 'Frames',  symbol: '▥', target: '.draw-properties-panel', side: 'right', scrollTo: '.draw-frames' },
    { label: 'Actions', symbol: '⌘', target: '.draw-toolbar', side: 'bottom' }
  ] : [
    { label: 'Editor',  symbol: '▣', closeOnly: true },
    { label: 'Files',   symbol: '≡', target: '.code-explorer', side: 'left' },
    { label: 'Actions', symbol: '⌘', target: '.code-toolbar', side: 'bottom' },
    { label: 'Inspect', symbol: '{}', target: '.code-inspector', side: 'right' },
    { label: 'Output',  symbol: '›_', target: '.code-bottom-panel', side: 'bottom' }
  ];

  const dock = document.createElement('nav');
  dock.className = 'eras-mobile-creator-dock';
  dock.setAttribute('aria-label', 'Mobile workspace controls');

  const backdrop = document.createElement('div');
  backdrop.className = 'eras-mobile-workspace-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  const panels = new Set();
  const buttons = [];

  function resolveTarget(config) {
    if (!config.target) return null;
    const target = document.querySelector(config.target);
    if (!target) return null;
    target.classList.add('eras-mobile-panel');
    target.dataset.erasSide = config.side || 'bottom';
    panels.add(target);
    return target;
  }

  function closeAll() {
    panels.forEach(panel => panel.classList.remove('eras-mobile-open'));
    buttons.forEach(btn => btn.classList.remove('is-active'));
    body.classList.remove('eras-mobile-panel-active');
    backdrop.setAttribute('aria-hidden', 'true');
  }

  function openConfig(config, button) {
    if (!mobileQuery.matches || config.closeOnly) {
      closeAll();
      return;
    }

    const target = resolveTarget(config);
    if (!target) return;

    const alreadyOpen = target.classList.contains('eras-mobile-open') &&
      button.classList.contains('is-active');

    closeAll();
    if (alreadyOpen) return;

    target.classList.add('eras-mobile-open');
    button.classList.add('is-active');
    body.classList.add('eras-mobile-panel-active');
    backdrop.setAttribute('aria-hidden', 'false');

    if (config.scrollTo) {
      requestAnimationFrame(() => {
        const section = target.querySelector(config.scrollTo);
        if (section) {
          const y = Math.max(0, section.offsetTop - 6);
          try { target.scrollTo({ top: y, behavior: 'smooth' }); }
          catch { target.scrollTop = y; }
        }
      });
    }
  }

  configs.forEach(config => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<b aria-hidden="true">${config.symbol}</b><span>${config.label}</span>`;
    button.setAttribute('aria-label', config.label);
    button.addEventListener('click', () => openConfig(config, button));
    buttons.push(button);
    dock.appendChild(button);
    resolveTarget(config);
  });

  backdrop.addEventListener('click', closeAll);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAll();
  });

  document.body.append(backdrop, dock);

  function syncVisualViewport() {
    const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
    if (height > 0) {
      document.documentElement.style.setProperty('--eras-mobile-workspace-height', `${height}px`);
    }
  }

  function refitDrawCanvas() {
    if (!isDraw || !mobileQuery.matches) return;
    window.setTimeout(() => {
      const fit = document.querySelector('#fitCanvas');
      if (fit) fit.click();
    }, 180);
  }

  let resizeTimer = 0;
  function handleViewportChange() {
    syncVisualViewport();
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      closeAll();
      refitDrawCanvas();
    }, 130);
  }

  syncVisualViewport();
  refitDrawCanvas();

  window.addEventListener('orientationchange', handleViewportChange, { passive: true });
  window.addEventListener('resize', handleViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', syncVisualViewport, { passive: true });

  if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener('change', () => {
      syncVisualViewport();
      closeAll();
      refitDrawCanvas();
    });
  } else if (mobileQuery.addListener) {
    mobileQuery.addListener(() => {
      syncVisualViewport();
      closeAll();
      refitDrawCanvas();
    });
  }
})();
