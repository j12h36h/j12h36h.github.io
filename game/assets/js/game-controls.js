const CONTROL_STYLESHEET='/game/assets/css/game-controls.css?v=1.0.0';

function ensureStyles(){
  if(document.querySelector('link[data-eras-game-controls]'))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=CONTROL_STYLESHEET;
  link.dataset.erasGameControls='';
  document.head.appendChild(link);
}

const key=(label,action)=>({label,action});

const GUIDES={
  'tactical-strike':{
    title:'TACTICAL STRIKE',
    subtitle:'FIRST-PERSON TACTICAL FPS',
    controls:[
      key('W / A / S / D','Move'),
      key('MOUSE','Aim / look'),
      key('LEFT CLICK','Fire'),
      key('LEFT SHIFT','Sprint while moving'),
      key('SPACE','Jump'),
      key('C','Hold to crouch'),
      key('R','Reload'),
      key('1 / 2','Switch rifle / pistol'),
      key('B','Open or close buy panel during buy phase'),
      key('ESC','Release mouse'),
      key('CURSOR BUTTON','Recapture mouse after Escape')
    ]
  },
  'turn-based':{
    title:'TURN-BASED TACTICAL',
    subtitle:'TACTICAL WORLD CONTROLS',
    controls:[
      key('MOUSE / TAP','Select destinations, targets and actions'),
      key('ACTION BUTTONS','Move, attack, interact and use world actions'),
      key('MAP','Choose a valid location inside your current turn range'),
      key('KEYBOARD','No keyboard input required')
    ]
  },
  'slime-smash':{
    title:'SLIME SMASH',
    subtitle:'REACTION SCORE ATTACK',
    controls:[
      key('MOUSE / TAP','Hit the slime on its current leaf'),
      key('START RUN','Begin or restart the timer'),
      key('KEYBOARD','No keyboard input required')
    ]
  },
  'side-scroller':{
    title:'SIDE SCROLLER',
    subtitle:'ONE-ACTION PLATFORM RUN',
    controls:[
      key('SPACE / ↑ / W','Jump'),
      key('HOLD JUMP','Higher jump'),
      key('MOUSE / TAP','Jump'),
      key('RELEASE','Shorter hop')
    ]
  },
  'escape-pod-dash':{
    title:'ESCAPE POD DASH',
    subtitle:'3 × 3 GALAXY DODGE',
    controls:[
      key('W / ↑','Move up'),
      key('S / ↓','Move down'),
      key('A / ←','Move left'),
      key('D / →','Move right'),
      key('TOUCH GRID','Move one position toward the pressed direction')
    ]
  },
  'galactic-dominion':{
    title:'GALACTIC DOMINION',
    subtitle:'TURN-BASED ECONOMIC STRATEGY',
    controls:[
      key('MOUSE / TAP','Select planets, routes and actions'),
      key('ROLL / ACTION','Advance the current turn'),
      key('BUY / DEVELOP','Purchase or improve valid territory'),
      key('KEYBOARD','No keyboard input required')
    ]
  },
  'surface-discovery':{
    title:'SURFACE DISCOVERY',
    subtitle:'MAZE EXPLORATION',
    controls:[
      key('W / A / S / D','Move when keyboard movement is available'),
      key('ARROW KEYS','Alternate movement'),
      key('MOUSE / TAP','Use on-screen movement and collect controls'),
      key('OBJECTIVE','Collect discoveries and avoid roaming threats')
    ]
  },
  'jeng-stroid':{
    title:'JENG-STROID',
    subtitle:'STRUCTURAL PRECISION',
    controls:[
      key('MOUSE / TAP','Select a removable structural block'),
      key('CONFIRM / REMOVE','Commit the selected move'),
      key('KEYBOARD','No keyboard input required')
    ]
  },
  'sunball':{
    title:'SUNBALL',
    subtitle:'ORBITAL BUMPER SCORE ATTACK',
    controls:[
      key('MOUSE / TAP','Aim / launch when the game requests input'),
      key('ACTION BUTTON','Launch or continue the current ball'),
      key('KEYBOARD','No keyboard input required')
    ]
  },
  'soldoku':{
    title:'SOLDOKU',
    subtitle:'LOGIC GRID',
    controls:[
      key('MOUSE / TAP','Select a cell'),
      key('NUMBER KEYS','Enter a symbol when keyboard entry is available'),
      key('GRID BUTTONS','Enter values on touch / mouse'),
      key('HINT','Use a remaining hint')
    ]
  },
  'arena-clash':{
    title:'E.R.A.S. CLASH',
    subtitle:'PLATFORM FIGHTER',
    controls:[
      key('A / D or ← / →','Move'),
      key('W / ↑ / SPACE','Jump'),
      key('J / LEFT CLICK','Primary attack'),
      key('K / RIGHT CLICK','Secondary attack'),
      key('S / ↓','Drop / fast fall when supported')
    ]
  }
};

function normalizedPath(){
  return location.pathname.toLowerCase().replace(/\/index\.html$/,'/').replace(/\/+$/,'/') || '/';
}

function staticGuideId(path){
  if(path.includes('/tactical-strike/'))return 'tactical-strike';
  if(path.includes('/global/turn-based/')||path.includes('/game/tactical/'))return 'turn-based';
  if(path.includes('/slime-smash/'))return 'slime-smash';
  if(path.includes('/side-scroller/'))return 'side-scroller';
  if(path.includes('/escape-pod-dash/'))return 'escape-pod-dash';
  if(path.includes('/galactic-dominion/'))return 'galactic-dominion';
  if(path.includes('/surface-discovery/'))return 'surface-discovery';
  if(path.includes('/jeng-stroid/'))return 'jeng-stroid';
  if(path.includes('/sunball/'))return 'sunball';
  if(path.includes('/soldoku/'))return 'soldoku';
  if(path.includes('/arena-clash/'))return 'arena-clash';
  return '';
}

function hostedGuideId(){
  const text=[
    document.querySelector('#modeTitle')?.textContent,
    document.title
  ].filter(Boolean).join(' ').toLowerCase();
  if(text.includes('surface discovery'))return 'surface-discovery';
  if(text.includes('jeng-stroid')||text.includes('jeng stroid'))return 'jeng-stroid';
  if(text.includes('sunball'))return 'sunball';
  if(text.includes('soldoku'))return 'soldoku';
  if(text.includes('escape pod'))return 'escape-pod-dash';
  return '';
}

function isPlayablePath(path){
  if(path==='/game/'||path==='/game/global/'||path==='/game/host/'||path==='/game/join/'||path==='/game/options/'||path==='/game/information/'||path==='/game/inventory/'||path==='/game/content/')return false;
  return path.startsWith('/game/')||path.startsWith('/game-mobile/');
}

function controlMarkup(control){
  return `<div class="eras-control-row"><kbd>${String(control.label)}</kbd><span>${String(control.action)}</span></div>`;
}

function mountGuide(id){
  const guide=GUIDES[id];
  if(!guide)return;
  ensureStyles();
  document.body.classList.add('eras-controls-scrollable');

  let root=document.querySelector('#erasGameControlGuide');
  if(!root){
    root=document.createElement('section');
    root.id='erasGameControlGuide';
    root.className='eras-game-control-guide';
    root.setAttribute('aria-label','Game controls');

    const main=document.querySelector('main');
    if(main?.parentNode)main.insertAdjacentElement('afterend',root);
    else document.body.appendChild(root);
  }
  if(root.dataset.guideId===id)return;
  root.dataset.guideId=id;
  root.innerHTML=`
    <div class="eras-game-control-inner">
      <header class="eras-game-control-head">
        <div><small>PLAYER REFERENCE // INPUT</small><h2>CONTROLS</h2></div>
        <div><b>${guide.title}</b><span>${guide.subtitle}</span></div>
      </header>
      <div class="eras-game-control-grid">${guide.controls.map(controlMarkup).join('')}</div>
      <footer>SCROLL BACK UP TO RETURN TO GAMEPLAY</footer>
    </div>`;
}

function resolve(){
  const path=normalizedPath();
  if(!isPlayablePath(path))return;
  const id=staticGuideId(path)||(path.includes('/hosted-mode/')?hostedGuideId():'');
  if(id)mountGuide(id);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',resolve,{once:true});
else resolve();

if(normalizedPath().includes('/hosted-mode/')){
  const startObserver=()=>{
    const target=document.querySelector('#modeTitle')||document.body;
    const observer=new MutationObserver(resolve);
    observer.observe(target,{subtree:true,childList:true,characterData:true});
    window.setTimeout(resolve,250);
    window.setTimeout(resolve,1000);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startObserver,{once:true});
  else startObserver();
}
