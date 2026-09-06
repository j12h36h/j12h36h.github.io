/* Project E.R.A.S. shared accessibility runtime — 2026-09-06 */
(() => {
  if (window.__ERAS_ACCESSIBILITY_RUNTIME__) return;
  window.__ERAS_ACCESSIBILITY_RUNTIME__ = true;

  const A11Y_CSS = '/assets/css/accessibility-core.css?v=20260906-a11y1';
  const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', 'summary',
    '[role="button"]:not([aria-disabled="true"])', '[role="tab"]:not([aria-disabled="true"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const ensureStyles = () => {
    if (document.querySelector('link[data-eras-a11y-core]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = A11Y_CSS;
    link.dataset.erasA11yCore = '1';
    document.head.appendChild(link);
  };

  const setMotionPreference = () => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.dataset.reduceMotion = reduced ? 'reduce' : 'no-preference';
  };

  const accessibleNameFallback = root => {
    root.querySelectorAll('input, textarea, select').forEach(control => {
      if (control.hasAttribute('aria-label') || control.hasAttribute('aria-labelledby')) return;
      if (control.closest('label')) return;
      if (control.id) {
        const labels = [...document.querySelectorAll('label[for]')];
        if (labels.some(label => label.htmlFor === control.id)) return;
      }
      const fallback = control.getAttribute('placeholder') || control.getAttribute('title');
      if (fallback) control.setAttribute('aria-label', fallback);
    });
  };

  const enhanceStatusRegions = root => {
    const selectors = [
      '.runtime-feedback', '#accountMessage', '#accountToastRegion', '#jsonStatus',
      '[data-social-feedback]', '[data-creator-feedback]', '[data-json-status]'
    ];
    root.querySelectorAll(selectors.join(',')).forEach(node => {
      if (!node.hasAttribute('aria-live')) node.setAttribute('aria-live', 'polite');
      if (!node.hasAttribute('role')) node.setAttribute('role', 'status');
    });
  };

  const syncToggleStates = root => {
    const groups = [
      ['button[data-view]', node => node.classList.contains('active')],
      ['button[data-tab]', node => node.classList.contains('is-active')],
      ['button[data-momentum-mode]', node => node.classList.contains('active')],
      ['button.thought-chip', node => node.classList.contains('selected')],
      ['button[data-graphics]', node => node.classList.contains('is-selected')]
    ];
    groups.forEach(([selector, selected]) => root.querySelectorAll(selector).forEach(node => {
      node.setAttribute('aria-pressed', String(Boolean(selected(node))));
    }));
  };

  const ensureSkipLink = () => {
    const main = document.querySelector('main');
    if (!main || document.querySelector('.eras-a11y-skip')) return;
    if (!main.id) main.id = 'eras-main-content';
    const skip = document.createElement('a');
    skip.className = 'eras-a11y-skip';
    skip.href = `#${main.id}`;
    skip.textContent = 'Skip to main content';
    skip.addEventListener('click', () => {
      if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
      queueMicrotask(() => main.focus({ preventScroll: true }));
    });
    document.body.insertBefore(skip, document.body.firstChild);
  };

  let activeDialog = null;
  let returnFocus = null;
  const visible = node => Boolean(node && !node.hidden && !node.closest('[hidden]') && node.getClientRects().length);
  const dialogFocusables = dialog => [...dialog.querySelectorAll(FOCUSABLE)].filter(visible);

  const updateDialogFocus = () => {
    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter(visible);
    const next = dialogs.at(-1) || null;
    if (next === activeDialog) return;

    if (!next && activeDialog) {
      const target = returnFocus;
      activeDialog = null;
      returnFocus = null;
      if (target?.isConnected && typeof target.focus === 'function') queueMicrotask(() => target.focus());
      return;
    }

    if (next) {
      returnFocus = activeDialog ? returnFocus : document.activeElement;
      activeDialog = next;
      if (!next.hasAttribute('tabindex')) next.setAttribute('tabindex', '-1');
      queueMicrotask(() => {
        if (!activeDialog || activeDialog !== next || next.contains(document.activeElement)) return;
        (dialogFocusables(next)[0] || next).focus();
      });
    }
  };

  const trapDialogTab = event => {
    if (event.key !== 'Tab' || !activeDialog || !visible(activeDialog)) return;
    const items = dialogFocusables(activeDialog);
    if (!items.length) {
      event.preventDefault();
      activeDialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const enhance = root => {
    accessibleNameFallback(root);
    enhanceStatusRegions(root);
    syncToggleStates(root);
    updateDialogFocus();
  };

  const init = () => {
    ensureStyles();
    document.documentElement.dataset.erasA11y = 'true';
    setMotionPreference();
    ensureSkipLink();
    enhance(document);

    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    motion.addEventListener?.('change', setMotionPreference);

    document.addEventListener('keydown', trapDialogTab, true);
    document.addEventListener('focusin', updateDialogFocus, true);
    document.addEventListener('click', () => queueMicrotask(() => { syncToggleStates(document); updateDialogFocus(); }), true);

    const observer = new MutationObserver(records => {
      let shouldEnhance = false;
      for (const record of records) {
        if (record.type === 'childList' && record.addedNodes.length) shouldEnhance = true;
        if (record.type === 'attributes') shouldEnhance = true;
      }
      if (!shouldEnhance) return;
      ensureSkipLink();
      enhance(document);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden']
    });
  };

  ensureStyles();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
