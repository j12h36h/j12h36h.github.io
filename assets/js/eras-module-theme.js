const path = location.pathname.toLowerCase().replace(/\/index\.html$/i, '/');

const theme =
  /^\/options(?:\/|$)/.test(path) ? 'options' :
  /^\/dai(?:\/|$)/.test(path) ? 'dai' :
  /^\/(?:logicalcommunicationservice|lcs-mobile|lcs)(?:\/|$)/.test(path) ? 'lcs' :
  /^\/(?:game|game-mobile)(?:\/|$)/.test(path) ? 'game' :
  'site';

document.documentElement.dataset.erasModuleTheme = theme;

function mountTheme() {
  if (!document.querySelector('link[data-eras-module-theme-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/assets/css/eras-module-theme.css?v=20260905-t1';
    link.dataset.erasModuleThemeCss = '1';
    document.head.appendChild(link);
  }

  if (!document.getElementById('erasModuleGlow') && document.body) {
    const glow = document.createElement('div');
    glow.id = 'erasModuleGlow';
    glow.setAttribute('aria-hidden', 'true');
    document.body.appendChild(glow);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountTheme, { once: true });
} else {
  mountTheme();
}

window.dispatchEvent(new CustomEvent('eras:module-theme', { detail: { theme } }));
