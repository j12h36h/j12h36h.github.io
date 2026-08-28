(() => {
  const homeLink = document.querySelector('[data-home-link]');
  if (homeLink) {
    const normalizePath = (pathname) => {
      let path = pathname.replace(/\/index\.html$/i, '/');
      if (!path.endsWith('/')) path += '/';
      return path;
    };

    const currentPath = normalizePath(window.location.pathname);
    const homePath = normalizePath(new URL(homeLink.href, window.location.href).pathname);

    if (currentPath === homePath) {
      homeLink.classList.add('is-active');
      homeLink.setAttribute('aria-current', 'page');
      homeLink.setAttribute('aria-pressed', 'true');
    } else {
      homeLink.classList.remove('is-active');
      homeLink.removeAttribute('aria-current');
      homeLink.setAttribute('aria-pressed', 'false');
    }
  }
})();

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const root = document.documentElement;
  const core = document.querySelector('[data-parallax-item]');

  window.addEventListener('pointermove', (event) => {
    const nx = event.clientX / window.innerWidth - 0.5;
    const ny = event.clientY / window.innerHeight - 0.5;

    root.style.setProperty('--px1', `${nx * -8}px`);
    root.style.setProperty('--py1', `${ny * -8}px`);
    root.style.setProperty('--px2', `${nx * -14}px`);
    root.style.setProperty('--py2', `${ny * -14}px`);

    if (core) {
      root.style.setProperty('--core-x', `${nx * 5}px`);
      root.style.setProperty('--core-y', `${ny * 5}px`);
    }
  }, { passive: true });
})();

(() => {
  const dateNode = document.querySelector('[data-irl-date]');
  if (!dateNode) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  dateNode.textContent = `${year}.${month}.${day}`;
})();

(() => {
  const optionInputs = [...document.querySelectorAll('[data-option]')];
  const graphicsChoices = [...document.querySelectorAll('[data-graphics]')];
  if (!optionInputs.length && !graphicsChoices.length) return;

  const storageKey = 'eras-universe-options-v1';
  const defaults = { masterVolume: 100, musicVolume: 100, fxVolume: 100, graphics: 'high' };
  let settings = { ...defaults };

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    settings = { ...settings, ...saved };
  } catch (_) {}

  const save = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch (_) {}
  };

  const updateRange = (input) => {
    const key = input.dataset.option;
    const value = Math.max(0, Math.min(100, Number(input.value) || 0));
    input.value = String(value);
    input.style.setProperty('--fill', `${value}%`);
    const output = document.querySelector(`[data-output="${key}"]`);
    if (output) output.value = String(value);
  };

  optionInputs.forEach((input) => {
    const key = input.dataset.option;
    if (Object.prototype.hasOwnProperty.call(settings, key)) input.value = String(settings[key]);
    updateRange(input);
    input.addEventListener('input', () => {
      settings[key] = Number(input.value);
      updateRange(input);
      save();
    });
  });

  const selectGraphics = (value) => {
    settings.graphics = value === 'low' ? 'low' : 'high';
    graphicsChoices.forEach((button) => {
      const selected = button.dataset.graphics === settings.graphics;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  selectGraphics(settings.graphics);
  graphicsChoices.forEach((button) => {
    button.addEventListener('click', () => {
      selectGraphics(button.dataset.graphics);
      save();
    });
  });
})();

(() => {
  const rings = [...document.querySelectorAll('.options-ring-field .hollow-ring')];
  if (!rings.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  rings.forEach((ring) => {
    const duration = 8 + Math.random() * 13;
    const reverse = Math.random() > 0.5 ? 'reverse' : 'normal';
    ring.style.animationDuration = `${duration.toFixed(2)}s`;
    ring.style.animationDirection = reverse;
  });
})();

(() => {
  const socialPage = document.querySelector('.social-page');
  if (!socialPage) return;

  const feedback = document.querySelector('[data-social-feedback]');
  const say = (message) => {
    if (!feedback) return;
    feedback.textContent = String(message).toUpperCase();
  };

  const displayName = document.querySelector('[data-display-name]');
  if (displayName) {
    const key = 'eras-universe-display-name-v1';
    try {
      const saved = localStorage.getItem(key);
      if (saved) displayName.value = saved;
    } catch (_) {}

    displayName.addEventListener('change', () => {
      const value = displayName.value.trim().slice(0, 24) || 'Player';
      displayName.value = value;
      try { localStorage.setItem(key, value); } catch (_) {}
      say('Display name updated');
    });
  }

  const pin = document.querySelector('[data-account-pin]');
  if (pin) {
    pin.addEventListener('input', () => {
      pin.value = pin.value.replace(/\D/g, '').slice(0, 8);
    });
    pin.addEventListener('change', () => say('PIN changed for this session'));
  }

  document.querySelectorAll('[data-social-action]').forEach((control) => {
    control.addEventListener('click', () => say(control.dataset.socialAction || 'Network action'));
  });

  document.querySelectorAll('[data-request-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-request-row]');
      if (!row) return;
      const player = row.querySelector('strong')?.textContent || 'Request';
      const action = button.dataset.requestAction === 'accept' ? 'accepted' : 'rejected';
      say(`${player} ${action}`);
      row.classList.add('is-resolved');
      window.setTimeout(() => row.remove(), 190);
    });
  });
})();

(() => {
  const page = document.querySelector('.creator-page');
  if (!page) return;

  const feedback = page.querySelector('[data-creator-feedback]');
  const previewMode = page.querySelector('[data-preview-mode]');
  const jsonMode = page.querySelector('[data-json-mode]');
  const jsonEditor = page.querySelector('[data-creator-json]');
  const jsonStatus = page.querySelector('[data-json-status]');
  const inspectorEmpty = page.querySelector('[data-inspector-empty]');
  const inspectorForm = page.querySelector('[data-inspector-form]');
  const definitionList = page.querySelector('[data-definition-list]');
  const fileInput = page.querySelector('[data-creator-file]');
  const contentPreview = page.querySelector('[data-content-preview]');
  const propertyNodes = [...page.querySelectorAll('[data-property-node]')];
  let activeDefinition = null;

  const say = (message) => { if (feedback) feedback.textContent = String(message).toUpperCase(); };

  const setView = (view) => {
    const isJson = view === 'json';
    if (previewMode) previewMode.hidden = isJson;
    if (jsonMode) jsonMode.hidden = !isJson;
    page.querySelectorAll('[data-creator-view]').forEach((button) => {
      const selected = button.dataset.creatorView === (isJson ? 'json' : 'preview');
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  page.querySelectorAll('[data-creator-view]').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.creatorView));
  });

  const normalizeDefinition = (raw = {}) => ({
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : 'eras:untitled',
    type: typeof raw.type === 'string' && raw.type.trim() ? raw.type.trim() : 'item',
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Untitled Content',
    visual: { color: '#83e0e3', ...(raw.visual && typeof raw.visual === 'object' ? raw.visual : {}) }
  });

  const updateTypeCounts = () => {
    page.querySelectorAll('[data-creator-type]').forEach((button) => {
      const count = button.querySelector('b');
      if (!count) return;
      count.textContent = activeDefinition && (button.dataset.creatorType === 'all' || button.dataset.creatorType === activeDefinition.type) ? '01' : '00';
    });
  };

  const renderDefinitionList = () => {
    if (!definitionList) return;
    definitionList.innerHTML = '';
    if (!activeDefinition) {
      const empty = document.createElement('p');
      empty.className = 'creator-empty-list';
      empty.textContent = 'NO CONTENT LOADED';
      definitionList.appendChild(empty);
      updateTypeCounts();
      return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'creator-definition is-active';
    button.innerHTML = `<i aria-hidden="true"></i><strong></strong><small></small>`;
    button.querySelector('strong').textContent = activeDefinition.id;
    button.querySelector('small').textContent = activeDefinition.type.toUpperCase();
    button.addEventListener('click', () => say(`Selected ${activeDefinition.id}`));
    definitionList.appendChild(button);
    updateTypeCounts();
  };

  const writeInspector = () => {
    if (!activeDefinition || !inspectorForm) return;
    const id = inspectorForm.querySelector('[data-field="id"]');
    const type = inspectorForm.querySelector('[data-field="type"]');
    const name = inspectorForm.querySelector('[data-field="name"]');
    const color = inspectorForm.querySelector('[data-field="color"]');
    const model = inspectorForm.querySelector('[data-field="model"]');
    const material = inspectorForm.querySelector('[data-field="material"]');
    if (id) id.value = activeDefinition.id;
    if (type) type.value = activeDefinition.type;
    if (name) name.value = activeDefinition.name;
    if (color) color.value = /^#[0-9a-f]{6}$/i.test(activeDefinition.visual.color || '') ? activeDefinition.visual.color : '#83e0e3';
    if (model) model.value = activeDefinition.visual.model || '';
    if (material) material.value = activeDefinition.visual.material || '';
  };

  const syncJson = () => {
    if (!activeDefinition || !jsonEditor) return;
    jsonEditor.value = JSON.stringify(activeDefinition, null, 2);
    if (jsonStatus) { jsonStatus.textContent = 'VALID'; jsonStatus.classList.remove('is-error'); }
  };

  const activateDefinition = (definition) => {
    activeDefinition = normalizeDefinition(definition);
    if (inspectorEmpty) inspectorEmpty.hidden = true;
    if (inspectorForm) inspectorForm.hidden = false;
    if (contentPreview) contentPreview.style.setProperty('--content-color', activeDefinition.visual.color || '#83e0e3');
    writeInspector();
    syncJson();
    renderDefinitionList();
    say(`Editing ${activeDefinition.id}`);
  };

  page.querySelectorAll('[data-field]').forEach((field) => {
    field.addEventListener('input', () => {
      if (!activeDefinition) return;
      const key = field.dataset.field;
      if (key === 'model' || key === 'material' || key === 'color') activeDefinition.visual[key] = field.value.trim();
      else activeDefinition[key] = field.value.trim();
      syncJson();
      renderDefinitionList();
      if (contentPreview) contentPreview.style.setProperty('--content-color', activeDefinition.visual.color || '#83e0e3');
      say('Definition modified');
    });
  });

  if (jsonEditor) {
    jsonEditor.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(jsonEditor.value);
        activeDefinition = normalizeDefinition(parsed);
        if (jsonStatus) { jsonStatus.textContent = 'VALID'; jsonStatus.classList.remove('is-error'); }
        writeInspector();
        renderDefinitionList();
        say('JSON valid');
      } catch (_) {
        if (jsonStatus) { jsonStatus.textContent = 'INVALID'; jsonStatus.classList.add('is-error'); }
        say('JSON validation error');
      }
    });
  }

  const newDefinition = () => activateDefinition({ id: 'eras:untitled', type: 'item', name: 'Untitled Content', visual: {} });

  const saveDefinition = () => {
    if (!activeDefinition) { say('Nothing to save'); return; }
    const blob = new Blob([JSON.stringify(activeDefinition, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDefinition.id.replace(/[^a-z0-9._-]+/gi, '_')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    say('Definition saved');
  };

  page.querySelectorAll('[data-creator-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.creatorAction;
      if (action === 'new') newDefinition();
      if (action === 'open' && fileInput) fileInput.click();
      if (action === 'save') saveDefinition();
      if (action === 'resource') say('Resource import placeholder');
    });
  });

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { activateDefinition(JSON.parse(String(reader.result || '{}'))); say(`Opened ${file.name}`); }
        catch (_) { say('Unable to open invalid JSON'); }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  const selectPropertyNode = (key) => {
    if (!activeDefinition) newDefinition();
    propertyNodes.forEach((node) => node.classList.toggle('is-selected', node.dataset.propertyNode === key));
    const field = inspectorForm?.querySelector(`[data-field="${key}"]`);
    if (field) {
      field.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      window.setTimeout(() => field.focus({ preventScroll: true }), 80);
    }
    say(`Editing ${key}`);
  };

  propertyNodes.forEach((node) => {
    node.addEventListener('click', () => selectPropertyNode(node.dataset.propertyNode));
  });

  page.querySelectorAll('[data-creator-type]').forEach((button) => {
    button.addEventListener('click', () => {
      page.querySelectorAll('[data-creator-type]').forEach((other) => other.classList.toggle('is-active', other === button));
      say(`Filter ${button.dataset.creatorType}`);
    });
  });

  page.querySelectorAll('[data-creator-control]').forEach((button) => button.addEventListener('click', () => say(`Preview ${button.dataset.creatorControl}`)));
  page.querySelectorAll('[data-creator-library]').forEach((button) => button.addEventListener('click', () => say(`Library ${button.dataset.creatorLibrary}`)));

  newDefinition();
})();
