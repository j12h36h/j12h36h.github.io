(() => {
  const entry = document.querySelector('[data-dai-archive-entry]');
  const notice = document.getElementById('daiEndNotice');
  if (!entry || !notice) return;

  const dialog = notice.querySelector('.dai-end-notice__dialog');
  const closeButtons = [...notice.querySelectorAll('[data-dai-notice-close]')];
  const continueLink = notice.querySelector('[data-dai-notice-continue]');
  let lastFocused = null;

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function openNotice(event) {
    if (event) event.preventDefault();
    lastFocused = document.activeElement;
    notice.hidden = false;
    document.body.classList.add('dai-end-notice-open');
    requestAnimationFrame(() => dialog?.focus());
  }

  function closeNotice() {
    notice.hidden = true;
    document.body.classList.remove('dai-end-notice-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || notice.hidden) return;
    const focusables = [...notice.querySelectorAll(focusableSelector)].filter(el => {
      return !el.hasAttribute('hidden') && el.getClientRects().length > 0;
    });
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  entry.addEventListener('click', openNotice);
  closeButtons.forEach(button => button.addEventListener('click', closeNotice));
  continueLink?.addEventListener('click', () => {
    document.body.classList.remove('dai-end-notice-open');
  });

  document.addEventListener('keydown', event => {
    if (notice.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeNotice();
      return;
    }
    trapFocus(event);
  });
})();
