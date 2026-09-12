(() => {
  const body = document.body;
  if (!body || body.dataset.erasCreatorMobileV6 === '1') return;

  const isDraw = body.classList.contains('draw-page');
  const isAnimation = body.classList.contains('sad-page');
  const isCode = body.classList.contains('code-page');
  if (!isDraw && !isAnimation && !isCode) return;

  body.dataset.erasCreatorMobileV6 = '1';

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

  const panels = new Set();
  const panelSlots = new Map();
  const buttons = [];
  let homeButton = null;
  let activePanel = null;
  let activeMobile = false;
  let lastLandscape = null;
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

    if (!panelSlots.has(el)) {
      panelSlots.set(el, {
        parent: el.parentNode,
        next: el.nextSibling,
        placeholder: null
      });
    }

    return el;
  }

  function mountPanelsToBody() {
    panels.forEach(panel => {
      if (panel.parentNode === document.body) return;

      const slot = panelSlots.get(panel);
      if (!slot) return;

      if (!slot.placeholder || !slot.placeholder.isConnected) {
        slot.placeholder = document.createComment('eras-mobile-panel-slot');
        panel.parentNode?.insertBefore(slot.placeholder, panel);
      }

      document.body.appendChild(panel);
    });
  }

  function restorePanels() {
    panels.forEach(panel => {
      const slot = panelSlots.get(panel);
      if (!slot) return;

      if (slot.placeholder?.parentNode) {
        slot.placeholder.parentNode.insertBefore(panel, slot.placeholder);
        slot.placeholder.remove();
        slot.placeholder = null;
      } else if (slot.parent?.isConnected) {
        if (slot.next?.parentNode === slot.parent) slot.parent.insertBefore(panel, slot.next);
        else slot.parent.appendChild(panel);
      }
    });
  }

  function markHome() {
    buttons.forEach(button => button.classList.remove('is-active'));
    homeButton?.classList.add('is-active');
  }

  function closePanels() {
    panels.forEach(panel => panel.classList.remove('eras-mobile-open'));
    activePanel = null;
    body.classList.remove('eras-mobile-panel-active');
    markHome();
  }

  function openPanel(config, button) {
    if (!activeMobile || config.closeOnly) {
      closePanels();
      return;
    }

    const panel = targetFor(config);
    if (!panel) return;

    mountPanelsToBody();

    const wasOpen =
      panel === activePanel &&
      panel.classList.contains('eras-mobile-open') &&
      button.classList.contains('is-active');

    panels.forEach(item => item.classList.remove('eras-mobile-open'));
    buttons.forEach(item => item.classList.remove('is-active'));

    if (wasOpen) {
      closePanels();
      return;
    }

    panel.classList.add('eras-mobile-open');
    button.classList.add('is-active');
    activePanel = panel;
    body.classList.add('eras-mobile-panel-active');

    if (config.scrollTo) {
      requestAnimationFrame(() => {
        const section = panel.querySelector(config.scrollTo);
        if (!section) return;
        panel.scrollTop = Math.max(0, section.offsetTop - 8);
      });
    }
  }

  configs.forEach((config, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<b aria-hidden="true">${config.symbol}</b><span>${config.label}</span>`;
    button.setAttribute('aria-label', config.label);
    button.addEventListener('click', () => openPanel(config, button));

    if (index === 0 || config.closeOnly) homeButton = button;
    buttons.push(button);
    dock.appendChild(button);
    targetFor(config);
  });

  document.body.appendChild(dock);

  // Tap outside an open panel to dismiss it, but NEVER intercept the tap.
  // The user's tap can still reach the canvas/editor beneath after dismissal.
  document.addEventListener('pointerdown', event => {
    if (!activeMobile || !activePanel) return;
    if (activePanel.contains(event.target) || dock.contains(event.target)) return;
    if (event.target.closest?.('.eras-action-wrap,.eras-utility-backdrop,dialog')) return;
    closePanels();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeMobile) closePanels();
  });

  function refitDraw() {
    if (!isDraw || !activeMobile) return;
    [50, 180, 420].forEach(delay => {
      window.setTimeout(() => document.querySelector('#fitCanvas')?.click(), delay);
    });
  }

  function sync() {
    const { width, height } = dims();
    document.documentElement.style.setProperty('--eras-editor-vw', `${width}px`);
    document.documentElement.style.setProperty('--eras-editor-vh', `${height}px`);

    const nextMobile = shouldMobile();
    const landscape = width > height;
    const modeChanged = nextMobile !== activeMobile || landscape !== lastLandscape;

    body.classList.toggle('eras-creator-mobile', nextMobile);
    body.classList.toggle('eras-creator-landscape', nextMobile && landscape);
    body.classList.toggle('eras-creator-portrait', nextMobile && !landscape);

    if (nextMobile) {
      mountPanelsToBody();
    } else {
      closePanels();
      restorePanels();
    }

    activeMobile = nextMobile;

    if (modeChanged) {
      closePanels();
      refitDraw();
    }

    lastLandscape = landscape;
  }

  function scheduleSync() {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(sync, 50);
  }

  sync();

  window.addEventListener('resize', scheduleSync, { passive: true });
  window.addEventListener('orientationchange', scheduleSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleSync, { passive: true });

  // Intentionally no visualViewport "scroll" listener:
  // Android browser chrome/keyboard movement must not close an active drawer.
})();
