import { auth, db, fs, ensureIdentity } from '/game/assets/js/eras-data.js';
import { ensureCreditWallet } from '/assets/js/credit-system.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

// Escape Pod Dash purchase compatibility layer.
// The core runtime historically modeled pod skins as custom Mode variants.
// This bridge makes those purchases reliable without changing gameplay state:
//   1) wait for/repair the shared E.R.A.S. identity,
//   2) ensure the shared Credit wallet exists,
//   3) refresh the Firebase Auth token before calling Functions,
//   4) retry once if the callable reports an auth/session transport failure,
//   5) confirm the resulting holding from the server, then reload the picker.

const ASSET_ID = 'eras:mode_escape_pod_dash';
const PODS = Object.freeze({
  comet:   Object.freeze({ name:'COMET POD',   customRule:'Comet Pod',   legacyStorage:'mode|custom_rule=comet_pod' }),
  aurora:  Object.freeze({ name:'AURORA POD',  customRule:'Aurora Pod',  legacyStorage:'mode|custom_rule=aurora_pod' }),
  bulwark: Object.freeze({ name:'BULWARK POD', customRule:'Bulwark Pod', legacyStorage:'mode|custom_rule=bulwark_pod' }),
  nova:    Object.freeze({ name:'NOVA POD',    customRule:'Nova Pod',    legacyStorage:'mode|custom_rule=nova_pod' })
});

const functions = getFunctions(getApp('site-account'));
const acquireAssetVariant = httpsCallable(functions, 'acquireAssetVariant');
let busy = false;

function feedback(message, tone='') {
  const el = document.getElementById('gameFeedback');
  if (!el) return;
  el.textContent = String(message || '').toUpperCase();
  el.dataset.tone = tone;
}

function readableError(error) {
  const code = String(error?.code || '').replace(/^functions\//,'');
  const message = String(error?.message || '').replace(/^Firebase:\s*/i,'').trim();
  if (code === 'failed-precondition' && /not enough credits/i.test(message)) return 'NOT ENOUGH CREDITS FOR THIS POD.';
  if (code === 'unauthenticated') return 'YOUR SIGN-IN SESSION EXPIRED. SIGN IN AGAIN AND RETRY.';
  if (code === 'not-found') return 'ASSET PURCHASE SERVICE IS NOT DEPLOYED.';
  return message || code || 'POD PURCHASE FAILED.';
}

function retriable(error) {
  const code = String(error?.code || '');
  return code === 'functions/unauthenticated' ||
    code === 'functions/unavailable' ||
    code === 'functions/internal' ||
    code === 'functions/deadline-exceeded';
}

async function callPurchase(user, podId, pod) {
  // Send both the current podSkin hint and the legacy Mode custom-rule payload.
  // Existing deployed functions ignore podSkin and use rule/customRule; newer
  // handlers may consume podSkin directly without breaking this client.
  const payload = {
    assetId: ASSET_ID,
    variant: {
      podSkin: podId,
      rule: '__custom__',
      customRule: pod.customRule
    }
  };

  try {
    return (await acquireAssetVariant(payload)).data;
  } catch (error) {
    if (!retriable(error)) throw error;
    await user.getIdToken(true);
    return (await acquireAssetVariant(payload)).data;
  }
}

async function verifyHolding(profileId, podId, pod, holdingId='') {
  try {
    if (holdingId) {
      const direct = await fs.getDoc(fs.doc(db, 'assetHoldings', holdingId));
      if (direct.exists()) {
        const h = direct.data();
        if (h.ownerProfileId === profileId && h.assetId === ASSET_ID && h.archived !== true) return true;
      }
    }

    const q = fs.query(
      fs.collection(db, 'assetHoldings'),
      fs.where('ownerProfileId', '==', profileId),
      fs.limit(500)
    );
    const snap = typeof fs.getDocsFromServer === 'function' ? await fs.getDocsFromServer(q) : await fs.getDocs(q);
    const accepted = new Set([
      pod.legacyStorage,
      `mode|pod_skin=${podId}`,
      `pod|skin=${podId}`
    ]);
    return snap.docs.some(d => {
      const h = d.data();
      return h.assetId === ASSET_ID && h.archived !== true && accepted.has(String(h.tint || ''));
    });
  } catch (error) {
    // The callable result is authoritative; a verification read must not turn
    // a successful purchase into a false client-side failure.
    console.debug('Escape pod purchase verification', error?.code || error);
    return null;
  }
}

async function buyPod(podId, button) {
  if (busy) return;
  const pod = PODS[podId];
  if (!pod) return;

  const user = auth.currentUser;
  if (!user) {
    feedback('SIGN IN TO BUY POD SKINS.', 'error');
    return;
  }

  if (!confirm(`BUY ${pod.name}?\n\n1 E.R.A.S. CREDIT\n\nCOSMETIC ONLY // SAME HITBOX AND SPEED`)) return;

  busy = true;
  const oldText = button?.textContent || 'BUY 1 CREDIT';
  if (button) {
    button.disabled = true;
    button.textContent = 'PURCHASING…';
  }

  try {
    feedback(`PURCHASING ${pod.name}…`);
    await user.getIdToken(true);
    const identity = await ensureIdentity(user);
    if (!identity?.profileId) throw new Error('E.R.A.S. profile link is unavailable.');

    // A new player can reach Escape Pod Dash before any page has initialized
    // their wallet. The secure purchase function expects the wallet document.
    await ensureCreditWallet(db, fs, identity.profileId);

    const result = await callPurchase(user, podId, pod);
    if (!result?.ok) throw new Error('Asset purchase was not confirmed.');

    const verified = await verifyHolding(identity.profileId, podId, pod, result.holdingId);
    if (verified === false) throw new Error('Purchase completed but the pod holding could not be found. Reload and try once more.');

    feedback(`${pod.name} ADDED TO YOUR E.R.A.S. ASSETS.`, 'ok');
    // Reload so the private hosted-mode state re-reads holdings and immediately
    // exposes SELECT / LAUNCH using the normal runtime path.
    location.reload();
  } catch (error) {
    console.error('Escape pod purchase repair', error);
    feedback(readableError(error), 'error');
    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }
    busy = false;
  }
}

// Capture before hosted-mode.js's document-level bubble listener so only one
// purchase flow runs. Non-purchase controls are untouched.
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-buy-pod]');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  buyPod(String(button.dataset.buyPod || ''), button);
}, true);
