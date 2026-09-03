const ERAS_ICON_FONTS = Object.freeze([
  'Arial','Verdana','Georgia','Courier New','Trebuchet MS','Times New Roman',
  'system-ui','monospace','sans-serif','serif'
]);
const ERAS_ICON_WEIGHTS = Object.freeze([400,700,900]);
const ERAS_ICON_ALIGNS = Object.freeze(['start','middle','end']);
const MAX_LAYERS = 96;
const MAX_FRAMES = 64;
const MAX_FRAME_CHANGES = 128;
const MAX_TOTAL_ANIMATION_MS = 120000;

function escapeXml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

function normalizeHex(value, label='color') {
  const text = String(value || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(text)) {
    throw new Error(`${label} must be a six-digit hex color.`);
  }
  return text.toLowerCase();
}

function numberIn(raw, key, min, max, fallback, label='layer') {
  const value = raw?.[key] ?? fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} ${key} must be between ${min} and ${max}.`);
  }
  return value;
}

function visibleText(value, label='char') {
  const text = String(value ?? '').normalize('NFC');
  if (!text || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text)) {
    throw new Error(`${label} must contain visible Unicode text.`);
  }
  const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter
    ? [...new Intl.Segmenter(undefined, { granularity:'grapheme' }).segment(text)].map(x => x.segment)
    : Array.from(text);
  if (graphemes.length < 1 || graphemes.length > 4 || graphemes.every(g => /^\s+$/u.test(g))) {
    throw new Error(`${label} must contain 1–4 visible Unicode characters.`);
  }
  return text;
}

function normalizeLayer(raw, index=0) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`Layer ${index + 1} must be an object.`);
  }
  const fontFamily = String(raw.fontFamily ?? 'Arial');
  const fontWeight = Number(raw.fontWeight ?? 700);
  const align = String(raw.align ?? 'middle');
  if (!ERAS_ICON_FONTS.includes(fontFamily)) throw new Error(`Layer ${index + 1} fontFamily is not allowed.`);
  if (!ERAS_ICON_WEIGHTS.includes(fontWeight)) throw new Error(`Layer ${index + 1} fontWeight must be 400, 700, or 900.`);
  if (!ERAS_ICON_ALIGNS.includes(align)) throw new Error(`Layer ${index + 1} align must be start, middle, or end.`);
  return {
    id: raw.id == null ? '' : String(raw.id).slice(0, 64),
    char: visibleText(raw.char, `Layer ${index + 1} char`),
    x: numberIn(raw, 'x', -64, 192, 64, `Layer ${index + 1}`),
    y: numberIn(raw, 'y', -64, 192, 64, `Layer ${index + 1}`),
    fontSize: numberIn(raw, 'fontSize', 4, 192, 42, `Layer ${index + 1}`),
    color: normalizeHex(raw.color ?? '#ffffff', `Layer ${index + 1} color`),
    fontFamily,
    fontWeight,
    rotation: numberIn(raw, 'rotation', -360, 360, 0, `Layer ${index + 1}`),
    scaleX: numberIn(raw, 'scaleX', -4, 4, 1, `Layer ${index + 1}`),
    scaleY: numberIn(raw, 'scaleY', -4, 4, 1, `Layer ${index + 1}`),
    skewX: numberIn(raw, 'skewX', -75, 75, 0, `Layer ${index + 1}`),
    skewY: numberIn(raw, 'skewY', -75, 75, 0, `Layer ${index + 1}`),
    opacity: numberIn(raw, 'opacity', 0, 1, 1, `Layer ${index + 1}`),
    align,
    hidden: raw.hidden === true || raw.visible === false
  };
}

function normalizeTarget(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < MAX_LAYERS) return value;
  const text = String(value ?? '').trim();
  if (text) return text.slice(0, 64);
  throw new Error('Animation change requires layer or id.');
}

function normalizeChange(raw, index) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Animation change ${index + 1} must be an object.`);
  const target = raw.layer ?? raw.id;
  const out = { target: normalizeTarget(target) };
  if ('char' in raw) out.char = visibleText(raw.char, `Animation change ${index + 1} char`);
  if ('x' in raw) out.x = numberIn(raw,'x',-64,192,64,`Animation change ${index + 1}`);
  if ('y' in raw) out.y = numberIn(raw,'y',-64,192,64,`Animation change ${index + 1}`);
  if ('fontSize' in raw) out.fontSize = numberIn(raw,'fontSize',4,192,42,`Animation change ${index + 1}`);
  if ('color' in raw) out.color = normalizeHex(raw.color, `Animation change ${index + 1} color`);
  if ('fontFamily' in raw) {
    const v = String(raw.fontFamily);
    if (!ERAS_ICON_FONTS.includes(v)) throw new Error(`Animation change ${index + 1} fontFamily is not allowed.`);
    out.fontFamily = v;
  }
  if ('fontWeight' in raw) {
    const v = Number(raw.fontWeight);
    if (!ERAS_ICON_WEIGHTS.includes(v)) throw new Error(`Animation change ${index + 1} fontWeight is invalid.`);
    out.fontWeight = v;
  }
  if ('rotation' in raw) out.rotation = numberIn(raw,'rotation',-360,360,0,`Animation change ${index + 1}`);
  if ('scaleX' in raw) out.scaleX = numberIn(raw,'scaleX',-4,4,1,`Animation change ${index + 1}`);
  if ('scaleY' in raw) out.scaleY = numberIn(raw,'scaleY',-4,4,1,`Animation change ${index + 1}`);
  if ('skewX' in raw) out.skewX = numberIn(raw,'skewX',-75,75,0,`Animation change ${index + 1}`);
  if ('skewY' in raw) out.skewY = numberIn(raw,'skewY',-75,75,0,`Animation change ${index + 1}`);
  if ('opacity' in raw) out.opacity = numberIn(raw,'opacity',0,1,1,`Animation change ${index + 1}`);
  if ('align' in raw) {
    const v = String(raw.align);
    if (!ERAS_ICON_ALIGNS.includes(v)) throw new Error(`Animation change ${index + 1} align is invalid.`);
    out.align = v;
  }
  if ('hidden' in raw || 'visible' in raw || 'remove' in raw) {
    out.hidden = raw.remove === true || raw.hidden === true || raw.visible === false;
  }
  return out;
}

function normalizeAnimation(raw) {
  if (raw == null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('animation must be an object.');
  if (!Array.isArray(raw.frames) || raw.frames.length < 1 || raw.frames.length > MAX_FRAMES) {
    throw new Error(`animation.frames must contain between 1 and ${MAX_FRAMES} frames.`);
  }
  let total = 0;
  const frames = raw.frames.map((frame, frameIndex) => {
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new Error(`Animation frame ${frameIndex + 1} must be an object.`);
    const durationMs = Math.floor(Number(frame.durationMs ?? frame.duration ?? 100));
    if (!Number.isFinite(durationMs) || durationMs < 40 || durationMs > 10000) {
      throw new Error(`Animation frame ${frameIndex + 1} durationMs must be between 40 and 10000.`);
    }
    total += durationMs;
    if (total > MAX_TOTAL_ANIMATION_MS) throw new Error('Animation total duration is too long.');
    const changes = frame.changes == null ? [] : frame.changes;
    if (!Array.isArray(changes) || changes.length > MAX_FRAME_CHANGES) {
      throw new Error(`Animation frame ${frameIndex + 1} has too many changes.`);
    }
    const removeLayers = frame.removeLayers == null ? [] : frame.removeLayers;
    if (!Array.isArray(removeLayers) || removeLayers.length > MAX_LAYERS) throw new Error(`Animation frame ${frameIndex + 1} removeLayers is invalid.`);
    const order = frame.order == null ? null : frame.order;
    if (order != null && (!Array.isArray(order) || order.length > MAX_LAYERS)) throw new Error(`Animation frame ${frameIndex + 1} order is invalid.`);
    const replacementLayers = frame.layers == null ? null : frame.layers;
    if (replacementLayers != null && (!Array.isArray(replacementLayers) || replacementLayers.length < 1 || replacementLayers.length > MAX_LAYERS)) {
      throw new Error(`Animation frame ${frameIndex + 1} layers is invalid.`);
    }
    return {
      durationMs,
      background: frame.background == null ? null : normalizeHex(frame.background, `Animation frame ${frameIndex + 1} background`),
      changes: changes.map((change, i) => normalizeChange(change, i)),
      removeLayers: removeLayers.map(normalizeTarget),
      order: order ? order.map(normalizeTarget) : null,
      layers: replacementLayers ? replacementLayers.map((layer, i) => normalizeLayer(layer, i)) : null
    };
  });
  return {
    loop: raw.loop !== false,
    autoplay: raw.autoplay !== false,
    frames,
    totalDurationMs: total
  };
}

export function validateErasIconSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid icon root.');
  if (input.version !== 1) throw new Error('Icon version must be 1.');
  const background = normalizeHex(input.background ?? '#000000', 'background');
  if (!Array.isArray(input.layers) || input.layers.length < 1 || input.layers.length > MAX_LAYERS) {
    throw new Error(`layers must contain between 1 and ${MAX_LAYERS} layers.`);
  }
  return {
    version: 1,
    background,
    layers: input.layers.map((layer, i) => normalizeLayer(layer, i)),
    animation: normalizeAnimation(input.animation)
  };
}

export function defaultErasIconSpec(displayName='Member') {
  const initials = String(displayName || 'Member').trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase() || 'M';
  return validateErasIconSpec({
    version: 1,
    background: '#34264c',
    layers: [{
      id: 'initials',
      char: initials,
      x: 64, y: 66, fontSize: 42,
      color: '#ffffff', fontFamily: 'Arial', fontWeight: 900,
      rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0,
      opacity: 1, align: 'middle'
    }]
  });
}

export function profileIconSpec(profile=null) {
  if (!profile?.avatarJson) return defaultErasIconSpec(profile?.displayName || 'Member');
  try {
    const raw = typeof profile.avatarJson === 'string' ? JSON.parse(profile.avatarJson) : profile.avatarJson;
    return validateErasIconSpec(raw);
  } catch (_) {
    return defaultErasIconSpec(profile?.displayName || 'Member');
  }
}

function cloneLayers(layers) {
  return layers.map(layer => ({ ...layer }));
}

function layerIndexByTarget(layers, target) {
  if (typeof target === 'number') return target >= 0 && target < layers.length ? target : -1;
  return layers.findIndex(layer => layer.id && layer.id === target);
}

function applyFrame(state, frame) {
  if (frame.layers) state.layers = cloneLayers(frame.layers);
  if (frame.background) state.background = frame.background;

  for (const change of frame.changes) {
    const index = layerIndexByTarget(state.layers, change.target);
    if (index < 0) continue;
    const next = { ...state.layers[index] };
    for (const [key, value] of Object.entries(change)) {
      if (key !== 'target') next[key] = value;
    }
    state.layers[index] = next;
  }

  if (frame.removeLayers.length) {
    const removals = new Set(frame.removeLayers.map(target => layerIndexByTarget(state.layers, target)).filter(i => i >= 0));
    state.layers = state.layers.filter((_, i) => !removals.has(i));
  }

  if (frame.order) {
    const used = new Set();
    const ordered = [];
    for (const target of frame.order) {
      const index = layerIndexByTarget(state.layers, target);
      if (index >= 0 && !used.has(index)) {
        ordered.push(state.layers[index]);
        used.add(index);
      }
    }
    state.layers.forEach((layer, index) => { if (!used.has(index)) ordered.push(layer); });
    state.layers = ordered;
  }
  return state;
}

export function erasIconSnapshots(specInput) {
  const spec = validateErasIconSpec(specInput);
  if (!spec.animation?.autoplay || !spec.animation.frames.length) {
    return [{ durationMs: 0, background: spec.background, layers: cloneLayers(spec.layers) }];
  }
  const state = { background: spec.background, layers: cloneLayers(spec.layers) };
  return spec.animation.frames.map(frame => {
    applyFrame(state, frame);
    return {
      durationMs: frame.durationMs,
      background: state.background,
      layers: cloneLayers(state.layers)
    };
  });
}

function layerSvg(layer) {
  if (layer.hidden || layer.opacity <= 0) return '';
  const transform = `translate(${layer.x} ${layer.y}) rotate(${layer.rotation}) skewX(${layer.skewX}) skewY(${layer.skewY}) scale(${layer.scaleX} ${layer.scaleY})`;
  return `<g transform="${transform}"><text x="0" y="0" fill="${layer.color}" font-family="${escapeXml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" opacity="${layer.opacity}" text-anchor="${layer.align}" dominant-baseline="middle">${escapeXml(layer.char)}</text></g>`;
}

function snapshotSvg(snapshot) {
  return `<rect width="128" height="128" fill="${snapshot.background}"/>${snapshot.layers.map(layerSvg).join('')}`;
}

function frameKeyframes(index, snapshots) {
  const total = snapshots.reduce((sum, frame) => sum + frame.durationMs, 0) || 1;
  let elapsed = 0;
  const start = snapshots.slice(0, index).reduce((sum, frame) => sum + frame.durationMs, 0);
  const end = start + snapshots[index].durationMs;
  const s = Math.max(0, Math.min(100, start / total * 100));
  const e = Math.max(0, Math.min(100, end / total * 100));
  const before = Math.max(0, s - 0.0001);
  const insideEnd = Math.max(s, e - 0.0001);
  const parts = [];
  if (s > 0) parts.push(`0%,${before}%{opacity:0}`);
  parts.push(`${s}%,${insideEnd}%{opacity:1}`);
  if (e < 100) parts.push(`${e}%,100%{opacity:0}`);
  return `@keyframes erasIconFrame${index}{${parts.join('')}}`;
}

export function erasIconSvg(specInput, options={}) {
  const spec = validateErasIconSpec(specInput);
  const snapshots = erasIconSnapshots(spec);
  const ariaHidden = options.ariaHidden === false ? 'false' : 'true';
  if (!spec.animation?.autoplay || snapshots.length <= 1) {
    return `<svg viewBox="0 0 128 128" focusable="false" aria-hidden="${ariaHidden}" xmlns="http://www.w3.org/2000/svg">${snapshotSvg(snapshots[0])}</svg>`;
  }

  const total = spec.animation.totalDurationMs || snapshots.reduce((sum, frame) => sum + frame.durationMs, 0);
  const iterations = spec.animation.loop ? 'infinite' : '1';
  const fill = spec.animation.loop ? 'none' : 'forwards';
  const keyframes = snapshots.map((_, i) => frameKeyframes(i, snapshots)).join('');
  const styles = snapshots.map((_, i) =>
    `.eras-icon-frame-${i}{opacity:0;animation:erasIconFrame${i} ${total}ms linear ${iterations};animation-fill-mode:${fill}}`
  ).join('');
  const reduced = snapshots.map((_, i) => `.eras-icon-frame-${i}{animation:none!important;opacity:${i===0?1:0}!important}`).join('');
  const groups = snapshots.map((snapshot, i) =>
    `<g class="eras-icon-frame eras-icon-frame-${i}">${snapshotSvg(snapshot)}</g>`
  ).join('');
  return `<svg viewBox="0 0 128 128" focusable="false" aria-hidden="${ariaHidden}" xmlns="http://www.w3.org/2000/svg"><style>${keyframes}${styles}@media(prefers-reduced-motion:reduce){${reduced}}</style>${groups}</svg>`;
}

export function erasIconDataUrl(specInput) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(erasIconSvg(specInput))}`;
}

export function renderErasIconElement(element, specOrJson) {
  if (!element) return null;
  try {
    const raw = typeof specOrJson === 'string' ? JSON.parse(specOrJson) : specOrJson;
    const spec = validateErasIconSpec(raw);
    element.innerHTML = erasIconSvg(spec);
    element.dataset.erasIconRendered = '1';
    return spec;
  } catch (error) {
    element.dataset.erasIconError = '1';
    console.warn('E.R.A.S. JSON icon render failed', error);
    return null;
  }
}

export function installErasIconAutoload(root=document) {
  const renderNode = node => {
    if (!(node instanceof Element)) return;
    const own = node.getAttribute?.('data-eras-icon-json');
    if (own && node.dataset.erasIconRendered !== '1') renderErasIconElement(node, own);
    node.querySelectorAll?.('[data-eras-icon-json]').forEach(el => {
      if (el.dataset.erasIconRendered !== '1') renderErasIconElement(el, el.getAttribute('data-eras-icon-json'));
    });
  };

  if (root?.documentElement) renderNode(root.documentElement);
  else if (root instanceof Element) renderNode(root);

  if (typeof MutationObserver !== 'undefined' && root?.documentElement && !root.documentElement.dataset.erasIconObserver) {
    root.documentElement.dataset.erasIconObserver = '1';
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'attributes') renderNode(record.target);
        record.addedNodes?.forEach(renderNode);
      }
    });
    observer.observe(root.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:['data-eras-icon-json'] });
  }
}

if (typeof window !== 'undefined') {
  window.ERASIconRenderer = Object.freeze({
    validate: validateErasIconSpec,
    svg: erasIconSvg,
    dataUrl: erasIconDataUrl,
    render: renderErasIconElement,
    snapshots: erasIconSnapshots,
    profileSpec: profileIconSpec
  });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => installErasIconAutoload(document), { once:true });
  else installErasIconAutoload(document);
}
