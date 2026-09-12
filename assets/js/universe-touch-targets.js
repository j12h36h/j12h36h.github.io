(() => {
  const body = document.body;
  const stage = document.querySelector('.system-stage');
  if (!body?.classList.contains('universe-main-page') || !stage) return;

  const nodes = [...stage.querySelectorAll('a.world-node[href]')];
  if (!nodes.length) return;

  function viewport() {
    const vv = window.visualViewport;
    return {
      width: Math.max(1, Math.round(vv?.width || window.innerWidth || 1)),
      height: Math.max(1, Math.round(vv?.height || window.innerHeight || 1))
    };
  }

  function isTouchMobile() {
    const { width, height } = viewport();
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const touch =
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window ||
      window.matchMedia?.('(pointer:coarse)').matches;

    return !!(touch && shortSide <= 900 && longSide <= 1600);
  }

  function sync() {
    body.classList.toggle('eras-universe-touch-nav', isTouchMobile());
  }

  function rectDistance(x, y, rect) {
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
    return Math.hypot(dx, dy);
  }

  function centerDistance(x, y, rect) {
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.top + rect.bottom) / 2;
    return Math.hypot(x - cx, y - cy);
  }

  function visibleRects(node) {
    return [...node.querySelectorAll(':scope > b,:scope > span,:scope > small')]
      .map(el => el.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0);
  }

  function nearestVisibleNode(x, y) {
    let best = null;

    nodes.forEach(node => {
      const rects = visibleRects(node);
      if (!rects.length) return;

      const visualDistance = Math.min(...rects.map(rect => rectDistance(x, y, rect)));
      const visualCenter = Math.min(...rects.map(rect => centerDistance(x, y, rect)));
      const score = visualDistance * 1000 + visualCenter;

      if (!best || score < best.score) {
        best = { node, visualDistance, score };
      }
    });

    return best;
  }

  /*
    Capture mobile taps before overlapping legacy anchor rectangles can choose
    the wrong destination. Navigation is based on the nearest VISIBLE marker,
    label, or subtitle instead of the invisible CSS box.
  */
  stage.addEventListener('click', event => {
    if (!body.classList.contains('eras-universe-touch-nav')) return;

    const candidate = nearestVisibleNode(event.clientX, event.clientY);
    const actual = event.target.closest?.('a.world-node');

    // Taps far away from any visible node must never activate an invisible box.
    if (!candidate || candidate.visualDistance > 18) {
      if (actual) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return;
    }

    if (actual === candidate.node) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(candidate.node.href);
  }, true);

  sync();
  window.addEventListener('resize', sync, { passive: true });
  window.addEventListener('orientationchange', sync, { passive: true });
  window.visualViewport?.addEventListener('resize', sync, { passive: true });
})();
