(() => {
  const body = document.body;
  if (!body || body.dataset.erasCreatorMobileV5 === '1') return;

  const isDraw = body.classList.contains('draw-page');
  const isAnimation = body.classList.contains('sad-page');
  const isCode = body.classList.contains('code-page');
  if (!isDraw && !isAnimation && !isCode) return;

  body.dataset.erasCreatorMobileV5 = '1';

  const configs = isDraw ? [
    { label: 'Canvas', symbol: '▣', closeOnly: true },
    { label: 'Tools', symbol: '✎', target: '.draw-tools-panel', side: 'left' },
    { label: 'Layers', symbol: '▤', target: '.draw-properties-panel', side: 'right', scrollTo: '.draw-layers' },
    { label: 'Frames', symbol: '▥', target: '.draw-properties-panel', side: 'right', scrollTo: '.draw-frames' },
    { label: 'Actions', symbol: '⌘', target: '.draw-toolbar', side: 'bottom' }
  ] : isAnimation ? [
    { label: 'View', symbol: '▣', closeOnly: true },
    { label: 'Actions', symbol: '⌘', target: '.sad-toolbar', side: 'bottom' },
    { label: 'Source', symbol: '{}', target: '.sad-editor-panel', side: 'left' },
    { label: 'Info', symbol: '≡', target: '.sad-reference-panel', side: 'right' }
  ] : [
    { label: 'Editor', symbol: '▣', closeOnly: true },
    { label: 'Files', symbol: '≡', target: '.code-explorer', side: 'left' },
    { label: 'Actions', symbol: '⌘', target: '.code-toolbar', side: 'bottom' },
    { label: 'Inspect', symbol: '{}', target: '.code-inspector', side: 'right' },
    { label: 'Output', symbol: '›_', target: '.code-bottom-panel', side: 'bottom' }
  ];

  const dock = document.createElement('nav');
  dock.className = 'eras-mobile-creator-dock eras-mobile-creator-dock-crisp';
  dock.setAttribute('aria-label', 'Mobile editor controls');

  const backdrop = document.createElement('div');
  backdrop.className = 'eras-mobile-workspace-backdrop eras-mobile-workspace-backdrop-crisp';
  backdrop.setAttribute('aria-hidden', 'true');

  const panels = new Set();
  const buttons = [];
  let homeButton = null;
  let activeMobile = false;
  let resizeTimer = 0;

  function dims() {
    const vv = window.visualViewport;
    return {
      width: Math.max(1, Math.round(vv?.width || window.innerWidth || 1)),
      height: Math.max(1, Math.round(vv?.height || window.innerHeight || 1))
    };
  }

  function shouldMobile() {
    const { width, height } = dims();
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const touch =
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window ||
      window.matchMedia?.('(pointer:coarse)').matches;
    return !!(touch && shortSide <= 900 && longSide <= 1600);
  }

  function targetFor(config) {
    if (!config.target) return null;
    const el = document.querySelector(config.target);
    if (!el) return null;
    el.classList.add('eras-mobile-panel', 'eras-mobile-panel-crisp');
    el.dataset.erasSide = config.side || 'bottom';
    panels.add(el);
    return el;
  }

  function markHome() {
    buttons.forEach(b => b.classList.remove('is-active'));
    homeButton?.classList.add('is-active');
  }

  function closePanels() {
    panels.forEach(p => p.classList.remove('eras-mobile-open'));
    body.classList.remove('eras-mobile-panel-active');
    backdrop.setAttribute('aria-hidden', 'true');
    markHome();
  }

  function openPanel(config, button) {
    if (!activeMobile || config.closeOnly) {
      closePanels();
      return;
    }

    const panel = targetFor(config);
    if (!panel) return;

    const wasOpen =
      panel.classList.contains('eras-mobile-open') &&
      button.classList.contains('is-active');

    panels.forEach(p => p.classList.remove('eras-mobile-open'));
    buttons.forEach(b => b.classList.remove('is-active'));

    if (wasOpen) {
      closePanels();
      return;
    }

    panel.classList.add('eras-mobile-open');
    button.classList.add('is-active');
    body.classList.add('eras-mobile-panel-active');
    backdrop.setAttribute('aria-hidden', 'false');

    if (config.scrollTo) {
      requestAnimationFrame(() => {
        const section = panel.querySelector(config.scrollTo);
        if (!section) return;
        panel.scrollTop = Math.max(0, section.offsetTop - 8);
      });
    }
  }

  configs.forEach((config, index) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<b aria-hidden="true">${config.symbol}</b><span>${config.label}</span>`;
    b.setAttribute('aria-label', config.label);
    b.addEventListener('click', () => openPanel(config, b));
    if (index === 0 || config.closeOnly) homeButton = b;
    buttons.push(b);
    dock.appendChild(b);
    targetFor(config);
  });

  backdrop.addEventListener('click', closePanels);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeMobile) closePanels();
  });

  document.body.append(backdrop, dock);

  function refitDraw() {
    if (!isDraw || !activeMobile) return;
    [50, 180, 420].forEach(ms => setTimeout(() => {
      document.querySelector('#fitCanvas')?.click();
    }, ms));
  }

  function sync() {
    const { width, height } = dims();
    document.documentElement.style.setProperty('--eras-editor-vw', `${width}px`);
    document.documentElement.style.setProperty('--eras-editor-vh', `${height}px`);

    const next = shouldMobile();
    const landscape = width > height;

    body.classList.toggle('eras-creator-mobile', next);
    body.classList.toggle('eras-creator-landscape', next && landscape);
    body.classList.toggle('eras-creator-portrait', next && !landscape);

    activeMobile = next;
    closePanels();
    if (next) refitDraw();
  }

  function scheduleSync() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sync, 50);
  }

  sync();
  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleSync, { passive: true });
})();
