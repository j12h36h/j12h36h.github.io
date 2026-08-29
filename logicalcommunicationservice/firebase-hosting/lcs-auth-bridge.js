import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, getRedirectResult, signInWithRedirect, browserSessionPersistence, setPersistence } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const FIREBASE_CONFIG={
  apiKey:'AIzaSyAyoCH-n3rgJ1TgLRa_qxoef9sibggFYOE',
  authDomain:'logicalcommunicationservice.firebaseapp.com',
  projectId:'logicalcommunicationservice',
  appId:'1:752872197816:web:d13177e2b26f757438ee4d'
};
const RETURN_URL='https://j12h36h.github.io/lcs-mobile/';
const NONCE_KEY='lcs_auth_bridge_nonce';
const STARTED_KEY='lcs_auth_bridge_started';
const $=s=>document.querySelector(s);

function base64UrlJson(value){
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function fail(error){
  console.error('LCS Firebase auth bridge',error);
  $('#spinner').hidden=true;
  $('#title').textContent='Google sign-in could not finish';
  $('#message').textContent=String(error?.message||error||'Unknown authentication error.');
  $('#retry').hidden=false;
}
async function start(){
  try{
    const query=new URLSearchParams(location.search);
    const incomingNonce=String(query.get('nonce')||'');
    if(incomingNonce)sessionStorage.setItem(NONCE_KEY,incomingNonce);
    const nonce=sessionStorage.getItem(NONCE_KEY)||'';
    if(!nonce)throw new Error('The LCS mobile sign-in request is missing its verification nonce. Return to LCS and retry.');

    const app=initializeApp(FIREBASE_CONFIG);
    const auth=getAuth(app);
    await setPersistence(auth,browserSessionPersistence);
    const result=await getRedirectResult(auth);
    if(result){
      const providerCredential=GoogleAuthProvider.credentialFromResult(result);
      const idToken=String(providerCredential?.idToken||'');
      const accessToken=String(providerCredential?.accessToken||'');
      if(!idToken&&!accessToken)throw new Error('Google completed sign-in but Firebase returned no provider credential.');
      sessionStorage.removeItem(STARTED_KEY);
      const payload=base64UrlJson({v:1,nonce,idToken,accessToken});
      location.replace(`${RETURN_URL}#lcs-auth=${encodeURIComponent(payload)}`);
      return;
    }

    const provider=new GoogleAuthProvider();
    provider.setCustomParameters({prompt:'select_account'});
    sessionStorage.setItem(STARTED_KEY,'1');
    await signInWithRedirect(auth,provider);
  }catch(error){fail(error);}
}
$('#retry').addEventListener('click',()=>{sessionStorage.removeItem(STARTED_KEY);location.reload();});
start();
