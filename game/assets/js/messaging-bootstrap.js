import { db, fs, watchIdentity, profileById, avatarSvg } from '/game/assets/js/eras-data.js?v=20260901-dm6';
import { createDirectMessenger } from '/assets/js/direct-messaging.js?v=20260901-dm6';

const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function initGameMessaging({ friendList = null, feedback = null } = {}) {
  let identity = null;
  let messenger = null;
  let friendshipUnsub = null;
  let friendIds = [];
  const feedbackEl = feedback ? document.querySelector(feedback) : null;
  const friendRoot = friendList ? document.querySelector(friendList) : null;
  const say = text => { if (feedbackEl) feedbackEl.textContent = String(text || '').toUpperCase(); };
  function updateChatBadges(count = 0) {
    const value = Math.max(0, Number(count) || 0);
    document.querySelectorAll('[data-eras-messages]').forEach(button => {
      let badge = button.querySelector('.chat-alert-badge');
      if (!badge) { badge = document.createElement('em'); badge.className = 'chat-alert-badge'; button.appendChild(badge); }
      badge.textContent = value > 99 ? '99+' : String(value);
      badge.hidden = value < 1;
      button.classList.toggle('has-chat-alerts', value > 0);
      button.setAttribute('aria-label', value ? `Chat, ${value} unread conversation${value === 1 ? '' : 's'}` : 'Chat');
    });
  }

  async function friendshipIdsOnce() {
    if (!identity?.profileId) return [];
    const q = fs.query(fs.collection(db, 'privateFriendships'), fs.where('members', 'array-contains', identity.profileId), fs.limit(250));
    const snap = await fs.getDocs(q);
    return [...new Set(snap.docs.flatMap(d => (d.data().members || []).filter(id => id && id !== identity.profileId)))];
  }

  function getMessenger() {
    if (!identity?.profileId) return null;
    if (!messenger) {
      messenger = createDirectMessenger({
        db,
        fs,
        getCurrentProfileId: () => identity?.profileId || '',
        getProfile: profileById,
        listContacts: friendshipIdsOnce,
        avatarMarkup: profile => avatarSvg(profile),
        onUnreadChange: count => updateChatBadges(count),
        onError: error => { console.error('E.R.A.S. game chat', error); say('Chat connection error'); }
      });
      messenger.startBackground?.();
    }
    return messenger;
  }

  async function renderFriends() {
    if (!friendRoot) return;
    if (!identity?.profileId) {
      friendRoot.innerHTML = '<article class="connection-card"><div class="connection-identity"><i aria-hidden="true"></i><strong>SIGN IN REQUIRED</strong></div><div class="connection-actions"><a href="/account/">ACCOUNT</a></div></article>';
      return;
    }
    if (!friendIds.length) {
      friendRoot.innerHTML = '<article class="connection-card"><div class="connection-identity"><i aria-hidden="true"></i><strong>NO ACCEPTED CONNECTIONS</strong></div><div class="connection-actions"><a href="/logicalcommunicationservice/#connections">LCS CONNECTIONS</a></div></article>';
      return;
    }
    const profiles = await Promise.all(friendIds.map(profileById));
    friendRoot.innerHTML = profiles.map((profile, index) => {
      const id = friendIds[index], name = profile?.displayName || `Member-${id.slice(0,6)}`;
      return `<article class="connection-card"><div class="connection-identity"><i aria-hidden="true"></i><strong>${escapeHtml(name)}</strong></div><div class="connection-actions"><button type="button" data-eras-dm-profile="${escapeHtml(id)}">CHAT</button><a href="/trade/?with=${encodeURIComponent(id)}">TRADE</a><a href="/logicalcommunicationservice/#connections">MANAGE</a></div></article>`;
    }).join('');
  }

  function stopFriendWatch() { try { friendshipUnsub?.(); } catch (_) {} friendshipUnsub = null; friendIds = []; }
  function startFriendWatch() {
    stopFriendWatch();
    if (!identity?.profileId) { renderFriends(); return; }
    const q = fs.query(fs.collection(db, 'privateFriendships'), fs.where('members', 'array-contains', identity.profileId), fs.limit(250));
    friendshipUnsub = fs.onSnapshot(q, snap => {
      friendIds = [...new Set(snap.docs.flatMap(d => (d.data().members || []).filter(id => id && id !== identity.profileId)))];
      renderFriends().catch(console.error);
      messenger?.refreshContacts?.();
    }, error => { console.error('friendships', error); say('Connection list unavailable'); });
  }

  document.addEventListener('click', event => {
    const launch = event.target.closest('[data-eras-messages]');
    if (launch) {
      event.preventDefault();
      const dm = getMessenger();
      if (!dm) { say('Sign in to use Chat'); return; }
      dm.openInbox();
      return;
    }
    const peer = event.target.closest('[data-eras-dm-profile]');
    if (peer) {
      event.preventDefault();
      const dm = getMessenger();
      if (!dm) { say('Sign in to use Chat'); return; }
      dm.openProfile(peer.dataset.erasDmProfile);
    }
  });

  const cancelIdentity = watchIdentity(next => {
    identity = next?.profileId ? next : null;
    messenger?.destroy?.(); messenger = null;
    startFriendWatch();
    if (identity) { say('Chat network ready'); getMessenger(); } else { say('Sign in for Chat'); updateChatBadges(0); }
    const username = document.querySelector('[data-eras-account-id]');
    const display = document.querySelector('[data-display-name]');
    if (username) username.value = identity?.profileId ? `LCS_${identity.profileId.slice(0,8).toUpperCase()}` : 'SIGNED_OUT';
    if (display && identity?.profile?.displayName) display.value = identity.profile.displayName;
  });

  return { destroy(){ stopFriendWatch(); messenger?.destroy?.(); cancelIdentity?.(); } };
}
