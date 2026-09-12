(() => {
  if (window.ERASStickyNotes) return;

  const KEY = 'eras_sticky_notes_v1';
  const COLORS = ['#ffd66b','#7ed7ff','#8ee6a7','#ff91ad','#c7a0ff','#ffb36b'];

  let root = null;
  let activeId = '';
  let reminderTimer = 0;
  let tickTimer = 0;
  let autosaveTimer = 0;
  let editorHydrating = false;

  const uid = () => (crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const saveAll = notes => {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
      return true;
    } catch {
      window.ERASUtilityToast?.('Unable to save Notes in this browser.');
      return false;
    }
  };

  function newNote() {
    return {
      id: uid(),
      title: 'New note',
      text: '',
      color: COLORS[0],
      reminderAt: 0,
      timerEndsAt: 0,
      reminderNotified: false,
      timerNotified: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function ensureNotes() {
    let notes = load();
    if (!notes.length) {
      notes = [newNote()];
      saveAll(notes);
    }
    if (!activeId || !notes.some(n => n.id === activeId)) {
      activeId = notes[0].id;
    }
    return notes;
  }

  function activeNote(notes = ensureNotes()) {
    return notes.find(n => n.id === activeId) || notes[0] || null;
  }

  function fmtWhen(ms) {
    if (!ms) return 'NONE';
    return new Date(ms).toLocaleString([], {
      month:'short', day:'numeric', hour:'numeric', minute:'2-digit'
    });
  }

  function localDateTimeValue(ms) {
    if (!ms) return '';
    const date = new Date(ms);
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0,16);
  }

  function countdown(ms) {
    if (!ms) return 'NO TIMER';
    const left = ms - Date.now();
    if (left <= 0) return 'TIMER COMPLETE';
    const s = Math.floor(left / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
  }

  function notification(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, tag: `eras-note-${title}` });
      }
    } catch {}
    window.ERASUtilityToast?.(`${title}: ${body}`);
  }

  /*
    IMPORTANT: list refreshes and reminder checks never rewrite the editor.
    The original bug came from background checkDue() calling a full render(),
    which restored older localStorage values over whatever the user was typing.
  */
  function renderList(notes = ensureNotes()) {
    if (!root) return;
    const active = activeNote(notes);
    const list = root.querySelector('[data-note-list]');
    if (!list || !active) return;

    const sorted = [...notes].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    list.innerHTML = sorted.map(note => `
      <button type="button"
        class="eras-note-card ${note.id===active.id?'is-active':''}"
        style="--note:${esc(note.color)}"
        data-note-id="${esc(note.id)}">
        <b>${esc(note.title || 'Untitled note')}</b>
        <small>${esc(
          (note.text || '').replace(/\s+/g,' ').slice(0,70)
          || fmtWhen(note.reminderAt)
        )}</small>
      </button>`).join('');
  }

  function refreshTimer(notes = ensureNotes()) {
    if (!root) return;
    const note = activeNote(notes);
    const el = root.querySelector('[data-note-timer-readout]');
    if (el && note) el.textContent = countdown(note.timerEndsAt);
  }

  function hydrateEditor(notes = ensureNotes()) {
    if (!root) return;
    const note = activeNote(notes);
    if (!note) return;

    editorHydrating = true;
    try {
      root.querySelector('[data-note-title]').value = note.title || '';
      root.querySelector('[data-note-text]').value = note.text || '';
      root.querySelector('[data-note-reminder]').value = localDateTimeValue(note.reminderAt);
      root.querySelector('[data-note-timer-minutes]').value = '';
      root.querySelectorAll('[data-note-color]').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.noteColor === note.color);
      });
      refreshTimer(notes);
    } finally {
      editorHydrating = false;
    }
  }

  function renderFull() {
    const notes = ensureNotes();
    renderList(notes);
    hydrateEditor(notes);
  }

  function patchActive(patch, { hydrate = false, refreshList = true } = {}) {
    const notes = ensureNotes();
    const note = activeNote(notes);
    if (!note) return false;

    Object.assign(note, patch, { updatedAt: Date.now() });
    const ok = saveAll(notes);
    if (refreshList) renderList(notes);
    refreshTimer(notes);
    if (hydrate) hydrateEditor(notes);
    return ok;
  }

  function readEditorPatch() {
    if (!root) return {};
    const reminderRaw = root.querySelector('[data-note-reminder]')?.value || '';
    const reminderAt = reminderRaw ? new Date(reminderRaw).getTime() : 0;
    return {
      title: (root.querySelector('[data-note-title]')?.value || '').trim().slice(0,120) || 'Untitled note',
      text: (root.querySelector('[data-note-text]')?.value || '').slice(0,8000),
      reminderAt: Number.isFinite(reminderAt) ? reminderAt : 0
    };
  }

  function autosaveEditor({ immediate = false } = {}) {
    if (editorHydrating || !root) return;
    clearTimeout(autosaveTimer);
    const save = () => {
      const patch = readEditorPatch();
      const notes = ensureNotes();
      const note = activeNote(notes);
      if (!note) return;

      const reminderChanged = Number(note.reminderAt || 0) !== Number(patch.reminderAt || 0);
      Object.assign(note, patch, {
        updatedAt: Date.now(),
        ...(reminderChanged ? { reminderNotified: false } : {})
      });
      saveAll(notes);
      renderList(notes);
    };

    if (immediate) save();
    else autosaveTimer = window.setTimeout(save, 180);
  }

  function flushAutosave() {
    if (!root) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = 0;
    autosaveEditor({ immediate: true });
  }

  function checkDue() {
    /*
      Flush currently typed content before touching storage, then update only
      notification flags. Never call hydrateEditor/renderFull from here.
    */
    if (root?.classList.contains('is-open')) flushAutosave();

    const notes = load();
    let changed = false;
    const now = Date.now();

    notes.forEach(note => {
      if (note.reminderAt && now >= note.reminderAt && !note.reminderNotified) {
        note.reminderNotified = true;
        changed = true;
        notification(
          'E.R.A.S. Note Reminder',
          note.title || note.text.slice(0,80) || 'Sticky note reminder'
        );
      }

      if (note.timerEndsAt && now >= note.timerEndsAt && !note.timerNotified) {
        note.timerNotified = true;
        changed = true;
        notification(
          'E.R.A.S. Note Timer',
          note.title || 'Sticky note timer finished'
        );
      }
    });

    if (changed) saveAll(notes);

    if (root?.classList.contains('is-open')) {
      renderList(notes.length ? notes : ensureNotes());
      refreshTimer(notes.length ? notes : ensureNotes());
    }
  }

  function build() {
    root = document.createElement('div');
    root.className = 'eras-utility-backdrop';

    root.innerHTML = `<section class="eras-utility-window" role="dialog" aria-modal="true" aria-label="Sticky notes">
      <header class="eras-utility-head">
        <div>
          <b>NOTES</b>
          <small>PRIVATE TO THIS BROWSER // AUTOSAVED</small>
        </div>
        <button class="eras-utility-close" type="button" data-close>×</button>
      </header>

      <div class="eras-utility-body eras-notes-layout">
        <aside class="eras-notes-list">
          <div class="eras-notes-list-head">
            <button class="eras-utility-button is-primary" type="button" data-new-note>+ NOTE</button>
            <button class="eras-utility-button" type="button" data-notify>NOTIFY</button>
          </div>
          <div class="eras-note-list-items" data-note-list></div>
        </aside>

        <main class="eras-note-editor">
          <label class="eras-utility-field">
            <span>TITLE</span>
            <input data-note-title maxlength="120">
          </label>

          <label class="eras-utility-field">
            <span>NOTE</span>
            <textarea data-note-text maxlength="8000"></textarea>
          </label>

          <div class="eras-note-colors">
            ${COLORS.map(c => `<button type="button"
              class="eras-note-color"
              style="--note-color:${c}"
              data-note-color="${c}"
              aria-label="Set note color"></button>`).join('')}
          </div>

          <div class="eras-note-grid">
            <label class="eras-utility-field">
              <span>REMINDER</span>
              <input type="datetime-local" data-note-reminder>
            </label>
            <label class="eras-utility-field">
              <span>TIMER MINUTES</span>
              <input type="number" min="0" max="100000" step="1" placeholder="15" data-note-timer-minutes>
            </label>
          </div>

          <div class="eras-note-timer" data-note-timer-readout>NO TIMER</div>

          <div class="eras-note-actions">
            <button class="eras-utility-button is-primary" type="button" data-save-note>SAVE NOW</button>
            <button class="eras-utility-button" type="button" data-start-timer>START TIMER</button>
            <button class="eras-utility-button" type="button" data-clear-timer>CLEAR TIMER</button>
            <button class="eras-utility-button is-danger" type="button" data-delete-note>DELETE</button>
          </div>

          <div class="eras-note-notice">
            Notes autosave while you type. Reminders use browser/system notifications when permitted while E.R.A.S. is running. Overdue reminders are checked again when E.R.A.S. opens.
          </div>
        </main>
      </div>
    </section>`;

    document.body.appendChild(root);

    const close = () => {
      flushAutosave();
      root.classList.remove('is-open');
    };

    root.querySelector('[data-close]').addEventListener('click', close);
    root.addEventListener('click', e => {
      if (e.target === root) close();
    });

    /*
      Continuous autosave prevents note loss from background timers, color
      changes, viewport changes, accidental closing, and switching notes.
    */
    root.querySelector('[data-note-title]').addEventListener('input', () => autosaveEditor());
    root.querySelector('[data-note-text]').addEventListener('input', () => autosaveEditor());
    root.querySelector('[data-note-reminder]').addEventListener('change', () => autosaveEditor({ immediate:true }));

    root.addEventListener('click', async e => {
      const item = e.target.closest('[data-note-id]');
      if (item) {
        flushAutosave();
        activeId = item.dataset.noteId;
        renderFull();
        return;
      }

      if (e.target.closest('[data-new-note]')) {
        flushAutosave();
        const notes = load();
        const note = newNote();
        notes.unshift(note);
        saveAll(notes);
        activeId = note.id;
        renderFull();
        root.querySelector('[data-note-title]')?.select();
        return;
      }

      const color = e.target.closest('[data-note-color]');
      if (color) {
        flushAutosave();
        patchActive(
          { color: color.dataset.noteColor },
          { hydrate:false, refreshList:true }
        );
        root.querySelectorAll('[data-note-color]').forEach(btn => {
          btn.classList.toggle('is-active', btn === color);
        });
        return;
      }

      if (e.target.closest('[data-notify]')) {
        if (!('Notification' in window)) {
          window.ERASUtilityToast?.('Notifications are not supported by this browser.');
          return;
        }
        const permission = await Notification.requestPermission();
        window.ERASUtilityToast?.(
          permission === 'granted'
            ? 'Note notifications enabled.'
            : 'Note notifications were not enabled.'
        );
        return;
      }

      if (e.target.closest('[data-save-note]')) {
        flushAutosave();
        window.ERASUtilityToast?.('Note saved.');
        return;
      }

      if (e.target.closest('[data-start-timer]')) {
        flushAutosave();
        const minutes = Math.max(
          0,
          Number(root.querySelector('[data-note-timer-minutes]').value) || 0
        );
        if (!minutes) {
          window.ERASUtilityToast?.('Enter timer minutes first.');
          return;
        }
        patchActive(
          {
            timerEndsAt: Date.now() + minutes * 60000,
            timerNotified: false
          },
          { hydrate:false, refreshList:true }
        );
        refreshTimer();
        return;
      }

      if (e.target.closest('[data-clear-timer]')) {
        flushAutosave();
        patchActive(
          { timerEndsAt:0, timerNotified:false },
          { hydrate:false, refreshList:true }
        );
        root.querySelector('[data-note-timer-minutes]').value = '';
        refreshTimer();
        return;
      }

      if (e.target.closest('[data-delete-note]')) {
        clearTimeout(autosaveTimer);
        let notes = load().filter(n => n.id !== activeId);
        if (!notes.length) notes = [newNote()];
        activeId = notes[0].id;
        saveAll(notes);
        renderFull();
        return;
      }
    });

    tickTimer = window.setInterval(() => {
      if (root?.classList.contains('is-open')) {
        refreshTimer();
      }
    }, 1000);
  }

  function open() {
    if (!root) build();
    renderFull();
    root.classList.add('is-open');
  }

  checkDue();
  reminderTimer = window.setInterval(checkDue, 15000);

  window.addEventListener('focus', checkDue);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkDue();
    else if (root?.classList.contains('is-open')) flushAutosave();
  });

  window.addEventListener('pagehide', () => {
    if (root?.classList.contains('is-open')) flushAutosave();
  });

  window.ERASStickyNotes = { open, checkDue };
})();
