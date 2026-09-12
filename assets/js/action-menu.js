(() => {
  if (document.querySelector('.eras-action-wrap')) return;

  const STYLE_ID='eras-action-menu-style-v2';
  if(!document.getElementById(STYLE_ID)){
    const link=document.createElement('link');link.id=STYLE_ID;link.rel='stylesheet';link.href='/assets/css/action-menu.css?v=20260912-2';document.head.appendChild(link);
  }

  // Chat is a site-wide utility now, so load its shared skin once and put the
  // landscape-phone correction AFTER it. Existing LCS/game Chat styles remain compatible.
  if(!document.querySelector('link[href*="direct-messaging.css"]')){
    const dm=document.createElement('link');dm.rel='stylesheet';dm.href='/assets/css/direct-messaging.css?v=20260912-dm7';document.head.appendChild(dm);
  }
  if(!document.getElementById('eras-chat-mobile-landscape-style')){
    const dmMobile=document.createElement('link');dmMobile.id='eras-chat-mobile-landscape-style';dmMobile.rel='stylesheet';dmMobile.href='/assets/css/chat-mobile-landscape.css?v=20260912-1';document.head.appendChild(dmMobile);
  }

  let deferredInstallPrompt=null,toastTimer=0,chatMessenger=null,chatIdentity=null;


  const syncChatViewport=()=>{
    const vv=window.visualViewport;
    const w=Math.max(320,Math.round(vv?.width||window.innerWidth||320));
    const h=Math.max(220,Math.round(vv?.height||window.innerHeight||220));
    document.documentElement.style.setProperty('--eras-chat-vw',`${w}px`);
    document.documentElement.style.setProperty('--eras-chat-vh',`${h}px`);
  };
  let chatViewportTimer=0;
  const scheduleChatViewport=()=>{
    clearTimeout(chatViewportTimer);
    chatViewportTimer=setTimeout(syncChatViewport,24);
  };
  syncChatViewport();
  window.addEventListener('resize',scheduleChatViewport,{passive:true});
  window.addEventListener('orientationchange',scheduleChatViewport,{passive:true});
  window.visualViewport?.addEventListener('resize',scheduleChatViewport,{passive:true});
  window.visualViewport?.addEventListener('scroll',scheduleChatViewport,{passive:true});

  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

  const icon=(paths)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
  const makeItem=(label,svg)=>{const b=document.createElement('button');b.type='button';b.className='eras-action-item';b.setAttribute('role','menuitem');b.innerHTML=`${icon(svg)}<span>${label}</span>`;return b;};

  const wrap=document.createElement('div');wrap.className='eras-action-wrap';
  const menu=document.createElement('div');menu.className='eras-action-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-hidden','true');

  const share=makeItem('Share','<path d="M12 15V3"></path><path d="M8.5 6.5 12 3l3.5 3.5"></path><path d="M7 9H5.8A1.8 1.8 0 0 0 4 10.8v7.4A1.8 1.8 0 0 0 5.8 20h12.4a1.8 1.8 0 0 0 1.8-1.8v-7.4A1.8 1.8 0 0 0 18.2 9H17"></path>');
  const install=makeItem('Install','<path d="M12 3v11"></path><path d="m8 10 4 4 4-4"></path><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"></path>');
  const chat=makeItem('Chat','<path d="M5 5h14v10H9l-4 4V5Z"></path><path d="M8 9h8M8 12h5"></path>');
  const note=makeItem('Note','<path d="M5 3h14v14l-4 4H5V3Z"></path><path d="M15 21v-4h4M8 8h8M8 12h6"></path>');
  const help=makeItem('Help','<circle cx="12" cy="12" r="9"></circle><path d="M9.8 9a2.4 2.4 0 1 1 3.4 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"></path>');
  const chatBadge=document.createElement('em');chatBadge.className='eras-action-badge';chatBadge.hidden=true;chat.appendChild(chatBadge);

  const toggle=document.createElement('button');toggle.type='button';toggle.className='eras-action-toggle';toggle.setAttribute('aria-label','Open E.R.A.S. actions');toggle.setAttribute('aria-haspopup','menu');toggle.setAttribute('aria-expanded','false');
  toggle.innerHTML=icon('<circle cx="6" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="18" cy="12" r="1.3"></circle>');

  const toast=document.createElement('div');toast.className='eras-action-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  const installHelp=document.createElement('div');installHelp.className='eras-install-help';installHelp.setAttribute('role','dialog');installHelp.setAttribute('aria-live','polite');
  installHelp.innerHTML='<b>INSTALL E.R.A.S.</b><p></p><button type="button">CLOSE</button>';

  menu.append(share,install,chat,note,help);wrap.append(menu,toggle);document.body.append(wrap,toast,installHelp);

  const showToast=message=>{clearTimeout(toastTimer);toast.textContent=message;toast.classList.add('is-visible');toastTimer=setTimeout(()=>toast.classList.remove('is-visible'),1900);};
  window.ERASUtilityToast=showToast;
  const setOpen=open=>{wrap.classList.toggle('is-open',open);menu.setAttribute('aria-hidden',String(!open));toggle.setAttribute('aria-expanded',String(open));};
  const showInstallHelp=message=>{installHelp.querySelector('p').textContent=message;installHelp.classList.add('is-visible');};

  function updateInstallState(){
    const label=install.querySelector('span');
    if(isStandalone()){
      install.disabled=false;label.textContent='Website';install.dataset.mode='website';
      install.querySelector('svg').innerHTML='<circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path>';
    }else{
      install.disabled=false;label.textContent='Install';install.dataset.mode='install';
      install.querySelector('svg').innerHTML='<path d="M12 3v11"></path><path d="m8 10 4 4 4-4"></path><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"></path>';
    }
  }

  async function ensureChat(){
    const existing=document.querySelector('#messagesButton');
    if(existing){existing.click();return;}

    const eras=await import('/game/assets/js/eras-data.js?v=20260912-hub1');
    if(!eras.auth.currentUser){showToast('Sign in to use Chat.');return;}
    chatIdentity=await eras.ensureIdentity(eras.auth.currentUser);
    if(!chatIdentity?.profileId){showToast('E.R.A.S. profile is still linking.');return;}

    if(!chatMessenger){
      const {createDirectMessenger}=await import('/assets/js/direct-messaging.js?v=20260901-dm6');
      const listContacts=async()=>{
        const q=eras.fs.query(eras.fs.collection(eras.db,'privateFriendships'),eras.fs.where('members','array-contains',chatIdentity.profileId),eras.fs.limit(250));
        const snap=await eras.fs.getDocs(q);
        return [...new Set(snap.docs.flatMap(d=>(d.data().members||[]).filter(id=>id&&id!==chatIdentity.profileId)))];
      };
      chatMessenger=createDirectMessenger({
        db:eras.db,fs:eras.fs,
        getCurrentProfileId:()=>chatIdentity?.profileId||'',
        getProfile:eras.profileById,
        listContacts,
        avatarMarkup:p=>eras.avatarSvg(p),
        onUnreadChange:count=>{chatBadge.textContent=count>99?'99+':String(count||0);chatBadge.hidden=!count;},
        onError:error=>{console.error('E.R.A.S. utility Chat',error);showToast('Chat connection error.');}
      });
      chatMessenger.startBackground?.();
    }
    await chatMessenger.openInbox();
  }

  async function openModule(path,globalName){
    await import(path);
    window[globalName]?.open?.();
  }

  toggle.addEventListener('click',e=>{e.stopPropagation();setOpen(!wrap.classList.contains('is-open'));});

  share.addEventListener('click',async()=>{
    setOpen(false);
    const data={title:document.title||'Project E.R.A.S.',text:'Project E.R.A.S.',url:location.href};
    if(typeof navigator.share==='function'){
      try{await navigator.share(data);return;}catch(e){if(e?.name==='AbortError')return;}
    }
    try{await navigator.clipboard.writeText(location.href);showToast('LINK COPIED');}
    catch{window.prompt('Copy this link:',location.href);}
  });

  install.addEventListener('click',async()=>{
    setOpen(false);
    if(install.dataset.mode==='website'){
      const w=window.open('https://j12h36h.github.io/','_blank','noopener,noreferrer');
      if(!w)showToast('Browser blocked the new website window.');
      return;
    }
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();try{await deferredInstallPrompt.userChoice;}catch{}
      deferredInstallPrompt=null;updateInstallState();return;
    }
    if(isIOS()){showInstallHelp('In Safari, tap Share → Add to Home Screen → enable Open as Web App → Add.');return;}
    showInstallHelp('Open your browser menu and choose Install app or Add to Home Screen. If the option is unavailable, reload E.R.A.S. and try again.');
  });

  chat.addEventListener('click',async()=>{setOpen(false);try{await ensureChat();}catch(e){console.error(e);showToast('Unable to open Chat.');}});
  note.addEventListener('click',async()=>{setOpen(false);try{await openModule('/assets/js/sticky-notes.js?v=20260912-2','ERASStickyNotes');}catch(e){console.error(e);showToast('Unable to open Notes.');}});
  help.addEventListener('click',async()=>{setOpen(false);try{await openModule('/assets/js/help-assistant.js?v=20260912-1','ERASHelp');}catch(e){console.error(e);showToast('Unable to open Help.');}});

  installHelp.querySelector('button').addEventListener('click',()=>installHelp.classList.remove('is-visible'));
  document.addEventListener('click',e=>{if(!wrap.contains(e.target))setOpen(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setOpen(false);installHelp.classList.remove('is-visible');}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallState();});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallState();showToast('E.R.A.S. INSTALLED');});
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change',updateInstallState);

  updateInstallState();
})();
