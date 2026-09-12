(() => {
  const root = document.querySelector('#universeDashboard');
  if (!root) return;

  const friendActivitySource = root.querySelector('[data-friend-activity]');
  const alertSource = root.querySelector('[data-alerts-list]');
  const combined = root.querySelector('[data-combined-activity]');
  const combinedCount = root.querySelector('[data-combined-activity-count]');

  if (!friendActivitySource || !alertSource || !combined || !combinedCount) return;

  const relativeAge = (text = '') => {
    const value = String(text).trim().toUpperCase();
    if (!value || value === 'NOW') return 0;
    let match = value.match(/^(\d+)(M|H|D)$/);
    if (match) {
      const n = Number(match[1]);
      return n * ({ M: 60e3, H: 3600e3, D: 86400e3 }[match[2]] || 1);
    }
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return Math.max(0, Date.now() - parsed);
    return Number.MAX_SAFE_INTEGER;
  };

  const rowsFrom = (source, kind) =>
    [...source.querySelectorAll('a')].map((node, index) => {
      const time = node.querySelector('time')?.textContent || '';
      return {
        node,
        kind,
        index,
        age: relativeAge(time)
      };
    });

  let queued = false;
  const render = () => {
    queued = false;

    const personal = rowsFrom(alertSource, 'personal');
    const social = rowsFrom(friendActivitySource, 'social');
    const rows = [...personal, ...social]
      .sort((a, b) => (a.age - b.age) || (a.kind === 'personal' ? -1 : 1) || (a.index - b.index))
      .slice(0, 28);

    combinedCount.textContent = String(rows.length);

    if (!rows.length) {
      const signedOut =
        alertSource.textContent.includes('SIGN IN') ||
        friendActivitySource.textContent.includes('SIGN IN');

      combined.innerHTML = `<p class="udp-empty">${
        signedOut ? 'SIGN IN TO LOAD NETWORK ACTIVITY.' : 'NO RECENT ACTIVITY. NETWORK CLEAR.'
      }</p>`;
      return;
    }

    combined.replaceChildren(...rows.map(({ node, kind }) => {
      const clone = node.cloneNode(true);
      clone.classList.add('combined-activity-row');
      clone.dataset.activityKind = kind;

      if (kind === 'personal') clone.classList.add('is-urgent');
      return clone;
    }));
  };

  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(friendActivitySource, { childList: true, subtree: true, characterData: true });
  observer.observe(alertSource, { childList: true, subtree: true, characterData: true });

  render();
})();
