const path = location.pathname.toLowerCase().replace(/\/index\.html$/i, '/');

const theme =
  /^\/options(?:\/|$)/.test(path) ? 'options' :
  /^\/content(?:\/|$)/.test(path) ? 'content' :
  /^\/dai(?:\/|$)/.test(path) ? 'dai' :
  /^\/(?:logicalcommunicationservice|lcs-mobile|lcs)(?:\/|$)/.test(path) ? 'lcs' :
  /^\/animation-engine(?:\/|$)/.test(path) ? 'animation' :
  /^\/(?:game|game-mobile)(?:\/|$)/.test(path) ? 'game' :
  'site';

document.documentElement.dataset.erasModuleTheme = theme;

const browserThemeColors = {
  site: '#02090b',
  game: '#07110b',
  options: '#120609',
  content: '#061109',
  dai: '#0b0714',
  lcs: '#100b17',
  animation: '#130f07'
};

const themeMeta = document.querySelector('meta[name="theme-color"]');
if (themeMeta) themeMeta.setAttribute('content', browserThemeColors[theme] || browserThemeColors.site);

function mountThemeCss() {
  if (document.querySelector('link[data-eras-module-theme-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/assets/css/eras-module-theme.css?v=20260907-t6';
  link.dataset.erasModuleThemeCss = '1';
  document.head.appendChild(link);
}

function mountGlow() {
  if (!document.body || document.getElementById('erasModuleGlow')) return;
  const glow = document.createElement('div');
  glow.id = 'erasModuleGlow';
  glow.setAttribute('aria-hidden', 'true');
  document.body.appendChild(glow);
}

mountThemeCss();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountGlow, { once: true });
} else {
  mountGlow();
}

window.dispatchEvent(new CustomEvent('eras:module-theme', { detail: { theme } }));
