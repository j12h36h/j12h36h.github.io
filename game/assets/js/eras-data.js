import { ACCOUNT_CONFIG } from '/account/assets/js/config.js';
import {
  defaultErasIconSpec,
  profileIconSpec,
  erasIconSvg,
  validateErasIconSpec
} from '/assets/js/eras-icon-renderer.js';
import { initializeApp, getApp, getApps } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDocsFromServer,
  serverTimestamp,
  limit,
  orderBy,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const APP_NAME = 'site-account';
const app = getApps().some(item => item.name === APP_NAME)
  ? getApp(APP_NAME)
  : initializeApp(ACCOUNT_CONFIG.firebase, APP_NAME);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const fs = {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  onSnapshot, getDocs, getDocsFromServer, serverTimestamp, limit, orderBy, runTransaction
};

try { await setPersistence(auth, browserLocalPersistence); } catch (_) {}

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function generatedName(id='') {
  return `Member-${String(id).replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase() || 'NEW'}`;
}

export function validateAvatar(input) {
  return validateErasIconSpec(input);
}

export function defaultAvatar(profile=null) {
  return defaultErasIconSpec(profile?.displayName || 'Member');
}

export function avatarSpec(profile) {
  return profileIconSpec(profile);
}

export function avatarSvg(profile) {
  return erasIconSvg(avatarSpec(profile));
}

export async function profileById(profileId) {
  if (!profileId) return null;
  const snap = await getDoc(doc(db, 'publicProfiles', profileId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function ensureIdentity(user = auth.currentUser) {
  if (!user) return null;
  const accountRef = doc(db, 'privateAccounts', user.uid);
  let account = await getDoc(accountRef);
  let profileId = account.exists() ? account.data().publicProfileId : '';
  if (!profileId) {
    profileId = crypto.randomUUID();
    await setDoc(accountRef, { publicProfileId: profileId, securityVersion: 6, createdAt: serverTimestamp() });
  }
  const profileRef = doc(db, 'publicProfiles', profileId);
  let profile = await getDoc(profileRef);
  if (!profile.exists()) {
    await setDoc(profileRef, {
      displayName: generatedName(profileId), bio: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    profile = await getDoc(profileRef);
  }
  return { user, profileId, profile: { id: profile.id, ...profile.data() } };
}

export function watchIdentity(callback) {
  let cancelled = false;
  return onAuthStateChanged(auth, async user => {
    if (cancelled) return;
    if (!user) {
      callback({ user: null, profileId: '', profile: null });
      return;
    }
    try {
      const identity = await ensureIdentity(user);
      if (!cancelled) callback(identity);
    } catch (error) {
      console.error('E.R.A.S. identity restore', error);
      if (!cancelled) callback({ user, profileId: '', profile: null, error });
    }
  });
}

export function safeText(value='') { return escapeHtml(value); }
