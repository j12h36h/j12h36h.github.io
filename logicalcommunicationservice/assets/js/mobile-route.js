(() => {
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/lcs-mobile' || path.startsWith('/lcs-mobile/')) return;

  const params = new URLSearchParams(location.search);
  const ua = navigator.userAgent || '';
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && window.innerWidth <= 900);

  if (mobile && params.get('desktop') !== '1') {
    const target = new URL('/lcs-mobile/', location.origin);
    target.search = location.search;
    target.hash = location.hash;
    location.replace(target.href);
    return;
  }

  /* LCS social bubble skin + Lilac Lily module identity.
     Theme loader is mounted after the bubble skin so its palette overrides
     win without changing LCS application logic. */
  const loadLcsSkin = () => {
    if (!document.querySelector('link[data-lcs-bubble-skin]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/logicalcommunicationservice/assets/css/lcs-bubbles.css?v=20260831-bubbles1';
      link.dataset.lcsBubbleSkin = '1';
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[data-eras-module-theme-loader]')) {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/assets/js/eras-module-theme.js?v=20260907-t4';
      script.dataset.erasModuleThemeLoader = '1';
      document.head.appendChild(script);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadLcsSkin, { once: true });
  } else {
    loadLcsSkin();
  }
})();
