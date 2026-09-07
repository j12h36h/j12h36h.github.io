import '/game/assets/js/slime-smash-host-compat.js?v=1.0.0';

export const HOSTED_GAME_MODES = Object.freeze({
  'arcade-topdown': Object.freeze({
    id:'arcade-topdown', name:'Turn-Based Tactical', short:'TACTICAL', icon:'⌖', mapId:'global-plaza', maxPlayers:32,
    description:'Build a custom tactical RPG world with areas, mobs, drops, equipment, shops and turn-based combat.',
    tags:['COMBAT','MOBS','EQUIPMENT','SHOPS'], assetId:'eras:mode_turn_based_tactical', runtime:'tactical'
  }),
  'tactical-strike': Object.freeze({
    id:'tactical-strike', name:'Tactical Strike', short:'TACTICAL STRIKE', icon:'⊕', mapId:'tactical-arena-01', maxPlayers:10,
    description:'Round-based first-person tactical combat played inside reusable E.R.A.S. 3D Scenes.',
    tags:['FPS','ROUND BASED','3D SCENES','ECONOMY'], assetId:'eras:mode_tactical_strike', runtime:'tactical-strike'
  }),
  'galactic-dominion': Object.freeze({
    id:'galactic-dominion', name:'Galactic Dominion', short:'DOMINION', icon:'◉', mapId:'galactic-ring', maxPlayers:8,
    description:'Build an interstellar economic empire by acquiring, developing and trading planets and warp routes.',
    tags:['PLANETS','TRADE','TERRITORY','ECONOMY'], assetId:'eras:mode_galactic_dominion', runtime:'galactic'
  }),
  'surface-discovery': Object.freeze({
    id:'surface-discovery', name:'Surface Discovery', short:'SURFACE', icon:'▦', mapId:'surface-grid', maxPlayers:8,
    description:'Explore a hostile maze-like surface, collect discoveries and evade roaming threats.',
    tags:['MAZE','COLLECT','EVADE','SURVIVE'], assetId:'eras:mode_surface_discovery', runtime:'hosted'
  }),
  'jeng-stroid': Object.freeze({
    id:'jeng-stroid', name:'Jeng-stroid', short:'JENG-STROID', icon:'▥', mapId:'stack-bay', maxPlayers:8,
    description:'Remove structural blocks without destabilizing the orbital stack. Precision beats speed.',
    tags:['STACK','BALANCE','PHYSICS','ELIMINATION'], assetId:'eras:mode_jeng_stroid', runtime:'hosted'
  }),
  'sunball': Object.freeze({
    id:'sunball', name:'Sunball', short:'SUNBALL', icon:'☼', mapId:'solar-table', maxPlayers:8,
    description:'Launch a high-speed ball through an orbital table of bumpers, targets and score multipliers.',
    tags:['ARCADE','BALL','BUMPER','SCORE'], assetId:'eras:mode_sunball', runtime:'hosted'
  }),
  'soldoku': Object.freeze({
    id:'soldoku', name:'Soldoku', short:'SOLDOKU', icon:'#', mapId:'logic-grid', maxPlayers:12,
    description:'Solve configurable symbol-grid logic puzzles solo, cooperatively or against the clock.',
    tags:['LOGIC','PUZZLE','SOLO','CO-OP'], assetId:'eras:mode_soldoku', runtime:'hosted'
  }),
  'escape-pod-dash': Object.freeze({
    id:'escape-pod-dash', name:'Escape Pod Dash', short:'POD DASH', icon:'➤', mapId:'launch-corridor', maxPlayers:8,
    description:'Blast through a galaxy in a customizable escape pod, moving across a 3 × 3 field of nine positions to dodge planets, asteroids, satellites and stellar hazards.',
    tags:['GALAXY','9-POSITION','DODGE','POD SKINS'], assetId:'eras:mode_escape_pod_dash', runtime:'hosted'
  }),
  'side-scroller': Object.freeze({
    id:'side-scroller', name:'Side Scroller', short:'SIDE SCROLLER', icon:'▲', mapId:'runner-strip', maxPlayers:8,
    description:'Auto-run through a 2D platform course. The entire game has one action: jump.',
    tags:['2D','PLATFORM','AUTO-RUN','JUMP'], assetId:'', runtime:'side-scroller'
  }),
  'slime-smash': Object.freeze({
    id:'slime-smash', name:'Slime Smash', short:'SLIME SMASH', icon:'●', mapId:'lily-grid', maxPlayers:8, storageGameStyle:'arcade-topdown', storageMapId:'slime-yard',
    description:'Tap slimes across nine leaf platforms. Each smash scores points and adds time; survive the countdown for the highest score.',
    tags:['REACTION','TIMED','SCORE','SLIMES'], assetId:'eras:mode_slime_smash', runtime:'slime-smash'
  })
});

export const HOSTED_MODE_IDS = Object.freeze(Object.keys(HOSTED_GAME_MODES));
export const hostedMode = id => HOSTED_GAME_MODES[id] || HOSTED_GAME_MODES['arcade-topdown'];
export const hostedModeLabel = id => hostedMode(id).name.toUpperCase();
export const hostedLobbyMode = lobby => hostedMode(lobby?.settings?.modeId || lobby?.gameStyle);
export const hostedLobbyModeLabel = lobby => hostedLobbyMode(lobby).name.toUpperCase();
export const hostedModeRuntimeHref = (lobby, mobile=false) => {
  const mode = hostedLobbyMode(lobby);
  const id = encodeURIComponent(lobby?.id || '');
  if(mode.runtime === 'galactic') return `/game/galactic-dominion/?lobby=${id}`;
  if(mode.runtime === 'slime-smash') return `/game/slime-smash/?lobby=${id}`;
  if(mode.runtime === 'side-scroller') return `/game/side-scroller/?lobby=${id}`;
  if(mode.runtime === 'tactical-strike') return `/game/tactical-strike/?lobby=${id}`;
  if(mode.runtime === 'hosted') return `/game/hosted-mode/?lobby=${id}`;
  return mobile ? `/game-mobile/tactical/?lobby=${id}` : `/game/tactical/?lobby=${id}`;
};

export const VISIBILITY_OPTIONS = Object.freeze([
  {id:'public',name:'Public',icon:'◎',description:'Visible in the public Join browser.'},
  {id:'friends',name:'Friends',icon:'◇',description:'Visible to accepted LCS connections and usable by join code.'},
  {id:'code',name:'Code Only',icon:'⌗',description:'Hidden from discovery. Players need the six-character join code.'}
]);

export const ACCESS_MODE_OPTIONS = Object.freeze([
  {id:'free',name:'Free',icon:'○',description:'Anyone allowed into the lobby can play without spending Credits.'},
  {id:'per_play',name:'Per Play',icon:'▶',description:'One purchase grants one lobby play/session entry.'},
  {id:'per_life',name:'Per Life',icon:'♥',description:'Credits buy lives. A new life consumes one purchased life.'},
  {id:'playtime',name:'Playtime',icon:'◷',description:'Sell a fixed block of active playtime measured in minutes.'},
  {id:'permanent',name:'Permanent Access',icon:'∞',description:'One purchase permanently unlocks access to this hosted lobby.'}
]);

export const BILLING_OPTIONS = Object.freeze(ACCESS_MODE_OPTIONS.filter(x=>x.id!=='free'));

export function modeDefaults(modeId){
  switch(modeId){
    case 'tactical-strike': return { teamSize:5, roundsToWin:7, roundSeconds:105, buySeconds:15, startingCredits:800, friendlyFire:false, objectiveMode:'elimination', sceneAssetId:'scene.tactical_arena_01' };
    case 'surface-discovery': return { gridSize:15, lives:3, enemyCount:3, powerMoves:12, winCondition:'collect_all' };
    case 'jeng-stroid': return { layers:18, piecesPerLayer:3, turnSeconds:60, gravity:1, collapseThreshold:65 };
    case 'sunball': return { balls:3, targetScore:25000, gravity:0.22, bumperForce:1.8, multiplayerMode:'alternating' };
    case 'soldoku': return { boardSize:9, difficulty:'normal', hints:3, mistakeLimit:3, playMode:'solo' };
    case 'escape-pod-dash': return { lanes:3, lives:1, startSpeed:4, acceleration:0.12, targetDistance:20000, obstacleRate:1 };
    case 'side-scroller': return { runSpeed:250, acceleration:3.5, gravity:1750, jumpVelocity:650, obstacleRate:1, targetDistance:0 };
    case 'slime-smash': return { startingSeconds:15, timeGainSeconds:0.35, scorePerSlime:100 };
    default: return {};
  }
}

const n=(value,fallback,min,max,integer=false)=>{let x=Number(value);if(!Number.isFinite(x))x=fallback;x=Math.max(min,Math.min(max,x));return integer?Math.round(x):x;};
export function normalizeModeSettings(modeId,input={}){
  const d=modeDefaults(modeId);
  switch(modeId){
    case 'tactical-strike': return {teamSize:n(input.teamSize,d.teamSize,1,5,true),roundsToWin:n(input.roundsToWin,d.roundsToWin,1,16,true),roundSeconds:n(input.roundSeconds,d.roundSeconds,30,300,true),buySeconds:n(input.buySeconds,d.buySeconds,5,60,true),startingCredits:n(input.startingCredits,d.startingCredits,0,16000,true),friendlyFire:input.friendlyFire===true||input.friendlyFire==='true'||input.friendlyFire==='on',objectiveMode:['elimination','attack-defend','control-point'].includes(input.objectiveMode)?input.objectiveMode:d.objectiveMode,sceneAssetId:String(input.sceneAssetId||d.sceneAssetId).trim().slice(0,100)||d.sceneAssetId};
    case 'surface-discovery': return {gridSize:n(input.gridSize,d.gridSize,9,31,true)|1,lives:n(input.lives,d.lives,1,9,true),enemyCount:n(input.enemyCount,d.enemyCount,1,8,true),powerMoves:n(input.powerMoves,d.powerMoves,3,60,true),winCondition:['collect_all','target_score','survive'].includes(input.winCondition)?input.winCondition:d.winCondition};
    case 'jeng-stroid': return {layers:n(input.layers,d.layers,6,30,true),piecesPerLayer:3,turnSeconds:n(input.turnSeconds,d.turnSeconds,15,180,true),gravity:n(input.gravity,d.gravity,.5,2),collapseThreshold:n(input.collapseThreshold,d.collapseThreshold,35,90,true)};
    case 'sunball': return {balls:n(input.balls,d.balls,1,9,true),targetScore:n(input.targetScore,d.targetScore,1000,1000000,true),gravity:n(input.gravity,d.gravity,.08,.6),bumperForce:n(input.bumperForce,d.bumperForce,1,3),multiplayerMode:['alternating','score_attack'].includes(input.multiplayerMode)?input.multiplayerMode:d.multiplayerMode};
    case 'soldoku': return {boardSize:[4,6,9].includes(Number(input.boardSize))?Number(input.boardSize):d.boardSize,difficulty:['easy','normal','hard'].includes(input.difficulty)?input.difficulty:d.difficulty,hints:n(input.hints,d.hints,0,9,true),mistakeLimit:n(input.mistakeLimit,d.mistakeLimit,0,9,true),playMode:['solo','competitive','cooperative'].includes(input.playMode)?input.playMode:d.playMode};
    case 'escape-pod-dash': return {lanes:3,lives:1,startSpeed:n(input.startSpeed,d.startSpeed,2,10),acceleration:n(input.acceleration,d.acceleration,.02,.5),targetDistance:20000,obstacleRate:n(input.obstacleRate,d.obstacleRate,.4,2.5)};
    case 'side-scroller': return {runSpeed:n(input.runSpeed,d.runSpeed,140,520),acceleration:n(input.acceleration,d.acceleration,0,18),gravity:n(input.gravity,d.gravity,900,2800),jumpVelocity:n(input.jumpVelocity,d.jumpVelocity,420,980),obstacleRate:n(input.obstacleRate,d.obstacleRate,.45,2.5),targetDistance:n(input.targetDistance,d.targetDistance,0,200000,true)};
    case 'slime-smash': return {startingSeconds:n(input.startingSeconds,d.startingSeconds,3,120),timeGainSeconds:n(input.timeGainSeconds,d.timeGainSeconds,.05,10),scorePerSlime:n(input.scorePerSlime,d.scorePerSlime,1,10000,true)};
    default:return {};
  }
}

// The Host page imports this module before its own initialization. Inject the
// Tactical Strike controls here so older host HTML can gain the new mode without
// replacing the entire host page.
function installTacticalStrikeHostPanel(){
  if(typeof document==='undefined' || !location.pathname.includes('/game/host')) return;
  if(document.querySelector('[data-mode-panel="tactical-strike"]')) return;
  const anchor=document.querySelector('[data-mode-panel="escape-pod-dash"]');
  if(!anchor) return;
  const panel=document.createElement('section');
  panel.className='runtime-config-section';
  panel.dataset.modePanel='tactical-strike';
  panel.hidden=true;
  panel.innerHTML=`<h3>TACTICAL STRIKE RULES</h3><p class="runtime-config-note">ROUND-BASED FIRST-PERSON COMBAT // SCENE-BASED 3D MAPS</p><div class="creator-quad"><label class="runtime-field"><span>TEAM SIZE</span><input id="mode_strikeTeamSize" type="number" min="1" max="5" value="5"></label><label class="runtime-field"><span>ROUNDS TO WIN</span><input id="mode_strikeRoundsToWin" type="number" min="1" max="16" value="7"></label><label class="runtime-field"><span>ROUND SECONDS</span><input id="mode_strikeRoundSeconds" type="number" min="30" max="300" value="105"></label><label class="runtime-field"><span>BUY SECONDS</span><input id="mode_strikeBuySeconds" type="number" min="5" max="60" value="15"></label></div><div class="creator-quad"><label class="runtime-field"><span>STARTING CREDITS</span><input id="mode_strikeStartingCredits" type="number" min="0" max="16000" value="800"></label><label class="runtime-field"><span>OBJECTIVE</span><select id="mode_strikeObjectiveMode"><option value="elimination">ELIMINATION</option><option value="attack-defend">ATTACK / DEFEND</option><option value="control-point">CONTROL POINT</option></select></label><label class="runtime-field"><span>FRIENDLY FIRE</span><input id="mode_strikeFriendlyFire" type="checkbox"></label><span></span></div><label class="runtime-field"><span>3D SCENE ASSET ID</span><input id="mode_strikeSceneAssetId" value="scene.tactical_arena_01" maxlength="100"></label><p class="runtime-config-note"><a href="/scene-designer/" target="_blank" rel="noopener">OPEN 3D SCENE DESIGNER ↗</a> // Build a Scene, export its JSON, and publish it as a Scene asset.</p>`;
  anchor.insertAdjacentElement('afterend',panel);
}
if(typeof document!=='undefined') installTacticalStrikeHostPanel();

// Make the 3D extension visible to host/runtime catalog consumers without
// replacing the established public-assets/catalog.json package.
function installHosted3dCatalogBridge(){
  if(typeof window==='undefined'||window.__eras3dCatalogExtensionInstalled)return;
  window.__eras3dCatalogExtensionInstalled=true;
  const nativeFetch=window.fetch.bind(window);let extraPromise=null;
  const extra=()=>extraPromise||(extraPromise=nativeFetch('/public-assets/catalog-3d.json',{cache:'no-store'}).then(r=>r.ok?r.json():{assets:[]}).catch(()=>({assets:[]})));
  window.fetch=async(input,init)=>{const url=typeof input==='string'?input:String(input?.url||''),response=await nativeFetch(input,init);if(!/(^|\/)public-assets\/catalog\.json(?:\?|$)/.test(url))return response;try{const base=await response.clone().json(),ext=await extra(),seen=new Set(),assets=[];for(const a of [...(base.assets||[]),...(ext.assets||[])]){const id=String(a?.id||'');if(!id||seen.has(id))continue;seen.add(id);assets.push(a);}return new Response(JSON.stringify({...base,assets}),{status:response.status,statusText:response.statusText,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}catch(_){return response;}};
}
installHosted3dCatalogBridge();
