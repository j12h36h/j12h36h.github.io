import { ACCOUNT_CONFIG } from '/account/assets/js/config.js';
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
  serverTimestamp,
  limit
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const APP_NAME = 'site-account';
const app = getApps().some(item => item.name === APP_NAME)
  ? getApp(APP_NAME)
  : initializeApp(ACCOUNT_CONFIG.firebase, APP_NAME);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const fs = {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  onSnapshot, getDocs, serverTimestamp, limit
};

try { await setPersistence(auth, browserLocalPersistence); } catch (_) {}

const AVATAR_FONTS = ['Arial','Verdana','Georgia','Courier New','Trebuchet MS','Times New Roman','system-ui','monospace','sans-serif','serif'];
const AVATAR_WEIGHTS = [400,700,900];
const AVATAR_ALIGNS = ['start','middle','end'];

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function initials(name='Member') {
  return String(name).trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase() || 'M';
}

function generatedName(id='') {
  return `Member-${String(id).replace(/[^a-z0-9]/gi,'').slice(0,6).toUpperCase() || 'NEW'}`;
}

function normalizeHex(value, label='color') {
  const v = String(value || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${label} must be a six-digit hex color.`);
  return v.toLowerCase();
}

function defaultAvatar(profile=null) {
  return {
    version: 1,
    background: '#34264c',
    layers: [{
      char: initials(profile?.displayName || 'Member'), x: 64, y: 66, fontSize: 42,
      color: '#ffffff', fontFamily: 'Arial', fontWeight: 900, rotation: 0,
      scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1, align: 'middle'
    }]
  };
}

function validateAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid avatar root.');
  if (input.version !== 1) throw new Error('Invalid avatar version.');
  const background = normalizeHex(input.background, 'background');
  if (!Array.isArray(input.layers) || input.layers.length < 1 || input.layers.length > 96) throw new Error('Invalid avatar layers.');
  const layers = input.layers.map((raw, i) => {
    const text = String(raw?.char ?? '').normalize('NFC');
    if (!text) throw new Error(`Layer ${i+1} is invalid.`);
    const num = (key, min, max, fallback) => {
      const value = raw[key] ?? fallback;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}.`);
      return value;
    };
    const fontFamily = String(raw.fontFamily ?? 'Arial');
    const fontWeight = Number(raw.fontWeight ?? 700);
    const align = String(raw.align ?? 'middle');
    if (!AVATAR_FONTS.includes(fontFamily) || !AVATAR_WEIGHTS.includes(fontWeight) || !AVATAR_ALIGNS.includes(align)) throw new Error('Invalid avatar typography.');
    return {
      char: text,
      x: num('x', -64, 192, 64), y: num('y', -64, 192, 64), fontSize: num('fontSize', 4, 192, 42),
      color: normalizeHex(raw.color ?? '#ffffff'), fontFamily, fontWeight,
      rotation: num('rotation', -360, 360, 0), scaleX: num('scaleX', -4, 4, 1), scaleY: num('scaleY', -4, 4, 1),
      skewX: num('skewX', -75, 75, 0), skewY: num('skewY', -75, 75, 0), opacity: num('opacity', 0, 1, 1), align
    };
  });
  return { version: 1, background, layers };
}

export function avatarSpec(profile) {
  try { return profile?.avatarJson ? validateAvatar(JSON.parse(profile.avatarJson)) : defaultAvatar(profile); }
  catch (_) { return defaultAvatar(profile); }
}

export function avatarSvg(profile) {
  const safe = avatarSpec(profile);
  const layers = safe.layers.map(layer =>
    `<g transform="translate(${layer.x} ${layer.y}) rotate(${layer.rotation}) skewX(${layer.skewX}) skewY(${layer.skewY}) scale(${layer.scaleX} ${layer.scaleY})"><text x="0" y="0" fill="${layer.color}" font-family="${escapeHtml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" opacity="${layer.opacity}" text-anchor="${layer.align}" dominant-baseline="middle">${escapeHtml(layer.char)}</text></g>`
  ).join('');
  return `<svg viewBox="0 0 128 128" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" fill="${safe.background}"/>${layers}</svg>`;
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
