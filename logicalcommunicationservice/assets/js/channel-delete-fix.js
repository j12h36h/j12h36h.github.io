/*
 * LCS community channel deletion repair.
 *
 * Purpose:
 * The current app.js delete flow still refreshes legacy community UI names after
 * the server call. This capture-phase handler owns channel-delete clicks before
 * app.js sees them, calls the existing server-authoritative manageCommunity
 * function directly, and reloads LCS after success so the soft-deleted channel
 * disappears from every cached view.
 *
 * No Firestore rules are bypassed or changed. Channel administration remains
 * server-authoritative through the existing Cloud Function.
 */

const FIREBASE_VERSION = '12.18.0';

function showMessage(message, error = false) {
  const region = document.querySelector('#toastRegion');
  if (region) {
    const el = document.createElement('div');
    el.className = 'toast';
    if (error) el.dataset.tone = 'error';
    el.textContent = message;
    region.appendChild(el);
    setTimeout(() => el.remove(), error ? 7000 : 3600);
    return;
  }
  if (error) alert(message);
  else console.info('[LCS channel delete]', message);
}

function readableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');

  if (code.includes('not-found') || /not found/i.test(message)) {
    return 'The LCS manageCommunity backend function is not deployed. Run logicalcommunicationservice/DEPLOY_BACKEND.bat once, then try again.';
  }
  if (code.includes('unauthenticated')) {
    return 'Your Firebase session is not authenticated. Sign out, sign back in, and try again.';
  }
  if (code.includes('permission-denied')) {
    return 'Firebase denied channel deletion. Only the community owner, Founder, or an authorized community moderator can delete this channel.';
  }
  if (code.includes('failed-precondition')) {
    if (/at least one channel/i.test(message)) {
      return 'A community must keep at least one channel.';
    }
    return message || 'The channel cannot be deleted in its current state.';
  }
  if (code.includes('unavailable') || /network|offline/i.test(message)) {
    return 'Firebase is temporarily unreachable. Check the connection and try again.';
  }
  return message ? `Channel deletion failed: ${message}` : 'Channel deletion failed for an unknown reason.';
}

async function firebaseServices() {
  const [appMod, firestoreMod, functionsMod] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-functions.js`)
  ]);

  const apps = appMod.getApps();
  if (!apps.length) throw new Error('Firebase is still connecting. Wait a moment and try again.');

  const app = apps[0];
  return {
    app,
    firestoreMod,
    functionsMod,
    db: firestoreMod.getFirestore(app),
    functions: functionsMod.getFunctions(app)
  };
}

async function deleteChannel(button) {
  const channelId = String(button.dataset.channelDelete || '').trim();
  if (!channelId) return;

  if (button.dataset.deletePending === '1') return;

  const oldText = button.textContent;
  button.dataset.deletePending = '1';
  button.disabled = true;

  try {
    const { db, firestoreMod, functions, functionsMod } = await firebaseServices();

    // Read the authoritative public channel document instead of depending on
    // app.js's in-memory state.
    const channelRef = firestoreMod.doc(db, 'publicChannels', channelId);
    const channelSnap = await firestoreMod.getDoc(channelRef);

    if (!channelSnap.exists()) {
      throw Object.assign(new Error('Channel not found.'), { code: 'not-found' });
    }

    const channel = channelSnap.data() || {};
    const spaceId = String(channel.spaceId || '').trim();
    const name = String(channel.name || 'channel');

    if (!spaceId) throw new Error('The channel has no community association.');
    if (channel.deleted === true) {
      button.closest('[data-channel-edit]')?.remove();
      showMessage('Channel was already deleted.');
      setTimeout(() => location.reload(), 250);
      return;
    }

    const accepted = window.confirm(
      `Delete #${name}?\n\nExisting posts remain retained, but the channel will stop accepting new content.`
    );
    if (!accepted) return;

    button.textContent = 'Deleting…';

    const callable = functionsMod.httpsCallable(functions, 'manageCommunity');
    const result = await callable({
      action: 'delete_channel',
      spaceId,
      channelId
    });

    if (result?.data?.ok !== true) {
      throw new Error('The server did not confirm channel deletion.');
    }

    // Remove it immediately from the currently-open manager so success is visible
    // even before the Firestore listener converges.
    const row = button.closest('[data-channel-edit]');
    if (row) row.remove();

    showMessage('Channel deleted. Existing content was retained.');

    // app.js currently keeps its own private state and legacy dialog refresh path.
    // A short reload is the cleanest way to guarantee every channel selector,
    // feed filter and manager panel uses the new server state.
    setTimeout(() => location.reload(), 500);
  } catch (error) {
    console.error('[LCS] channel delete repair failed', error);
    showMessage(readableError(error), true);
  } finally {
    button.dataset.deletePending = '0';
    button.disabled = false;
    button.textContent = oldText;
  }
}

// Capture phase is intentional: app.js owns a document-level bubble handler for
// the same data-channel-delete button. Stopping here prevents the broken legacy
// handler from running a second time.
document.addEventListener('click', event => {
  const target = event.target instanceof Element
    ? event.target.closest('[data-channel-delete]')
    : null;
  if (!target) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  deleteChannel(target);
}, true);
