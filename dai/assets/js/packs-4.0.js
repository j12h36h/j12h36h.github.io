(() => {
  const REGISTRY_URL = '/dai/api/packs-4.0.json';
  const EXPERIENCE_GRID = document.getElementById('experiencePackGrid');
  const ADDON_GRID = document.getElementById('addonPackGrid');
  const PREVIEW = document.getElementById('registryPreview');
  const COUNTS = {
    experience: document.getElementById('experiencePackCount'),
    addon: document.getElementById('addonPackCount')
  };

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function firstSourcePage(pack) {
    const component = Array.isArray(pack?.components) ? pack.components[0] : null;
    return component?.source_page || pack?.info_url || '#';
  }

  function componentSummary(pack) {
    const components = Array.isArray(pack?.components) ? pack.components : [];
    if (!components.length) return 'NO COMPONENTS';
    return components
      .map(component => String(component?.type || 'component').replaceAll('_', ' ').toUpperCase())
      .join(' + ');
  }

  function card(pack, section) {
    const href = firstSourcePage(pack);
    const classLabel = section === 'experience'
      ? 'EXPERIENCE PACK'
      : 'ADDON';
    const behavior = section === 'experience'
      ? 'PRIMARY EXPERIENCE'
      : 'STACKABLE';

    return `
      <a class="ecosystem-card dai4-pack-card dai4-${section}" href="${escapeHtml(href)}" rel="noopener noreferrer" target="_blank">
        <span>${classLabel} // ${escapeHtml(pack.display_tag || 'DAI PACK')}</span>
        <strong>${escapeHtml(pack.name || pack.id)}</strong>
        <p>${escapeHtml(pack.summary || 'Official DAI Engine pack.')}</p>
        <div class="dai4-pack-meta">
          <b>v${escapeHtml(pack.version || '?')}</b>
          <b>${behavior}</b>
          <b>${escapeHtml(componentSummary(pack))}</b>
        </div>
        <i>SOURCE →</i>
      </a>`;
  }

  function renderGrid(root, packs, section) {
    if (!root) return;
    if (!packs.length) {
      root.innerHTML = '<p class="dai4-pack-empty">NO PACKS ARE REGISTERED IN THIS SECTION YET.</p>';
      return;
    }
    root.innerHTML = packs.map(pack => card(pack, section)).join('');
  }

  async function load() {
    try {
      const response = await fetch(REGISTRY_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const registry = await response.json();
      const experiences = registry?.sections?.experience_packs || [];
      const addons = registry?.sections?.addons || [];

      renderGrid(EXPERIENCE_GRID, experiences, 'experience');
      renderGrid(ADDON_GRID, addons, 'addon');
      if (COUNTS.experience) COUNTS.experience.textContent = String(experiences.length).padStart(2, '0');
      if (COUNTS.addon) COUNTS.addon.textContent = String(addons.length).padStart(2, '0');
      if (PREVIEW) PREVIEW.textContent = JSON.stringify(registry, null, 2);
    } catch (error) {
      const message = `DAI 4.0 pack registry unavailable: ${error?.message || error}`;
      if (EXPERIENCE_GRID) EXPERIENCE_GRID.innerHTML = `<p class="dai4-pack-empty">${escapeHtml(message)}</p>`;
      if (ADDON_GRID) ADDON_GRID.innerHTML = `<p class="dai4-pack-empty">${escapeHtml(message)}</p>`;
      if (PREVIEW) PREVIEW.textContent = message;
    }
  }

  load();
})();
