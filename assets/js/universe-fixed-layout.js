(() => {
  const body = document.body;
  if (!body || !body.classList.contains('universe-main-page')) return;

  const mq = window.matchMedia(
    '(pointer: coarse) and (orientation: landscape) and (max-height: 650px)'
  );

  function clearVars() {
    [
      '--eras-visible-w',
      '--eras-visible-h',
      '--eras-landscape-stage',
      '--eras-landscape-stage-top',
      '--eras-landscape-core',
      '--eras-landscape-planet',
      '--eras-side-panel-w',
      '--eras-side-panel-h'
    ].forEach(name => body.style.removeProperty(name));
  }

  function sync() {
    if (!mq.matches) {
      clearVars();
      return;
    }

    const vv = window.visualViewport;
    const w = Math.max(480, Math.round(vv?.width || window.innerWidth || 800));
    const h = Math.max(240, Math.round(vv?.height || window.innerHeight || 360));

    /*
      The node UI keeps its existing size.
      We shrink the square field carrying the node anchors until it fits
      between the left/right dashboard gutters.
    */
    const sidePanelW = Math.round(Math.max(122, Math.min(164, w * 0.17)));
    const sidePanelH = Math.round(Math.max(90, Math.min(122, (h - 72) * 0.35)));

    const horizontalRoom = Math.max(230, w - (sidePanelW * 2) - 150);
    const verticalRoom = Math.max(220, h - 74);

    const stage = Math.round(Math.max(
      184,
      Math.min(
        250,
        verticalRoom * 0.76,
        horizontalRoom * 0.70
      )
    ));

    const headerClearance = Math.max(42, Math.round(h * 0.11));
    const stageTop = Math.round(Math.max(
      headerClearance + stage / 2 + 2,
      h * 0.53
    ));

    const core = Math.round(Math.min(stage * 0.56, 142));
    const planet = Math.round(Math.min(stage * 0.40, 101));

    body.style.setProperty('--eras-visible-w', `${w}px`);
    body.style.setProperty('--eras-visible-h', `${h}px`);
    body.style.setProperty('--eras-landscape-stage', `${stage}px`);
    body.style.setProperty('--eras-landscape-stage-top', `${stageTop}px`);
    body.style.setProperty('--eras-landscape-core', `${core}px`);
    body.style.setProperty('--eras-landscape-planet', `${planet}px`);
    body.style.setProperty('--eras-side-panel-w', `${sidePanelW}px`);
    body.style.setProperty('--eras-side-panel-h', `${sidePanelH}px`);
  }

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 32);
  };

  sync();

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

  if (mq.addEventListener) mq.addEventListener('change', schedule);
  else if (mq.addListener) mq.addListener(schedule);
})();
