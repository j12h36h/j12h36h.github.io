import { auth, db, fs, watchIdentity } from '/game/assets/js/eras-data.js';
import { watchCreditWallet, formatCredits } from '/assets/js/credit-system.js';
import { openOptionPicker } from '/game/assets/js/hosted-option-picker.js?v=1.0.0';
import {
  assetPreviewUrl,
  assetIsTintable,
  assetDefaultTint,
  renderAssetCanvas,
  safeAssetTint,
  assetCategory,
  assetDisplayLabel,
  assetCatalogVariantLabel
} from '/game/assets/js/catalog-assets.js?v=1.2.0';
import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const $ = selector => document.querySelector(selector);
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const functions = getFunctions(getApp('site-account'));
const acquireAssetVariantCall = httpsCallable(functions,'acquireAssetVariant');
const createModeTestLobbyCall = httpsCallable(functions,'createModeTestLobby');

const state = {
  identity: null,
  catalog: { assets: [] },
  asset: null,
  variant: {},
  selectedHolding: null,
  holdings: [],
  archiveView: false,
  collectionUnsub: null,
  creditUnsub: null,
  creditBalance: 0,

  audioTest: null,
  audioTestActive: false,
  effectTestActive: false,
  iconTestActive: false
};

function say(message, tone='') {
  const el = $('#assetFeedback');
  if (!el) return;
  el.textContent = String(message || '').toUpperCase();
  el.dataset.tone = tone;
}

function assetById(id) {
  return state.catalog.assets.find(asset => asset.id === id) || null;
}

function policy(asset=state.asset) {
  return asset?.variantPolicy || {
    defaultPriceCredits:0,
    customPriceCredits:1
  };
}

function assetKind(asset=state.asset) {
  return assetCategory(asset);
}

function defaultVariant(asset) {
  const kind = assetKind(asset);
  const p = policy(asset);

  if (kind === 'Sprite') {
    const first = p.tintPresets?.[0];
    return {
      tint: safeAssetTint(first?.value || assetDefaultTint(asset)),
      presetName: first?.name || 'Default'
    };
  }

  if (kind === 'Audio') {
    return {
      pitchRate: Number(p.defaultPitchRate ?? 1),
      pitchName: String(p.defaultPitchName || 'Alto')
    };
  }

  if (kind === 'Mode') {
    return {
      rule: String(p.defaultRule || p.rulePresets?.[0] || 'Highest Score'),
      customRule: ''
    };
  }

  if (kind === 'World') {
    return {
      skin: String(p.defaultSkin || p.skinPresets?.[0] || asset.skinName || 'Default'),
      customSkin: ''
    };
  }

  if (kind === 'Effect') {
    const d = p.defaultImpact || asset.effectData || {};
    return {
      size: Number(d.size ?? 1),
      brightness: Number(d.brightness ?? 1),
      tint: safeAssetTint(d.tint || '#ffffff')
    };
  }

  if (kind === 'Icon') {
    const first = p.colorPresets?.[0] || {};
    return {
      primary: safeAssetTint(first.primary || '#ffffff'),
      secondary: safeAssetTint(first.secondary || '#925cff'),
      accent: safeAssetTint(first.accent || '#64d9ff'),
      presetName: String(first.name || 'Original')
    };
  }

  return {};
}

function nearestPitchPreset(asset, rate) {
  const presets = policy(asset).pitchPresets || [];
  let nearest = null;
  let distance = Infinity;
  for (const preset of presets) {
    const d = Math.abs(Number(preset.rate) - Number(rate));
    if (d < distance) {
      nearest = preset;
      distance = d;
    }
  }
  return { preset:nearest, distance };
}

function sameNumber(a,b,epsilon=0.0005) {
  return Math.abs(Number(a)-Number(b)) <= epsilon;
}

function variantInfo(asset=state.asset, variant=state.variant) {
  if (!asset) return { custom:false, price:0, label:'Undefined', payload:{} };

  const kind = assetKind(asset);
  const p = policy(asset);
  let custom = false;
  let label = 'Undefined';

  if (kind === 'Sprite') {
    const tint = safeAssetTint(variant.tint || assetDefaultTint(asset));
    const preset = (p.tintPresets || []).find(x => safeAssetTint(x.value) === tint);
    custom = !preset;
    label = preset?.name || tint.toUpperCase();
  }

  else if (kind === 'Audio') {
    const rate = Math.max(Number(p.minPitchRate ?? .5), Math.min(Number(p.maxPitchRate ?? 1.5), Number(variant.pitchRate ?? p.defaultPitchRate ?? 1)));
    const nearest = nearestPitchPreset(asset, rate);
    custom = !nearest.preset || nearest.distance > 0.004;
    label = custom ? `${rate.toFixed(2)}x CUSTOM` : nearest.preset.name;
  }

  else if (kind === 'Mode') {
    const rule = String(variant.rule || p.defaultRule || 'Highest Score');
    const presets = p.rulePresets || [];
    custom = rule === '__custom__' || !presets.includes(rule);
    label = custom ? (String(variant.customRule || '').trim() || 'Custom Rule') : rule;
  }

  else if (kind === 'World') {
    const skin = String(variant.skin || p.defaultSkin || 'Default');
    const presets = p.skinPresets || [];
    custom = skin === '__custom__' || !presets.includes(skin);
    label = custom ? (String(variant.customSkin || '').trim() || 'Custom Skin') : skin;
  }

  else if (kind === 'Effect') {
    const d = p.defaultImpact || {};
    const size = Number(variant.size ?? d.size ?? 1);
    const brightness = Number(variant.brightness ?? d.brightness ?? 1);
    const tint = safeAssetTint(variant.tint || d.tint || '#ffffff');
    custom = !(sameNumber(size,d.size ?? 1,.001) && sameNumber(brightness,d.brightness ?? 1,.001) && tint === safeAssetTint(d.tint || '#ffffff'));
    label = custom
      ? `Size ${size.toFixed(2)} · Light ${brightness.toFixed(2)} · ${tint.toUpperCase()}`
      : String(asset.impactName || 'Default Impact');
  }

  else if (kind === 'Icon') {
    const primary = safeAssetTint(variant.primary || '#ffffff');
    const secondary = safeAssetTint(variant.secondary || '#925cff');
    const accent = safeAssetTint(variant.accent || '#64d9ff');
    const preset = (p.colorPresets || []).find(x =>
      safeAssetTint(x.primary) === primary &&
      safeAssetTint(x.secondary) === secondary &&
      safeAssetTint(x.accent) === accent
    );
    custom = !preset;
    label = preset?.name || `${primary.toUpperCase()} / ${secondary.toUpperCase()} / ${accent.toUpperCase()}`;
  }

  const price = custom ? Number(p.customPriceCredits ?? 1) : Number(p.defaultPriceCredits ?? 0);

  return {
    custom,
    price,
    label,
    payload: normalizeVariantPayload(asset, variant)
  };
}

function normalizeVariantPayload(asset, variant) {
  const kind = assetKind(asset);
  const p = policy(asset);

  if (kind === 'Sprite') {
    return { tint:safeAssetTint(variant.tint || assetDefaultTint(asset)) };
  }
  if (kind === 'Audio') {
    return { pitchRate:Number(variant.pitchRate ?? p.defaultPitchRate ?? 1) };
  }
  if (kind === 'Mode') {
    return {
      rule:String(variant.rule || p.defaultRule || 'Highest Score'),
      customRule:String(variant.customRule || '').trim().slice(0,80)
    };
  }
  if (kind === 'World') {
    return {
      skin:String(variant.skin || p.defaultSkin || 'Default'),
      customSkin:String(variant.customSkin || '').trim().slice(0,80)
    };
  }
  if (kind === 'Effect') {
    return {
      size:Number(variant.size ?? 1),
      brightness:Number(variant.brightness ?? 1),
      tint:safeAssetTint(variant.tint || '#ffffff')
    };
  }
  if (kind === 'Icon') {
    return {
      primary:safeAssetTint(variant.primary || '#ffffff'),
      secondary:safeAssetTint(variant.secondary || '#925cff'),
      accent:safeAssetTint(variant.accent || '#64d9ff')
    };
  }
  return {};
}

function storagePreview(asset, variant) {
  const kind = assetKind(asset);
  const p = policy(asset);

  if (kind === 'Sprite') {
    return safeAssetTint(variant.tint || assetDefaultTint(asset));
  }

  if (kind === 'Audio') {
    const rate = Number(variant.pitchRate ?? p.defaultPitchRate ?? 1);
    const nearest = nearestPitchPreset(asset,rate);
    if (nearest.preset && nearest.distance <= 0.004) {
      return `audio|pitch=${token(nearest.preset.name)}`;
    }
    return `audio|rate=${rate.toFixed(2)}`;
  }

  if (kind === 'Mode') {
    const info = variantInfo(asset,variant);
    return info.custom
      ? `mode|custom_rule=${token(variant.customRule || 'custom_rule')}`
      : `mode|rule=${token(variant.rule || p.defaultRule || 'Highest Score')}`;
  }

  if (kind === 'World') {
    const info = variantInfo(asset,variant);
    return info.custom
      ? `world|custom_skin=${token(variant.customSkin || 'custom_skin')}`
      : `world|skin=${token(variant.skin || p.defaultSkin || 'Default')}`;
  }

  if (kind === 'Effect') {
    return `effect|size=${Number(variant.size ?? 1).toFixed(2)}|brightness=${Number(variant.brightness ?? 1).toFixed(2)}|tint=${safeAssetTint(variant.tint || '#ffffff')}`;
  }

  if (kind === 'Icon') {
    return `icon|primary=${safeAssetTint(variant.primary || '#ffffff')}|secondary=${safeAssetTint(variant.secondary || '#925cff')}|accent=${safeAssetTint(variant.accent || '#64d9ff')}`;
  }

  return 'default';
}

function token(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,80) || 'default';
}

function holdingVariantLabel(asset, holding) {
  const stored = String(holding?.tint || '').trim();
  if (!stored) return assetCatalogVariantLabel(asset);

  if (stored.startsWith('#')) return stored.toUpperCase();
  if (stored.startsWith('audio|pitch=')) return titleToken(stored.slice('audio|pitch='.length));
  if (stored.startsWith('audio|rate=')) return `${Number(stored.slice('audio|rate='.length)).toFixed(2)}x CUSTOM`;
  if (stored.startsWith('mode|rule=')) return titleToken(stored.slice('mode|rule='.length));
  if (stored.startsWith('mode|custom_rule=')) return `${titleToken(stored.slice('mode|custom_rule='.length))} · CUSTOM`;
  if (stored.startsWith('world|skin=')) return titleToken(stored.slice('world|skin='.length));
  if (stored.startsWith('world|custom_skin=')) return `${titleToken(stored.slice('world|custom_skin='.length))} · CUSTOM`;
  if (stored.startsWith('effect|')) {
    const v=parseStorage(stored);
    return `Size ${v.size||'1.00'} · Light ${v.brightness||'1.00'} · ${String(v.tint||'#ffffff').toUpperCase()}`;
  }
  if (stored.startsWith('icon|')) {
    const v=parseStorage(stored);
    return `${String(v.primary||'').toUpperCase()} / ${String(v.secondary||'').toUpperCase()} / ${String(v.accent||'').toUpperCase()}`;
  }
  return stored;
}

function parseStorage(stored) {
  const out={};
  for (const piece of String(stored||'').split('|').slice(1)) {
    const i=piece.indexOf('=');
    if (i>0) out[piece.slice(0,i)]=piece.slice(i+1);
  }
  return out;
}

function titleToken(value) {
  return String(value||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function currentDisplayLabel() {
  if (!state.asset) return 'Asset';
  if (state.selectedHolding) {
    return assetDisplayLabel(state.asset, holdingVariantLabel(state.asset,state.selectedHolding));
  }
  return assetDisplayLabel(state.asset, variantInfo().label);
}

function existingVariant() {
  if (!state.asset || state.selectedHolding) return null;
  const storage = storagePreview(state.asset,state.variant);
  return state.holdings.find(h => h.assetId === state.asset.id && String(h.tint||'') === storage) || null;
}

function stopTests() {
  stopAudioTest();
  state.effectTestActive=false;
  state.iconTestActive=false;
  document.querySelector('.asset-preview-wrap')?.classList.remove('is-effect-testing','is-icon-testing');
  $('#assetImagePreview')?.classList.remove('is-icon-animated-test');
  $('#assetCanvas')?.classList.remove('is-icon-animated-test');
  document.querySelector('.asset-live-effect')?.remove();
}

function selectBrowseAsset(asset) {
  stopTests();
  state.selectedHolding=null;
  state.asset=asset;
  state.variant=defaultVariant(asset);
  renderSelectedAsset().catch(console.error);
  renderCollectionList();
}

function selectCollectionHolding(item,asset) {
  stopTests();
  state.selectedHolding=item;
  state.asset=asset;
  state.variant=defaultVariant(asset);
  renderSelectedAsset().catch(console.error);
  renderCollectionList();
  say(`${assetDisplayLabel(asset,holdingVariantLabel(asset,item))} selected from Collection.`,'ok');
}

function chooseAsset() {
  openOptionPicker({
    title:'Select Asset Library asset',
    options:(state.catalog.assets||[]).map(asset=>({
      id:asset.id,
      name:assetDisplayLabel(asset),
      description:asset.description||'',
      image:assetPreviewUrl(asset),
      tags:[]
    })),
    selected:state.selectedHolding?'':(state.asset?.id||''),
    onSelect:id=>{
      const asset=assetById(id);
      if (asset) selectBrowseAsset(asset);
    }
  });
}

function renderVariantEditor() {
  const root=$('#assetVariantControls');
  const tests=$('#assetTestControls');
  if (!root || !tests || !state.asset) return;
  root.innerHTML='';
  tests.innerHTML='';

  if (state.selectedHolding) {
    root.innerHTML = `<div class="variant-static"><b>COLLECTION VARIANT</b><span>${escapeHtml(holdingVariantLabel(state.asset,state.selectedHolding))}</span></div>`;
    return;
  }

  const asset=state.asset;
  const kind=assetKind(asset);
  const p=policy(asset);

  if (kind==='Sprite') {
    const row=document.createElement('div');
    row.className='variant-row';
    row.innerHTML='<span>PRESET TINTS</span>';
    const swatches=document.createElement('div');
    swatches.className='asset-swatches';
    for (const preset of p.tintPresets||[]) {
      const button=document.createElement('button');
      button.type='button';
      button.style.setProperty('--swatch',safeAssetTint(preset.value));
      button.title=`${preset.name} — FREE`;
      button.dataset.tone=safeAssetTint(preset.value);
      button.addEventListener('click',()=>{
        state.variant.tint=safeAssetTint(preset.value);
        syncVariantUI();
      });
      swatches.append(button);
    }
    row.append(swatches);
    root.append(row);

    const custom=document.createElement('label');
    custom.className='variant-row';
    custom.innerHTML='<span>CUSTOM TINT · 1 CREDIT</span>';
    const color=document.createElement('input');
    color.type='color';
    color.value=safeAssetTint(state.variant.tint||assetDefaultTint(asset));
    color.addEventListener('input',e=>{
      state.variant.tint=safeAssetTint(e.target.value);
      syncVariantUI();
    });
    custom.append(color);
    root.append(custom);
  }

  else if (kind==='Audio') {
    const rate=Number(state.variant.pitchRate ?? p.defaultPitchRate ?? 1);
    const info=variantInfo(asset,state.variant);
    const label=document.createElement('label');
    label.className='variant-row variant-slider-row';
    label.innerHTML=`<span>PITCH · <b id="pitchReadout">${escapeHtml(info.label)}</b></span>`;
    const slider=document.createElement('input');
    slider.type='range';
    slider.min=String(p.minPitchRate??.5);
    slider.max=String(p.maxPitchRate??1.5);
    slider.step=String(p.step??.01);
    slider.value=String(rate);
    slider.addEventListener('input',e=>{
      state.variant.pitchRate=Number(e.target.value);
      syncVariantUI();
      if (state.audioTest) state.audioTest.playbackRate=Number(e.target.value);
    });
    label.append(slider);
    root.append(label);

    const marks=document.createElement('div');
    marks.className='pitch-spectrum-labels';
    marks.innerHTML=(p.pitchPresets||[]).map(x=>`<span title="${Number(x.rate).toFixed(2)}x">${escapeHtml(x.name)}</span>`).join('');
    root.append(marks);

    addTestButton(tests,'TEST AUDIO',toggleAudioTest,'audioTestButton');
  }

  else if (kind==='Mode') {
    const select=document.createElement('select');
    select.className='variant-select';
    for (const rule of p.rulePresets||[]) {
      const option=document.createElement('option');
      option.value=rule;
      option.textContent=`${rule} · FREE`;
      select.append(option);
    }
    const customOption=document.createElement('option');
    customOption.value='__custom__';
    customOption.textContent='Custom Rule · 1 Credit';
    select.append(customOption);
    select.value=state.variant.rule || p.defaultRule || p.rulePresets?.[0] || '__custom__';
    select.addEventListener('change',e=>{
      state.variant.rule=e.target.value;
      syncVariantUI();
      renderVariantEditor();
    });
    root.append(select);

    if (state.variant.rule==='__custom__') {
      const input=document.createElement('input');
      input.className='variant-text';
      input.maxLength=80;
      input.placeholder='Custom rule name';
      input.value=state.variant.customRule||'';
      input.addEventListener('input',e=>{
        state.variant.customRule=e.target.value;
        syncVariantUI();
      });
      root.append(input);
    }

    addTestButton(tests,'TEST MODE',testMode,'modeTestButton');
  }

  else if (kind==='World') {
    const select=document.createElement('select');
    select.className='variant-select';
    for (const skin of p.skinPresets||[]) {
      const option=document.createElement('option');
      option.value=skin;
      option.textContent=`${skin} · FREE`;
      select.append(option);
    }
    const customOption=document.createElement('option');
    customOption.value='__custom__';
    customOption.textContent='Custom Defined Skin Pack · 1 Credit';
    select.append(customOption);
    select.value=state.variant.skin || p.defaultSkin || p.skinPresets?.[0] || '__custom__';
    select.addEventListener('change',e=>{
      state.variant.skin=e.target.value;
      syncVariantUI();
      renderVariantEditor();
    });
    root.append(select);

    if (state.variant.skin==='__custom__') {
      const input=document.createElement('input');
      input.className='variant-text';
      input.maxLength=80;
      input.placeholder='Custom skin pack name / ID';
      input.value=state.variant.customSkin||'';
      input.addEventListener('input',e=>{
        state.variant.customSkin=e.target.value;
        syncVariantUI();
      });
      root.append(input);
    }
  }

  else if (kind==='Effect') {
    root.append(effectSlider('SIZE','size',Number(p.sizeMin??.25),Number(p.sizeMax??3),.05));
    root.append(effectSlider('BRIGHTNESS','brightness',Number(p.brightnessMin??0),Number(p.brightnessMax??2),.05));

    const tint=document.createElement('label');
    tint.className='variant-row';
    tint.innerHTML='<span>IMPACT TINT</span>';
    const color=document.createElement('input');
    color.type='color';
    color.value=safeAssetTint(state.variant.tint||'#ffffff');
    color.addEventListener('input',e=>{
      state.variant.tint=safeAssetTint(e.target.value);
      syncVariantUI();
      updateLiveEffect();
    });
    tint.append(color);
    root.append(tint);

    addTestButton(tests,'TEST EFFECT',toggleEffectTest,'effectTestButton');
  }

  else if (kind==='Icon') {
    const presetSelect=document.createElement('select');
    presetSelect.className='variant-select';
    const presets=p.colorPresets||[];
    for (let i=0;i<presets.length;i++) {
      const preset=presets[i];
      const option=document.createElement('option');
      option.value=String(i);
      option.textContent=`${preset.name} · FREE`;
      presetSelect.append(option);
    }
    const customOption=document.createElement('option');
    customOption.value='custom';
    customOption.textContent='Custom Color Combination · 1 Credit';
    presetSelect.append(customOption);

    const current=variantInfo(asset,state.variant);
    const presetIndex=presets.findIndex(x=>x.name===current.label);
    presetSelect.value=presetIndex>=0?String(presetIndex):'custom';
    presetSelect.addEventListener('change',e=>{
      if (e.target.value!=='custom') {
        const preset=presets[Number(e.target.value)];
        if (preset) {
          state.variant.primary=safeAssetTint(preset.primary);
          state.variant.secondary=safeAssetTint(preset.secondary);
          state.variant.accent=safeAssetTint(preset.accent);
        }
      } else {
        // Keep the current colors and let the pickers make the custom combination.
      }
      syncVariantUI();
      renderVariantEditor();
    });
    root.append(presetSelect);

    const colorGrid=document.createElement('div');
    colorGrid.className='icon-color-grid';
    for (const [label,key,fallback] of [
      ['PRIMARY','primary','#ffffff'],
      ['SECONDARY','secondary','#925cff'],
      ['ACCENT','accent','#64d9ff']
    ]) {
      const holder=document.createElement('label');
      holder.className='variant-row';
      holder.innerHTML=`<span>${label}</span>`;
      const color=document.createElement('input');
      color.type='color';
      color.value=safeAssetTint(state.variant[key]||fallback);
      color.addEventListener('input',e=>{
        state.variant[key]=safeAssetTint(e.target.value);
        syncVariantUI();
      });
      holder.append(color);
      colorGrid.append(holder);
    }
    root.append(colorGrid);

    addTestButton(tests,'TEST ICON',toggleIconTest,'iconTestButton');
    const note=document.createElement('small');
    note.className='variant-note';
    note.textContent='STATIC ICONS PULSE DURING TEST. FUTURE ANIMATED ICON METADATA USES THIS SAME TEST BUTTON.';
    tests.append(note);
  }
}

function effectSlider(label,key,min,max,step) {
  const holder=document.createElement('label');
  holder.className='variant-row variant-slider-row';
  holder.innerHTML=`<span>${label} · <b data-effect-readout="${key}">${Number(state.variant[key]??1).toFixed(2)}</b></span>`;
  const slider=document.createElement('input');
  slider.type='range';
  slider.min=String(min);
  slider.max=String(max);
  slider.step=String(step);
  slider.value=String(Number(state.variant[key]??1));
  slider.addEventListener('input',e=>{
    state.variant[key]=Number(e.target.value);
    syncVariantUI();
    updateLiveEffect();
  });
  holder.append(slider);
  return holder;
}

function addTestButton(root,label,handler,id) {
  const button=document.createElement('button');
  button.type='button';
  button.id=id;
  button.className='asset-test-button';
  button.textContent=label;
  button.addEventListener('click',handler);
  root.append(button);
}

function syncVariantUI() {
  if (!state.asset || state.selectedHolding) return;
  const info=variantInfo();

  $('#assetName').textContent=assetDisplayLabel(state.asset,info.label);
  const price=$('#assetPriceTag');
  if (price) {
    price.textContent=info.price===0?'FREE':`◈ ${info.price} CREDIT${info.price===1?'':'S'}`;
    price.classList.toggle('is-paid',info.price>0);
  }

  const button=$('#obtainAsset');
  if (button) {
    button.textContent=info.price===0?'ADD TO COLLECTION · FREE':`ADD TO COLLECTION · ◈ ${info.price}`;
  }

  const pitch=$('#pitchReadout');
  if (pitch) pitch.textContent=info.label;

  document.querySelectorAll('[data-effect-readout]').forEach(el=>{
    const key=el.dataset.effectReadout;
    el.textContent=Number(state.variant[key]??1).toFixed(2);
  });

  if (assetKind()==='Sprite') {
    renderAssetCanvas($('#assetCanvas'),state.asset,safeAssetTint(state.variant.tint||assetDefaultTint(state.asset))).catch(()=>{});
  }

  updateObtainState();
}

async function renderSelectedAsset() {
  if (!state.asset) return;

  $('#assetName').textContent=currentDisplayLabel();
  $('#assetDescription').textContent=state.asset.description||'';
  $('#assetType').textContent=assetKind().toUpperCase();
  $('#assetTags').innerHTML=(state.asset.tags||[]).slice(0,8).map(tag=>`<span>${escapeHtml(String(tag).toUpperCase())}</span>`).join('');

  const canvas=$('#assetCanvas');
  const image=$('#assetImagePreview');
  const kind=assetKind();

  if (kind==='Sprite') {
    canvas.hidden=false;
    image.hidden=true;
    const tint=state.selectedHolding
      ? safeAssetTint(state.selectedHolding.tint||assetDefaultTint(state.asset))
      : safeAssetTint(state.variant.tint||assetDefaultTint(state.asset));
    await renderAssetCanvas(canvas,state.asset,tint);
  } else {
    canvas.hidden=true;
    image.hidden=false;
    image.src=assetPreviewUrl(state.asset);
    image.alt=`${assetDisplayLabel(state.asset)} preview`;
  }

  const price=$('#assetPriceTag');
  if (state.selectedHolding) {
    price.textContent='OWNED';
    price.classList.remove('is-paid');
  } else {
    const info=variantInfo();
    price.textContent=info.price===0?'FREE':`◈ ${info.price} CREDIT`;
    price.classList.toggle('is-paid',info.price>0);
  }

  renderVariantEditor();
  updateObtainState();
}

function updateObtainState() {
  const button=$('#obtainAsset');
  if (!button || !state.asset) return;

  if (state.selectedHolding) {
    button.disabled=true;
    button.textContent='COLLECTION ASSET SELECTED';
    return;
  }

  if (!state.identity?.profileId) {
    button.disabled=true;
    button.textContent='SIGN IN THROUGH E.R.A.S.';
    return;
  }

  const existing=existingVariant();
  if (existing) {
    button.disabled=true;
    button.textContent=existing.archived?'ASSET IN ARCHIVE':'ASSET IN COLLECTION';
    return;
  }

  const info=variantInfo();
  if (info.price>state.creditBalance) {
    button.disabled=true;
    button.textContent=`NEED ◈ ${info.price} CREDIT`;
    return;
  }

  button.disabled=false;
  button.textContent=info.price===0?'ADD TO COLLECTION · FREE':`ADD TO COLLECTION · ◈ ${info.price}`;
}

async function acquireSelectedAsset() {
  if (!state.identity?.profileId || !auth.currentUser || !state.asset || state.selectedHolding) {
    return say('Select a Browse asset and sign in first.','error');
  }

  const info=variantInfo();
  if (info.price>state.creditBalance) {
    return say(`This custom variation costs ${info.price} Credit. Your balance is ${state.creditBalance}.`,'error');
  }

  const button=$('#obtainAsset');
  button.disabled=true;
  const old=button.textContent;
  button.textContent='ADDING…';

  try {
    const result=await acquireAssetVariantCall({
      assetId:state.asset.id,
      variant:info.payload
    });
    const data=result?.data||{};
    if (!data.ok) throw new Error(data.error||'Asset acquisition failed.');

    say(
      data.priceCharged===0
        ? `${assetDisplayLabel(state.asset,info.label)} added to your Collection for free.`
        : `${assetDisplayLabel(state.asset,info.label)} added to your Collection for 1 Credit.`,
      'ok'
    );
  } catch (error) {
    console.error('Acquire asset variant',error);
    say(`Could not add asset: ${error?.message||error}`,'error');
  } finally {
    button.disabled=false;
    button.textContent=old;
    updateObtainState();
  }
}

function collectionPreview(asset,holding) {
  const wrap=document.createElement('div');
  wrap.className='inventory-preview';

  if (assetKind(asset)==='Sprite') {
    const canvas=document.createElement('canvas');
    canvas.width=96;
    canvas.height=96;
    wrap.append(canvas);
    renderAssetCanvas(canvas,asset,safeAssetTint(holding.tint||assetDefaultTint(asset))).catch(()=>{});
  } else {
    const img=document.createElement('img');
    img.src=assetPreviewUrl(asset);
    img.alt='';
    wrap.append(img);
  }

  return wrap;
}

function renderCollectionList() {
  const list=$('#inventoryList');
  if (!list) return;

  const active=state.holdings.filter(h=>!h.archived);
  const archived=state.holdings.filter(h=>h.archived);
  $('#ownedCount').textContent=String(active.length).padStart(2,'0');
  $('#inventoryViewCount').textContent=String(active.length).padStart(2,'0');
  $('#archiveCount').textContent=String(archived.length).padStart(2,'0');
  $('#inventoryPanelTitle').textContent=state.archiveView?'ASSET ARCHIVE':'YOUR COLLECTION';
  $('#inventoryViewButton').classList.toggle('is-active',!state.archiveView);
  $('#archiveViewButton').classList.toggle('is-active',state.archiveView);

  list.innerHTML='';

  if (!state.identity?.profileId) {
    list.innerHTML='<p class="inventory-empty">SIGN IN TO LOAD YOUR COLLECTION.</p>';
    return;
  }

  const items=state.holdings.filter(h=>Boolean(h.archived)===state.archiveView);
  if (!items.length) {
    list.innerHTML=`<p class="inventory-empty">${state.archiveView?'NO ARCHIVED ASSETS.':'NO ASSETS COLLECTED YET.'}</p>`;
    return;
  }

  for (const item of items) {
    const asset=assetById(item.assetId)||{id:item.assetId,name:item.assetId,type:'sprite',defaultTint:'#ffffff',tintable:true};
    const selected=state.selectedHolding?.id===item.id;
    const row=document.createElement('article');
    row.className=`inventory-item${selected?' is-selected':''}${item.archived?' is-archived':''}`;

    row.append(collectionPreview(asset,item));

    const copy=document.createElement('div');
    copy.className='inventory-copy';

    const select=document.createElement('button');
    select.type='button';
    select.className='inventory-select';
    select.textContent=assetDisplayLabel(asset,holdingVariantLabel(asset,item));
    select.addEventListener('click',()=>selectCollectionHolding(item,asset));

    const meta=document.createElement('small');
    meta.textContent=item.archived?'ARCHIVED // RECOVERABLE':'OWNED // TRADEABLE';

    const archive=document.createElement('button');
    archive.type='button';
    archive.className=item.archived?'inventory-restore':'inventory-archive';
    archive.textContent=item.archived?'RESTORE':'ARCHIVE';
    archive.addEventListener('click',event=>{
      event.stopPropagation();
      setHoldingArchived(item,!item.archived);
    });

    copy.append(select,meta,archive);
    row.append(copy);
    list.append(row);
  }
}

async function setHoldingArchived(item,archived) {
  if (!state.identity?.profileId || item.ownerProfileId!==state.identity.profileId) {
    return say('That holding does not belong to this profile.','error');
  }

  try {
    await fs.updateDoc(fs.doc(db,'assetHoldings',item.id),{
      archived,
      archivedAt:archived?fs.serverTimestamp():null,
      updatedAt:fs.serverTimestamp()
    });
    say(archived?'Asset moved to Archive.':'Asset restored to Collection.','ok');
  } catch (error) {
    console.error('Archive holding',error);
    say(`Could not ${archived?'archive':'restore'} asset: ${error?.code||error?.message}`,'error');
  }
}

function watchCollection() {
  state.collectionUnsub?.();
  state.holdings=[];
  renderCollectionList();

  if (!state.identity?.profileId) return;

  const q=fs.query(
    fs.collection(db,'assetHoldings'),
    fs.where('ownerProfileId','==',state.identity.profileId),
    fs.limit(300)
  );

  state.collectionUnsub=fs.onSnapshot(q,snapshot=>{
    state.holdings=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));

    if (state.selectedHolding) {
      state.selectedHolding=state.holdings.find(x=>x.id===state.selectedHolding.id)||null;
    }

    renderCollectionList();
    updateObtainState();
  },error=>{
    console.error('Collection subscription',error);
    say(`Collection error: ${error?.code||error?.message}`,'error');
  });
}

function watchCredits() {
  state.creditUnsub?.();
  state.creditBalance=0;

  if (!state.identity?.profileId) {
    $('#marketCreditBalance').textContent='00';
    return;
  }

  state.creditUnsub=watchCreditWallet(
    db,
    fs,
    state.identity.profileId,
    balance=>{
      state.creditBalance=Number(balance)||0;
      $('#marketCreditBalance').textContent=formatCredits(state.creditBalance);
      updateObtainState();
    },
    error=>console.debug('Asset Library wallet',error?.code||error)
  );
}

function toggleAudioTest() {
  if (state.audioTestActive) {
    stopAudioTest();
    syncTestButton('audioTestButton',false,'TEST AUDIO');
    return;
  }

  const asset=state.asset;
  if (!asset?.source) return say('This Audio asset has no playable source.','error');

  stopAudioTest();
  const audio=new Audio(asset.source);
  audio.preload='auto';
  audio.loop=Boolean(asset.audioData?.loop);
  audio.playbackRate=Number(state.variant.pitchRate??1);
  audio.volume=.72;

  state.audioTest=audio;
  state.audioTestActive=true;
  syncTestButton('audioTestButton',true,'STOP AUDIO');

  audio.addEventListener('ended',()=>{
    if (!audio.loop) {
      state.audioTestActive=false;
      state.audioTest=null;
      syncTestButton('audioTestButton',false,'TEST AUDIO');
    }
  },{once:true});

  audio.play().catch(error=>{
    console.error('Audio test',error);
    stopAudioTest();
    syncTestButton('audioTestButton',false,'TEST AUDIO');
    say('Audio test could not start. Interact with the page and retry.','error');
  });
}

function stopAudioTest() {
  if (state.audioTest) {
    try { state.audioTest.pause(); state.audioTest.currentTime=0; } catch {}
  }
  state.audioTest=null;
  state.audioTestActive=false;
}

function toggleEffectTest() {
  state.effectTestActive=!state.effectTestActive;
  const wrap=document.querySelector('.asset-preview-wrap');
  wrap?.classList.toggle('is-effect-testing',state.effectTestActive);
  syncTestButton('effectTestButton',state.effectTestActive,state.effectTestActive?'STOP EFFECT':'TEST EFFECT');

  if (state.effectTestActive) {
    let effect=wrap?.querySelector('.asset-live-effect');
    if (!effect && wrap) {
      effect=document.createElement('i');
      effect.className='asset-live-effect';
      wrap.append(effect);
    }
    updateLiveEffect();
  } else {
    wrap?.querySelector('.asset-live-effect')?.remove();
  }
}

function updateLiveEffect() {
  if (!state.effectTestActive) return;
  const effect=document.querySelector('.asset-live-effect');
  if (!effect) return;
  effect.style.setProperty('--effect-scale',String(Number(state.variant.size??1)));
  effect.style.setProperty('--effect-brightness',String(Number(state.variant.brightness??1)));
  effect.style.setProperty('--effect-tint',safeAssetTint(state.variant.tint||'#ffffff'));
}

function toggleIconTest() {
  state.iconTestActive=!state.iconTestActive;
  const image=$('#assetImagePreview');
  const canvas=$('#assetCanvas');
  const animation=state.asset?.animation||{};
  const duration=Math.max(180,Math.min(5000,Number(animation.durationMs||900)));
  for (const el of [image,canvas]) {
    if (!el) continue;
    el.classList.toggle('is-icon-animated-test',state.iconTestActive);
    el.style.setProperty('--icon-test-duration',`${duration}ms`);
  }
  syncTestButton('iconTestButton',state.iconTestActive,state.iconTestActive?'STOP ICON':'TEST ICON');
}

function syncTestButton(id,active,label) {
  const button=$(`#${id}`);
  if (!button) return;
  button.classList.toggle('is-active',active);
  button.textContent=label;
}

async function testMode() {
  if (!state.identity?.profileId) return say('Sign in before testing a Mode.','error');
  if (!state.asset?.modeId) return say('This Mode is not linked to a hosted game runtime.','error');

  const button=$('#modeTestButton');
  if (button) {
    button.disabled=true;
    button.textContent='CREATING TEST…';
  }

  try {
    const result=await createModeTestLobbyCall({
      modeId:state.asset.modeId,
      ruleVariant:normalizeVariantPayload(state.asset,state.variant)
    });
    const data=result?.data||{};
    if (!data.ok || !data.url) throw new Error(data.error||'Mode test could not be created.');
    location.href=data.url;
  } catch (error) {
    console.error('Mode test',error);
    say(`Mode test failed: ${error?.message||error}`,'error');
    if (button) {
      button.disabled=false;
      button.textContent='TEST MODE';
    }
  }
}

async function loadCatalog() {
  const response=await fetch('/public-assets/catalog.json',{cache:'no-store'});
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  state.catalog=await response.json();

  const assets=state.catalog.assets||[];
  const counts={Sprite:0,Audio:0,Mode:0,World:0,Effect:0,Icon:0};
  for (const asset of assets) {
    const kind=assetKind(asset);
    if (kind in counts) counts[kind]++;
  }

  $('#catalogCount').textContent=String(assets.length).padStart(2,'0');
  $('#spriteAssetCount').textContent=String(counts.Sprite).padStart(2,'0');
  $('#audioAssetCount').textContent=String(counts.Audio).padStart(2,'0');
  $('#modeAssetCount').textContent=String(counts.Mode).padStart(2,'0');
  $('#worldAssetCount').textContent=String(counts.World).padStart(2,'0');
  $('#effectAssetCount').textContent=String(counts.Effect).padStart(2,'0');
  $('#iconAssetCount').textContent=String(counts.Icon).padStart(2,'0');
  $('#gameAssetCount').textContent=String(counts.Mode).padStart(2,'0');

  if (!assets.length) throw new Error('No public assets are available.');
  selectBrowseAsset(assets[0]);
}

$('#chooseAsset')?.addEventListener('click',chooseAsset);
$('#obtainAsset')?.addEventListener('click',acquireSelectedAsset);
$('#inventoryViewButton')?.addEventListener('click',()=>{
  state.archiveView=false;
  renderCollectionList();
});
$('#archiveViewButton')?.addEventListener('click',()=>{
  state.archiveView=true;
  renderCollectionList();
});

watchIdentity(identity=>{
  state.identity=identity;
  watchCollection();
  watchCredits();
  renderVariantEditor();
  updateObtainState();
});

loadCatalog().catch(error=>{
  console.error(error);
  say(`Asset Library failed to load: ${error.message}`,'error');
});
