export const HOSTED_GAME_MODES = Object.freeze({
  'arcade-topdown': Object.freeze({
    id:'arcade-topdown', name:'Turn-Based Tactical', short:'TACTICAL', icon:'⌖', mapId:'global-plaza', maxPlayers:32,
    description:'Build a custom tactical RPG world with areas, mobs, drops, equipment, shops and turn-based combat.',
    tags:['COMBAT','MOBS','EQUIPMENT','SHOPS'], assetId:'eras:mode_turn_based_tactical', runtime:'tactical'
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
    description:'Race an escape pod through an accelerating corridor of lanes, hazards, jumps and pickups.',
    tags:['RUN','DODGE','JUMP','SURVIVE'], assetId:'eras:mode_escape_pod_dash', runtime:'hosted'
  })
});

export const HOSTED_MODE_IDS = Object.freeze(Object.keys(HOSTED_GAME_MODES));
export const hostedMode = id => HOSTED_GAME_MODES[id] || HOSTED_GAME_MODES['arcade-topdown'];
export const hostedModeLabel = id => hostedMode(id).name.toUpperCase();
export const hostedModeRuntimeHref = (lobby, mobile=false) => {
  const mode = hostedMode(lobby?.gameStyle);
  const id = encodeURIComponent(lobby?.id || '');
  if(mode.runtime === 'galactic') return `/game/galactic-dominion/?lobby=${id}`;
  if(mode.runtime === 'hosted') return `/game/hosted-mode/?lobby=${id}`;
  return mobile ? `/game-mobile/global/?lobby=${id}` : `/game/global/?lobby=${id}`;
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
    case 'surface-discovery': return { gridSize:15, lives:3, enemyCount:3, powerMoves:12, winCondition:'collect_all' };
    case 'jeng-stroid': return { layers:18, piecesPerLayer:3, turnSeconds:60, gravity:1, collapseThreshold:65 };
    case 'sunball': return { balls:3, targetScore:25000, gravity:0.22, bumperForce:1.8, multiplayerMode:'alternating' };
    case 'soldoku': return { boardSize:9, difficulty:'normal', hints:3, mistakeLimit:3, playMode:'solo' };
    case 'escape-pod-dash': return { lanes:3, lives:3, startSpeed:4, acceleration:0.12, targetDistance:2500, obstacleRate:1 };
    default: return {};
  }
}

const n=(value,fallback,min,max,integer=false)=>{let x=Number(value);if(!Number.isFinite(x))x=fallback;x=Math.max(min,Math.min(max,x));return integer?Math.round(x):x;};
export function normalizeModeSettings(modeId,input={}){
  const d=modeDefaults(modeId);
  switch(modeId){
    case 'surface-discovery': return {gridSize:n(input.gridSize,d.gridSize,9,31,true)|1,lives:n(input.lives,d.lives,1,9,true),enemyCount:n(input.enemyCount,d.enemyCount,1,8,true),powerMoves:n(input.powerMoves,d.powerMoves,3,60,true),winCondition:['collect_all','target_score','survive'].includes(input.winCondition)?input.winCondition:d.winCondition};
    case 'jeng-stroid': return {layers:n(input.layers,d.layers,6,30,true),piecesPerLayer:3,turnSeconds:n(input.turnSeconds,d.turnSeconds,15,180,true),gravity:n(input.gravity,d.gravity,.5,2),collapseThreshold:n(input.collapseThreshold,d.collapseThreshold,35,90,true)};
    case 'sunball': return {balls:n(input.balls,d.balls,1,9,true),targetScore:n(input.targetScore,d.targetScore,1000,1000000,true),gravity:n(input.gravity,d.gravity,.08,.6),bumperForce:n(input.bumperForce,d.bumperForce,1,3),multiplayerMode:['alternating','score_attack'].includes(input.multiplayerMode)?input.multiplayerMode:d.multiplayerMode};
    case 'soldoku': return {boardSize:[4,6,9].includes(Number(input.boardSize))?Number(input.boardSize):d.boardSize,difficulty:['easy','normal','hard'].includes(input.difficulty)?input.difficulty:d.difficulty,hints:n(input.hints,d.hints,0,9,true),mistakeLimit:n(input.mistakeLimit,d.mistakeLimit,0,9,true),playMode:['solo','competitive','cooperative'].includes(input.playMode)?input.playMode:d.playMode};
    case 'escape-pod-dash': return {lanes:n(input.lanes,d.lanes,3,5,true),lives:n(input.lives,d.lives,1,9,true),startSpeed:n(input.startSpeed,d.startSpeed,2,10),acceleration:n(input.acceleration,d.acceleration,.02,.5),targetDistance:n(input.targetDistance,d.targetDistance,500,20000,true),obstacleRate:n(input.obstacleRate,d.obstacleRate,.4,2.5)};
    default:return {};
  }
}
