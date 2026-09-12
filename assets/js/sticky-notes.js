(() => {
  if (window.ERASStickyNotes) return;

  const KEY = 'eras_sticky_notes_v1';
  const COLORS = ['#ffd66b','#7ed7ff','#8ee6a7','#ff91ad','#c7a0ff','#ffb36b'];
  let root = null, activeId = '', reminderTimer = 0, tickTimer = 0;

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  };
  const saveAll = notes => {
    try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch {}
  };
  const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function newNote() {
    return {
      id: uid(), title: 'New note', text: '', color: COLORS[0],
      reminderAt: 0, timerEndsAt: 0, reminderNotified: false, timerNotified: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function ensureNotes() {
    let notes = load();
    if (!notes.length) { notes = [newNote()]; saveAll(notes); }
    if (!activeId || !notes.some(n => n.id === activeId)) activeId = notes[0].id;
    return notes;
  }

  function fmtWhen(ms) {
    if (!ms) return 'NONE';
    return new Date(ms).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function countdown(ms) {
    if (!ms) return 'NO TIMER';
    const left = ms - Date.now();
    if (left <= 0) return 'TIMER COMPLETE';
    const s = Math.floor(left/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
    return h ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
  }

  function notification(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, tag: `eras-note-${title}` });
      }
    } catch {}
    if (window.ERASUtilityToast) window.ERASUtilityToast(`${title}: ${body}`);
  }

  function checkDue() {
    const notes = load();
    let changed = false;
    const now = Date.now();
    notes.forEach(note => {
      if (note.reminderAt && now >= note.reminderAt && !note.reminderNotified) {
        note.reminderNotified = true; changed = true;
        notification('E.R.A.S. Note Reminder', note.title || note.text.slice(0,80) || 'Sticky note reminder');
      }
      if (note.timerEndsAt && now >= note.timerEndsAt && !note.timerNotified) {
        note.timerNotified = true; changed = true;
        notification('E.R.A.S. Note Timer', note.title || 'Sticky note timer finished');
      }
    });
    if (changed) saveAll(notes);
    if (root?.classList.contains('is-open')) render();
  }

  function render() {
    if (!root) return;
    const notes = ensureNotes();
    const active = notes.find(n=>n.id===activeId) || notes[0];

    const list = root.querySelector('[data-note-list]');
    list.innerHTML = notes
      .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))
      .map(note => `<button type="button" class="eras-note-card ${note.id===active.id?'is-active':''}" style="--note:${esc(note.color)}" data-note-id="${esc(note.id)}">
        <b>${esc(note.title || 'Untitled note')}</b>
        <small>${esc((note.text || '').replace(/\s+/g,' ').slice(0,70) || fmtWhen(note.reminderAt))}</small>
      </button>`).join('');

    root.querySelector('[data-note-title]').value = active.title || '';
    root.querySelector('[data-note-text]').value = active.text || '';
    root.querySelector('[data-note-reminder]').value = active.reminderAt ? new Date(active.reminderAt - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
    root.querySelector('[data-note-timer-readout]').textContent = countdown(active.timerEndsAt);
    root.querySelectorAll('[data-note-color]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.noteColor === active.color));
  }

  function updateActive(patch) {
    const notes = ensureNotes();
    const note = notes.find(n=>n.id===activeId); if (!note) return;
    Object.assign(note, patch, {updatedAt:Date.now()});
    saveAll(notes); render();
  }

  function build() {
    root = document.createElement('div');
    root.className = 'eras-utility-backdrop';
    root.innerHTML = `<section class="eras-utility-window" role="dialog" aria-modal="true" aria-label="Sticky notes">
      <header class="eras-utility-head"><div><b>NOTES</b><small>PRIVATE TO THIS BROWSER // OPEN ONLY FROM THE UTILITY HUB</small></div><button class="eras-utility-close" type="button" data-close>×</button></header>
      <div class="eras-utility-body eras-notes-layout">
        <aside class="eras-notes-list">
          <div class="eras-notes-list-head"><button class="eras-utility-button is-primary" type="button" data-new-note>+ NOTE</button><button class="eras-utility-button" type="button" data-notify>NOTIFY</button></div>
          <div class="eras-note-list-items" data-note-list></div>
        </aside>
        <main class="eras-note-editor">
          <label class="eras-utility-field"><span>TITLE</span><input data-note-title maxlength="120"></label>
          <label class="eras-utility-field"><span>NOTE</span><textarea data-note-text maxlength="8000"></textarea></label>
          <div class="eras-note-colors">${COLORS.map(c=>`<button type="button" class="eras-note-color" style="--note-color:${c}" data-note-color="${c}" aria-label="Set note color"></button>`).join('')}</div>
          <div class="eras-note-grid">
            <label class="eras-utility-field"><span>REMINDER</span><input type="datetime-local" data-note-reminder></label>
            <label class="eras-utility-field"><span>TIMER MINUTES</span><input type="number" min="0" max="100000" step="1" placeholder="15" data-note-timer-minutes></label>
          </div>
          <div class="eras-note-timer" data-note-timer-readout>NO TIMER</div>
          <div class="eras-note-actions">
            <button class="eras-utility-button is-primary" type="button" data-save-note>SAVE</button>
            <button class="eras-utility-button" type="button" data-start-timer>START TIMER</button>
            <button class="eras-utility-button" type="button" data-clear-timer>CLEAR TIMER</button>
            <button class="eras-utility-button is-danger" type="button" data-delete-note>DELETE</button>
          </div>
          <div class="eras-note-notice">Reminders use browser/system notifications when permitted while E.R.A.S. is running. Overdue reminders are also checked the next time E.R.A.S. opens.</div>
        </main>
      </div>
    </section>`;
    document.body.appendChild(root);

    const close = () => root.classList.remove('is-open');
    root.querySelector('[data-close]').addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target === root) close(); });

    root.addEventListener('click', async e => {
      const item=e.target.closest('[data-note-id]'); if(item){activeId=item.dataset.noteId;render();return;}
      if(e.target.closest('[data-new-note]')){const notes=load();const note=newNote();notes.unshift(note);saveAll(notes);activeId=note.id;render();return;}
      if(e.target.closest('[data-note-color]')){updateActive({color:e.target.closest('[data-note-color]').dataset.noteColor});return;}
      if(e.target.closest('[data-notify]')){
        if(!('Notification' in window)){ window.ERASUtilityToast?.('Notifications are not supported by this browser.'); return; }
        const permission=await Notification.requestPermission();
        window.ERASUtilityToast?.(permission==='granted'?'Note notifications enabled.':'Note notifications were not enabled.');
        return;
      }
      if(e.target.closest('[data-save-note]')){
        const reminderRaw=root.querySelector('[data-note-reminder]').value;
        const reminderAt=reminderRaw ? new Date(reminderRaw).getTime() : 0;
        updateActive({
          title:root.querySelector('[data-note-title]').value.trim().slice(0,120)||'Untitled note',
          text:root.querySelector('[data-note-text]').value.slice(0,8000),
          reminderAt:Number.isFinite(reminderAt)?reminderAt:0,
          reminderNotified:false
        });
        window.ERASUtilityToast?.('Note saved.');
        return;
      }
      if(e.target.closest('[data-start-timer]')){
        const minutes=Math.max(0,Number(root.querySelector('[data-note-timer-minutes]').value)||0);
        if(!minutes){window.ERASUtilityToast?.('Enter timer minutes first.');return;}
        updateActive({timerEndsAt:Date.now()+minutes*60000,timerNotified:false});return;
      }
      if(e.target.closest('[data-clear-timer]')){updateActive({timerEndsAt:0,timerNotified:false});return;}
      if(e.target.closest('[data-delete-note]')){
        let notes=load().filter(n=>n.id!==activeId);
        if(!notes.length) notes=[newNote()];
        activeId=notes[0].id;saveAll(notes);render();return;
      }
    });

    tickTimer = window.setInterval(() => {
      if(root?.classList.contains('is-open')) {
        const note=load().find(n=>n.id===activeId);
        const el=root.querySelector('[data-note-timer-readout]');
        if(el&&note)el.textContent=countdown(note.timerEndsAt);
      }
    },1000);
  }

  function open() {
    if(!root) build();
    render();
    root.classList.add('is-open');
  }

  checkDue();
  reminderTimer = window.setInterval(checkDue,15000);
  window.addEventListener('focus',checkDue);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkDue();});

  window.ERASStickyNotes={open,checkDue};
})();
