(() => {
  const body = document.body;
  if (!body || !body.classList.contains('universe-main-page')) return;

  const landscapePhone = window.matchMedia(
    '(pointer: coarse) and (orientation: landscape) and (max-height: 650px)'
  );

  const sync = () => {
    if (!landscapePhone.matches) {
      body.style.removeProperty('--eras-home-visible-height');
      body.style.removeProperty('--eras-home-stage-size');
      body.style.removeProperty('--eras-home-stage-top');
      body.style.removeProperty('--eras-home-core-size');
      body.style.removeProperty('--eras-home-planet-size');
      return;
    }

    const vv = window.visualViewport;
    const visibleHeight = Math.max(220, Math.round(vv?.height || window.innerHeight || 360));
    const visibleWidth = Math.max(420, Math.round(vv?.width || window.innerWidth || 720));

    // Size from the actually visible area, not CSS dvh. This keeps the orbit
    // clear of Android Chrome's URL bar while still using the wide screen.
    const stage = Math.round(Math.min(
      visibleHeight * 0.92,
      visibleWidth * 0.46,
      340
    ));

    const top = Math.round(Math.max(
      88,
      Math.min(visibleHeight * 0.58, visibleHeight - stage * 0.40)
    ));

    const core = Math.round(Math.min(stage * 0.55, 178));
    const planet = Math.round(Math.min(stage * 0.39, 125));

    body.style.setProperty('--eras-home-visible-height', `${visibleHeight}px`);
    body.style.setProperty('--eras-home-stage-size', `${stage}px`);
    body.style.setProperty('--eras-home-stage-top', `${top}px`);
    body.style.setProperty('--eras-home-core-size', `${core}px`);
    body.style.setProperty('--eras-home-planet-size', `${planet}px`);
  };

  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 40);
  };

  sync();
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });

  if (landscapePhone.addEventListener) {
    landscapePhone.addEventListener('change', schedule);
  } else if (landscapePhone.addListener) {
    landscapePhone.addListener(schedule);
  }
})();
