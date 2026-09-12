(() => {
  if (document.querySelector('.eras-share-fab')) return;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'eras-share-fab';
  button.setAttribute('aria-label', 'Share E.R.A.S.');
  button.setAttribute('title', 'Share E.R.A.S.');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15V3"></path>
      <path d="M8.5 6.5 12 3l3.5 3.5"></path>
      <path d="M7 9H5.8A1.8 1.8 0 0 0 4 10.8v7.4A1.8 1.8 0 0 0 5.8 20h12.4a1.8 1.8 0 0 0 1.8-1.8v-7.4A1.8 1.8 0 0 0 18.2 9H17"></path>
    </svg>`;

  const toast = document.createElement('div');
  toast.className = 'eras-share-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  document.body.append(button, toast);

  let toastTimer = 0;
  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 1800);
  };

  const fallbackShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('LINK COPIED');
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  };

  button.addEventListener('click', async () => {
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

    await fallbackShare();
  });
})();
