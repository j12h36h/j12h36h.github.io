// E.R.A.S. Founder status recovery
// Shared by the normal LCS website and the ?erasDesktop=1 embedded Desktop view.
//
// Security model:
// - Never trusts a public Founder badge.
// - Proves root Founder authority by performing the Firestore founderProbe get.
//   Firestore rules allow that get only when privateAccounts/<uid>.publicProfileId
//   matches systemPrivate/founder.profileId.
// - Only then repairs the canonical public Founder Status document if it is missing.
// - Does not grant moderation authority client-side; normal Firestore rules and
//   getModerationCapabilities remain the authority for privileged operations.

const RECOVERY_VERSION = '20260903-founder-status-v2';
const RELOAD_KEY = `eras:${RECOVERY_VERSION}:verified-reload`;
const RETRY_KEY = `eras:${RECOVERY_VERSION}:retry-count`;
const MAX_RETRIES = 4;

function isLcsSurface() {
  return /^\/(?:logicalcommunicationservice|lcs-mobile)(?:\/|$)/.test(location.pathname);
}

function canonicalFounderStatusId(profileId) {
  return ['global', '_', 'founder', profileId]
    .map(value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '_'))
    .join('__')
    .slice(0, 1400);
}

function isActiveFounderRow(data) {
  if (!data || data.active !== true) return false;
  if (data.status !== 'founder' || data.scopeType !== 'global' || data.scopeId !== '_') return false;
  const expires = data.expiresAt?.toMillis?.();
  return expires == null || expires > Date.now();
}

function canUseHelpers(fs) {
  return Boolean(
    fs &&
    typeof fs.doc === 'function' &&
    typeof fs.getDoc === 'function' &&
    typeof fs.setDoc === 'function' &&
    typeof fs.serverTimestamp === 'function'
  );
}

function scheduleRetry(db, fs, profileId, error) {
  if (!isLcsSurface()) return;
  const code = String(error?.code || '');
  // Explicit permission-denied means this profile is not the configured root Founder.
  // Never retry or synthesize Founder state in that case.
  if (code === 'permission-denied') return;

  let count = 0;
  try { count = Number(sessionStorage.getItem(RETRY_KEY) || 0); } catch (_) {}
  if (!Number.isFinite(count) || count >= MAX_RETRIES) return;
  count += 1;
  try { sessionStorage.setItem(RETRY_KEY, String(count)); } catch (_) {}

  setTimeout(() => {
    recoverFounderStatus(db, fs, profileId, { reloadAfterVerify: true }).catch(() => {});
  }, 1200 * count);
}

function requestOneCleanReload() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return false;
    sessionStorage.setItem(RELOAD_KEY, '1');
  } catch (_) {
    return false;
  }

  // Let Firestore's status snapshot settle before the clean reload. This works
  // the same in the normal browser and E.R.A.S. Desktop's embedded web view.
  setTimeout(() => location.reload(), 180);
  return true;
}

export async function recoverFounderStatus(db, fs, profileId, options = {}) {
  if (!isLcsSurface() || !db || !canUseHelpers(fs) || !profileId) {
    return { verified: false, repaired: false, reason: 'not-applicable' };
  }

  try {
    // The document intentionally does not need to exist. Permission to perform
    // this get is the proof of Founder identity.
    await fs.getDoc(fs.doc(db, 'systemAuthority', 'founderProbe'));

    const assignmentId = canonicalFounderStatusId(profileId);
    const assignmentRef = fs.doc(db, 'statusAssignments', assignmentId);
    const existing = await fs.getDoc(assignmentRef);
    let repaired = false;

    if (!existing.exists()) {
      await fs.setDoc(assignmentRef, {
        profileId,
        status: 'founder',
        scopeType: 'global',
        scopeId: '_',
        visibility: 'public',
        active: true,
        expiresAt: null,
        reason: '',
        grantedByProfileId: profileId,
        createdAt: fs.serverTimestamp(),
        updatedAt: fs.serverTimestamp(),
        revokedAt: null,
        revokedByProfileId: '',
        lastActionId: 'bootstrap'
      });
      repaired = true;
    } else if (!isActiveFounderRow(existing.data())) {
      // Do not attempt to rewrite an unexpected existing Founder assignment.
      // Existing-document changes have stricter moderation-log requirements.
      console.warn('E.R.A.S. Founder authority verified, but the canonical Founder Status row is not active.');
    }

    try {
      sessionStorage.removeItem(RETRY_KEY);
      sessionStorage.setItem(`eras:${RECOVERY_VERSION}:verified`, '1');
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('eras-founder-status-verified', {
      detail: { profileId, repaired }
    }));

    if (options.reloadAfterVerify !== false) requestOneCleanReload();

    return {
      verified: true,
      repaired,
      assignmentId,
      active: existing.exists() ? isActiveFounderRow(existing.data()) : true
    };
  } catch (error) {
    scheduleRetry(db, fs, profileId, error);
    return {
      verified: false,
      repaired: false,
      reason: String(error?.code || error?.message || 'founder-probe-failed')
    };
  }
}
