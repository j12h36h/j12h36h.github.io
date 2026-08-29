(() => {
  const path = location.pathname.replace(/\/+$/, '');
  if (path === '/lcs-mobile' || path.startsWith('/lcs-mobile/')) return;

  const params = new URLSearchParams(location.search);
  if (params.get('desktop') === '1') return;

  const ua = navigator.userAgent || '';
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (coarse && window.innerWidth <= 900);
  if (!mobile) return;

  const target = new URL('/lcs-mobile/', location.origin);
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
})();
