// Optional E.R.A.S. LCS JSON-icon bridge.
//
// This bridge is intentionally VISUAL ONLY. It must never initialize Firebase,
// intercept account/editor events, alter authentication, or participate in
// Founder / Moderator authority. The website and Desktop share the LCS page,
// so keeping this module isolated prevents icon rendering from affecting status.

import {
  erasIconSvg,
  profileIconSpec
} from '/assets/js/eras-icon-renderer.js';

export function upgradeLcsAvatarElement(element, profile) {
  if (!element || !profile?.avatarJson) return false;
  try {
    element.innerHTML = erasIconSvg(profileIconSpec(profile));
    element.dataset.erasAnimatedProfile = String(profile.id || profile.profileId || '1');
    return true;
  } catch (error) {
    console.debug('Optional animated LCS avatar skipped', error);
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.ERAS_LCS_ICONS = Object.freeze({
    upgradeAvatar: upgradeLcsAvatarElement
  });
}
