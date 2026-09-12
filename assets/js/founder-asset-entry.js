import { watchIdentity } from '/game/assets/js/eras-data.js?v=1.7.3';
import { getApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getFunctions,
  httpsCallable
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js';

const button = document.querySelector('#founderAssetUploadButton');
if (button) {
  button.hidden = true;
  const functions = getFunctions(getApp('site-account'));
  const accessCall = httpsCallable(functions, 'getFounderAssetUploadAccess');

  watchIdentity(async identity => {
    button.hidden = true;
    if (!identity?.user) return;

    try {
      const response = await accessCall({});
      button.hidden = response.data?.founder !== true;
    } catch (_) {
      button.hidden = true;
    }
  });
}
