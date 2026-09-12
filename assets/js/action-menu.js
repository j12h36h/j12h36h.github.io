(() => {
  if (document.querySelector('.eras-action-wrap')) return;

  let deferredInstallPrompt = null;
  let toastTimer = 0;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const wrap = document.createElement('div');
  wrap.className = 'eras-action-wrap';

  const menu = document.createElement('div');
  menu.className = 'eras-action-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-hidden', 'true');

  const share = document.createElement('button');
  share.type = 'button';
  share.className = 'eras-action-item';
  share.setAttribute('role', 'menuitem');
  share.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15V3"></path>
      <path d="M8.5 6.5 12 3l3.5 3.5"></path>
      <path d="M7 9H5.8A1.8 1.8 0 0 0 4 10.8v7.4A1.8 1.8 0 0 0 5.8 20h12.4a1.8 1.8 0 0 0 1.8-1.8v-7.4A1.8 1.8 0 0 0 18.2 9H17"></path>
    </svg>
    <span>Share</span>`;

  const install = document.createElement('button');
  install.type = 'button';
  install.className = 'eras-action-item';
  install.setAttribute('role', 'menuitem');
  install.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11"></path>
      <path d="m8 10 4 4 4-4"></path>
      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"></path>
    </svg>
    <span>Install</span>`;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'eras-action-toggle';
  toggle.setAttribute('aria-label', 'Open E.R.A.S. actions');
  toggle.setAttribute('aria-haspopup', 'menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="12" r="1.3"></circle>
      <circle cx="12" cy="12" r="1.3"></circle>
      <circle cx="18" cy="12" r="1.3"></circle>
    </svg>`;

  const toast = document.createElement('div');
  toast.className = 'eras-action-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const installHelp = document.createElement('div');
  installHelp.className = 'eras-install-help';
  installHelp.setAttribute('role', 'dialog');
  installHelp.setAttribute('aria-live', 'polite');
  installHelp.innerHTML = `
    <b>INSTALL E.R.A.S.</b>
    <p></p>
    <button type="button">CLOSE</button>`;

  menu.append(share, install);
  wrap.append(menu, toggle);
  document.body.append(wrap, toast, installHelp);

  const helpText = installHelp.querySelector('p');
  const helpClose = installHelp.querySelector('button');

  const setOpen = (open) => {
    wrap.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close E.R.A.S. actions' : 'Open E.R.A.S. actions');
  };

  const showToast = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 1800);
  };

  const showInstallHelp = (message) => {
    helpText.textContent = message;
    installHelp.classList.add('is-visible');
  };

  const updateInstallState = () => {
    if (isStandalone()) {
      install.disabled = true;
      install.querySelector('span').textContent = 'Installed';
    } else {
      install.disabled = false;
      install.querySelector('span').textContent = 'Install';
    }
  };

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setOpen(!wrap.classList.contains('is-open'));
  });

  share.addEventListener('click', async () => {
    setOpen(false);

    const shareData = {
      title: document.title || 'Project E.R.A.S.',
      text: 'Project E.R.A.S.',
      url: window.location.href
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('LINK COPIED');
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  });

  install.addEventListener('click', async () => {
    setOpen(false);

    if (isStandalone()) {
      showToast('E.R.A.S. IS ALREADY INSTALLED');
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch {}
      deferredInstallPrompt = null;
      updateInstallState();
      return;
    }

    if (isIOS()) {
      showInstallHelp('In Safari, tap Share → Add to Home Screen → make sure Open as Web App is enabled → Add.');
      return;
    }

    showInstallHelp('Open your browser menu and choose Install app or Add to Home Screen. If that option is not available yet, reload E.R.A.S. and try again.');
  });

  helpClose.addEventListener('click', () => installHelp.classList.remove('is-visible'));

  document.addEventListener('click', (event) => {
    if (!wrap.contains(event.target)) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      installHelp.classList.remove('is-visible');
    }
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallState();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallState();
    showToast('E.R.A.S. INSTALLED');
  });

  updateInstallState();
})();
