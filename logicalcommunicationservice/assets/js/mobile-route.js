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

  /* LCS-only social skin. Loaded after the shared stylesheet so it layers on top
     of the universal E.R.A.S. styling without affecting non-LCS pages. */
  const loadBubbleSkin = () => {
    if (document.querySelector('link[data-lcs-bubble-skin]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/logicalcommunicationservice/assets/css/lcs-bubbles.css?v=20260831-bubbles1';
    link.dataset.lcsBubbleSkin = '1';
    document.head.appendChild(link);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBubbleSkin, { once: true });
  } else {
    loadBubbleSkin();
  }
})();
