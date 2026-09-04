// Single browser-facing DAI version source.
// Update this one value when the public engine version advances.
export const DAI_VERSION = '3.5';
export const DAI_VERSION_LABEL = `DAI ${DAI_VERSION}`;

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
const replacements = [
  [/DAI Engine 3\.3/g, `DAI Engine ${DAI_VERSION}`],
  [/DAI 3\.3/g, `DAI ${DAI_VERSION}`],
  [/\b3\.3 engine\b/gi, `${DAI_VERSION} engine`],
  [/\b3\.3 runtime\b/gi, `${DAI_VERSION} runtime`],
  [/\b3\.3 condition\b/gi, `${DAI_VERSION} condition`],
  [/\b3\.3 action\b/gi, `${DAI_VERSION} action`],
  [/\b3\.3 companion\b/gi, `${DAI_VERSION} companion`],
  [/\b3\.3 native\b/gi, `${DAI_VERSION} native`],
  [/\b3\.3 framework\b/gi, `${DAI_VERSION} framework`],
  [/\b3\.3 creator\b/gi, `${DAI_VERSION} creator`]
];

function replaceValue(value) {
  let out = String(value ?? '');
  for (const [pattern, replacement] of replacements) out = out.replace(pattern, replacement);
  return out;
}

function patchTextNode(node) {
  if (!node?.nodeValue || SKIP.has(node.parentElement?.tagName)) return;
  const next = replaceValue(node.nodeValue);
  if (next !== node.nodeValue) node.nodeValue = next;
}

function patchElement(el) {
  if (!(el instanceof Element) || SKIP.has(el.tagName)) return;
  for (const attr of ['title', 'aria-label', 'placeholder', 'content']) {
    if (!el.hasAttribute(attr)) continue;
    const before = el.getAttribute(attr);
    const after = replaceValue(before);
    if (after !== before) el.setAttribute(attr, after);
  }
}

function patchTree(root = document) {
  if (root.nodeType === Node.TEXT_NODE) { patchTextNode(root); return; }
  if (root instanceof Element) patchElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) patchTextNode(node);
    else patchElement(node);
  }
  document.title = replaceValue(document.title);
}

function start() {
  patchTree(document.documentElement);
  const observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) patchTree(node);
      if (record.type === 'characterData') patchTextNode(record.target);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.DAI_SITE_VERSION = DAI_VERSION;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
