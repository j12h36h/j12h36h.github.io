// Shared E.R.A.S. / LCS credit wallet surface.
// The wallet is keyed by the same random publicProfileId used across the site.
export const CREDIT_COLLECTION = 'creditWallets';

const FOUNDER_RECOVERY_URL = '/assets/js/founder-status-recovery.js?v=20260903-founder-status-v2';
const founderRecoveryRuns = new Set();

function isLcsSurface() {
  return typeof location !== 'undefined'
    && /^\/(?:logicalcommunicationservice|lcs-mobile)(?:\/|$)/.test(location.pathname);
}

function startFounderRecovery(db, fs, profileId) {
  if (!isLcsSurface() || !db || !fs || !profileId || founderRecoveryRuns.has(profileId)) return;
  founderRecoveryRuns.add(profileId);

  // Founder recovery is deliberately optional and isolated. A failure here can
  // never stop the wallet, authentication, LCS startup, or Desktop startup.
  import(FOUNDER_RECOVERY_URL)
    .then(module => module.recoverFounderStatus?.(db, fs, profileId, { reloadAfterVerify: true }))
    .catch(error => console.debug('Optional Founder recovery unavailable', error));
}

export function formatCredits(value) {
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  return amount.toLocaleString();
}

export async function ensureCreditWallet(db, fs, profileId) {
  if (!db || !fs || !profileId) return null;
  const ref = fs.doc(db, CREDIT_COLLECTION, profileId);
  const createPayload = () => ({
    profileId,
    balance: 0,
    totalEarned: 0,
    totalLost: 0,
    lastEventId: '',
    lastEventType: 'init',
    createdAt: fs.serverTimestamp(),
    updatedAt: fs.serverTimestamp()
  });
  if (typeof fs.runTransaction === 'function') {
    await fs.runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) tx.set(ref, createPayload());
    });
    return ref;
  }
  const snap = await fs.getDoc(ref);
  if (!snap.exists()) await fs.setDoc(ref, createPayload());
  return ref;
}

export function watchCreditWallet(db, fs, profileId, callback, onError = console.error) {
  if (!db || !fs || !profileId) {
    callback?.(0, null);
    return () => {};
  }

  // LCS is the same web application in a normal browser and in E.R.A.S.
  // Desktop (?erasDesktop=1), so this repairs both surfaces from the exact
  // authenticated Firestore context already owned by LCS.
  startFounderRecovery(db, fs, profileId);

  let unsub = () => {};
  let cancelled = false;
  ensureCreditWallet(db, fs, profileId).then(ref => {
    if (cancelled || !ref) return;
    unsub = fs.onSnapshot(ref, snap => {
      const data = snap.exists() ? snap.data() : null;
      callback?.(Math.max(0, Math.floor(Number(data?.balance) || 0)), data);
    }, onError);
  }).catch(onError);
  return () => { cancelled = true; try { unsub(); } catch (_) {} };
}
