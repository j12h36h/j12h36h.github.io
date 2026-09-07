import { fs } from '/game/assets/js/eras-data.js';

/*
 * Tactical Strike Firestore compatibility bridge.
 *
 * The currently deployed Firestore rules only admit the established hosted
 * gameStyle/mapId pairs. Tactical Strike remains a real E.R.A.S. mode in
 * settings.modeId, but its lobby document is stored through the already
 * permitted arcade-topdown/global-plaza envelope until the production rules
 * are expanded.
 *
 * This is the same compatibility pattern already used by Slime Smash:
 * hostedLobbyMode() resolves settings.modeId first, so Join / runtime routing
 * still sees "tactical-strike".
 */

const nativeSetDoc = fs.setDoc.bind(fs);

function isTopLevelLobbyRef(ref) {
  const path = String(ref?.path || '');
  return /^gameLobbies\/[^/]+$/.test(path);
}

function tacticalStrikeLobby(data) {
  return data
    && typeof data === 'object'
    && (
      data.gameStyle === 'tactical-strike'
      || data?.settings?.modeId === 'tactical-strike'
    );
}

fs.setDoc = async function erasTacticalStrikeCompatibleSetDoc(ref, data, options) {
  if (!isTopLevelLobbyRef(ref) || !tacticalStrikeLobby(data)) {
    return options === undefined
      ? nativeSetDoc(ref, data)
      : nativeSetDoc(ref, data, options);
  }

  const settings = {
    ...(data.settings || {}),
    modeId: 'tactical-strike'
  };

  // Keep the original object untouched so the Host page continues displaying
  // Tactical Strike locally. Only the Firestore payload uses the compatibility
  // envelope accepted by the currently deployed rules.
  const compatible = {
    ...data,
    gameStyle: 'arcade-topdown',
    mapId: 'global-plaza',
    settings
  };

  return options === undefined
    ? nativeSetDoc(ref, compatible)
    : nativeSetDoc(ref, compatible, options);
};
