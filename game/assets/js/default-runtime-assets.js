(() => {
  const DEFAULTS = Object.freeze({
    music:'/public-assets/audio/turn_based_theme.wav',
    damagedAudio:'/public-assets/audio/damaged_hit.wav',
    worldSkin:'medieval'
  });

  if (!document.body.classList.contains('global-page')) return;

  document.body.classList.add('eras-world-skin-medieval');

  const readOptions = () => {
    try {
      return { masterVolume:100, musicVolume:100, fxVolume:100, ...JSON.parse(localStorage.getItem('eras-universe-options-v1') || '{}') };
    } catch (_) {
      return { masterVolume:100, musicVolume:100, fxVolume:100 };
    }
  };

  const gain = (channel) => {
    const settings = readOptions();
    const master = Math.max(0,Math.min(100,Number(settings.masterVolume ?? 100))) / 100;
    const own = Math.max(0,Math.min(100,Number(settings[channel] ?? 100))) / 100;
    return master * own;
  };

  const music = new Audio(DEFAULTS.music);
  music.loop = true;
  music.preload = 'auto';
  music.volume = gain('musicVolume') * .32;

  const damagedAudio = new Audio(DEFAULTS.damagedAudio);
  damagedAudio.preload = 'auto';
  damagedAudio.volume = gain('fxVolume') * .55;

  let musicStarted = false;
  const startMusic = async () => {
    if (musicStarted) return;
    music.volume = gain('musicVolume') * .32;
    try {
      await music.play();
      musicStarted = true;
      detachUnlock();
    } catch (_) {}
  };

  const unlockEvents = ['pointerdown','keydown','touchstart'];
  const detachUnlock = () => unlockEvents.forEach(name => window.removeEventListener(name,startMusic,true));
  unlockEvents.forEach(name => window.addEventListener(name,startMusic,{capture:true,passive:true}));
  startMusic();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) music.pause();
    else if (musicStarted) music.play().catch(()=>{});
  });

  let lastDamageAt = 0;
  const triggerDamaged = () => {
    const now = performance.now();
    if (now - lastDamageAt < 180) return;
    lastDamageAt = now;

    const board = document.querySelector('#globalMap,.global-map');
    if (board) {
      const effect = document.createElement('i');
      effect.className = 'eras-runtime-damaged-effect';
      board.appendChild(effect);
      setTimeout(() => effect.remove(), 520);
    }

    try {
      damagedAudio.currentTime = 0;
      damagedAudio.volume = gain('fxVolume') * .55;
      damagedAudio.play().catch(()=>{});
    } catch (_) {}
  };

  const health = document.querySelector('#playerHealth');
  let lastHp = health ? Number.parseFloat(health.textContent) : NaN;
  if (health) {
    new MutationObserver(() => {
      const next = Number.parseFloat(health.textContent);
      if (Number.isFinite(next) && Number.isFinite(lastHp) && next < lastHp) triggerDamaged();
      if (Number.isFinite(next)) lastHp = next;
    }).observe(health,{childList:true,subtree:true,characterData:true});
  }

  const message = document.querySelector('#globalMessage');
  if (message) {
    new MutationObserver(() => {
      const text = String(message.textContent || '').toUpperCase();
      if (/\b(PVP HIT|HIT RECEIVED|DAMAGE|KO)\b/.test(text)) triggerDamaged();
    }).observe(message,{childList:true,subtree:true,characterData:true});
  }

  window.ERASDefaultRuntimeAssets = Object.freeze({
    musicAssetId:'eras:audio_turn_based_theme',
    damagedEffectAssetId:'eras:effect_damaged',
    damagedAudioAssetId:'eras:audio_damaged_hit',
    worldAssetId:'eras:world_turn_based_medieval',
    triggerDamaged
  });
})();