// Single browser-facing DAI version source.
// Update this one value when the public engine version advances.
export const DAI_VERSION = '4.0';
export const DAI_VERSION_LABEL = `DAI ${DAI_VERSION}`;

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
const HISTORICAL_PATHS = [
  '/dai/guides/version-3-8',
  '/dai/guides/runtime-dispatch-2-2',
  '/dai/guides/runtime-dispatch-3-0',
  '/dai/guides/runtime-dispatch-3-3',
  '/dai/guides/input-ui-3-3'
];
function isHistoricalPage(){
  const p = location.pathname.replace(/\/+$/, '');
  return HISTORICAL_PATHS.some(x => p === x || p.startsWith(x + '/'));
}

const replacements = [
  [/DAI Engine 3\.(?:3|5|8|9)/g, `DAI Engine ${DAI_VERSION}`],
  [/DAI 3\.(?:3|5|8|9)/g, `DAI ${DAI_VERSION}`],
  [/DAI \/\/ 3\.(?:3|5|8|9)/g, `DAI // ${DAI_VERSION}`],
  [/\b3\.(?:3|5|8|9) engine\b/gi, `${DAI_VERSION} engine`],
  [/\b3\.(?:3|5|8|9) runtime\b/gi, `${DAI_VERSION} runtime`],
  [/\b3\.(?:3|5|8|9) condition\b/gi, `${DAI_VERSION} condition`],
  [/\b3\.(?:3|5|8|9) action\b/gi, `${DAI_VERSION} action`],
  [/\b3\.(?:3|5|8|9) companion\b/gi, `${DAI_VERSION} companion`],
  [/\b3\.(?:3|5|8|9) native\b/gi, `${DAI_VERSION} native`],
  [/\b3\.(?:3|5|8|9) framework\b/gi, `${DAI_VERSION} framework`],
  [/\b3\.(?:3|5|8|9) creator\b/gi, `${DAI_VERSION} creator`]
];

function replaceValue(value){
  let out = String(value ?? '');
  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  return out;
}

function patchTextNode(node){
  if (!node?.nodeValue || SKIP.has(node.parentElement?.tagName)) return;
  const next = replaceValue(node.nodeValue);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function patchElement(el){
  if (!(el instanceof Element) || SKIP.has(el.tagName)) return;
  for (const attr of ['title','aria-label','placeholder','content']){
    if (!el.hasAttribute(attr)) continue;
    const before = el.getAttribute(attr);
    const after = replaceValue(before);
    if (after !== before) el.setAttribute(attr, after);
  }
}

function patchTree(root=document){
  if (root.nodeType === Node.TEXT_NODE){
    patchTextNode(root);
    return;
  }
  if (root instanceof Element) patchElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())){
    if (node.nodeType === Node.TEXT_NODE) patchTextNode(node);
    else patchElement(node);
  }
  document.title = replaceValue(document.title);
}

/* 2026-09-09: restore missing official DAI universe nodes.
   Kept here in the shared DAI bootstrap so the existing /dai/index.html
   constellation does not need to be duplicated or rewritten. */
const OFFICIAL_UNIVERSE_NODES = [
  {
    key: 'musashi',
    label: 'MUSASHI STORY',
    subtitle: 'SAMURAI RPG',
    href: 'https://www.curseforge.com/minecraft/modpacks/official-musashistory'
  },
  {
    key: 'patch-release',
    label: 'PATCH & RELEASE',
    subtitle: 'STORY EXPERIENCE',
    href: 'https://www.curseforge.com/minecraft/modpacks/official-p-r'
  },
  {
    key: 'minecomic',
    label: 'MINECOMIC',
    subtitle: 'COMIC WORLD',
    href: 'https://www.curseforge.com/minecraft/modpacks/official-minecomic'
  }
];

function installUniverseNodes(){
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/dai') return;

  const stage = document.querySelector('.universe-stage');
  if (!stage) return;

  if (!document.querySelector('#dai-official-node-layout')){
    const style = document.createElement('style');
    style.id = 'dai-official-node-layout';
    style.textContent = `
      .node-musashi{left:8%;bottom:9%}
      .node-patch-release{right:8%;bottom:9%;text-align:right}
      .node-patch-release b{margin-left:auto}
      .node-minecomic{left:50%;bottom:2%;transform:translateX(-50%);text-align:center}
      .node-minecomic b{margin-left:auto;margin-right:auto}
      .node-minecomic:hover{transform:translateX(-50%) scale(1.06)}
      @media(max-width:820px){
        .node-musashi{left:2%;bottom:10%}
        .node-patch-release{right:2%;bottom:10%}
        .node-minecomic{bottom:1%}
      }
    `;
    document.head.appendChild(style);
  }

  const core = stage.querySelector('.universe-core');

  for (const spec of OFFICIAL_UNIVERSE_NODES){
    if (stage.querySelector(`.node-${spec.key}`)) continue;

    const node = document.createElement('a');
    node.className = `world-node node-${spec.key}`;
    node.href = spec.href;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.setAttribute('aria-label', `${spec.label} — ${spec.subtitle}`);
    node.innerHTML = `<b></b><span>${spec.label}</span><small>${spec.subtitle}</small>`;

    if (core) stage.insertBefore(node, core);
    else stage.appendChild(node);
  }
}

function start(){
  if (!isHistoricalPage()) patchTree(document.documentElement);
  installUniverseNodes();

  const observer = new MutationObserver(records => {
    for (const record of records){
      for (const node of record.addedNodes) patchTree(node);
      if (record.type === 'characterData') patchTextNode(record.target);
    }
  });
  observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true});
  window.DAI_SITE_VERSION = DAI_VERSION;
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', start, {once:true});
} else {
  start();
}
