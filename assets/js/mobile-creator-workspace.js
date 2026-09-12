(() => {
  const body = document.body;
  if (!body || body.dataset.erasCreatorWorkspaceV3 === '1') return;

  const isDraw = body.classList.contains('draw-page');
  const isAnimation = body.classList.contains('sad-page');
  if (!isDraw && !isAnimation) return;

  body.dataset.erasCreatorWorkspaceV3 = '1';

  const configs = isDraw ? [
    { label: 'Canvas',  symbol: '▣', closeOnly: true },
    { label: 'Tools',   symbol: '✎', target: '.draw-tools-panel', side: 'left' },
    { label: 'Layers',  symbol: '▤', target: '.draw-properties-panel', side: 'right', scrollTo: '.draw-layers' },
    { label: 'Frames',  symbol: '▥', target: '.draw-properties-panel', side: 'right', scrollTo: '.draw-frames' },
    { label: 'Actions', symbol: '⌘', target: '.draw-toolbar', side: 'bottom' }
  ] : [
    { label: 'View',    symbol: '▣', closeOnly: true },
    { label: 'Actions', symbol: '⌘', target: '.sad-toolbar', side: 'bottom' },
    { label: 'Source',  symbol: '{}', target: '.sad-editor-panel', side: 'left' },
    { label: 'Info',    symbol: '≡', target: '.sad-reference-panel', side: 'right' }
  ];

  const dock = document.createElement('nav');
  dock.className = 'eras-mobile-creator-dock eras-mobile-creator-dock-v3';
  dock.setAttribute('aria-label', isDraw ? 'DRAW mobile controls' : 'Animation mobile controls');

  const backdrop = document.createElement('div');
  backdrop.className = 'eras-mobile-workspace-backdrop eras-mobile-workspace-backdrop-v3';
  backdrop.setAttribute('aria-hidden', 'true');

  const panels = new Set();
  const buttons = [];
  let baseButton = null;
  let mobileActive = false;
  let resizeTimer = 0;

  function viewport() {
    const vv = window.visualViewport;
    return {
      width: Math.max(1, Math.round(vv?.width || window.innerWidth || 1)),
      height: Math.max(1, Math.round(vv?.height || window.innerHeight || 1))
    };
  }

  function shouldUseMobileWorkspace() {
    const { width, height } = viewport();
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const touch =
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window ||
      window.matchMedia?.('(pointer: coarse)').matches;

    // Explicit touch + viewport test. This does not depend on one fragile CSS
    // media query, and excludes normal desktop monitors/touch displays.
    return Boolean(touch && shortSide <= 900 && longSide <= 1600);
  }

  function resolveTarget(config) {
    if (!config.target) return null;
    const target = document.querySelector(config.target);
    if (!target) return null;

    target.classList.add('eras-mobile-panel-v3');
    target.dataset.erasSide = config.side || 'bottom';
    panels.add(target);
    return target;
  }

  function markBaseActive() {
    buttons.forEach(button => button.classList.remove('is-active'));
    baseButton?.classList.add('is-active');
  }

  function closeAll() {
    panels.forEach(panel => panel.classList.remove('eras-mobile-open'));
    body.classList.remove('eras-mobile-panel-active');
    backdrop.setAttribute('aria-hidden', 'true');
    markBaseActive();
  }

  function openConfig(config, button) {
    if (!mobileActive || config.closeOnly) {
      closeAll();
      return;
    }

    const target = resolveTarget(config);
    if (!target) return;

    const alreadyOpen =
      target.classList.contains('eras-mobile-open') &&
      button.classList.contains('is-active');

    panels.forEach(panel => panel.classList.remove('eras-mobile-open'));
    buttons.forEach(btn => btn.classList.remove('is-active'));

    if (alreadyOpen) {
      markBaseActive();
      body.classList.remove('eras-mobile-panel-active');
      backdrop.setAttribute('aria-hidden', 'true');
      return;
    }

    target.classList.add('eras-mobile-open');
    button.classList.add('is-active');
    body.classList.add('eras-mobile-panel-active');
    backdrop.setAttribute('aria-hidden', 'false');

    if (config.scrollTo) {
      requestAnimationFrame(() => {
        const section = target.querySelector(config.scrollTo);
        if (!section) return;
        const y = Math.max(0, section.offsetTop - 8);
        try { target.scrollTo({ top: y, behavior: 'smooth' }); }
        catch { target.scrollTop = y; }
      });
    }
  }

  configs.forEach((config, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<b aria-hidden="true">${config.symbol}</b><span>${config.label}</span>`;
    button.setAttribute('aria-label', config.label);
    button.addEventListener('click', () => openConfig(config, button));

    if (config.closeOnly || index === 0) baseButton = button;
    buttons.push(button);
    dock.appendChild(button);
    resolveTarget(config);
  });

  backdrop.addEventListener('click', closeAll);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileActive) closeAll();
  });

  document.body.append(backdrop, dock);

  function refitDrawCanvas() {
    if (!isDraw || !mobileActive) return;
    [40, 180, 420].forEach(delay => {
      window.setTimeout(() => document.querySelector('#fitCanvas')?.click(), delay);
    });
  }

  function syncMode() {
    const { width, height } = viewport();
    document.documentElement.style.setProperty('--eras-creator-vw', `${width}px`);
    document.documentElement.style.setProperty('--eras-creator-vh', `${height}px`);

    const nextMobile = shouldUseMobileWorkspace();
    const landscape = width > height;

    body.classList.toggle('eras-creator-mobile', nextMobile);
    body.classList.toggle('eras-creator-landscape', nextMobile && landscape);
    body.classList.toggle('eras-creator-portrait', nextMobile && !landscape);

    if (nextMobile !== mobileActive) {
      mobileActive = nextMobile;
      closeAll();
      if (mobileActive) refitDrawCanvas();
    } else if (mobileActive) {
      closeAll();
      refitDrawCanvas();
    }
  }

  function scheduleSync() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(syncMode, 60);
  }

  syncMode();
  markBaseActive();

  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });
})();
