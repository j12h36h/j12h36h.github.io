(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('desktop') === '1') return;
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const narrow = window.matchMedia?.('(max-width: 820px)')?.matches;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  if (!(uaMobile || (coarse && narrow))) return;
  const path = location.pathname;
  if (!path.startsWith('/game/')) return;
  const rest = path.slice('/game'.length);
  location.replace(`/game-mobile${rest || '/'}${location.search}${location.hash}`);
})();
