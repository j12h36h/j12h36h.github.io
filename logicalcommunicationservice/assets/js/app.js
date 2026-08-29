import { LCS_CONFIG } from './config.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const SYSTEM_SPACE = Object.freeze({ id: 'open-commons', name: 'Open Commons', description: 'The shared public space for ideas, problems, projects, and discussion.', system: true });
const SYSTEM_CHANNELS = Object.freeze([
  { id: 'open-commons-general', spaceId: SYSTEM_SPACE.id, name: 'general', description: 'Open discussion across the LCS network.', type: 'discussion', system: true },
  { id: 'open-commons-ideas', spaceId: SYSTEM_SPACE.id, name: 'ideas', description: 'Ideas that may become something real.', type: 'ideas', system: true },
  { id: 'open-commons-problems', spaceId: SYSTEM_SPACE.id, name: 'problems', description: 'Problems worth understanding before solving.', type: 'problems', system: true },
  { id: 'open-commons-projects', spaceId: SYSTEM_SPACE.id, name: 'projects', description: 'Work that is becoming real.', type: 'projects', system: true }
]);
const CHANNEL_TYPES = Object.freeze({
  discussion: { label: 'Discussion', symbol: '💬', kind: null }, ideas: { label: 'Ideas', symbol: '💡', kind: 'idea' },
  problems: { label: 'Problems', symbol: '❓', kind: 'problem' }, projects: { label: 'Projects', symbol: '🛠', kind: 'project' },
  research: { label: 'Research', symbol: '🔎', kind: null }, releases: { label: 'Releases', symbol: '🚀', kind: 'project' }, announcements: { label: 'Announcements', symbol: '📣', kind: null }
});
const reasoning = Object.freeze({
  observation: { plain: 'I noticed', formal: 'Observation', symbol: '👀', description: 'Something directly seen, measured, heard, or recorded.' },
  premise: { plain: 'We know', formal: 'Premise', symbol: '📌', description: 'A starting fact, rule, or agreed point.' },
  deduction: { plain: 'This follows', formal: 'Deduction', symbol: '→', description: 'A conclusion connected to stated facts or premises.' },
  assumption: { plain: "I'm assuming", formal: 'Assumption', symbol: '☁', description: 'Something treated as true even though it is not established.' },
  hypothesis: { plain: 'Maybe', formal: 'Hypothesis', symbol: '🧪', description: 'A possible explanation or solution that can be tested.' },
  question: { plain: 'I need to know', formal: 'Question', symbol: '?', description: 'Missing information that could change the conclusion.' },
  unclassified: { plain: 'Just say it', formal: 'Unclassified', symbol: '💬', description: 'Normal communication with no reasoning label required.' }
});
const LFG_PURPOSES = Object.freeze({ play: { label: 'Play together', icon: '🎮' }, create: { label: 'Create together', icon: '🛠' }, share: { label: 'Share information', icon: '↗' } });
const STATUS_META = Object.freeze({
  founder: { label: 'Founder', symbol: '✦', public: true, description: 'Root LCS stewardship and Status administration.' },
  moderator: { label: 'Moderator', symbol: '◆', public: true, description: 'Moderation authority in the assigned scope.' },
  timeout: { label: 'Timeout', symbol: '⏳', public: false, description: 'Read-only access in the assigned scope.' }
});
const STATUS_SCOPE_LABELS = Object.freeze({ global: 'Global', discussion_post: 'Discussion', discussion_object: 'Discussion', project: 'Project' });

const state = {
  authUid: null, authReady: false, firebaseReady: false, firebase: null,
  profileId: null, publicProfile: null, profiles: {}, posts: [], objects: [], spaces: [], channels: [], comments: [], reactions: [], follows: [], connections: [], postLinks: [], lfg: [],
  friendRequests: [], friendships: [], lfgRequests: [], blocks: [],
  statusPublic: [], statusOwn: [], statusPrivileged: [], statuses: [], moderationLogs: [], moderationPosts: [], moderationObjects: [], moderationComments: [], moderationLfg: [], moderationUnsubs: [], moderationSignature: '',
  activeType: 'unclassified', activeFilter: 'all', activeView: 'home', activeSpaceId: 'all', activeChannelId: 'all', activeLfgFilter: 'all', mapLayoutSeed: 0,
  momentumMode: 'explore', networkContext: null, sessionImpact: {},
  detail: null, connectContext: null, profileSavePending: false, profileSaveStatus: '', accountDirty: false, profileVerified: false,
  createInFlight: false, publishInFlight: false, commentInFlight: false, lfgInFlight: false, spaceInFlight: false, channelInFlight: false, detailCommentUnsub: null,
  publicUnsubs: [], privateUnsubs: [], ownProfileUnsub: null, legacyMigrationStarted: false, founderBootstrapAttempted: false, identityLinkPromise: null, profileHydrationPending: new Set()
};

function isFirebaseConfigured() { const c = LCS_CONFIG.firebase || {}; return Boolean(c.apiKey && c.projectId && c.appId && !String(c.apiKey).includes('YOUR_')); }
function escapeHtml(v = '') { return String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function safeDocId(...parts) { return parts.map(v => String(v || '').replace(/[^a-zA-Z0-9_-]/g, '_')).join('__').slice(0, 1400); }
function timeValue(ts) { if (typeof ts === 'number') return ts; if (ts?.toMillis) return ts.toMillis(); if (ts instanceof Date) return ts.getTime(); return 0; }
function timeAgo(ts) { const s = Math.max(1, Math.floor((Date.now() - (timeValue(ts) || Date.now())) / 1000)); if (s < 60) return `${s}s ago`; const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; const d = Math.floor(h / 24); return d < 30 ? `${d}d ago` : new Date(timeValue(ts)).toLocaleDateString(); }
function initialsFor(name = 'Member') { return String(name).trim().split(/\s+/).slice(0, 2).map(s => s[0] || '').join('').toUpperCase() || 'M'; }
function generatedPublicName(profileId = '') { return `Member-${String(profileId).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase() || 'NEW'}`; }
const AVATAR_FONTS = Object.freeze(['Arial','Verdana','Georgia','Courier New','Trebuchet MS','Times New Roman','system-ui','monospace','sans-serif','serif']);
const AVATAR_WEIGHTS = Object.freeze([400,700,900]);
const AVATAR_ALIGNS = Object.freeze(['start','middle','end']);
const AVATAR_MAX_LAYERS = 96;
const AVATAR_JSON_MAX_CHARS = 32000;
const AVATAR_RENDER_CACHE = new Map();
function defaultAvatarSpec(profile = null) {
  return {
    version: 1,
    background: '#34264c',
    layers: [{
      char: initialsFor(profile?.displayName || 'Member'), x: 64, y: 66, fontSize: 42,
      color: '#ffffff', fontFamily: 'Arial', fontWeight: 900, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, opacity: 1, align: 'middle'
    }]
  };
}
function normalizeHexColor(value, label) {
  const v = String(value || '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${label} must be a six-digit hex color such as #ffb22e.`);
  return v.toLowerCase();
}
function validateAvatarSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('The root JSON value must be an object.');
  if (input.version !== 1) throw new Error('version must be 1.');
  const background = normalizeHexColor(input.background, 'background');
  if (!Array.isArray(input.layers) || input.layers.length < 1 || input.layers.length > AVATAR_MAX_LAYERS) throw new Error(`layers must contain between 1 and ${AVATAR_MAX_LAYERS} character layers.`);
  const layers = input.layers.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`Layer ${index + 1} must be an object.`);
    const rawText = String(raw.char ?? '').normalize('NFC');
    if (!rawText || /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(rawText)) throw new Error(`Layer ${index + 1} char must contain 1–4 visible Unicode characters and cannot contain control or bidi-override characters.`);
    const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(rawText)].map(part => part.segment)
      : Array.from(rawText);
    if (graphemes.length < 1 || graphemes.length > 4 || graphemes.every(g => /^\s+$/u.test(g))) throw new Error(`Layer ${index + 1} char must contain 1–4 visible Unicode characters.`);
    const number = (key, min, max, fallback) => {
      const value = raw[key] ?? fallback;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Layer ${index + 1} ${key} must be between ${min} and ${max}.`);
      return value;
    };
    const fontFamily = String(raw.fontFamily ?? 'Arial');
    if (!AVATAR_FONTS.includes(fontFamily)) throw new Error(`Layer ${index + 1} fontFamily is not allowed.`);
    const fontWeight = Number(raw.fontWeight ?? 700);
    if (!AVATAR_WEIGHTS.includes(fontWeight)) throw new Error(`Layer ${index + 1} fontWeight must be 400, 700, or 900.`);
    const align = String(raw.align ?? 'middle');
    if (!AVATAR_ALIGNS.includes(align)) throw new Error(`Layer ${index + 1} align must be start, middle, or end.`);
    return {
      char: rawText,
      x: number('x', -64, 192, 64), y: number('y', -64, 192, 64), fontSize: number('fontSize', 4, 192, 42),
      color: normalizeHexColor(raw.color ?? '#ffffff', `Layer ${index + 1} color`), fontFamily, fontWeight,
      rotation: number('rotation', -360, 360, 0),
      scaleX: number('scaleX', -4, 4, 1), scaleY: number('scaleY', -4, 4, 1),
      skewX: number('skewX', -75, 75, 0), skewY: number('skewY', -75, 75, 0),
      opacity: number('opacity', 0, 1, 1), align
    };
  });
  return { version: 1, background, layers };
}
function avatarSpecFor(profile) {
  if (!profile?.avatarJson) return defaultAvatarSpec(profile);
  try { return validateAvatarSpec(JSON.parse(profile.avatarJson)); }
  catch (error) { console.warn('Invalid saved avatar JSON; using initials fallback.', error); return defaultAvatarSpec(profile); }
}
function avatarSvgInner(spec) {
  const safe = validateAvatarSpec(spec);
  const cacheKey = JSON.stringify(safe);
  const cached = AVATAR_RENDER_CACHE.get(cacheKey);
  if (cached) return cached;
  const layers = safe.layers.map(layer => `<g transform="translate(${layer.x} ${layer.y}) rotate(${layer.rotation}) skewX(${layer.skewX}) skewY(${layer.skewY}) scale(${layer.scaleX} ${layer.scaleY})"><text x="0" y="0" fill="${layer.color}" font-family="${escapeHtml(layer.fontFamily)}" font-size="${layer.fontSize}" font-weight="${layer.fontWeight}" opacity="${layer.opacity}" text-anchor="${layer.align}" dominant-baseline="middle">${escapeHtml(layer.char)}</text></g>`).join('');
  const svg = `<svg viewBox="0 0 128 128" focusable="false" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" fill="${safe.background}"/>${layers}</svg>`;
  AVATAR_RENDER_CACHE.set(cacheKey, svg);
  if (AVATAR_RENDER_CACHE.size > 128) AVATAR_RENDER_CACHE.delete(AVATAR_RENDER_CACHE.keys().next().value);
  return svg;
}
function avatarMarkup(profile, cls = 'fallback-avatar') { return `<span class="${cls} avatar-composite" aria-hidden="true">${avatarSvgInner(avatarSpecFor(profile))}</span>`; }
function prettyAvatarJson(profile = null) { return JSON.stringify(avatarSpecFor(profile), null, 2); }

function showDialog(selector) { const d = typeof selector === 'string' ? $(selector) : selector; if (d && !d.open) d.showModal(); }
function closeDialog(dialogOrSelector) {
  const d = typeof dialogOrSelector === 'string' ? $(dialogOrSelector) : dialogOrSelector;
  if (!d) return;
  try { if (d.open) d.close(); } catch (error) { console.debug('Dialog close fallback', error); }
  // Some mobile/desktop browser combinations can leave the open attribute behind after
  // async form work. Force the modal out of the top layer so a successful publish can
  // never look like it is still waiting for another submit.
  if (d.hasAttribute('open')) d.removeAttribute('open');
  try { document.activeElement?.blur?.(); } catch {}
}
function closeDialogFromControl(control) { closeDialog(control?.closest?.('dialog')); }
function formatTagEntry(value='') {
  return String(value).replace(/\s*[,;]+\s*/g, ', ').replace(/(?:,\s*){2,}/g, ', ').replace(/^\s+/, '');
}
function renderTagPreview(input, preview) {
  if (!input || !preview) return;
  const tags = parseTags(input.value);
  preview.innerHTML = tags.length ? tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '<span class="muted tiny">Comma-separate tags.</span>';
}
function bindTagInput(inputSelector, previewSelector) {
  const input=$(inputSelector), preview=$(previewSelector); if(!input)return;
  const sync=()=>{ const caret=input.selectionStart; const before=input.value; const after=formatTagEntry(before); if(after!==before){input.value=after; const delta=after.length-before.length; const pos=Math.max(0,(caret??after.length)+delta); try{input.setSelectionRange(pos,pos);}catch{}} renderTagPreview(input,preview); };
  input.addEventListener('input',sync);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault(); const trimmed=input.value.trim(); if(trimmed&&!/[;,]\s*$/.test(trimmed))input.value=`${trimmed}, `; sync();} });
  sync();
}
function toast(message) { const region = $('#toastRegion'); if (!region) return; const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; region.appendChild(el); setTimeout(() => el.remove(), 3600); }
function setBackendStatus(title, text, tone = '') { $('#backendStatusTitle').textContent = title; $('#backendStatusText').textContent = text; $('#backendStatusCard').dataset.tone = tone; }
function requireUser() { if (state.authUid && state.profileId) return true; showDialog('#authDialog'); return false; }
function ownProfile() { return state.publicProfile || (state.profileId ? state.profiles[state.profileId] : null) || { id: state.profileId, displayName: generatedPublicName(state.profileId), bio: '' }; }
function identity(profileId, fallback = 'Member') { return state.profiles[profileId] || { id: profileId, displayName: fallback, bio: '' }; }
function currentPublicId() { return state.profileId || ''; }
function referencedProfileIds() {
  const ids=new Set();
  const add=id=>{if(typeof id==='string'&&id)ids.add(id);};
  state.posts.forEach(x=>add(x.authorProfileId)); state.objects.forEach(x=>add(x.authorProfileId)); state.lfg.forEach(x=>add(x.authorProfileId));
  state.statusPublic.forEach(x=>add(x.profileId)); state.statusOwn.forEach(x=>add(x.profileId)); state.follows.forEach(x=>{add(x.followerProfileId);if(x.targetType==='profile')add(x.targetId);});
  state.friendRequests.forEach(x=>{add(x.fromProfileId);add(x.toProfileId);}); state.friendships.forEach(x=>(x.members||[]).forEach(add));
  return [...ids];
}
function synthesizeReferencedProfiles() {
  referencedProfileIds().forEach(id=>{if(!state.profiles[id])state.profiles[id]={id,displayName:generatedPublicName(id),bio:'Public profile metadata has not synced yet.',_stub:true};});
}
async function hydrateReferencedProfiles() {
  if(!state.firebaseReady||!state.firebase?.db)return; synthesizeReferencedProfiles();
  const ids=referencedProfileIds().filter(id=>state.profiles[id]?._stub&&!state.profileHydrationPending.has(id)).slice(0,120);
  if(!ids.length)return; const {db,fsMod}=state.firebase; ids.forEach(id=>state.profileHydrationPending.add(id));
  await Promise.allSettled(ids.map(async id=>{try{const snap=await fsMod.getDoc(fsMod.doc(db,'publicProfiles',id));if(snap.exists())state.profiles[id]={id:snap.id,...snap.data()};}finally{state.profileHydrationPending.delete(id);}}));
  synthesizeReferencedProfiles(); renderSearchPanel(); renderConnections(); renderStatusTargetOptions(); renderFeed(); renderCatalogs();
}
function renderPublicProfileDirectory(){
  const root=$('#publicProfileDirectory'); if(!root)return; synthesizeReferencedProfiles();
  const rows=Object.values(state.profiles).filter(p=>p?.id&&p.id!==state.profileId&&!isBlocked(p.id)).sort((a,b)=>{if(Boolean(a._stub)!==Boolean(b._stub))return a._stub?1:-1;return String(a.displayName||'').localeCompare(String(b.displayName||''));}).slice(0,120);
  root.innerHTML=rows.length?rows.map(p=>renderPersonRow(p.id,p._stub?'Profile metadata pending sync':(p.bio||'Public LCS profile'))).join(''):'<p class="muted">No other public profiles have synced yet.</p>';
}
function publicIdShort(id = '') { return id ? `${id.slice(0, 8)}…${id.slice(-4)}` : 'Not created'; }
function visibleItems(items) { return items.filter(x => !x.deleted); }
function parseTags(v = '') { return [...new Set(String(v).split(/[,;\n]+/).map(s => s.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase()).filter(Boolean))].slice(0, 8); }
function containsContactData(text = '') { const v = String(text); return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(v) || /(?:\+?\d[\s().-]*){8,}/.test(v); }
function profileFollowEdge(profileId, targetId) { return state.follows.find(f => f.followerProfileId === profileId && f.targetType === 'profile' && f.targetId === targetId); }
function isFollowing(type, id) { return Boolean(state.profileId && state.follows.some(f => f.followerProfileId === state.profileId && f.targetType === type && f.targetId === id)); }
function followCount(type, id) { return state.follows.filter(f => f.targetType === type && f.targetId === id).length; }
function reactionCount(type, id) { return state.reactions.filter(r => r.targetType === type && r.targetId === id && r.type === 'helpful').length; }
function responseCount(type,id){const key=`${type}:${id}`;return state.comments.filter(c=>c.targetKey===key&&!c.deleted).length;}

const MOMENTUM_MODES = Object.freeze({
  create:{label:'Create',symbol:'✦',description:'Surface unfinished ideas and projects where a concrete artifact or next build can move the work.'},
  solve:{label:'Solve',symbol:'?',description:'Prioritize clearly stated problems and the evidence or work that could change them.'},
  test:{label:'Test',symbol:'🧪',description:'Prioritize hypotheses, questions, and work that benefits from observations, evidence, and contradiction.'},
  explore:{label:'Explore',symbol:'◎',description:'Keep discovery broad while showing the work with the strongest current momentum signals.'},
  collaborate:{label:'Collaborate',symbol:'↔',description:'Prioritize projects and LFG contexts where another person can materially change the outcome.'}
});
const DAI_CONTEXT_META = Object.freeze({
  experiences:'Experiences',addons:'Addons',entities:'Entities',gameplay:'Gameplay',presentation:'Presentation',worlds:'Worlds',content:'Content',distribution:'Distribution',creator:'Creator',engine:'Engine',ecosystem:'DAI ecosystem'
});
const SESSION_IMPACT_KEYS = Object.freeze({created:'Created',tested:'Evidence added',challenged:'Questions / challenges',connected:'Connections made',collaborated:'Collaboration moves',helped:'Helpful signals',responses:'Responses added'});

function loadSessionImpact(){
  try{const raw=JSON.parse(sessionStorage.getItem('lcsSessionImpact')||'{}');return Object.fromEntries(Object.keys(SESSION_IMPACT_KEYS).map(k=>[k,Math.max(0,Number(raw[k])||0)]));}
  catch{return Object.fromEntries(Object.keys(SESSION_IMPACT_KEYS).map(k=>[k,0]));}
}
function impactTotal(){return Object.values(state.sessionImpact||{}).reduce((a,b)=>a+(Number(b)||0),0);}
function bumpImpact(key,amount=1){
  if(!SESSION_IMPACT_KEYS[key])return;
  state.sessionImpact[key]=(Number(state.sessionImpact[key])||0)+amount;
  try{sessionStorage.setItem('lcsSessionImpact',JSON.stringify(state.sessionImpact));}catch{}
  renderSessionMomentum();
  document.body.classList.remove('momentum-pulse');void document.body.offsetWidth;document.body.classList.add('momentum-pulse');setTimeout(()=>document.body.classList.remove('momentum-pulse'),700);
}
function renderSessionMomentum(){
  const total=impactTotal(),badge=$('#sessionMomentumTotal'),root=$('#sessionMomentum');
  if(badge)badge.textContent=`${total} ${total===1?'move':'moves'}`;
  if(root)root.innerHTML=Object.entries(SESSION_IMPACT_KEYS).map(([key,label])=>`<div class="session-impact-item ${state.sessionImpact[key]?'has-impact':''}"><b>${Number(state.sessionImpact[key])||0}</b><span>${escapeHtml(label)}</span></div>`).join('');
  const recap=$('#impactRecap');if(recap)recap.innerHTML=total?`<div class="impact-total"><b>${total}</b><span>state-changing moves this session</span></div><div class="impact-recap-grid">${Object.entries(SESSION_IMPACT_KEYS).filter(([k])=>state.sessionImpact[k]).map(([k,label])=>`<div><b>${state.sessionImpact[k]}</b><span>${escapeHtml(label)}</span></div>`).join('')}</div><p class="impact-note">The useful part is the trail of created work, evidence, questions, connections, and collaboration — not the number itself.</p>`:'<div class="empty-state"><b>No session moves yet.</b><span>Create, test, respond, connect, or collaborate and the recap will update immediately.</span></div>';
}
function resetSessionImpact(){state.sessionImpact=Object.fromEntries(Object.keys(SESSION_IMPACT_KEYS).map(k=>[k,0]));try{sessionStorage.removeItem('lcsSessionImpact');}catch{}renderSessionMomentum();toast('Session recap cleared.');}

function discussionSignals(type,id){
  const key=`${type}:${id}`,rows=state.comments.filter(c=>c.targetKey===key&&!c.deleted);
  const evidence=rows.filter(c=>c.reasoningType==='observation'||c.reasoningType==='premise').length;
  const challenge=rows.filter(c=>c.reasoningType==='question'||c.reasoningType==='assumption').length;
  return {responses:rows.length,evidence,challenge};
}
function objectSignals(o){
  const d=discussionSignals('object',o.id),connections=state.connections.filter(c=>c.sourceId===o.id||c.targetId===o.id).length;
  return {...d,connections,reactions:reactionCount('object',o.id),follows:followCount('object',o.id)};
}
function objectMomentum(o){
  const s=objectSignals(o);const score=Math.min(100,8+s.responses*7+s.evidence*7+s.challenge*3+s.connections*10+s.reactions*3+s.follows*2);
  const stages={idea:['Signal','Defined','Testing','Build-ready','Active build'],problem:['Reported','Clarifying','Testing','Solution forming','Action path'],project:['Concept','Prototype','Testing','Iteration','Release-ready']};
  const idx=score<22?0:score<42?1:score<62?2:score<82?3:4;return {score,stage:(stages[o.kind]||stages.idea)[idx],...s};
}
function momentumMarkup(o,compact=false){const m=objectMomentum(o);return `<div class="momentum-meter ${compact?'compact':''}" title="Momentum is derived from public responses, evidence-labelled responses, connections, helpful signals, and follows. It is not a completion or truth score."><div class="momentum-meter-head"><span>${escapeHtml(m.stage)}</span><b>Momentum ${m.score}</b></div><div class="momentum-track"><i style="width:${m.score}%"></i></div><div class="momentum-signals"><span>🧪 ${m.evidence} evidence</span><span>💬 ${m.responses} responses</span><span>↗ ${m.connections} links</span></div></div>`;}
function postMomentumPriority(p){const d=discussionSignals('post',p.id),base=d.responses*5+d.evidence*7+reactionCount('post',p.id)*2;switch(state.momentumMode){case'create':return (p.kind==='idea'||p.kind==='project'?25:0)+base;case'solve':return (p.kind==='problem'?35:0)+base;case'test':return (p.reasoningType==='hypothesis'||p.reasoningType==='question'?40:0)+(p.kind==='problem'?15:0)+d.challenge*4+base;case'collaborate':return (p.kind==='project'?30:0)+base;default:return base;}}
function objectMomentumPriority(o){const m=objectMomentum(o);switch(state.momentumMode){case'create':return (o.kind==='idea'?38:o.kind==='project'?28:0)+(100-m.score)*.12;case'solve':return (o.kind==='problem'?55:0)+m.challenge*4+m.evidence*4;case'test':return (o.kind==='problem'?30:15)+(m.challenge*7)+(20-Math.min(20,m.evidence*4));case'collaborate':return (o.kind==='project'?50:12)+m.follows*3+m.connections*2;default:return m.score;}}
function momentumActionsForObject(o){
  if(o.kind==='problem')return `<button data-momentum-action="test" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">🧪 Add evidence</button><button data-momentum-action="build" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">✦ Build a response</button><button data-momentum-action="collaborate" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">↔ Collaborate</button>`;
  if(o.kind==='project')return `<button data-momentum-action="test" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">🧪 Test this</button><button data-momentum-action="collaborate" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">↔ Join the work</button><button data-connect-object="${escapeHtml(o.id)}" type="button">↗ Connect</button>`;
  return `<button data-momentum-action="build" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">✦ Build from this</button><button data-momentum-action="challenge" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">? Question it</button><button data-momentum-action="test" data-target-type="object" data-target-id="${escapeHtml(o.id)}" type="button">🧪 Test it</button>`;
}
function momentumActionsForPost(p){return `<button data-momentum-action="evidence" data-target-type="post" data-target-id="${escapeHtml(p.id)}" type="button">🧪 Add evidence</button><button data-momentum-action="challenge" data-target-type="post" data-target-id="${escapeHtml(p.id)}" type="button">? Challenge / ask</button><button data-open-post="${escapeHtml(p.id)}" type="button">💬 Open</button>`;}
function renderMomentumDeck(){
  const root=$('#momentumDeck');if(!root)return;const mode=MOMENTUM_MODES[state.momentumMode]||MOMENTUM_MODES.explore;const desc=$('#momentumModeDescription');if(desc)desc.textContent=mode.description;
  $$('[data-momentum-mode]').forEach(b=>b.classList.toggle('active',b.dataset.momentumMode===state.momentumMode));
  let entries=[];
  const objects=visibleItems(state.objects).filter(o=>!isBlocked(o.authorProfileId));const posts=visibleItems(state.posts).filter(p=>!isBlocked(p.authorProfileId));
  if(state.momentumMode==='collaborate'){
    entries.push(...state.lfg.filter(x=>x.status==='open'&&!isBlocked(x.authorProfileId)).slice(0,3).map(x=>({type:'lfg',item:x,priority:100+timeValue(x.createdAt)/1e12})));
    entries.push(...objects.filter(o=>o.kind==='project').map(o=>({type:'object',item:o,priority:objectMomentumPriority(o)})));
  }else if(state.momentumMode==='test'){
    entries.push(...objects.map(o=>({type:'object',item:o,priority:objectMomentumPriority(o)})));
    entries.push(...posts.filter(p=>p.reasoningType==='hypothesis'||p.reasoningType==='question'||p.kind==='problem').map(p=>({type:'post',item:p,priority:postMomentumPriority(p)})));
  }else if(state.momentumMode==='solve') entries.push(...objects.filter(o=>o.kind==='problem').map(o=>({type:'object',item:o,priority:objectMomentumPriority(o)})));
  else if(state.momentumMode==='create') entries.push(...objects.filter(o=>o.kind==='idea'||o.kind==='project').map(o=>({type:'object',item:o,priority:objectMomentumPriority(o)})));
  else {entries.push(...objects.map(o=>({type:'object',item:o,priority:objectMomentumPriority(o)})));entries.push(...posts.map(p=>({type:'post',item:p,priority:postMomentumPriority(p)})));}
  entries.sort((a,b)=>b.priority-a.priority);entries=entries.slice(0,4);
  if(!entries.length){root.innerHTML=`<div class="momentum-empty"><b>No matching work yet.</b><span>That is a useful signal: create the first context instead of scrolling for one.</span><button class="primary-button" data-momentum-new="${state.momentumMode==='solve'?'problem':state.momentumMode==='collaborate'?'project':'idea'}" type="button">Start something</button></div>`;return;}
  root.innerHTML=entries.map(({type,item})=>{
    if(type==='lfg'){const who=identity(item.authorProfileId);return `<article class="momentum-card momentum-lfg"><div class="momentum-card-top"><span>↔ COLLABORATE</span><small>${timeAgo(item.createdAt)}</small></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="momentum-card-foot"><span>${escapeHtml(who.displayName)} · ${escapeHtml(item.topic)}</span><button data-open-lfg="${escapeHtml(item.id)}" type="button">Open match →</button></div></article>`;}
    if(type==='post'){const p=item,r=reasoning[p.reasoningType]||reasoning.unclassified;return `<article class="momentum-card"><div class="momentum-card-top"><span>${r.symbol} ${escapeHtml(r.plain)}</span><small>${timeAgo(p.createdAt)}</small></div><p class="momentum-post-copy">${escapeHtml(p.text)}</p><div class="momentum-card-actions">${momentumActionsForPost(p)}</div></article>`;}
    const o=item;return `<article class="momentum-card"><div class="momentum-card-top"><span>${o.kind==='idea'?'💡 IDEA':o.kind==='problem'?'? PROBLEM':'◆ PROJECT'}</span><small>${timeAgo(o.createdAt)}</small></div><h3>${escapeHtml(o.title)}</h3><p>${escapeHtml(o.description)}</p>${momentumMarkup(o,true)}<div class="momentum-card-actions">${momentumActionsForObject(o)}</div></article>`;
  }).join('');
}
function setMomentumMode(mode){if(!MOMENTUM_MODES[mode])return;state.momentumMode=mode;try{sessionStorage.setItem('lcsMomentumMode',mode);}catch{}renderMomentumDeck();renderFeed();}
function prepareResponse(type,id,reasoningType,placeholder){if(type==='post')openPostDetail(id);else openObjectDetail(id);setTimeout(()=>{const select=$('#detailCommentReasoning'),text=$('#detailCommentText');if(select)select.value=reasoningType;if(text){text.placeholder=placeholder;text.focus();}},30);}
function buildFromObject(id){const o=state.objects.find(x=>x.id===id);if(!o)return;if(!requireUser())return;openCreate('project');setTimeout(()=>{const related=$('#createRelatedObject'),tags=$('#createTags'),desc=$('#createDescription');if(related)related.value=o.id;if(tags){tags.value=[...(o.tags||[]),'build'].filter(Boolean).join(', ');renderTagPreview(tags,$('#createTagPreview'));}if(desc)desc.placeholder=`What concrete build, prototype, or solution will move “${o.title.slice(0,70)}” forward?`;},20);}
function collaborateOnObject(id){const o=state.objects.find(x=>x.id===id);if(!o||!requireUser())return;showDialog('#lfgDialog');setTimeout(()=>{if($('#lfgPurpose'))$('#lfgPurpose').value='create';if($('#lfgTitle'))$('#lfgTitle').value=`Collaborate: ${o.title}`.slice(0,100);if($('#lfgTopic'))$('#lfgTopic').value=o.title.slice(0,80);if($('#lfgDescription'))$('#lfgDescription').value=`Looking for collaborators who can help move this ${o.kind} forward. Context: ${o.description}`.slice(0,700);if($('#lfgTags')){$('#lfgTags').value=[...(o.tags||[]),'collaboration'].join(', ');renderTagPreview($('#lfgTags'),$('#lfgTagPreview'));}},20);}
function handleMomentumAction(action,type,id){if(action==='build'&&type==='object'){buildFromObject(id);return;}if(action==='collaborate'&&type==='object'){collaborateOnObject(id);return;}const presets={test:['observation','What did you test? Describe the setup, result, and anything another person could reproduce.'],evidence:['observation','What did you observe, measure, reproduce, or verify?'],challenge:['question','What assumption, missing information, contradiction, or alternate explanation should be checked?']};const p=presets[action];if(p)prepareResponse(type,id,p[0],p[1]);}

function readNetworkContext(){const q=new URLSearchParams(location.search);if(q.get('source')!=='dai')return null;const context=DAI_CONTEXT_META[q.get('context')]?q.get('context'):'ecosystem';return {context,topic:(q.get('topic')||'').slice(0,140),mode:MOMENTUM_MODES[q.get('mode')]?q.get('mode'):'explore'};}
function renderNetworkContext(){const card=$('#networkContextCard');if(!card)return;if(!state.networkContext){card.hidden=true;return;}const meta=DAI_CONTEXT_META[state.networkContext.context]||'DAI ecosystem';$('#networkContextTitle').textContent=`DAI suggested: ${meta}`;$('#networkContextText').textContent=state.networkContext.topic?`From “${state.networkContext.topic}”. This is only a suggested correlation — nothing is automatically categorized, posted, or linked.`:'This is only a suggested correlation — nothing is automatically categorized, posted, or linked.';card.hidden=false;}
function exploreNetworkContext(){if(!state.networkContext)return;const search=$('#globalSearch');if(search){search.value=[state.networkContext.topic,DAI_CONTEXT_META[state.networkContext.context],'DAI'].filter(Boolean).join(' ');renderSearchPanel();renderFeed();renderCatalogs();renderLfg();search.focus();toast('Suggested DAI context applied to search only.');}}
function useNetworkContextInPost(){if(!state.networkContext)return;setView('home');const tags=$('#postTags'),tag=state.networkContext.context;if(tags){const existing=parseTags(tags.value);tags.value=[...new Set([...existing,'dai',tag])].join(', ');renderTagPreview(tags,$('#postTagPreview'));}$('#composerText')?.focus();$('#composer')?.scrollIntoView({behavior:'smooth',block:'center'});toast('DAI context added as editable post tags. No relationship was created.');}
function clearNetworkContext(){state.networkContext=null;renderNetworkContext();const u=new URL(location.href);['source','context','topic','mode'].forEach(k=>u.searchParams.delete(k));history.replaceState({},'',u.pathname+(u.search?u.search:'')+u.hash);}

function isBlocked(profileId) { return Boolean(profileId && state.blocks.some(b => b.blockerProfileId === state.profileId && b.blockedProfileId === profileId)); }
function isOwnReaction(type, id) { return Boolean(state.profileId && state.reactions.some(r => r.actorProfileId === state.profileId && r.targetType === type && r.targetId === id && r.type === 'helpful')); }
function isStatusActive(row) { return Boolean(row?.active && (!row.expiresAt || timeValue(row.expiresAt) > Date.now())); }
function activeStatusesFor(profileId = state.profileId) { return state.statuses.filter(s => s.profileId === profileId && isStatusActive(s)); }
function hasStatus(status, scopeType = 'global', scopeId = '_', profileId = state.profileId) { return activeStatusesFor(profileId).some(s => s.status === status && s.scopeType === scopeType && s.scopeId === scopeId); }
function isFounder(profileId = state.profileId) { return Boolean(profileId && hasStatus('founder','global','_',profileId)); }
function isGlobalModerator(profileId = state.profileId) { return Boolean(profileId && (isFounder(profileId) || hasStatus('moderator','global','_',profileId))); }
function isGlobalTimedOut(profileId = state.profileId) { return Boolean(profileId && !isFounder(profileId) && hasStatus('timeout','global','_',profileId)); }
function statusScopeForDiscussion(type) { return type === 'post' ? 'discussion_post' : 'discussion_object'; }
function timedOutForDiscussionClient(type,id) { if(isGlobalTimedOut())return true; if(hasStatus('timeout',statusScopeForDiscussion(type),id))return true; const o=type==='object'?state.objects.find(x=>x.id===id):null; return Boolean(o?.kind==='project'&&hasStatus('timeout','project',id)); }
function canModerateDiscussionClient(type,id) { if(!state.profileId||isGlobalTimedOut())return false; if(isGlobalModerator())return true; if(hasStatus('moderator',statusScopeForDiscussion(type),id))return true; const o=type==='object'?state.objects.find(x=>x.id===id):null; return Boolean(o?.kind==='project'&&hasStatus('moderator','project',id)); }
function canModerateObjectClient(o) { return Boolean(o && state.profileId && !isGlobalTimedOut() && (isGlobalModerator() || (o.kind==='project' && hasStatus('moderator','project',o.id)))); }
function mergeStatusRows() { const rows=[...state.statusPublic,...state.statusOwn,...state.statusPrivileged]; state.statuses=[...new Map(rows.map(x=>[x.id,x])).values()]; renderStatusSurfaces(); setupModerationSubscriptions(); }
function statusBadgeMarkup(profileId, scopeType='global', scopeId='_') { return activeStatusesFor(profileId).filter(s=>s.visibility==='public' && (s.scopeType==='global' || (s.scopeType===scopeType&&s.scopeId===scopeId))).map(s=>`<span class="status-badge status-${escapeHtml(s.status)}">${STATUS_META[s.status]?.symbol||'•'} ${escapeHtml(STATUS_META[s.status]?.label||s.status)}</span>`).join(''); }
function requireContribution(scopeType='global',scopeId='_'){if(!requireUser())return false;if(isGlobalTimedOut()){toast('Timeout is active. LCS is read-only for this account.');return false;}if(scopeType!=='global'&&hasStatus('timeout',scopeType,scopeId)){toast('Timeout is active for this context. You can still read it.');return false;}return true;}

function allSpaces() { const seen = new Set([SYSTEM_SPACE.id]); return [SYSTEM_SPACE, ...state.spaces.filter(s => s?.id && !seen.has(s.id) && seen.add(s.id))]; }
function spaceById(id) { return allSpaces().find(s => s.id === id) || SYSTEM_SPACE; }
function legacyGeneralChannel(spaceId) { return { id: `${spaceId}-general`, spaceId, name: 'general', description: 'General public discussion.', type: 'discussion', virtual: true }; }
function channelsForSpace(spaceId) { if (spaceId === SYSTEM_SPACE.id) return SYSTEM_CHANNELS; const rows = state.channels.filter(c => c.spaceId === spaceId && !c.deleted); return rows.length ? rows : [legacyGeneralChannel(spaceId)]; }
function allChannels() { return allSpaces().flatMap(s => channelsForSpace(s.id)); }
function channelById(id, spaceId = '') { return allChannels().find(c => c.id === id) || channelsForSpace(spaceId || SYSTEM_SPACE.id)[0] || SYSTEM_CHANNELS[0]; }
async function ensureWritableChannel(channel) {
  if(!channel?.virtual)return channel;
  const space=state.spaces.find(s=>s.id===channel.spaceId);
  if(!space)throw new Error('The selected community is no longer available.');
  if(space.ownerProfileId!==state.profileId&&!isFounder())throw new Error('This community still uses a legacy #general channel. Its owner or the Founder must repair it before new posts can be published there.');
  const {db,fsMod}=state.firebase, ref=fsMod.doc(db,'publicChannels',channel.id);
  let snap=await fsMod.getDoc(ref);
  if(!snap.exists()){
    const payload={spaceId:space.id,name:'general',description:'General public discussion.',type:'discussion',ownerProfileId:space.ownerProfileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()};
    await fsMod.setDoc(ref,payload,{merge:false});
    snap=await fsMod.getDoc(ref);
  }
  const repaired={id:channel.id,...(snap.exists()?snap.data():{spaceId:space.id,name:'general',description:'General public discussion.',type:'discussion',ownerProfileId:space.ownerProfileId}),virtual:false};
  state.channels=[repaired,...state.channels.filter(c=>c.id!==repaired.id)]; renderSpaces();renderCommunities();renderChannelSelects();
  toast(`#general repaired for ${space.name}.`); return repaired;
}
function channelMeta(type) { return CHANNEL_TYPES[type] || CHANNEL_TYPES.discussion; }
function itemChannelId(item) { return item.channelId || `${item.spaceId || SYSTEM_SPACE.id}-general`; }
function contentMatchesQuery(content, extra = '') { const q = ($('#globalSearch')?.value || '').trim().toLowerCase(); return !q || `${content || ''} ${extra || ''}`.toLowerCase().includes(q); }

function setView(view, updateHash = true) {
  const valid = ['home','universe','ideas','problems','projects','communities','connections','lfg','moderation','account'];
  state.activeView = valid.includes(view) ? view : 'home';
  $$('.view').forEach(v => v.classList.toggle('active-view', v.id === `view-${state.activeView}`));
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.activeView));
  if (updateHash) history.replaceState(null, '', `#${state.activeView}`);
  if (state.activeView === 'universe') renderUniverse();
  if (state.activeView === 'connections') renderConnections();
  if (state.activeView === 'lfg') renderLfg();
  if (state.activeView === 'account') renderAccount();
  if (state.activeView === 'moderation') renderModeration();
}

function renderAuth() {
  const area = $('#authArea');
  if (!state.authReady) { area.innerHTML = '<div class="auth-checking"><span class="auth-checking-dot"></span><span>Checking account…</span></div>'; return; }
  if (!state.authUid) { area.innerHTML = '<button class="primary-button" data-open-auth type="button">Sign in</button>'; $('#composerName').textContent = 'Share a thought'; $('#composerAvatar').textContent = 'You'; return; }
  if (!state.profileId) { area.innerHTML = '<div class="auth-checking"><span class="auth-checking-dot"></span><span>Linking public identity…</span></div>'; return; }
  const p = ownProfile();
  area.innerHTML = `<div class="auth-user"><button class="auth-account-main" data-open-account type="button">${avatarMarkup(p,'auth-fallback-avatar')}<span>${escapeHtml(p.displayName || 'Account')}</span><span class="status-badge-row">${statusBadgeMarkup(state.profileId)}</span></button><button id="signOutButton" type="button" aria-label="Sign out">↪</button></div>`;
  $('#composerName').textContent = p.displayName || 'Share a thought'; $('#composerAvatar').innerHTML = avatarMarkup(p,'composer-avatar-composite');
}

function renderAccount() {
  $('#accountAuthLoading').hidden = state.authReady;
  $('#accountSignedOut').hidden = !state.authReady || Boolean(state.authUid);
  $('#accountSignedIn').hidden = !state.authReady || !state.authUid;
  if (!state.authUid) return;
  const p = ownProfile();
  if (!state.accountDirty) { $('#accountDisplayName').value = p.displayName || generatedPublicName(state.profileId); $('#accountBio').value = p.bio || ''; }
  $('#accountPreviewName').textContent = $('#accountDisplayName').value || p.displayName || 'Member';
  $('#accountPreviewBio').textContent = $('#accountBio').value || 'No public bio yet.';
  $('#accountPublicAvatar').innerHTML = avatarMarkup(p,'account-avatar-composite');
  $('#accountBioCounter').textContent = `${$('#accountBio').value.length} / 240`;
  $('#accountConnectionStatus').textContent = state.profileId ? 'Connected · private Firebase mapping active · public profile separated' : 'Creating private identity mapping…';
  $('#accountPublicId').textContent = state.profileId ? publicIdShort(state.profileId) : 'Creating…';
  const fullId=$('#accountFullPublicId'); if(fullId) fullId.textContent=state.profileId||'Creating…';
  $('#accountSaveStatus').textContent = state.profileSaveStatus || (state.profileVerified ? 'Public profile synced' : 'Public profile connecting');
  $('#accountSaveButton').disabled = state.profileSavePending || !state.profileId;
  $('#accountSaveButton').textContent = state.profileSavePending ? 'Saving…' : 'Save public profile';
  $('#accountPublicSyncStatus').textContent = state.accountDirty ? 'Editing' : (state.profileVerified ? 'Synced' : 'Connecting');
  $('#accountPublicSyncStatus').dataset.tone = state.accountDirty ? 'editing' : (state.profileVerified ? 'ok' : 'loading');
}

function markAccountDirty() { state.accountDirty = true; state.profileSaveStatus = 'Unsaved changes'; renderAccount(); }

function avatarEditorRead() {
  const raw = $('#avatarJsonEditor')?.value || '';
  try {
    const parsed = validateAvatarSpec(JSON.parse(raw));
    $('#avatarEditorPreview').innerHTML = `<span class="avatar-editor-live avatar-composite">${avatarSvgInner(parsed)}</span>`;
    $('#avatarEditorError').hidden = true;
    $('#avatarEditorErrorText').textContent = '';
    $('#avatarSaveButton').disabled = false;
    $('#avatarEditorStatus').textContent = 'Valid · preview updated live';
    return parsed;
  } catch (error) {
    $('#avatarEditorError').hidden = false;
    $('#avatarEditorErrorText').textContent = error?.message || 'Invalid avatar JSON.';
    $('#avatarSaveButton').disabled = true;
    $('#avatarEditorStatus').textContent = 'Fix the JSON before saving';
    return null;
  }
}
function openAvatarEditor() {
  if (!requireUser() || !state.profileId) return;
  $('#avatarJsonEditor').value = prettyAvatarJson(ownProfile());
  avatarEditorRead();
  showDialog('#avatarEditorDialog');
  setTimeout(() => $('#avatarJsonEditor')?.focus(), 0);
}
async function saveAvatarJson() {
  if (!requireUser() || !state.profileId) return;
  const parsed = avatarEditorRead(); if (!parsed) return;
  const canonical = JSON.stringify(parsed, null, 2);
  if (canonical.length > AVATAR_JSON_MAX_CHARS) { $('#avatarEditorError').hidden = false; $('#avatarEditorErrorText').textContent = `The canonical avatar JSON is larger than the ${AVATAR_JSON_MAX_CHARS.toLocaleString()}-character profile limit.`; return; }
  const button = $('#avatarSaveButton'); button.disabled = true; button.textContent = 'Saving…'; $('#avatarEditorStatus').textContent = 'Saving public avatar…';
  try {
    const {db,fsMod}=state.firebase;
    await fsMod.setDoc(fsMod.doc(db,'publicProfiles',state.profileId),{avatarJson:canonical,updatedAt:fsMod.serverTimestamp()},{merge:true});
    state.publicProfile = {...ownProfile(), avatarJson: canonical}; state.profiles[state.profileId] = state.publicProfile;
    $('#accountPublicAvatar').innerHTML = avatarMarkup(state.publicProfile,'account-avatar-composite');
    $('#avatarEditorStatus').textContent = 'Saved · public avatar updated'; toast('Profile image JSON saved.');
    setTimeout(() => { const d=$('#avatarEditorDialog'); if(d?.open)d.close(); }, 350);
  } catch (error) {
    console.error(error); $('#avatarEditorError').hidden = false; $('#avatarEditorErrorText').textContent = 'Firestore rejected or could not save the avatar JSON.'; $('#avatarEditorStatus').textContent = 'Save failed';
  } finally { button.disabled = false; button.textContent = 'Save profile image'; renderAuth(); renderAccount(); renderFeed(); renderConnections(); }
}

function renderSpaces() {
  const root = $('#spaceList'); if (!root) return;
  const allActive = state.activeSpaceId === 'all' && state.activeChannelId === 'all';
  root.innerHTML = `<button class="space-item network-all ${allActive ? 'active' : ''}" data-space-filter="all" type="button"><span>◎</span><b>Whole network</b></button>` + allSpaces().map(space => {
    const active = state.activeSpaceId === space.id;
    return `<div class="community-nav-group ${active ? 'active-community' : ''}"><button class="space-item community-item" data-space-filter="${escapeHtml(space.id)}" type="button"><span>${space.system ? '✦' : '▦'}</span><b>${escapeHtml(space.name)}</b></button><div class="channel-nav-list">${channelsForSpace(space.id).map(c => `<button class="channel-nav-item ${state.activeChannelId === c.id ? 'active' : ''}" data-channel-filter="${escapeHtml(c.id)}" type="button"><span>${channelMeta(c.type).symbol}</span><b># ${escapeHtml(c.name)}</b></button>`).join('')}</div></div>`;
  }).join('');
  renderChannelSelects();
}
function renderChannelSelects() {
  const html = allSpaces().map(s => `<optgroup label="${escapeHtml(s.name)}">${channelsForSpace(s.id).map(c => `<option value="${escapeHtml(c.id)}"># ${escapeHtml(c.name)} · ${escapeHtml(channelMeta(c.type).label)}</option>`).join('')}</optgroup>`).join('');
  ['postChannel','createChannelSelect'].forEach(id => { const el = $(`#${id}`); if (!el) return; const old = el.value; el.innerHTML = html; if ([...el.options].some(o => o.value === old)) el.value = old; });
  const owned = state.spaces.filter(s => s.ownerProfileId === state.profileId);
  const community = $('#channelCommunity'); if (community) { const old = community.value; community.innerHTML = owned.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join(''); if ([...community.options].some(o => o.value === old)) community.value = old; }
}
function setActiveChannel(id) { const c = channelById(id); state.activeChannelId = c.id; state.activeSpaceId = c.spaceId; setView('home'); renderSpaces(); renderFeed(); renderCatalogs(); }

function feedItems() {
  return visibleItems(state.posts).filter(p => !isBlocked(p.authorProfileId) && (state.activeFilter === 'all' || p.kind === state.activeFilter) && (state.activeSpaceId === 'all' || p.spaceId === state.activeSpaceId) && (state.activeChannelId === 'all' || itemChannelId(p) === state.activeChannelId) && contentMatchesQuery(p.text, `${(p.tags||[]).join(' ')} ${identity(p.authorProfileId).displayName} ${spaceById(p.spaceId).name}`));
}
function renderFeed() {
  const root = $('#feed'); if (!root) return; const items = feedItems().sort((a,b) => (postMomentumPriority(b)-postMomentumPriority(a)) || (timeValue(b.createdAt)-timeValue(a.createdAt)));
  if (!items.length) { root.innerHTML = '<div class="empty-state"><b>No public posts match this view yet.</b><span>Start the context instead of waiting for it.</span></div>'; return; }
  root.innerHTML = items.slice(0,160).map(p => { const who = identity(p.authorProfileId); const r = reasoning[p.reasoningType] || reasoning.unclassified; const helpful = isOwnReaction('post',p.id); const channel = channelById(itemChannelId(p),p.spaceId); return `<article class="post-card"><div class="post-head"><button class="post-author identity-button" data-open-profile="${escapeHtml(p.authorProfileId)}" type="button">${avatarMarkup(who)}<span class="post-author-copy"><b>${escapeHtml(who.displayName)}</b><small>${escapeHtml(spaceById(p.spaceId).name)} · #${escapeHtml(channel.name)} · ${timeAgo(p.createdAt)}</small></span></button><button class="reason-pill" data-reason="${escapeHtml(p.reasoningType)}" type="button"><span>${r.symbol}</span>${escapeHtml(r.plain)}</button></div><button class="post-body-button" data-open-post="${escapeHtml(p.id)}" type="button"><p class="post-text">${escapeHtml(p.text)}</p>${(p.tags||[]).length?`<div class="post-tag-row tag-row">${p.tags.map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>`:''}</button><div class="post-actions"><button class="ghost-button" data-open-post="${escapeHtml(p.id)}" type="button">💬 Responses · ${responseCount('post',p.id)}</button><button class="ghost-button ${helpful ? 'active-action' : ''}" data-helpful-type="post" data-helpful-id="${escapeHtml(p.id)}" type="button">${helpful ? '♥' : '♡'} Helpful · ${reactionCount('post',p.id)}</button><button class="ghost-button" data-connect-post="${escapeHtml(p.id)}" type="button">↗ Connect</button></div></article>`; }).join('');
}

function catalogFor(kind) { return visibleItems(state.objects).filter(o => !isBlocked(o.authorProfileId) && o.kind === kind && (state.activeSpaceId === 'all' || o.spaceId === state.activeSpaceId) && (state.activeChannelId === 'all' || itemChannelId(o) === state.activeChannelId) && contentMatchesQuery(`${o.title} ${o.description}`, `${o.tags?.join(' ') || ''} ${identity(o.authorProfileId).displayName}`)); }
function renderCatalog(rootId, kind) {
  const root = $(`#${rootId}`); if (!root) return;
  const items = catalogFor(kind).sort((a,b)=>(objectMomentumPriority(b)-objectMomentumPriority(a))||(timeValue(b.createdAt)-timeValue(a.createdAt)));
  root.innerHTML = items.length ? items.map(o => {
    const who=identity(o.authorProfileId),following=isFollowing('object',o.id);
    return `<article class="catalog-card momentum-catalog-card"><button class="catalog-open" data-open-object="${escapeHtml(o.id)}" type="button"><div class="catalog-card-top"><span class="kind-badge ${escapeHtml(o.kind)}">${escapeHtml(o.kind)}</span><small>${timeAgo(o.createdAt)}</small></div><h3>${escapeHtml(o.title)}</h3><p>${escapeHtml(o.description)}</p><div class="tag-row">${(o.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>${momentumMarkup(o)}</button><div class="catalog-byline"><button class="identity-link" data-open-profile="${escapeHtml(o.authorProfileId)}" type="button">${escapeHtml(who.displayName)}</button><span>${escapeHtml(spaceById(o.spaceId).name)}</span></div><div class="catalog-actions momentum-catalog-actions">${momentumActionsForObject(o)}<button data-open-object="${escapeHtml(o.id)}" type="button">💬 ${responseCount('object',o.id)}</button><button class="${following?'active-action':''}" data-follow-type="object" data-follow-id="${escapeHtml(o.id)}" type="button">${following?'★':'☆'} ${followCount('object',o.id)}</button><button class="${isOwnReaction('object',o.id)?'active-action':''}" data-helpful-type="object" data-helpful-id="${escapeHtml(o.id)}" type="button">♡ ${reactionCount('object',o.id)}</button></div></article>`;
  }).join('') : '<div class="empty-state"><b>Nothing here yet.</b><span>Create the first public item in this context.</span></div>';
  renderMomentumDeck();
}
function renderCatalogs() { renderCatalog('ideaCatalog','idea'); renderCatalog('problemCatalog','problem'); renderCatalog('projectCatalog','project'); updateCreateRelatedOptions(); }

function renderCommunities() { const root=$('#communityCatalog'); if(!root)return; root.innerHTML=allSpaces().map(s=>{ const cs=channelsForSpace(s.id); const count=state.posts.filter(p=>p.spaceId===s.id&&!p.deleted).length+state.objects.filter(o=>o.spaceId===s.id&&!o.deleted).length; return `<article class="community-card"><div class="community-card-head"><div><p class="eyebrow">${s.system?'Network commons':'Public community'}</p><h2>${escapeHtml(s.name)}</h2><p>${escapeHtml(s.description||'No description yet.')}</p></div><div class="community-stats"><span><b>${cs.length}</b> channels</span><span><b>${count}</b> items</span></div></div><div class="community-channel-grid">${cs.map(c=>`<button class="community-channel-card" data-channel-filter="${escapeHtml(c.id)}" type="button"><span class="channel-symbol">${channelMeta(c.type).symbol}</span><span><b># ${escapeHtml(c.name)}</b><small>${escapeHtml(c.description||channelMeta(c.type).label)}</small></span><em>${state.posts.filter(p=>itemChannelId(p)===c.id&&!p.deleted).length}</em></button>`).join('')}</div>${s.ownerProfileId===state.profileId?`<div class="community-card-actions"><button class="ghost-button" data-new-channel="${escapeHtml(s.id)}" type="button">＋ Add channel</button></div>`:''}</article>`;}).join(''); }

function renderTrends() { const root=$('#trendList'); if(!root)return; const counts={}; state.connections.forEach(c=>counts[c.relation]=(counts[c.relation]||0)+1); const rows=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5); root.innerHTML=rows.length?rows.map(([k,v])=>`<div class="trend-row"><span>${escapeHtml(k)}</span><b>${v}</b></div>`).join(''):'<p class="muted">Relationships will trend as people connect public work.</p>'; }

function renderUniverse() {
  const canvas=$('#universeCanvas'), svg=$('#universeLines'); if(!canvas||!svg)return; const objs=visibleItems(state.objects).filter(o=>(state.activeSpaceId==='all'||o.spaceId===state.activeSpaceId)&&(state.activeChannelId==='all'||itemChannelId(o)===state.activeChannelId)).slice(0,36);
  if(!objs.length){canvas.innerHTML='<div class="map-empty">Create ideas, problems, and projects to give the map something to connect.</div>';svg.innerHTML='';return;}
  const w=Math.max(canvas.clientWidth||720,320), h=Math.max(420,Math.min(720,objs.length*28)); canvas.style.minHeight=`${h}px`; const positions={};
  canvas.innerHTML=objs.map((o,i)=>{const angle=(i/Math.max(objs.length,1))*Math.PI*2+state.mapLayoutSeed*.41;const ring=110+(i%4)*58;const x=w/2+Math.cos(angle)*Math.min(ring,w*.38);const y=h/2+Math.sin(angle)*ring*.65;positions[o.id]={x,y};const momentum=objectMomentum(o);return `<button class="universe-node node-${escapeHtml(o.kind)}" data-open-object="${escapeHtml(o.id)}" type="button" style="left:${Math.max(25,Math.min(w-130,x))}px;top:${Math.max(25,Math.min(h-70,y))}px;--node-momentum:${momentum.score}%"><span>${o.kind==='idea'?'💡':o.kind==='problem'?'?':'◆'}</span><b>${escapeHtml(o.title.slice(0,28))}</b><small>${escapeHtml(momentum.stage)} · ${momentum.score}</small></button>`;}).join('');
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`); svg.innerHTML=state.connections.filter(c=>positions[c.sourceId]&&positions[c.targetId]).map(c=>`<line x1="${positions[c.sourceId].x}" y1="${positions[c.sourceId].y}" x2="${positions[c.targetId].x}" y2="${positions[c.targetId].y}" />`).join('');
}

function renderSearchPanel() {
  const panel=$('#searchResultsPanel'), q=$('#globalSearch').value.trim().toLowerCase(); if(!q){panel.hidden=true;panel.innerHTML='';return;}
  const profiles=Object.values(state.profiles).filter(p=>!isBlocked(p.id)&&`${p.displayName} ${p.bio}`.toLowerCase().includes(q)).slice(0,5);
  const objects=visibleItems(state.objects).filter(o=>`${o.title} ${o.description} ${(o.tags||[]).join(' ')}`.toLowerCase().includes(q)).slice(0,5);
  const lfg=state.lfg.filter(x=>x.status==='open'&&!isBlocked(x.authorProfileId)&&`${x.title} ${x.topic} ${x.description} ${(x.tags||[]).join(' ')}`.toLowerCase().includes(q)).slice(0,5);
  const spaces=allSpaces().filter(s=>`${s.name} ${s.description||''}`.toLowerCase().includes(q)).slice(0,4);
  const groups=[];
  if(profiles.length) groups.push(`<div class="search-group"><b>People</b>${profiles.map(p=>`<button data-open-profile="${escapeHtml(p.id)}" type="button"><span>${escapeHtml(p.displayName)}</span><small>${escapeHtml(p.bio||'Public LCS profile')}</small></button>`).join('')}</div>`);
  if(lfg.length) groups.push(`<div class="search-group"><b>LFG</b>${lfg.map(x=>`<button data-open-lfg="${escapeHtml(x.id)}" type="button"><span>${escapeHtml(x.title)}</span><small>${escapeHtml(LFG_PURPOSES[x.purpose]?.label||'LFG')} · ${escapeHtml(x.topic)}</small></button>`).join('')}</div>`);
  if(objects.length) groups.push(`<div class="search-group"><b>Work</b>${objects.map(o=>`<button data-open-object="${escapeHtml(o.id)}" type="button"><span>${escapeHtml(o.title)}</span><small>${escapeHtml(o.kind)}</small></button>`).join('')}</div>`);
  if(spaces.length) groups.push(`<div class="search-group"><b>Communities</b>${spaces.map(s=>`<button data-space-filter="${escapeHtml(s.id)}" type="button"><span>${escapeHtml(s.name)}</span><small>${escapeHtml(s.description||'Public community')}</small></button>`).join('')}</div>`);
  panel.innerHTML=groups.join('')||'<div class="search-empty">No matching public context.</div>'; panel.hidden=false;
}

function renderLfg() {
  const root=$('#lfgCatalog'); if(!root)return; const rows=state.lfg.filter(x=>x.status==='open'&&!isBlocked(x.authorProfileId)&&(state.activeLfgFilter==='all'||x.purpose===state.activeLfgFilter)&&contentMatchesQuery(`${x.title} ${x.topic} ${x.description}`,`${(x.tags||[]).join(' ')} ${identity(x.authorProfileId).displayName}`)).sort((a,b)=>timeValue(b.createdAt)-timeValue(a.createdAt));
  root.innerHTML=rows.length?rows.map(x=>{const who=identity(x.authorProfileId);const mine=x.authorProfileId===state.profileId;const request=state.lfgRequests.find(r=>r.lfgId===x.id&&r.fromProfileId===state.profileId);return `<article class="lfg-card"><button class="lfg-card-open" data-open-lfg="${escapeHtml(x.id)}" type="button" aria-label="Open LFG listing: ${escapeHtml(x.title)}"><div class="lfg-card-top"><span class="lfg-purpose">${LFG_PURPOSES[x.purpose]?.icon||'⚑'} ${escapeHtml(LFG_PURPOSES[x.purpose]?.label||x.purpose)}</span><small>${timeAgo(x.createdAt)}</small></div><h2>${escapeHtml(x.title)}</h2><p class="lfg-topic">${escapeHtml(x.topic)}</p><p>${escapeHtml(x.description)}</p>${x.availability?`<div class="lfg-availability"><b>Availability</b><span>${escapeHtml(x.availability)}</span></div>`:''}<div class="tag-row">${(x.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div></button><div class="lfg-footer"><button class="identity-link" data-open-profile="${escapeHtml(x.authorProfileId)}" type="button">${escapeHtml(who.displayName)}</button>${mine?'<span class="status-pill">Your listing</span>':`<button class="primary-button" data-lfg-request="${escapeHtml(x.id)}" type="button" ${request?'disabled':''}>${request?escapeHtml(request.status==='pending'?'Request sent':request.status):'Request to connect'}</button>`}</div></article>`;}).join(''):'<div class="empty-state"><b>No open LFG listings match.</b><span>Create one for playing, creating, or sharing information.</span></div>';
}

function friendProfileIds() { return state.friendships.flatMap(f=>f.members||[]).filter(id=>id!==state.profileId); }
function renderPersonRow(profileId, extra='') { const p=identity(profileId); return `<button class="person-row" data-open-profile="${escapeHtml(profileId)}" type="button">${avatarMarkup(p,'person-avatar')}<span><b>${escapeHtml(p.displayName)}</b><small>${escapeHtml(extra||p.bio||'Public profile')}</small></span></button>`; }
function renderConnections() {
  renderPublicProfileDirectory();
  const signed=Boolean(state.profileId); $('#connectionsSignedOut').hidden=signed; $('#connectionsSignedIn').hidden=!signed; if(!signed)return;
  const friends=[...new Set(friendProfileIds())]; $('#friendCountBadge').textContent=String(friends.length); $('#friendList').innerHTML=friends.length?friends.map(id=>renderPersonRow(id,'Friend')).join(''):'<p class="muted">No accepted friends yet.</p>';
  const incoming=state.friendRequests.filter(r=>r.toProfileId===state.profileId&&r.status==='pending'); const outgoing=state.friendRequests.filter(r=>r.fromProfileId===state.profileId&&r.status==='pending');
  $('#friendRequestList').innerHTML=[...incoming.map(r=>`<div class="request-row">${renderPersonRow(r.fromProfileId,'Wants to connect')}<div class="request-actions"><button class="primary-button" data-friend-action="accept" data-request-id="${escapeHtml(r.id)}" type="button">Accept</button><button class="ghost-button" data-friend-action="decline" data-request-id="${escapeHtml(r.id)}" type="button">Decline</button></div></div>`),...outgoing.map(r=>`<div class="request-row">${renderPersonRow(r.toProfileId,'Friend request pending')}<div class="request-actions"><button class="ghost-button" data-friend-action="cancel" data-request-id="${escapeHtml(r.id)}" type="button">Cancel</button></div></div>`)].join('')||'<p class="muted">No pending friend requests.</p>';
  const followers=[...new Set(state.follows.filter(f=>f.targetType==='profile'&&f.targetId===state.profileId).map(f=>f.followerProfileId))].filter(id=>!isBlocked(id)); const following=[...new Set(state.follows.filter(f=>f.targetType==='profile'&&f.followerProfileId===state.profileId).map(f=>f.targetId))].filter(id=>!isBlocked(id));
  $('#followerList').innerHTML=followers.length?followers.map(id=>renderPersonRow(id,'Follows you')).join(''):'<p class="muted">No followers yet.</p>'; $('#followingList').innerHTML=following.length?following.map(id=>renderPersonRow(id,'You follow this person')).join(''):'<p class="muted">You are not following anyone yet.</p>'; const blocked=[...new Set(state.blocks.map(b=>b.blockedProfileId))]; $('#blockedList').innerHTML=blocked.length?blocked.map(id=>{const p=identity(id);return `<div class="request-row">${renderPersonRow(id,'Blocked')}<div class="request-actions"><button class="ghost-button" data-unblock-profile="${escapeHtml(id)}" type="button">Unblock</button></div></div>`;}).join(''):'<p class="muted">No blocked profiles.</p>';
  const reqs=state.lfgRequests.filter(r=>r.status==='pending'||r.status==='accepted'); $('#lfgRequestList').innerHTML=reqs.length?reqs.map(r=>{const incoming=r.toProfileId===state.profileId;const other=incoming?r.fromProfileId:r.toProfileId;const listing=state.lfg.find(x=>x.id===r.lfgId);return `<div class="request-row">${renderPersonRow(other,listing?`${LFG_PURPOSES[listing.purpose]?.label||'LFG'} · ${listing.title}`:'LFG request')}<div class="request-actions">${r.status==='accepted'?'<span class="status-pill">Accepted</span>':incoming?`<button class="primary-button" data-lfg-action="accept" data-request-id="${escapeHtml(r.id)}" type="button">Accept</button><button class="ghost-button" data-lfg-action="decline" data-request-id="${escapeHtml(r.id)}" type="button">Decline</button>`:`<span class="status-pill">Pending</span><button class="ghost-button" data-lfg-action="cancel" data-request-id="${escapeHtml(r.id)}" type="button">Cancel</button>`}</div></div>`;}).join(''):'<p class="muted">No LFG requests yet.</p>';
}

function openLogicGuide(key='') { const meta=reasoning[key]; $('#logicDialogTitle').textContent=meta?`${meta.plain} · ${meta.formal}`:'Six useful thought types'; $('#logicDialogBody').innerHTML=meta?`<div class="logic-explain"><span class="logic-symbol big">${meta.symbol}</span><p>${escapeHtml(meta.description)}</p></div>`:Object.values(reasoning).filter(x=>x!==reasoning.unclassified).map(x=>`<div class="logic-explain"><span class="logic-symbol">${x.symbol}</span><div><b>${escapeHtml(x.plain)}</b><small>${escapeHtml(x.formal)}</small><p>${escapeHtml(x.description)}</p></div></div>`).join(''); showDialog('#logicDialog'); }

function stopDetailCommentSubscription(){
  if(state.detailCommentUnsub){try{state.detailCommentUnsub();}catch{} state.detailCommentUnsub=null;}
}
function startDetailCommentSubscription(){
  stopDetailCommentSubscription();
  if(!state.firebaseReady||!state.detail||state.detail.type==='profile')return;
  const type=state.detail.type==='post'?'post':'object', key=`${type}:${state.detail.id}`;
  const {db,fsMod}=state.firebase;
  const applySnapshot=(snap,filterKey=false)=>{
    let scoped=snap.docs.map(d=>({id:d.id,...d.data()})); if(filterKey)scoped=scoped.filter(c=>c.targetKey===key);
    const other=state.comments.filter(c=>c.targetKey!==key); state.comments=[...other,...scoped];
    if(state.detail&&`${state.detail.type==='post'?'post':'object'}:${state.detail.id}`===key)renderDetailThread(); renderFeed(); renderCatalogs();
  };
  const primary=fsMod.query(fsMod.collection(db,'publicComments'),fsMod.where('targetKey','==',key),fsMod.where('deleted','==',false),fsMod.limit(500));
  state.detailCommentUnsub=fsMod.onSnapshot(primary,snap=>applySnapshot(snap,false),err=>{
    console.warn('Scoped discussion query needs compatibility fallback.',err?.code||err);
    if(state.detailCommentUnsub){try{state.detailCommentUnsub();}catch{} state.detailCommentUnsub=null;}
    const fallback=fsMod.query(fsMod.collection(db,'publicComments'),fsMod.where('deleted','==',false),fsMod.limit(2000));
    state.detailCommentUnsub=fsMod.onSnapshot(fallback,snap=>applySnapshot(snap,true),fallbackErr=>{console.error('detail comments fallback',fallbackErr);setBackendStatus('Discussion sync needs attention',firestoreErrorText(fallbackErr,'read responses'),'error');});
  });
}

function openPostDetail(id) { const p=state.posts.find(x=>x.id===id)||state.moderationPosts.find(x=>x.id===id); if(!p)return; state.detail={type:'post',id}; const who=identity(p.authorProfileId),r=reasoning[p.reasoningType]||reasoning.unclassified; const canRemove=p.authorProfileId===state.profileId||canModerateDiscussionClient('post',id); $('#detailEyebrow').textContent=`${r.symbol} ${r.plain}`; $('#detailTitle').textContent=p.deleted?'Removed public post':'Public post'; $('#detailBody').innerHTML=`<div class="detail-author-row"><button class="identity-button" data-open-profile="${escapeHtml(p.authorProfileId)}" type="button">${avatarMarkup(who)}<span><b>${escapeHtml(who.displayName)}</b><span class="status-badge-row">${statusBadgeMarkup(p.authorProfileId,'discussion_post',id)}</span><small>${timeAgo(p.createdAt)}</small></span></button></div><p class="detail-main-copy">${escapeHtml(p.text)}</p>${(p.tags||[]).length?`<div class="detail-tags tag-row">${p.tags.map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>`:''}${p.deleted?`<div class="moderation-notice"><b>Removed from normal LCS views</b><span>${escapeHtml(p.deleteReason||'No reason recorded.')}</span></div>`:''}<div class="detail-actions">${p.deleted?(canRemove?`<button class="ghost-button" data-content-restore="publicPosts" data-content-id="${escapeHtml(id)}" type="button">↺ Restore</button>`:''):`<button class="ghost-button ${isOwnReaction('post',p.id)?'active-action':''}" data-helpful-type="post" data-helpful-id="${escapeHtml(p.id)}" type="button">♡ Helpful · ${reactionCount('post',p.id)}</button><button class="ghost-button" data-connect-post="${escapeHtml(p.id)}" type="button">↗ Connect to work</button>${canRemove?`<button class="ghost-button danger-button" data-content-remove="publicPosts" data-content-id="${escapeHtml(id)}" type="button">${p.authorProfileId===state.profileId?'Delete my post':'Remove post'}</button>`:''}`}</div>`; renderDetailThread(); startDetailCommentSubscription(); showDialog('#detailDialog'); }
function openObjectDetail(id) { const o=state.objects.find(x=>x.id===id)||state.moderationObjects.find(x=>x.id===id); if(!o)return; state.detail={type:'object',id}; const who=identity(o.authorProfileId); const rel=state.connections.filter(c=>c.sourceId===id||c.targetId===id); const canRemove=o.authorProfileId===state.profileId||canModerateObjectClient(o); const scope=o.kind==='project'?'project':'discussion_object'; $('#detailEyebrow').textContent=o.kind; $('#detailTitle').textContent=o.deleted?`Removed ${o.kind}`:o.title; $('#detailBody').innerHTML=`<div class="detail-author-row"><button class="identity-button" data-open-profile="${escapeHtml(o.authorProfileId)}" type="button">${avatarMarkup(who)}<span><b>${escapeHtml(who.displayName)}</b><span class="status-badge-row">${statusBadgeMarkup(o.authorProfileId,scope,id)}</span><small>${timeAgo(o.createdAt)}</small></span></button></div><p class="detail-main-copy">${escapeHtml(o.description)}</p>${o.deleted?`<div class="moderation-notice"><b>Removed from normal LCS views</b><span>${escapeHtml(o.deleteReason||'No reason recorded.')}</span></div>`:''}<div class="detail-tags tag-row">${(o.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div><div class="detail-actions">${o.deleted?(canRemove?`<button class="ghost-button" data-content-restore="publicObjects" data-content-id="${escapeHtml(id)}" type="button">↺ Restore</button>`:''):`<button class="ghost-button ${isFollowing('object',id)?'active-action':''}" data-follow-type="object" data-follow-id="${escapeHtml(id)}" type="button">${isFollowing('object',id)?'★ Following':'☆ Follow'} · ${followCount('object',id)}</button><button class="ghost-button" data-connect-object="${escapeHtml(id)}" type="button">↗ Connect another item</button>${canRemove?`<button class="ghost-button danger-button" data-content-remove="publicObjects" data-content-id="${escapeHtml(id)}" type="button">${o.authorProfileId===state.profileId?'Delete my item':'Remove item'}</button>`:''}`}</div><section class="linked-section"><h3>Relationships</h3>${rel.length?rel.map(c=>{const other=state.objects.find(x=>x.id===(c.sourceId===id?c.targetId:c.sourceId));return other?`<button class="linked-object" data-open-object="${escapeHtml(other.id)}" type="button"><span>${escapeHtml(c.relation)}</span><b>${escapeHtml(other.title)}</b><small>${escapeHtml(other.kind)}</small></button>`:'';}).join(''):'<p class="muted">No relationships yet.</p>'}</section>`; renderDetailThread(); startDetailCommentSubscription(); showDialog('#detailDialog'); }
function friendshipStateWith(profileId) { if(!state.profileId||profileId===state.profileId)return {kind:'self'}; if(state.friendships.some(f=>(f.members||[]).includes(state.profileId)&&(f.members||[]).includes(profileId)))return {kind:'friends'}; const incoming=state.friendRequests.find(r=>r.fromProfileId===profileId&&r.toProfileId===state.profileId&&r.status==='pending'); if(incoming)return {kind:'incoming',request:incoming}; const outgoing=state.friendRequests.find(r=>r.fromProfileId===state.profileId&&r.toProfileId===profileId&&r.status==='pending'); if(outgoing)return {kind:'outgoing',request:outgoing}; return {kind:'none'}; }
function openProfileDetail(id) { stopDetailCommentSubscription(); const p=state.profiles[id]; if(!p){toast('That public profile is not available.');return;} state.detail={type:'profile',id}; const authored=state.objects.filter(o=>o.authorProfileId===id&&!o.deleted); const posts=state.posts.filter(x=>x.authorProfileId===id&&!x.deleted); const fs=friendshipStateWith(id); const blocked=isBlocked(id); const friendButton=fs.kind==='self'||blocked?'':fs.kind==='friends'?'<span class="status-pill">Friends</span>':fs.kind==='incoming'?`<button class="primary-button" data-friend-action="accept" data-request-id="${escapeHtml(fs.request.id)}" type="button">Accept friend request</button>`:fs.kind==='outgoing'?'<span class="status-pill">Friend request pending</span>':`<button class="ghost-button" data-friend-profile="${escapeHtml(id)}" type="button">＋ Friend request</button>`; const blockButton=id===state.profileId?'':blocked?`<button class="ghost-button active-action" data-unblock-profile="${escapeHtml(id)}" type="button">Unblock</button>`:`<button class="ghost-button" data-block-profile="${escapeHtml(id)}" type="button">Block</button>`; const manage=isFounder()||isGlobalModerator()?`<button class="ghost-button" data-manage-status="${escapeHtml(id)}" type="button">Status / moderation</button>`:''; $('#detailEyebrow').textContent='Public profile'; $('#detailTitle').textContent=p.displayName||'Member'; $('#detailBody').innerHTML=`<div class="profile-detail-hero">${avatarMarkup(p,'profile-detail-fallback')}<div><h3>${escapeHtml(p.displayName||'Member')}</h3><div class="status-badge-row">${statusBadgeMarkup(id)}</div><p>${escapeHtml(p.bio||'No public bio yet.')}</p></div></div><div class="detail-actions">${id===state.profileId||blocked?'':`<button class="ghost-button ${isFollowing('profile',id)?'active-action':''}" data-follow-type="profile" data-follow-id="${escapeHtml(id)}" type="button">${isFollowing('profile',id)?'★ Following':'☆ Follow'} · ${followCount('profile',id)}</button>`}${friendButton}${blockButton}${manage}</div><div class="profile-stats"><div><b>${authored.length}</b><span>Ideas / problems / projects</span></div><div><b>${posts.length}</b><span>Posts</span></div></div><section class="linked-section"><h3>Recent work</h3>${authored.slice(0,8).map(o=>`<button class="linked-object" data-open-object="${escapeHtml(o.id)}" type="button"><b>${escapeHtml(o.title)}</b><small>${escapeHtml(o.kind)}</small></button>`).join('')||'<p class="muted">No public work yet.</p>'}</section>`; $('#detailThreadSection').hidden=true; showDialog('#detailDialog'); }
function openLfg(id) {
  const x=state.lfg.find(v=>v.id===id); if(!x)return;
  const who=identity(x.authorProfileId), mine=x.authorProfileId===state.profileId;
  const request=state.lfgRequests.find(r=>r.lfgId===x.id&&r.fromProfileId===state.profileId);
  const title=$('#lfgDetailTitle'), body=$('#lfgDetailBody');
  if(!title||!body){setView('lfg');setTimeout(()=>document.querySelector(`[data-open-lfg="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),20);return;}
  title.textContent=x.title;
  body.innerHTML=`<div class="lfg-detail-meta"><span class="lfg-purpose">${LFG_PURPOSES[x.purpose]?.icon||'⚑'} ${escapeHtml(LFG_PURPOSES[x.purpose]?.label||x.purpose)}</span><small>${timeAgo(x.createdAt)}</small></div><p class="lfg-topic">${escapeHtml(x.topic)}</p><p class="detail-main-copy">${escapeHtml(x.description)}</p>${x.availability?`<div class="lfg-availability"><b>Availability</b><span>${escapeHtml(x.availability)}</span></div>`:''}${(x.tags||[]).length?`<div class="tag-row detail-tags">${x.tags.map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div>`:''}<div class="lfg-detail-actions"><button class="identity-link" data-open-profile="${escapeHtml(x.authorProfileId)}" type="button">${escapeHtml(who.displayName)}</button>${mine?'<span class="status-pill">Your listing</span>':`<button class="primary-button" data-lfg-request="${escapeHtml(x.id)}" type="button" ${request?'disabled':''}>${request?escapeHtml(request.status==='pending'?'Request sent':request.status):'Request to connect'}</button>`}</div>`;
  showDialog('#lfgDetailDialog');
}

function renderDetailThread() { const section=$('#detailThreadSection'); if(!state.detail||state.detail.type==='profile'){section.hidden=true;return;} section.hidden=false; const type=state.detail.type==='post'?'post':'object', key=`${type}:${state.detail.id}`; const rows=state.comments.filter(c=>c.targetKey===key&&!c.deleted&&!isBlocked(c.authorProfileId)).sort((a,b)=>timeValue(a.createdAt)-timeValue(b.createdAt)); $('#detailCommentList').innerHTML=rows.length?rows.map(c=>{const p=identity(c.authorProfileId),r=reasoning[c.reasoningType]||reasoning.unclassified; const canRemove=c.authorProfileId===state.profileId||canModerateDiscussionClient(c.targetType,c.targetId); return `<article class="comment-card"><div class="comment-head"><button class="identity-link" data-open-profile="${escapeHtml(c.authorProfileId)}" type="button">${escapeHtml(p.displayName)}</button><span>${r.symbol} ${escapeHtml(r.plain)} · ${timeAgo(c.createdAt)}</span></div><p>${escapeHtml(c.text)}</p>${canRemove?`<div class="comment-actions"><button class="ghost-button danger-button" data-content-remove="publicComments" data-content-id="${escapeHtml(c.id)}" type="button">${c.authorProfileId===state.profileId?'Delete':'Remove'}</button></div>`:''}</article>`;}).join(''):'<div class="thread-empty">No responses yet.</div>'; const timed=timedOutForDiscussionClient(type,state.detail.id); $('#detailCommentForm').hidden=!state.profileId||timed; $('#detailCommentSignIn').hidden=Boolean(state.profileId); const note=$('#detailTimeoutNote'); if(note){note.hidden=!timed; note.textContent=timed?'Timeout Status makes this discussion read-only for your account.':'';} }

function setCreateError(message=''){const box=$('#createError'),text=$('#createErrorText');if(!box||!text)return;box.hidden=!message;text.textContent=message||'';}
function openCreate(kind='idea'){
  if(!requireUser())return;
  setCreateError('');
  const radio=$(`#createForm input[name="kind"][value="${kind}"]`); if(radio)radio.checked=true;
  $('#createDialogTitle').textContent=`Create ${kind}`;
  renderChannelSelects(); updateCreateRelatedOptions();
  const select=$('#createChannelSelect');
  const preferred=state.activeChannelId!=='all'?state.activeChannelId:({idea:'open-commons-ideas',problem:'open-commons-problems',project:'open-commons-projects'}[kind]||'open-commons-general');
  if(select&&[...select.options].some(o=>o.value===preferred))select.value=preferred;
  showDialog('#createDialog');
}
function openSpaceDialog(){if(!requireUser())return;showDialog('#spaceDialog');}
function openChannelDialog(spaceId=''){if(!requireUser())return;renderChannelSelects(); if(!state.spaces.some(s=>s.ownerProfileId===state.profileId)){toast('Create a community first.');return;} if(spaceId)$('#channelCommunity').value=spaceId;showDialog('#channelDialog');}
function openConnect(mode,id){if(!requireUser())return;state.connectContext={mode,id}; const options=visibleItems(state.objects).filter(o=>!(mode==='object'&&o.id===id)); $('#connectTargetObject').innerHTML=options.map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)} · ${escapeHtml(o.kind)}</option>`).join(''); if(!options.length){toast('Create another idea, problem, or project first.');return;} $('#connectDialogTitle').textContent=mode==='post'?'Connect this post to work':'Connect this item to another item'; showDialog('#connectDialog');}

async function toggleHelpful(type,id){const scope=statusScopeForDiscussion(type);if(!requireContribution(scope,id))return;const {db,fsMod}=state.firebase;const docId=safeDocId(state.profileId,type,id);const ref=fsMod.doc(db,'publicReactions',docId);const current=state.reactions.find(r=>r.id===docId);if(current)await fsMod.deleteDoc(ref);else{await fsMod.setDoc(ref,{actorProfileId:state.profileId,targetType:type,targetId:id,type:'helpful',createdAt:fsMod.serverTimestamp()});bumpImpact('helped');}}
async function toggleFollow(type,id){if(!requireContribution())return;const {db,fsMod}=state.firebase;const docId=safeDocId(state.profileId,type,id);const ref=fsMod.doc(db,'publicFollows',docId);const current=state.follows.find(f=>f.id===docId);if(current)await fsMod.deleteDoc(ref);else await fsMod.setDoc(ref,{followerProfileId:state.profileId,targetType:type,targetId:id,createdAt:fsMod.serverTimestamp()});}
async function publishPost(){
  if(state.publishInFlight)return;
  if(!requireContribution())return;
  const text=$('#composerText').value.trim();if(!text)return;
  const button=$('#publishButton'), old=button?.textContent||'Publish thought'; state.publishInFlight=true;
  if(button){button.disabled=true;button.textContent='Publishing…';}
  try{
    let c=channelById($('#postChannel').value); c=await ensureWritableChannel(c); const tags=parseTags($('#postTags')?.value||''); const {db,fsMod}=state.firebase;
    const payload={text:text.slice(0,1200),tags,reasoningType:state.activeType,kind:$('#postKind').value,spaceId:c.spaceId,channelId:c.id,authorProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp(),deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''};
    const ref=await fsMod.addDoc(fsMod.collection(db,'publicPosts'),payload);
    if(!state.posts.some(x=>x.id===ref.id)){state.posts.unshift({...payload,id:ref.id,createdAt:Date.now(),updatedAt:Date.now()});renderFeed();}
    $('#composerText').value=''; if($('#postTags'))$('#postTags').value=''; renderTagPreview($('#postTags'),$('#postTagPreview')); $('#charCounter').textContent='0 / 1200'; toast(`Public thought published to ${spaceById(c.spaceId).name} · #${c.name}.`);bumpImpact('created');
  } catch(error){console.error('publish thought failed',error);toast(firestoreErrorText(error,'publish this thought'));}
  finally {state.publishInFlight=false;if(button){button.disabled=false;button.textContent=old;}}
}
async function createObject(e){
  e.preventDefault(); if(state.createInFlight)return; if(!requireContribution())return;
  const formEl=e.currentTarget, submit=formEl.querySelector('button[type="submit"]'), oldLabel=submit?.textContent||'Create';
  setCreateError('');
  const form=new FormData(formEl),kind=form.get('kind')||'idea';
  const title=$('#createTitle').value.trim(),description=$('#createDescription').value.trim();
  if(!title||!description){setCreateError('Add both a name and a description before creating this item.');return;}
  const selectedChannel=$('#createChannelSelect').value;
  let c=channelById(selectedChannel);
  if(!c?.id||!c?.spaceId){setCreateError('Choose a valid channel.');return;}
  state.createInFlight=true; formEl.setAttribute('aria-busy','true'); if(submit){submit.disabled=true;submit.textContent='Creating…';}
  const {db,fsMod}=state.firebase;
  const tags=parseTags($('#createTags').value), related=$('#createRelatedObject').value;
  try{
    c=await ensureWritableChannel(c);
    const payload={kind,title:title.slice(0,100),description:description.slice(0,700),tags,spaceId:c.spaceId,channelId:c.id,authorProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp(),deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''};
    const ref=await fsMod.addDoc(fsMod.collection(db,'publicObjects'),payload);
    if(!state.objects.some(x=>x.id===ref.id)){
      state.objects.unshift({...payload,id:ref.id,createdAt:Date.now(),updatedAt:Date.now()});
      renderCatalogs();renderUniverse();renderTrends();renderSearchPanel();renderStatusTargetOptions();
    }
    formEl.reset(); renderTagPreview($('#createTags'),$('#createTagPreview')); closeDialog(formEl.closest('dialog')); toast(`${kind} created.`);bumpImpact('created');
    if(related){
      try{await fsMod.addDoc(fsMod.collection(db,'publicConnections'),{sourceId:ref.id,targetId:related,relation:'related to',authorProfileId:state.profileId,createdAt:fsMod.serverTimestamp()});}
      catch(linkError){console.error('initial object connection failed',linkError);toast(`${kind} created, but the optional starting connection could not be saved.`);}
    }
  }catch(error){
    console.error('create object failed',error);
    const message=firestoreErrorText(error,`create this ${kind}`);setCreateError(message);toast(message);
  }finally{state.createInFlight=false;formEl.removeAttribute('aria-busy');if(submit){submit.disabled=false;submit.textContent=oldLabel;}}
}
async function createSpace(e){
  e.preventDefault();if(state.spaceInFlight||!requireContribution())return;
  const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),old=button?.textContent||'Create community';
  state.spaceInFlight=true;if(button){button.disabled=true;button.textContent='Creating…';}
  try{const name=$('#spaceName').value.trim(),description=$('#spaceDescription').value.trim();const {db,fsMod}=state.firebase;const ref=await fsMod.addDoc(fsMod.collection(db,'publicSpaces'),{name:name.slice(0,50),description:description.slice(0,240),ownerProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});await fsMod.addDoc(fsMod.collection(db,'publicChannels'),{spaceId:ref.id,name:'general',description:'General public discussion.',type:'discussion',ownerProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});form.reset();closeDialog(form.closest('dialog'));toast('Community created with #general.');}
  finally{state.spaceInFlight=false;if(button){button.disabled=false;button.textContent=old;}}
}
async function createChannel(e){
  e.preventDefault();if(state.channelInFlight||!requireContribution())return;const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),old=button?.textContent||'Create channel';
  const spaceId=$('#channelCommunity').value;const space=state.spaces.find(s=>s.id===spaceId);if(!space||space.ownerProfileId!==state.profileId){toast('You can only add channels to communities you own.');return;}
  state.channelInFlight=true;if(button){button.disabled=true;button.textContent='Creating…';}
  try{const {db,fsMod}=state.firebase;await fsMod.addDoc(fsMod.collection(db,'publicChannels'),{spaceId,name:$('#channelName').value.trim().slice(0,40),description:$('#channelDescription').value.trim().slice(0,240),type:$('#channelType').value,ownerProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});form.reset();closeDialog(form.closest('dialog'));toast('Channel created.');}
  finally{state.channelInFlight=false;if(button){button.disabled=false;button.textContent=old;}}
}
async function submitConnection(e){e.preventDefault();if(!state.connectContext||!requireContribution())return;const targetId=$('#connectTargetObject').value,relation=$('#connectRelation').value,{mode,id}=state.connectContext;const {db,fsMod}=state.firebase;if(mode==='post')await fsMod.addDoc(fsMod.collection(db,'publicPostLinks'),{postId:id,objectId:targetId,relation,authorProfileId:state.profileId,createdAt:fsMod.serverTimestamp()});else await fsMod.addDoc(fsMod.collection(db,'publicConnections'),{sourceId:id,targetId,relation,authorProfileId:state.profileId,createdAt:fsMod.serverTimestamp()});closeDialog('#connectDialog');state.connectContext=null;bumpImpact('connected');toast('Connection saved.');}
async function submitComment(e){
  e.preventDefault(); if(state.commentInFlight||!state.detail||state.detail.type==='profile')return;
  const type=state.detail.type==='post'?'post':'object'; if(!requireContribution(statusScopeForDiscussion(type),state.detail.id))return;
  const text=$('#detailCommentText').value.trim();if(!text)return;
  const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),old=button?.textContent||'Add response';state.commentInFlight=true;if(button){button.disabled=true;button.textContent='Adding…';}
  try{
    const {db,fsMod}=state.firebase; const payload={targetKey:`${type}:${state.detail.id}`,targetType:type,targetId:state.detail.id,text:text.slice(0,800),reasoningType:$('#detailCommentReasoning').value,authorProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp(),deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''};
    const ref=await fsMod.addDoc(fsMod.collection(db,'publicComments'),payload);
    if(!state.comments.some(c=>c.id===ref.id))state.comments.push({...payload,id:ref.id,createdAt:Date.now(),updatedAt:Date.now()});
    const responseType=$('#detailCommentReasoning').value;$('#detailCommentText').value='';renderDetailThread();if(responseType==='observation'||responseType==='premise')bumpImpact('tested');else if(responseType==='question'||responseType==='assumption')bumpImpact('challenged');else bumpImpact('responses');toast('Response added.');
  } finally {state.commentInFlight=false;if(button){button.disabled=false;button.textContent=old;}}
}
async function savePublicProfile(e){e.preventDefault();if(!requireUser()||state.profileSavePending)return;const displayName=$('#accountDisplayName').value.trim().replace(/\s+/g,' '),bio=$('#accountBio').value.trim();if(displayName.length<2)return;state.profileSavePending=true;state.profileSaveStatus='Saving public profile…';renderAccount();try{const {db,fsMod}=state.firebase;const ref=fsMod.doc(db,'publicProfiles',state.profileId);const created=state.publicProfile?.createdAt||fsMod.serverTimestamp();await fsMod.setDoc(ref,{displayName:displayName.slice(0,40),bio:bio.slice(0,240),createdAt:created,updatedAt:fsMod.serverTimestamp()},{merge:true});state.accountDirty=false;state.profileSaveStatus='Saved · waiting for realtime verification';toast('Public profile saved.');}catch(err){console.error(err);state.profileSaveStatus='Could not save public profile';toast('Profile save failed.');}finally{state.profileSavePending=false;renderAccount();}}

async function sendFriendRequest(profileId){if(!requireContribution()||profileId===state.profileId)return;if(isBlocked(profileId)){toast('Unblock this profile before connecting.');return;}const fs=friendshipStateWith(profileId);if(fs.kind!=='none'){toast('A connection already exists or is pending.');return;}const {db,fsMod}=state.firebase;const requestId=safeDocId(...[state.profileId,profileId].sort());await fsMod.setDoc(fsMod.doc(db,'privateFriendRequests',requestId),{fromProfileId:state.profileId,toProfileId:profileId,status:'pending',createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});toast('Friend request sent privately.');}
async function handleFriendRequest(id,action){if(!requireUser())return;const r=state.friendRequests.find(x=>x.id===id);if(!r)return;const {db,fsMod}=state.firebase;const ref=fsMod.doc(db,'privateFriendRequests',id);if(action==='cancel'||action==='decline'){await fsMod.deleteDoc(ref);toast(action==='decline'?'Friend request declined.':'Friend request cancelled.');return;}if(action==='accept'){const members=[r.fromProfileId,r.toProfileId].sort();const fref=fsMod.doc(db,'privateFriendships',safeDocId(...members));const batch=fsMod.writeBatch(db);batch.update(ref,{status:'accepted',updatedAt:fsMod.serverTimestamp()});batch.set(fref,{members,requestId:id,createdAt:fsMod.serverTimestamp()});await batch.commit();toast('Friend connection accepted.');}}
async function createLfg(e){
  e.preventDefault();if(state.lfgInFlight||!requireContribution())return;
  const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),old=button?.textContent||'Publish LFG';
  const title=$('#lfgTitle').value.trim(),topic=$('#lfgTopic').value.trim(),description=$('#lfgDescription').value.trim(),availability=$('#lfgAvailability').value.trim();
  if(containsContactData(`${description} ${availability}`)){toast('For safety, remove email addresses or phone numbers and use LCS requests instead.');return;}
  state.lfgInFlight=true;if(button){button.disabled=true;button.textContent='Publishing…';}
  try{const {db,fsMod}=state.firebase;await fsMod.addDoc(fsMod.collection(db,'publicLfg'),{purpose:$('#lfgPurpose').value,title:title.slice(0,100),topic:topic.slice(0,80),description:description.slice(0,700),availability:availability.slice(0,120),tags:parseTags($('#lfgTags').value),authorProfileId:state.profileId,status:'open',createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp(),deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''});form.reset();renderTagPreview($('#lfgTags'),$('#lfgTagPreview'));closeDialog(form.closest('dialog'));bumpImpact('collaborated');toast('LFG listing published publicly.');}
  finally{state.lfgInFlight=false;if(button){button.disabled=false;button.textContent=old;}}
}
async function sendLfgRequest(lfgId){if(!requireContribution())return;const listing=state.lfg.find(x=>x.id===lfgId);if(listing&&isBlocked(listing.authorProfileId)){toast('Unblock this profile before requesting a match.');return;}if(!listing||listing.authorProfileId===state.profileId)return;const existing=state.lfgRequests.find(r=>r.lfgId===lfgId&&r.fromProfileId===state.profileId);if(existing){toast('You already sent a request for this listing.');return;}const {db,fsMod}=state.firebase;const requestId=safeDocId(lfgId,state.profileId);await fsMod.setDoc(fsMod.doc(db,'privateLfgRequests',requestId),{lfgId,fromProfileId:state.profileId,toProfileId:listing.authorProfileId,status:'pending',createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});bumpImpact('collaborated');toast('Private LFG request sent.');}
async function handleLfgRequest(id,action){if(!requireUser())return;const r=state.lfgRequests.find(x=>x.id===id);if(!r)return;const {db,fsMod}=state.firebase,ref=fsMod.doc(db,'privateLfgRequests',id);if(action==='decline'||action==='cancel'){await fsMod.deleteDoc(ref);toast(`LFG request ${action==='decline'?'declined':'cancelled'}.`);return;}if(!requireContribution())return;await fsMod.updateDoc(ref,{status:'accepted',updatedAt:fsMod.serverTimestamp()});toast('LFG request accepted.');}

async function blockProfile(profileId){if(!requireUser()||!profileId||profileId===state.profileId)return;const {db,fsMod}=state.firebase;const blockRef=fsMod.doc(db,'privateBlocks',safeDocId(state.profileId,profileId));const batch=fsMod.writeBatch(db);batch.set(blockRef,{blockerProfileId:state.profileId,blockedProfileId:profileId,createdAt:fsMod.serverTimestamp()});const follow=state.follows.find(f=>f.followerProfileId===state.profileId&&f.targetType==='profile'&&f.targetId===profileId);if(follow)batch.delete(fsMod.doc(db,'publicFollows',follow.id));const req=state.friendRequests.find(r=>(r.fromProfileId===state.profileId&&r.toProfileId===profileId)||(r.fromProfileId===profileId&&r.toProfileId===state.profileId));if(req)batch.delete(fsMod.doc(db,'privateFriendRequests',req.id));const friendship=state.friendships.find(f=>(f.members||[]).includes(state.profileId)&&(f.members||[]).includes(profileId));if(friendship)batch.delete(fsMod.doc(db,'privateFriendships',friendship.id));state.lfgRequests.filter(r=>(r.fromProfileId===state.profileId&&r.toProfileId===profileId)||(r.fromProfileId===profileId&&r.toProfileId===state.profileId)).slice(0,450).forEach(r=>batch.delete(fsMod.doc(db,'privateLfgRequests',r.id)));await batch.commit();toast('Profile blocked.');if(state.detail?.type==='profile'&&state.detail.id===profileId)openProfileDetail(profileId);}
async function unblockProfile(profileId){if(!requireUser())return;const {db,fsMod}=state.firebase;await fsMod.deleteDoc(fsMod.doc(db,'privateBlocks',safeDocId(state.profileId,profileId)));toast('Profile unblocked.');}

function updateCreateRelatedOptions(){const select=$('#createRelatedObject');if(!select)return;const old=select.value;select.innerHTML='<option value="">No initial relationship</option>'+visibleItems(state.objects).slice(0,250).map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.title)} · ${escapeHtml(o.kind)}</option>`).join('');if([...select.options].some(o=>o.value===old))select.value=old;}

function renderStatusSurfaces(){
  const account=$('#accountStatusList'); if(account){const rows=activeStatusesFor();account.innerHTML=rows.length?rows.map(x=>`<span class="status-badge status-${escapeHtml(x.status)}">${STATUS_META[x.status]?.symbol||'•'} ${escapeHtml(STATUS_META[x.status]?.label||x.status)}${x.scopeType==='global'?'':` · ${escapeHtml(STATUS_SCOPE_LABELS[x.scopeType]||x.scopeType)}`}</span>`).join(''):'<span class="muted">No assigned Status values.</span>';}
  const timed=isGlobalTimedOut(); const banner=$('#timeoutBanner'); if(banner){banner.hidden=!timed;}
  const nav=$('#moderationNav'); if(nav)nav.hidden=!(isFounder()||activeStatusesFor().some(x=>x.status==='moderator'));
  const publish=$('#publishButton'); if(publish)publish.disabled=timed;
  const hint=$('#composerHint'); if(hint)hint.textContent=timed?'Timeout is active · browsing remains available, publishing is temporarily disabled.':'You can post normally. Structure is optional.';
  renderModeration();
}
function statusScopeDescription(row){if(row.scopeType==='global')return 'Global';const obj=state.objects.find(x=>x.id===row.scopeId)||state.moderationObjects.find(x=>x.id===row.scopeId);const post=state.posts.find(x=>x.id===row.scopeId)||state.moderationPosts.find(x=>x.id===row.scopeId);return `${STATUS_SCOPE_LABELS[row.scopeType]||row.scopeType} · ${obj?.title||post?.text?.slice(0,48)||publicIdShort(row.scopeId)}`;}
function statusDocIdClient(scopeType,scopeId,status,profileId){return safeDocId(scopeType,scopeId,status,profileId);}
function renderStatusTargetOptions(){const profile=$('#statusTargetProfile');if(profile){const oldProfile=profile.value;const rows=Object.values(state.profiles).sort((a,b)=>String(a.displayName||'').localeCompare(String(b.displayName||'')));profile.innerHTML=rows.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.displayName||'Member')} · ${escapeHtml(publicIdShort(p.id))}</option>`).join('');if([...profile.options].some(o=>o.value===oldProfile))profile.value=oldProfile;}const kind=$('#statusScopeKind'),target=$('#statusScopeTarget');if(!kind||!target)return;const k=kind.value;if(k==='global'){target.innerHTML='<option value="_">Whole LCS network</option>';target.disabled=true;return;}target.disabled=false;if(k==='project'){target.innerHTML=state.objects.filter(o=>o.kind==='project'&&!o.deleted).map(o=>`<option value="project|${escapeHtml(o.id)}">${escapeHtml(o.title)}</option>`).join('')||'<option value="">No projects available</option>';return;}const posts=state.posts.map(p=>`<option value="discussion_post|${escapeHtml(p.id)}">Post · ${escapeHtml(p.text.slice(0,70))}</option>`);const objs=state.objects.map(o=>`<option value="discussion_object|${escapeHtml(o.id)}">${escapeHtml(o.kind)} · ${escapeHtml(o.title)}</option>`);target.innerHTML=[...posts,...objs].join('')||'<option value="">No discussions available</option>';}
function renderModeration(){const denied=$('#moderationDenied'),workspace=$('#moderationWorkspace');if(!denied||!workspace)return;const canSee=isFounder()||activeStatusesFor().some(x=>x.status==='moderator');denied.hidden=canSee;workspace.hidden=!canSee;if(!canSee)return;const founder=isFounder();const statusSelect=$('#statusValue');if(statusSelect){[...statusSelect.options].forEach(o=>o.hidden=!founder&&o.value!=='timeout');if(!founder&&statusSelect.value!=='timeout')statusSelect.value='timeout';}renderStatusTargetOptions();const statuses=[...state.statuses].filter(isStatusActive).sort((a,b)=>String(a.status).localeCompare(String(b.status)));$('#activeStatusList').innerHTML=statuses.length?statuses.map(x=>{const p=identity(x.profileId);const revoke=(founder||(x.status==='timeout'&&canModerateStatusScope(x.scopeType,x.scopeId)))&&!(x.status==='founder'&&x.profileId===state.profileId);return `<div class="moderation-row"><div><span class="status-badge status-${escapeHtml(x.status)}">${STATUS_META[x.status]?.symbol||'•'} ${escapeHtml(STATUS_META[x.status]?.label||x.status)}</span><b>${escapeHtml(p.displayName)}</b><small>${escapeHtml(statusScopeDescription(x))}${x.expiresAt?` · expires ${new Date(timeValue(x.expiresAt)).toLocaleString()}`:''}</small></div>${revoke?`<button class="ghost-button danger-button" data-status-revoke="${escapeHtml(x.id)}" type="button">Revoke</button>`:''}</div>`;}).join(''):'<p class="muted">No active Status assignments visible in your moderation scope.</p>';
  const items=[...state.moderationPosts.map(x=>({...x,_collection:'publicPosts',_label:'Post'})),...state.moderationObjects.map(x=>({...x,_collection:'publicObjects',_label:x.kind||'Object'})),...state.moderationComments.map(x=>({...x,_collection:'publicComments',_label:'Response'})),...state.moderationLfg.map(x=>({...x,_collection:'publicLfg',_label:'LFG'}))].sort((a,b)=>timeValue(b.updatedAt||b.createdAt)-timeValue(a.updatedAt||a.createdAt)).slice(0,180);$('#moderationContentList').innerHTML=items.length?items.map(x=>{const text=x.text||x.title||x.description||'Content';return `<div class="moderation-row ${x.deleted?'is-removed':''}"><div><b>${escapeHtml(x._label)} · ${escapeHtml(identity(x.authorProfileId).displayName)}</b><small>${escapeHtml(String(text).slice(0,120))}</small><span>${x.deleted?'Removed':'Visible'} · ${timeAgo(x.updatedAt||x.createdAt)}</span></div><div class="request-actions"><button class="ghost-button" data-open-moderation-content="${escapeHtml(x._collection)}" data-content-id="${escapeHtml(x.id)}" type="button">Review</button>${x.deleted?`<button class="ghost-button" data-content-restore="${escapeHtml(x._collection)}" data-content-id="${escapeHtml(x.id)}" type="button">Restore</button>`:`<button class="ghost-button danger-button" data-content-remove="${escapeHtml(x._collection)}" data-content-id="${escapeHtml(x.id)}" type="button">Remove</button>`}</div></div>`;}).join(''):'<p class="muted">No moderation content loaded for this scope.</p>';
  $('#moderationAuditList').innerHTML=state.moderationLogs.length?state.moderationLogs.slice().sort((a,b)=>timeValue(b.createdAt)-timeValue(a.createdAt)).slice(0,150).map(x=>`<div class="audit-row"><div><b>${escapeHtml(x.action.replaceAll('_',' '))}</b><span>${escapeHtml(identity(x.actorProfileId).displayName)} → ${escapeHtml(identity(x.targetProfileId).displayName||x.targetProfileId||'content')}</span></div><small>${escapeHtml(x.reason||'No reason')} · ${timeAgo(x.createdAt)}</small></div>`).join(''):'<p class="muted">No immutable moderation log entries visible in this scope yet.</p>';
}
function canModerateStatusScope(scopeType,scopeId){return !isGlobalTimedOut()&&(isGlobalModerator()||hasStatus('moderator',scopeType,scopeId));}
async function grantStatus(e){
  e.preventDefault();if(!requireUser())return;
  const form=e.currentTarget,button=form.querySelector('button[type="submit"]'),oldLabel=button?.textContent||'Grant Status';
  const target=$('#statusTargetProfile').value,status=$('#statusValue').value,kind=$('#statusScopeKind').value,raw=$('#statusScopeTarget').value,reason=$('#statusReason').value.trim().slice(0,240),duration=$('#statusDuration').value;
  let scopeType='global',scopeId='_';if(kind!=='global'){const parts=raw.split('|');scopeType=parts[0]||'';scopeId=parts[1]||'';}
  if(!target||!scopeType||!scopeId){toast('Choose a target and scope.');return;}
  const targetProfile=state.profiles[target];if(targetProfile?._stub){toast('That profile is referenced by public content but its profile document has not synced yet. Status cannot be assigned until the profile finishes syncing.');return;}
  if(status==='founder'&&scopeType!=='global'){toast('Founder is global only.');return;}
  if(!isFounder()&&!canModerateStatusScope(scopeType,scopeId)){toast('Your Moderator Status does not cover that scope.');return;}
  if(button){button.disabled=true;button.textContent='Granting…';}
  try{
    const {db,fsMod}=state.firebase;const assignmentId=statusDocIdClient(scopeType,scopeId,status,target),ref=fsMod.doc(db,'statusAssignments',assignmentId),existing=await fsMod.getDoc(ref);
    let expiresAt=null;if(duration!=='none'){const ms={hour:3600000,day:86400000,week:604800000}[duration]||0;expiresAt=fsMod.Timestamp.fromDate(new Date(Date.now()+ms));}
    const actionId=crypto.randomUUID();const assignment={profileId:target,status,scopeType,scopeId,visibility:status==='timeout'?'private':'public',active:true,expiresAt,reason:status==='timeout'?reason:'',grantedByProfileId:state.profileId,createdAt:existing.exists()?existing.data().createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp(),revokedAt:null,revokedByProfileId:'',lastActionId:actionId};
    const log={actorProfileId:state.profileId,targetProfileId:target,targetCollection:'statusAssignments',targetId:assignmentId,action:'status_grant',scopeType,scopeId,reason,snapshot:{status,scopeType,scopeId,expiresAt:expiresAt||null},createdAt:fsMod.serverTimestamp()};
    const batch=fsMod.writeBatch(db);batch.set(fsMod.doc(db,'moderationLogs',actionId),log);batch.set(ref,assignment,{merge:false});await batch.commit();
    const verified=await fsMod.getDoc(ref);if(!verified.exists())throw new Error('Status write completed but could not be verified.');
    const row={id:verified.id,...verified.data()};state.statusPublic=[row,...state.statusPublic.filter(x=>x.id!==row.id)];if(target===state.profileId)state.statusOwn=[row,...state.statusOwn.filter(x=>x.id!==row.id)];mergeStatusRows();
    form.reset();renderStatusTargetOptions();
    toast(target===state.profileId&&status==='moderator'&&scopeType==='global'&&isFounder()?'Moderator Status added alongside Founder.':`${STATUS_META[status]?.label||status} Status granted.`);
  }catch(error){console.error('grant status failed',error);toast(firestoreErrorText(error,'grant this Status'));}
  finally{if(button){button.disabled=false;button.textContent=oldLabel;}}
}

async function revokeStatus(id){const row=state.statuses.find(x=>x.id===id);if(!row)return;const reason=(prompt('Reason for revoking this Status?','Status revoked')||'Status revoked').slice(0,240);const {db,fsMod}=state.firebase;const actionId=crypto.randomUUID(),ref=fsMod.doc(db,'statusAssignments',id),batch=fsMod.writeBatch(db);batch.set(fsMod.doc(db,'moderationLogs',actionId),{actorProfileId:state.profileId,targetProfileId:row.profileId,targetCollection:'statusAssignments',targetId:id,action:'status_revoke',scopeType:row.scopeType,scopeId:row.scopeId,reason,snapshot:{status:row.status,scopeType:row.scopeType,scopeId:row.scopeId},createdAt:fsMod.serverTimestamp()});batch.update(ref,{active:false,updatedAt:fsMod.serverTimestamp(),revokedAt:fsMod.serverTimestamp(),revokedByProfileId:state.profileId,lastActionId:actionId});await batch.commit();toast('Status revoked.');}
function contentForCollection(collection,id){const map={publicPosts:state.moderationPosts,publicObjects:state.moderationObjects,publicComments:state.moderationComments,publicLfg:state.moderationLfg};return (map[collection]||[]).find(x=>x.id===id)||({publicPosts:state.posts,publicObjects:state.objects,publicComments:state.comments,publicLfg:state.lfg}[collection]||[]).find(x=>x.id===id);}
function contentScope(collection,item,id){if(collection==='publicPosts')return ['discussion_post',id];if(collection==='publicObjects')return [item?.kind==='project'?'project':'discussion_object',id];if(collection==='publicComments')return [item?.targetType==='post'?'discussion_post':'discussion_object',item?.targetId||id];return ['global','_'];}
function moderationSnapshot(collection,item){const base={authorProfileId:item?.authorProfileId||'',deleted:Boolean(item?.deleted)};if(collection==='publicPosts')return {...base,text:String(item?.text||'').slice(0,1200),tags:Array.isArray(item?.tags)?item.tags.slice(0,8):[],reasoningType:item?.reasoningType||'unclassified'};if(collection==='publicObjects')return {...base,kind:item?.kind||'',title:String(item?.title||'').slice(0,100),description:String(item?.description||'').slice(0,700)};if(collection==='publicComments')return {...base,targetKey:item?.targetKey||'',text:String(item?.text||'').slice(0,800)};return {...base,title:String(item?.title||'').slice(0,100),description:String(item?.description||'').slice(0,700)};}
async function moderateContent(collection,id,restore=false){
  if(!requireUser())return;
  let item=contentForCollection(collection,id);
  const {db,fsMod}=state.firebase;
  if(!item){try{const snap=await fsMod.getDoc(fsMod.doc(db,collection,id));if(snap.exists())item={id:snap.id,...snap.data()};}catch{} }
  if(!item)return toast('Content was not found.');
  const own=item.authorProfileId===state.profileId;
  const [scopeType,scopeId]=contentScope(collection,item,id);
  let moderator=isGlobalModerator()||canModerateStatusScope(scopeType,scopeId);
  if(collection==='publicObjects'&&item.kind!=='project'&&!isGlobalModerator())moderator=false;
  const restoreTimed=collection==='publicPosts'?timedOutForDiscussionClient('post',id):collection==='publicObjects'?timedOutForDiscussionClient('object',id):collection==='publicComments'?timedOutForDiscussionClient(item.targetType,item.targetId):isGlobalTimedOut();
  const authorRemoved=Boolean(item.deleted&&item.deleteReason==='Deleted by author'&&item.deletedByProfileId===state.profileId);
  if(restore&&own&&restoreTimed&&!isFounder())return toast('Timeout is active. Restoring public content is temporarily disabled.');
  if(restore&&own&&!authorRemoved&&!moderator)return toast('Only a moderator can restore content that was removed by moderation.');
  if(!own&&!moderator)return toast('You do not have moderation authority for this content.');
  const ref=fsMod.doc(db,collection,id);

  // Author actions are also transactional + immutable-audited. The content itself is never hard-deleted.
  if(own&&(!restore||authorRemoved)){
    const actionId=crypto.randomUUID();
    const action=restore?'author_restore':'author_remove';
    const batch=fsMod.writeBatch(db);
    batch.set(fsMod.doc(db,'moderationLogs',actionId),{
      actorProfileId:state.profileId,
      targetProfileId:state.profileId,
      targetCollection:collection,
      targetId:id,
      action,
      scopeType,
      scopeId,
      reason:restore?'Restored by author':'Deleted by author',
      snapshot:moderationSnapshot(collection,item),
      createdAt:fsMod.serverTimestamp()
    });
    batch.update(ref,restore?{
      deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:actionId,updatedAt:fsMod.serverTimestamp()
    }:{
      deleted:true,deletedAt:fsMod.serverTimestamp(),deletedByProfileId:state.profileId,deleteReason:'Deleted by author',moderationActionId:actionId,updatedAt:fsMod.serverTimestamp()
    });
    await batch.commit();
    toast(restore?'Content restored. The history entry was retained.':'Content removed from public views. The original and deletion history are retained for moderation.');
    return;
  }

  const reason=(prompt(restore?'Reason for restoring this content?':'Reason for removing this content?',restore?'Moderation review complete':'Moderation action')||'Moderation action').slice(0,240);
  const actionId=crypto.randomUUID(),action=restore?'restore':'remove',batch=fsMod.writeBatch(db);
  batch.set(fsMod.doc(db,'moderationLogs',actionId),{actorProfileId:state.profileId,targetProfileId:item.authorProfileId||'',targetCollection:collection,targetId:id,action,scopeType,scopeId,reason,snapshot:moderationSnapshot(collection,item),createdAt:fsMod.serverTimestamp()});
  batch.update(ref,restore?{deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:actionId,updatedAt:fsMod.serverTimestamp()}:{deleted:true,deletedAt:fsMod.serverTimestamp(),deletedByProfileId:state.profileId,deleteReason:reason,moderationActionId:actionId,updatedAt:fsMod.serverTimestamp()});
  await batch.commit();
  toast(restore?'Content restored and logged.':'Content removed from normal views and retained in the moderation record.');
}
function openModerationContent(collection,id){const item=contentForCollection(collection,id);if(!item)return; if(collection==='publicPosts')return openPostDetail(id);if(collection==='publicObjects')return openObjectDetail(id);if(collection==='publicComments'){const type=item.targetType||'post';type==='post'?openPostDetail(item.targetId):openObjectDetail(item.targetId);return;}if(collection==='publicLfg')openLfg(id);}
async function tryFounderBootstrap(){if(!state.profileId||!state.firebaseReady||state.founderBootstrapAttempted||isFounder())return;state.founderBootstrapAttempted=true;const {db,fsMod}=state.firebase,id=statusDocIdClient('global','_','founder',state.profileId);try{await fsMod.setDoc(fsMod.doc(db,'statusAssignments',id),{profileId:state.profileId,status:'founder',scopeType:'global',scopeId:'_',visibility:'public',active:true,expiresAt:null,reason:'',grantedByProfileId:state.profileId,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp(),revokedAt:null,revokedByProfileId:'',lastActionId:'bootstrap'});toast('Founder Status securely linked to this public LCS identity.');}catch(e){if(e?.code!=='permission-denied')console.debug('Founder bootstrap',e?.code||e);}}
function stopModerationSubscriptions(){state.moderationUnsubs.splice(0).forEach(fn=>{try{fn();}catch{}});state.moderationPosts=[];state.moderationObjects=[];state.moderationComments=[];state.moderationLfg=[];state.moderationLogs=[];state.statusPrivileged=[];state.moderationSignature='';}
function moderationSubscribe(q,apply,label){const {fsMod}=state.firebase;const unsub=fsMod.onSnapshot(q,s=>apply(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.debug(`moderation ${label}`,e?.code||e));state.moderationUnsubs.push(unsub);}
function moderationDocSubscribe(ref,apply,label){const {fsMod}=state.firebase;const unsub=fsMod.onSnapshot(ref,s=>apply(s.exists()?{id:s.id,...s.data()}:null),e=>console.debug(`moderation ${label}`,e?.code||e));state.moderationUnsubs.push(unsub);}
function mergeModerationRows(current,rows){return [...new Map([...current,...rows].filter(Boolean).map(x=>[x.id,x])).values()];}
function setupModerationSubscriptions(){if(!state.firebaseReady||!state.profileId)return;const modRows=activeStatusesFor().filter(x=>x.status==='moderator');const global=isGlobalModerator();const signature=JSON.stringify([global,...modRows.map(x=>[x.scopeType,x.scopeId]).sort()]);if(signature===state.moderationSignature)return;stopModerationSubscriptions();state.moderationSignature=signature;if(!global&&!modRows.length){renderModeration();return;}const {db,fsMod}=state.firebase;if(global){moderationSubscribe(fsMod.query(fsMod.collection(db,'statusAssignments'),fsMod.limit(2500)),rows=>{state.statusPrivileged=rows;mergeStatusRowsNoResub();},'statuses');moderationSubscribe(fsMod.query(fsMod.collection(db,'moderationLogs'),fsMod.orderBy('createdAt','desc'),fsMod.limit(300)),rows=>{state.moderationLogs=rows;renderModeration();},'logs');moderationSubscribe(fsMod.query(fsMod.collection(db,'publicPosts'),fsMod.orderBy('updatedAt','desc'),fsMod.limit(300)),rows=>{state.moderationPosts=rows;renderModeration();},'posts');moderationSubscribe(fsMod.query(fsMod.collection(db,'publicObjects'),fsMod.orderBy('updatedAt','desc'),fsMod.limit(300)),rows=>{state.moderationObjects=rows;renderModeration();},'objects');moderationSubscribe(fsMod.query(fsMod.collection(db,'publicComments'),fsMod.orderBy('updatedAt','desc'),fsMod.limit(500)),rows=>{state.moderationComments=rows;renderModeration();},'comments');moderationSubscribe(fsMod.query(fsMod.collection(db,'publicLfg'),fsMod.orderBy('updatedAt','desc'),fsMod.limit(200)),rows=>{state.moderationLfg=rows;renderModeration();},'lfg');return;}modRows.forEach(row=>{const q=fsMod.query(fsMod.collection(db,'statusAssignments'),fsMod.where('scopeType','==',row.scopeType),fsMod.where('scopeId','==',row.scopeId),fsMod.limit(250));moderationSubscribe(q,rows=>{state.statusPrivileged=mergeModerationRows(state.statusPrivileged,rows);mergeStatusRowsNoResub();},`status ${row.scopeId}`);const lq=fsMod.query(fsMod.collection(db,'moderationLogs'),fsMod.where('scopeType','==',row.scopeType),fsMod.where('scopeId','==',row.scopeId),fsMod.limit(200));moderationSubscribe(lq,rows=>{state.moderationLogs=mergeModerationRows(state.moderationLogs,rows);renderModeration();},`logs ${row.scopeId}`);if(row.scopeType==='discussion_post'){moderationDocSubscribe(fsMod.doc(db,'publicPosts',row.scopeId),doc=>{state.moderationPosts=mergeModerationRows(state.moderationPosts,[doc]);renderModeration();},`post ${row.scopeId}`);const cq=fsMod.query(fsMod.collection(db,'publicComments'),fsMod.where('targetKey','==',`post:${row.scopeId}`),fsMod.limit(500));moderationSubscribe(cq,rows=>{state.moderationComments=mergeModerationRows(state.moderationComments,rows);renderModeration();},`post comments ${row.scopeId}`);}else if(row.scopeType==='discussion_object'||row.scopeType==='project'){moderationDocSubscribe(fsMod.doc(db,'publicObjects',row.scopeId),doc=>{state.moderationObjects=mergeModerationRows(state.moderationObjects,[doc]);renderModeration();},`object ${row.scopeId}`);const cq=fsMod.query(fsMod.collection(db,'publicComments'),fsMod.where('targetKey','==',`object:${row.scopeId}`),fsMod.limit(500));moderationSubscribe(cq,rows=>{state.moderationComments=mergeModerationRows(state.moderationComments,rows);renderModeration();},`object comments ${row.scopeId}`);}});renderModeration();}
function mergeStatusRowsNoResub(){const rows=[...state.statusPublic,...state.statusOwn,...state.statusPrivileged];state.statuses=[...new Map(rows.map(x=>[x.id,x])).values()];renderStatusSurfacesNoResub();}
function renderStatusSurfacesNoResub(){const account=$('#accountStatusList');if(account){const rows=activeStatusesFor();account.innerHTML=rows.length?rows.map(x=>`<span class="status-badge status-${escapeHtml(x.status)}">${STATUS_META[x.status]?.symbol||'•'} ${escapeHtml(STATUS_META[x.status]?.label||x.status)}${x.scopeType==='global'?'':` · ${escapeHtml(STATUS_SCOPE_LABELS[x.scopeType]||x.scopeType)}`}</span>`).join(''):'<span class="muted">No assigned Status values.</span>';}const timed=isGlobalTimedOut(),banner=$('#timeoutBanner');if(banner)banner.hidden=!timed;const nav=$('#moderationNav');if(nav)nav.hidden=!(isFounder()||activeStatusesFor().some(x=>x.status==='moderator'));renderModeration();}

const MOBILE_AUTH_PENDING_KEY='lcsMobileGoogleBrokerV1';
function isMobileAuthBrowser(){return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')||Boolean(window.matchMedia?.('(pointer: coarse)').matches&&window.innerWidth<=900);}
function compactAuthMessage(value){return String(value||'').replace(/\s+/g,' ').trim().slice(0,900);}
function readMobileAuthPending(){
  try{
    const raw=sessionStorage.getItem(MOBILE_AUTH_PENDING_KEY)||localStorage.getItem(MOBILE_AUTH_PENDING_KEY);
    if(!raw)return null;
    const value=JSON.parse(raw);
    if(!value?.sessionId||!value?.continueUri)return null;
    if(Date.now()-Number(value.startedAt||0)>15*60*1000){clearMobileAuthPending();return null;}
    return value;
  }catch{return null;}
}
function writeMobileAuthPending(value){
  const raw=JSON.stringify(value);
  try{sessionStorage.setItem(MOBILE_AUTH_PENDING_KEY,raw);}catch{}
  try{localStorage.setItem(MOBILE_AUTH_PENDING_KEY,raw);}catch{}
}
function clearMobileAuthPending(){
  try{sessionStorage.removeItem(MOBILE_AUTH_PENDING_KEY);}catch{}
  try{localStorage.removeItem(MOBILE_AUTH_PENDING_KEY);}catch{}
}
function mobileAuthCallbackLooksPresent(){
  const q=new URLSearchParams(location.search);
  if(q.has('code')||q.has('error')||q.has('oauth_token')||q.has('state')||q.has('scope')||q.has('authuser'))return true;
  return /(?:^|[&#])(id_token|access_token|error|code)=/i.test(location.hash||'');
}
async function identityToolkitRequest(endpoint,payload){
  const apiKey=String(LCS_CONFIG.firebase?.apiKey||'');
  const response=await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(payload),
    cache:'no-store',
    referrerPolicy:'strict-origin-when-cross-origin'
  });
  let body={};
  try{body=await response.json();}catch{}
  if(!response.ok){
    const error=new Error(compactAuthMessage(body?.error?.message||`Identity Toolkit HTTP ${response.status}`));
    error.code=`auth/mobile-broker-${String(body?.error?.message||body?.error?.status||response.status).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)}`;
    error.httpStatus=response.status;
    error.identityToolkitStatus=String(body?.error?.status||'');
    throw error;
  }
  return body;
}
async function probeFirebaseAuthProject(){
  const apiKey=String(LCS_CONFIG.firebase?.apiKey||'');
  if(!apiKey)return {ok:false,httpStatus:0,errorStatus:'MISSING_API_KEY',errorMessage:'Firebase apiKey is missing.'};
  try{
    const response=await fetch(`https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(apiKey)}`,{method:'GET',cache:'no-store',referrerPolicy:'strict-origin-when-cross-origin'});
    let payload={};
    try{payload=await response.json();}catch{}
    const authorizedDomains=Array.isArray(payload?.authorizedDomains)?payload.authorizedDomains.map(String):[];
    return {ok:response.ok,httpStatus:response.status,errorStatus:String(payload?.error?.status||''),errorMessage:compactAuthMessage(payload?.error?.message||''),authorizedDomains,currentDomainAuthorized:authorizedDomains.length?authorizedDomains.includes(location.hostname):null};
  }catch(e){return {ok:null,httpStatus:0,errorStatus:'NETWORK_PROBE_FAILED',errorMessage:compactAuthMessage(e?.message||e),authorizedDomains:[],currentDomainAuthorized:null};}
}
function authDiagnosticText(err,attempt,probe){
  const rows=[
    `attempt: ${attempt||'unknown'}`,
    `origin: ${location.origin}`,
    `authDomain: ${LCS_CONFIG.firebase?.authDomain||'(missing)'}`,
    `projectId: ${LCS_CONFIG.firebase?.projectId||'(missing)'}`,
    `mobileBrowser: ${isMobileAuthBrowser()?'yes':'no'}`,
    `mobileBrokerPending: ${readMobileAuthPending()?'yes':'no'}`,
    `online: ${navigator.onLine?'yes':'no'}`
  ];
  if(probe){
    rows.push(`projectConfigProbe: ${probe.ok===true?'ok':probe.ok===false?'blocked':'unavailable'}`);
    if(probe.httpStatus)rows.push(`probeHttpStatus: ${probe.httpStatus}`);
    if(probe.errorStatus)rows.push(`probeStatus: ${probe.errorStatus}`);
    if(probe.errorMessage)rows.push(`probeMessage: ${probe.errorMessage}`);
    if(probe.currentDomainAuthorized!==null)rows.push(`authorizedDomain: ${probe.currentDomainAuthorized?'yes':'no'}`);
  }
  if(err?.httpStatus)rows.push(`brokerHttpStatus: ${err.httpStatus}`);
  if(err?.identityToolkitStatus)rows.push(`brokerStatus: ${err.identityToolkitStatus}`);
  const message=compactAuthMessage(err?.message);
  if(message)rows.push(`firebaseMessage: ${message}`);
  return rows.join('\n');
}
function clearAuthError(){const b=$('#authErrorBox');b.hidden=true;$('#authErrorText').textContent='';$('#authErrorCode').textContent='';const d=$('#authDiagnosticDetails');if(d){d.textContent='';d.hidden=true;}const r=$('#authRedirectRetryButton');if(r)r.hidden=true;}
function showAuthError(err,attempt='popup',probe=null){
  const code=String(err?.code||'auth/unknown');
  let text='Firebase could not complete Google sign-in. Check Authentication, authorized domains, and browser key/API restrictions.';
  if(code.includes('unauthorized-domain'))text='This GitHub Pages domain is not authorized in Firebase Authentication. Add j12h36h.github.io under Authentication → Settings → Authorized domains.';
  else if(code.includes('popup-closed'))text='The Google window was closed before sign-in finished.';
  else if(code.includes('popup-blocked'))text='The browser blocked the Google sign-in window. Allow popups for this site and retry Google sign-in.';
  else if(code.includes('project-config-request-failed'))text='Firebase project configuration could not be read with this browser API key. The diagnostic below normally exposes an HTTP-referrer or API restriction that must be corrected in Google Cloud.';
  else if(code.includes('mobile-broker'))text='The mobile Google account flow reached Firebase Identity Toolkit but the direct credential exchange did not complete. The diagnostic below contains the exact Identity Toolkit response.';
  else if(code.includes('mobile-credential-missing'))text='Google completed the mobile authorization flow, but Identity Toolkit did not return a Google credential that Firebase could attach to this browser session.';
  else if(code.includes('session-not-retained'))text='Google sign-in completed, but Firebase did not retain the signed-in browser session.';
  else if(code.includes('internal-error'))text='Firebase returned an internal Google sign-in error. On mobile, LCS now bypasses Firebase popup/redirect helper state entirely and uses Identity Toolkit to obtain the Google credential before handing it to Firebase.';
  $('#authErrorTitle').textContent='Google sign-in needs attention';$('#authErrorText').textContent=text;$('#authErrorCode').textContent=code;
  const details=$('#authDiagnosticDetails');if(details){details.textContent=authDiagnosticText(err,attempt,probe);details.hidden=false;}
  const retry=$('#authRedirectRetryButton');if(retry)retry.hidden=!(isMobileAuthBrowser()&&state.firebase?.auth);
  $('#authErrorBox').hidden=false;
}
async function startMobileGoogleBroker(probe=null){
  if(!state.firebase?.auth)return showAuthError({code:'auth/configuration-not-found'},'mobile-broker-start',probe);
  const continueUri=`${location.origin}${location.pathname}`;
  const returnUrl=location.href;
  try{
    const response=await identityToolkitRequest('accounts:createAuthUri',{
      providerId:'google.com',
      continueUri,
      authFlowType:'CODE_FLOW',
      context:crypto.randomUUID(),
      customParameter:{prompt:'select_account'}
    });
    if(!response?.authUri||!response?.sessionId){
      const error=new Error('Identity Toolkit did not return authUri/sessionId for Google.');
      error.code='auth/mobile-broker-invalid-start-response';
      throw error;
    }
    writeMobileAuthPending({
      sessionId:String(response.sessionId),
      continueUri,
      returnUrl,
      startedAt:Date.now()
    });
    location.assign(String(response.authUri));
  }catch(e){
    clearMobileAuthPending();
    console.error(e);
    showAuthError(e,'mobile-broker-start',probe);
  }
}
async function completeMobileGoogleBroker(auth,authMod){
  const pending=readMobileAuthPending();
  if(!pending||!isMobileAuthBrowser())return false;
  if(!mobileAuthCallbackLooksPresent())return false;
  try{
    const callbackUri=location.href;
    const response=await identityToolkitRequest('accounts:signInWithIdp',{
      requestUri:callbackUri,
      sessionId:pending.sessionId,
      returnSecureToken:true,
      returnIdpCredential:true
    });
    const googleIdToken=String(response?.oauthIdToken||'');
    const googleAccessToken=String(response?.oauthAccessToken||'');
    if(!googleIdToken&&!googleAccessToken){
      const error=new Error('Identity Toolkit completed the callback but returned no Google OAuth credential.');
      error.code='auth/mobile-credential-missing';
      throw error;
    }
    const credential=authMod.GoogleAuthProvider.credential(googleIdToken||null,googleAccessToken||null);
    const result=await authMod.signInWithCredential(auth,credential);
    if(!result?.user&&!auth.currentUser){
      const error=new Error('Firebase accepted the Google credential but did not create a browser user session.');
      error.code='auth/session-not-retained';
      throw error;
    }
    clearMobileAuthPending();
    const target=new URL(pending.returnUrl||pending.continueUri,location.origin);
    if(target.origin===location.origin)history.replaceState(null,'',`${target.pathname}${target.search}${target.hash}`);
    return true;
  }catch(e){
    clearMobileAuthPending();
    console.error('LCS mobile Google broker return',e);
    showDialog('#authDialog');
    showAuthError(e,'mobile-broker-return');
    return false;
  }
}
async function waitForFirebaseAuthUser(auth,authMod,timeoutMs=4500){
  if(auth.currentUser)return auth.currentUser;
  return await new Promise(resolve=>{
    let settled=false;
    let unsubscribe=()=>{};
    const finish=user=>{if(settled)return;settled=true;clearTimeout(timer);try{unsubscribe();}catch{}resolve(user||auth.currentUser||null);};
    const timer=setTimeout(()=>finish(auth.currentUser),timeoutMs);
    unsubscribe=authMod.onAuthStateChanged(auth,user=>{if(user)finish(user);},()=>finish(null));
  });
}
async function signInGoogle(){
  clearAuthError();
  if(!state.firebase?.auth)return showAuthError({code:'auth/configuration-not-found'});
  const {auth,authMod}=state.firebase;
  const mobile=isMobileAuthBrowser();
  const probe=mobile?await probeFirebaseAuthProject():null;
  if(mobile&&probe?.ok===false){showAuthError({code:'auth/project-config-request-failed',message:`Firebase project configuration request failed with HTTP ${probe.httpStatus}${probe.errorStatus?` (${probe.errorStatus})`:''}.`},'preflight',probe);return;}
  if(mobile&&probe?.currentDomainAuthorized===false){showAuthError({code:'auth/unauthorized-domain',message:`${location.hostname} is not present in the Firebase authorizedDomains response.`},'preflight',probe);return;}
  try{await authMod.setPersistence(auth,authMod.browserLocalPersistence);}catch(e){console.warn('Firebase local persistence unavailable before sign-in',e?.code||e);}
  if(mobile){
    await startMobileGoogleBroker(probe);
    return;
  }
  const provider=new authMod.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  try{
    const result=await authMod.signInWithPopup(auth,provider);
    if(result?.user){try{await result.user.getIdToken();}catch(tokenError){console.debug('Firebase token refresh after popup',tokenError?.code||tokenError);}}
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    if(!auth.currentUser){const retentionError=new Error('Google returned to LCS, but Firebase did not retain the authenticated browser session.');retentionError.code='auth/session-not-retained';throw retentionError;}
    syncFirebaseAuthUser(auth.currentUser);
    if(state.firebaseReady)await ensurePrivateIdentityOnce();
    closeDialog('#authDialog');toast('Signed in. This browser will keep the LCS session until you sign out.');
  }catch(e){console.error(e);showAuthError(e,'popup',probe);}
}
async function signOutUser(){if(!state.firebase?.auth)return;stopPrivateSubscriptions();stopOwnProfileListener();await state.firebase.authMod.signOut(state.firebase.auth);toast('Signed out.');}

function stopOwnProfileListener(){if(state.ownProfileUnsub){state.ownProfileUnsub();state.ownProfileUnsub=null;}}
function stopPrivateSubscriptions(){state.privateUnsubs.splice(0).forEach(fn=>{try{fn();}catch{}});state.friendRequests=[];state.friendships=[];state.lfgRequests=[];state.blocks=[];state.statusOwn=[];stopModerationSubscriptions();}
function firestoreErrorText(error, action='use Firestore') {
  const code=String(error?.code||''); const message=String(error?.message||'');
  if(code.includes('permission-denied')) return `Firebase denied permission to ${action}. Confirm the current firestore.rules are published.`;
  if(code.includes('failed-precondition') || /index/i.test(message)) return `Firestore needs an index for this query. LCS will try an index-free realtime fallback automatically.`;
  if(code.includes('unavailable') || code.includes('network') || /network|offline/i.test(message)) return `Firebase is temporarily unreachable. Check the connection and try again.`;
  return message ? `Firebase could not ${action}: ${message}` : `Firebase could not ${action}.`;
}
function publicSubscribe(name,apply,{orderBy='',limit=500,filters=[]}={}){
  const {db,fsMod}=state.firebase;
  const build=(withOrder=true,queryLimit=limit)=>{
    const parts=[fsMod.collection(db,name),...filters.map(([field,op,value])=>fsMod.where(field,op,value))];
    if(withOrder&&orderBy)parts.push(fsMod.orderBy(orderBy,'desc'));
    parts.push(fsMod.limit(queryLimit)); return fsMod.query(...parts);
  };
  const deliver=(snapshot,clientSort=false)=>{
    let rows=snapshot.docs.map(d=>({id:d.id,...d.data()}));
    if(clientSort&&orderBy)rows.sort((a,b)=>timeValue(b?.[orderBy])-timeValue(a?.[orderBy]));
    apply(rows);
  };
  let fellBack=false;
  const start=(withOrder=true)=>{
    const queryLimit=withOrder?limit:Math.min(Math.max(limit*4,2000),5000);
    const unsub=fsMod.onSnapshot(build(withOrder,queryLimit),s=>deliver(s,!withOrder),e=>{
      console.error(`subscription ${name}`,e);
      const indexFailure=Boolean(withOrder&&orderBy&&filters.length&&(String(e?.code||'').includes('failed-precondition')||/index/i.test(String(e?.message||''))));
      if(indexFailure&&!fellBack){
        fellBack=true;
        console.warn(`Falling back to index-free realtime query for ${name}.`,e);
        setBackendStatus('Live network connected with compatibility query',`${name} is using an index-free realtime fallback. You can deploy firestore.indexes.json later for optimal scaling.`, 'ok');
        start(false);
        return;
      }
      setBackendStatus('Live network needs attention',firestoreErrorText(e,`read ${name}`),'error');
    });
    state.publicUnsubs.push(unsub);
  };
  start(true);
}
function privateQuerySubscribe(name,field,value,apply){const {db,fsMod}=state.firebase;const q=fsMod.query(fsMod.collection(db,name),fsMod.where(field,'==',value),fsMod.limit(250));const unsub=fsMod.onSnapshot(q,s=>apply(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error(`private subscription ${name}`,e));state.privateUnsubs.push(unsub);}
function setupPrivateSubscriptions(){stopPrivateSubscriptions();if(!state.profileId)return;let friendIn=[],friendOut=[],lfgIn=[],lfgOut=[];const merge=(a,b)=>[...new Map([...a,...b].map(x=>[x.id,x])).values()];privateQuerySubscribe('privateFriendRequests','toProfileId',state.profileId,rows=>{friendIn=rows;state.friendRequests=merge(friendIn,friendOut);renderConnections();if(state.detail?.type==='profile')openProfileDetail(state.detail.id);});privateQuerySubscribe('privateFriendRequests','fromProfileId',state.profileId,rows=>{friendOut=rows;state.friendRequests=merge(friendIn,friendOut);renderConnections();});privateQuerySubscribe('privateLfgRequests','toProfileId',state.profileId,rows=>{lfgIn=rows;state.lfgRequests=merge(lfgIn,lfgOut);renderConnections();renderLfg();});privateQuerySubscribe('privateLfgRequests','fromProfileId',state.profileId,rows=>{lfgOut=rows;state.lfgRequests=merge(lfgIn,lfgOut);renderConnections();renderLfg();});privateQuerySubscribe('statusAssignments','profileId',state.profileId,rows=>{state.statusOwn=rows;mergeStatusRows();renderAuth();renderAccount();renderDetailThread();});const {db,fsMod}=state.firebase;const q=fsMod.query(fsMod.collection(db,'privateFriendships'),fsMod.where('members','array-contains',state.profileId),fsMod.limit(250));state.privateUnsubs.push(fsMod.onSnapshot(q,s=>{state.friendships=s.docs.map(d=>({id:d.id,...d.data()}));renderConnections();if(state.detail?.type==='profile')openProfileDetail(state.detail.id);},e=>console.error('friendships',e)));const bq=fsMod.query(fsMod.collection(db,'privateBlocks'),fsMod.where('blockerProfileId','==',state.profileId),fsMod.limit(500));state.privateUnsubs.push(fsMod.onSnapshot(bq,s=>{state.blocks=s.docs.map(d=>({id:d.id,...d.data()}));renderFeed();renderCatalogs();renderSearchPanel();renderLfg();renderConnections();if(state.detail?.type==='profile')openProfileDetail(state.detail.id);},e=>console.error('blocks',e)));}

async function ensurePrivateIdentityOnce(){
  if(!state.authUid||!state.firebaseReady||!state.firebase?.db)return;
  if(state.profileId)return state.profileId;
  if(state.identityLinkPromise)return state.identityLinkPromise;
  const expectedUid=state.authUid;
  state.identityLinkPromise=(async()=>{
    await ensurePrivateIdentity();
    return state.authUid===expectedUid?state.profileId:null;
  })().finally(()=>{state.identityLinkPromise=null;});
  return state.identityLinkPromise;
}
async function ensurePrivateIdentity(){if(!state.authUid||!state.firebaseReady)return;const {db,fsMod}=state.firebase;const accountRef=fsMod.doc(db,'privateAccounts',state.authUid);let accountSnap=await fsMod.getDoc(accountRef);let profileId=accountSnap.exists()?accountSnap.data().publicProfileId:'';if(!profileId){profileId=crypto.randomUUID();await fsMod.setDoc(accountRef,{publicProfileId:profileId,securityVersion:6,createdAt:fsMod.serverTimestamp()});}
  state.profileId=profileId;
  const profileRef=fsMod.doc(db,'publicProfiles',profileId);let profileSnap=await fsMod.getDoc(profileRef);if(!profileSnap.exists()){
    let displayName=generatedPublicName(profileId),bio='';
    try{const legacy=await fsMod.getDoc(fsMod.doc(db,'users',state.authUid));if(legacy.exists()){const d=legacy.data();if(typeof d.displayName==='string'&&d.displayName.trim().length>=2)displayName=d.displayName.trim().slice(0,40);if(typeof d.bio==='string')bio=d.bio.trim().slice(0,240);}}catch{}
    await fsMod.setDoc(profileRef,{displayName,bio,createdAt:fsMod.serverTimestamp(),updatedAt:fsMod.serverTimestamp()});profileSnap=await fsMod.getDoc(profileRef);
  }
  state.publicProfile={id:profileId,...profileSnap.data()};state.profiles[profileId]=state.publicProfile;state.profileVerified=true;state.profileSaveStatus='Public profile synced';
  stopOwnProfileListener();state.ownProfileUnsub=fsMod.onSnapshot(profileRef,{includeMetadataChanges:true},s=>{if(!s.exists())return;state.publicProfile={id:s.id,...s.data()};state.profiles[s.id]=state.publicProfile;if(!s.metadata.hasPendingWrites){state.profileVerified=true;const currentName=$('#accountDisplayName')?.value.trim().replace(/\s+/g,' ')||'';const currentBio=$('#accountBio')?.value.trim()||'';const matches=currentName===String(s.data().displayName||'')&&currentBio===String(s.data().bio||'');if(!state.accountDirty||matches){state.profileSaveStatus='Saved · verified public';state.accountDirty=false;}}renderAuth();renderAccount();renderFeed();renderCatalogs();renderSearchPanel();if(state.detail?.type==='profile'&&state.detail.id===s.id)openProfileDetail(s.id);});
  setupPrivateSubscriptions();renderAuth();renderAccount();renderConnections();renderStatusSurfaces();tryFounderBootstrap().catch(console.debug);
  if(!state.legacyMigrationStarted){state.legacyMigrationStarted=true;setTimeout(()=>migrateLegacyOwnedData().catch(e=>console.warn('Legacy migration skipped:',e)),300);}
}

async function migrateLegacyOwnedData(){if(!state.authUid||!state.profileId)return;const {db,fsMod}=state.firebase;const pid=state.profileId,uid=state.authUid;
  const specs=[
    ['spaces','ownerUid','publicSpaces',d=>({name:d.name||'Community',description:d.description||'',ownerProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp(),updatedAt:d.updatedAt||fsMod.serverTimestamp()})],
    ['channels','ownerUid','publicChannels',d=>({spaceId:d.spaceId,name:d.name||'general',description:d.description||'',type:d.type||'discussion',ownerProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp(),updatedAt:d.updatedAt||fsMod.serverTimestamp()})],
    ['posts','authorUid','publicPosts',d=>({text:d.text||'',tags:Array.isArray(d.tags)?d.tags:[],reasoningType:d.reasoningType||'unclassified',kind:d.kind||'idea',spaceId:d.channelId?(d.spaceId||SYSTEM_SPACE.id):SYSTEM_SPACE.id,channelId:d.channelId||SYSTEM_CHANNELS[0].id,authorProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp(),updatedAt:d.updatedAt||fsMod.serverTimestamp(),deleted:Boolean(d.deleted),deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''})],
    ['objects','authorUid','publicObjects',d=>({kind:d.kind||'idea',title:d.title||'Untitled',description:d.description||'',tags:Array.isArray(d.tags)?d.tags:[],spaceId:d.channelId?(d.spaceId||SYSTEM_SPACE.id):SYSTEM_SPACE.id,channelId:d.channelId||SYSTEM_CHANNELS[0].id,authorProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp(),updatedAt:d.updatedAt||fsMod.serverTimestamp(),deleted:Boolean(d.deleted),deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''})],
    ['comments','authorUid','publicComments',d=>({targetKey:d.targetKey,targetType:d.targetType,targetId:d.targetId,text:d.text||'',reasoningType:d.reasoningType||'unclassified',authorProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp(),updatedAt:d.updatedAt||fsMod.serverTimestamp(),deleted:false,deletedAt:null,deletedByProfileId:'',deleteReason:'',moderationActionId:''})],
    ['reactions','userUid','publicReactions',d=>({targetType:d.targetType,targetId:d.targetId,type:'helpful',actorProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp()})],
    ['connections','authorUid','publicConnections',d=>({sourceId:d.sourceId,targetId:d.targetId,relation:d.relation||'related to',authorProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp()})],
    ['postLinks','authorUid','publicPostLinks',d=>({postId:d.postId,objectId:d.objectId,relation:d.relation||'related to',authorProfileId:pid,createdAt:d.createdAt||fsMod.serverTimestamp()})]
  ];
  for(const [oldName,field,newName,transform] of specs){try{const q=fsMod.query(fsMod.collection(db,oldName),fsMod.where(field,'==',uid),fsMod.limit(300));const snap=await fsMod.getDocs(q);for(const docSnap of snap.docs){const data=transform(docSnap.data());if((newName==='publicPosts'&&!data.text)||(newName==='publicObjects'&&!data.description))continue;await fsMod.setDoc(fsMod.doc(db,newName,docSnap.id),data,{merge:false});await fsMod.deleteDoc(docSnap.ref);}}catch(e){console.debug(`No legacy ${oldName} migrated`,e?.code||e);}}
  try{const q=fsMod.query(fsMod.collection(db,'follows'),fsMod.where('userUid','==',uid),fsMod.limit(300));const snap=await fsMod.getDocs(q);for(const d of snap.docs){const x=d.data();if(x.targetType==='object'){await fsMod.setDoc(fsMod.doc(db,'publicFollows',safeDocId(pid,'object',x.targetId)),{followerProfileId:pid,targetType:'object',targetId:x.targetId,createdAt:x.createdAt||fsMod.serverTimestamp()});}await fsMod.deleteDoc(d.ref);}}catch{}
  try{await fsMod.deleteDoc(fsMod.doc(db,'users',uid));}catch{}
}

function syncFirebaseAuthUser(user){
  const next=user?.uid||null;
  const changed=next!==state.authUid;
  state.authUid=next;
  state.authReady=true;
  if(changed){
    state.profileId=null;state.publicProfile=null;state.profileVerified=false;state.accountDirty=false;
    state.profileSaveStatus=next?'Authentication verified · restoring private identity link…':'';
    state.legacyMigrationStarted=false;state.founderBootstrapAttempted=false;state.identityLinkPromise=null;
    state.statusPublic=[];state.statusOwn=[];state.statusPrivileged=[];state.statuses=[];
    stopPrivateSubscriptions();stopOwnProfileListener();
  }
  renderAuth();renderAccount();renderConnections();renderDetailThread();
  if(next&&state.firebaseReady)ensurePrivateIdentityOnce().catch(e=>{console.error(e);toast('Could not link the private account to a public profile.');});
}
async function recoverPersistedMobileAuth(){
  const auth=state.firebase?.auth;
  if(!auth)return;
  try{
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    if(auth.currentUser)syncFirebaseAuthUser(auth.currentUser);
  }catch(e){console.debug('Firebase mobile session recovery',e?.code||e);}
}

async function initFirebase(){
  if(!isFirebaseConfigured()){state.authReady=true;setBackendStatus('Backend configuration missing','Add the Firebase Web App configuration in assets/js/config.js.','error');$('#authSetupWarning').hidden=false;renderAuth();renderAccount();return;}
  try{
    const firestorePromise=import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    const [appMod,authMod]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js')]);
    const app=appMod.initializeApp(LCS_CONFIG.firebase),auth=authMod.getAuth(app);authMod.useDeviceLanguage(auth);state.firebase={app,auth,authMod,db:null,fsMod:null};
    // Normalize any restored/legacy session onto durable local persistence before auth state is consumed.
    try{await authMod.setPersistence(auth,authMod.browserLocalPersistence);}catch(e){console.warn('Firebase local persistence unavailable',e?.code||e);}
    // Mobile bypass: complete Identity Toolkit's authorization-code flow first, then
    // hand the returned Google credential to Firebase with signInWithCredential().
    // This avoids the mobile popup/redirect helper state that was returning auth/internal-error.
    const mobileBrokerCompleted=await completeMobileGoogleBroker(auth,authMod);
    authMod.onAuthStateChanged(auth,syncFirebaseAuthUser);
    if(typeof auth.authStateReady==='function')await auth.authStateReady();
    if(mobileBrokerCompleted&&auth.currentUser){syncFirebaseAuthUser(auth.currentUser);closeDialog('#authDialog');toast('Signed in. Mobile Google authentication completed directly through Firebase.');}
    const fsMod=await firestorePromise,db=fsMod.getFirestore(app);state.firebase={app,auth,authMod,db,fsMod};state.firebaseReady=true;
    // Firebase Auth can restore the user before Firestore finishes importing. Re-apply that
    // persisted user here so the private identity linker always gets a ready database.
    syncFirebaseAuthUser(auth.currentUser);
    if(auth.currentUser)ensurePrivateIdentityOnce().catch(e=>{console.error(e);toast('Could not restore the private account identity.');});
    publicSubscribe('publicProfiles',rows=>{state.profiles={...state.profiles,...Object.fromEntries(rows.map(p=>[p.id,{...p,_stub:false}]))};if(state.publicProfile)state.profiles[state.publicProfile.id]={...state.publicProfile,_stub:false};synthesizeReferencedProfiles();renderAuth();renderFeed();renderCatalogs();renderSearchPanel();renderConnections();renderLfg();renderStatusTargetOptions();hydrateReferencedProfiles().catch(console.debug);},{limit:1000});
    publicSubscribe('publicPosts',rows=>{state.posts=rows;synthesizeReferencedProfiles();renderFeed();renderCommunities();renderSearchPanel();renderConnections();renderStatusTargetOptions();hydrateReferencedProfiles().catch(console.debug);if(state.detail?.type==='post')openPostDetail(state.detail.id);},{orderBy:'createdAt',limit:250,filters:[['deleted','==',false]]});
    publicSubscribe('publicObjects',rows=>{state.objects=rows;synthesizeReferencedProfiles();renderCatalogs();renderUniverse();renderTrends();renderSearchPanel();renderConnections();renderStatusTargetOptions();hydrateReferencedProfiles().catch(console.debug);},{orderBy:'createdAt',limit:350,filters:[['deleted','==',false]]});
    publicSubscribe('publicSpaces',rows=>{state.spaces=rows;renderSpaces();renderCommunities();renderFeed();renderCatalogs();renderSearchPanel();},{orderBy:'createdAt',limit:200});
    publicSubscribe('publicChannels',rows=>{state.channels=rows;renderSpaces();renderCommunities();renderFeed();renderCatalogs();},{orderBy:'createdAt',limit:600});
    publicSubscribe('publicComments',rows=>{state.comments=rows;renderDetailThread();renderFeed();renderCatalogs();},{orderBy:'createdAt',limit:2000,filters:[['deleted','==',false]]});
    publicSubscribe('publicReactions',rows=>{state.reactions=rows;renderFeed();renderCatalogs();},{limit:3000});
    publicSubscribe('publicFollows',rows=>{state.follows=rows;renderCatalogs();renderConnections();if(state.detail?.type==='profile')openProfileDetail(state.detail.id);},{limit:3000});
    publicSubscribe('publicConnections',rows=>{state.connections=rows;renderUniverse();renderTrends();},{limit:2000});
    publicSubscribe('publicPostLinks',rows=>{state.postLinks=rows;},{limit:2000});
    publicSubscribe('publicLfg',rows=>{state.lfg=rows;synthesizeReferencedProfiles();renderLfg();renderConnections();renderSearchPanel();hydrateReferencedProfiles().catch(console.debug);},{orderBy:'createdAt',limit:500,filters:[['deleted','==',false]]});
    publicSubscribe('statusAssignments',rows=>{state.statusPublic=rows;synthesizeReferencedProfiles();mergeStatusRows();renderAuth();renderFeed();renderCatalogs();renderConnections();hydrateReferencedProfiles().catch(console.debug);},{limit:2000,filters:[['visibility','==','public']]});
    if(state.authUid)await ensurePrivateIdentityOnce();
    setBackendStatus('LCS v0.8.6 profile directory + legacy channel repair connected','Public content uses random public profile IDs. Status authorization, soft-delete retention, and immutable moderation logs are enforced by Firestore rules.','ok');
  }catch(e){console.error(e);state.authReady=true;setBackendStatus('Could not connect to Firebase','Check Firebase configuration and publish the included v0.7.1 firestore.rules.','error');renderAuth();renderAccount();}
}

function bindUI(){
  document.addEventListener('click',e=>{const t=e.target.closest('button,a');if(!t)return;
    if(t.matches('[data-open-account]')){e.preventDefault();setView('account');return;} if(t.matches('[data-open-auth]')){e.preventDefault();clearAuthError();showDialog('#authDialog');return;} if(t.matches('#signOutButton')){signOutUser();return;}
    if(t.matches('[data-momentum-mode]')){setMomentumMode(t.dataset.momentumMode);return;} if(t.matches('[data-momentum-action]')){handleMomentumAction(t.dataset.momentumAction,t.dataset.targetType,t.dataset.targetId);return;} if(t.matches('[data-momentum-new]')){openCreate(t.dataset.momentumNew);return;}
    if(t.matches('[data-open-post]')){openPostDetail(t.dataset.openPost);return;} if(t.matches('[data-open-object]')){openObjectDetail(t.dataset.openObject);return;} if(t.matches('[data-open-profile]')){openProfileDetail(t.dataset.openProfile);return;} if(t.matches('[data-open-lfg]')){openLfg(t.dataset.openLfg);return;} if(t.matches('[data-manage-status]')){setView('moderation');setTimeout(()=>{const el=$('#statusTargetProfile');if(el)el.value=t.dataset.manageStatus;},0);return;} if(t.matches('[data-status-revoke]')){revokeStatus(t.dataset.statusRevoke).catch(console.error);return;} if(t.matches('[data-content-remove]')){moderateContent(t.dataset.contentRemove,t.dataset.contentId,false).catch(console.error);return;} if(t.matches('[data-content-restore]')){moderateContent(t.dataset.contentRestore,t.dataset.contentId,true).catch(console.error);return;} if(t.matches('[data-open-moderation-content]')){openModerationContent(t.dataset.openModerationContent,t.dataset.contentId);return;}
    if(t.matches('[data-helpful-type]')){toggleHelpful(t.dataset.helpfulType,t.dataset.helpfulId).catch(console.error);return;} if(t.matches('[data-follow-type]')){toggleFollow(t.dataset.followType,t.dataset.followId).catch(console.error);return;} if(t.matches('[data-friend-profile]')){sendFriendRequest(t.dataset.friendProfile).catch(console.error);return;}
    if(t.matches('[data-block-profile]')){blockProfile(t.dataset.blockProfile).catch(console.error);return;} if(t.matches('[data-unblock-profile]')){unblockProfile(t.dataset.unblockProfile).catch(console.error);return;} if(t.matches('[data-friend-action]')){handleFriendRequest(t.dataset.requestId,t.dataset.friendAction).catch(console.error);return;} if(t.matches('[data-lfg-request]')){sendLfgRequest(t.dataset.lfgRequest).catch(console.error);return;} if(t.matches('[data-lfg-action]')){handleLfgRequest(t.dataset.requestId,t.dataset.lfgAction).catch(console.error);return;}
    if(t.matches('[data-connect-post]')){openConnect('post',t.dataset.connectPost);return;} if(t.matches('[data-connect-object]')){openConnect('object',t.dataset.connectObject);return;} if(t.matches('[data-reason]')){openLogicGuide(t.dataset.reason);return;}
    if(t.matches('[data-channel-filter]')){setActiveChannel(t.dataset.channelFilter);$('#searchResultsPanel').hidden=true;return;} if(t.matches('[data-space-filter]')){state.activeSpaceId=t.dataset.spaceFilter;state.activeChannelId='all';setView('home');renderSpaces();renderFeed();renderCatalogs();renderUniverse();$('#searchResultsPanel').hidden=true;return;} if(t.matches('[data-new-channel]')){openChannelDialog(t.dataset.newChannel);return;} if(t.matches('[data-close-dialog]')){closeDialogFromControl(t);return;}
  });
  $$('[data-close-dialog]').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeDialogFromControl(button);}));
  $$('dialog.modal').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(dialog);}));
  bindTagInput('#createTags','#createTagPreview'); bindTagInput('#postTags','#postTagPreview'); bindTagInput('#lfgTags','#lfgTagPreview');
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view))); $$('.thought-chip').forEach(b=>b.addEventListener('click',()=>{$$('.thought-chip').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');state.activeType=b.dataset.type;})); $$('.segment[data-filter]').forEach(b=>b.addEventListener('click',()=>{$$('.segment[data-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.activeFilter=b.dataset.filter;renderFeed();})); $$('.segment[data-lfg-filter]').forEach(b=>b.addEventListener('click',()=>{$$('.segment[data-lfg-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.activeLfgFilter=b.dataset.lfgFilter;renderLfg();}));
  $('#networkContextExplore')?.addEventListener('click',exploreNetworkContext); $('#networkContextPost')?.addEventListener('click',useNetworkContextInPost); $('#networkContextClear')?.addEventListener('click',clearNetworkContext); $('#viewSessionImpact')?.addEventListener('click',()=>{renderSessionMomentum();showDialog('#impactDialog');}); $('#resetSessionImpact')?.addEventListener('click',resetSessionImpact);
  $('#composerText').addEventListener('input',e=>$('#charCounter').textContent=`${e.target.value.length} / ${LCS_CONFIG.maxPostLength}`); $('#publishButton').addEventListener('click',()=>publishPost().catch(console.error)); $('#googleSignInButton').addEventListener('click',()=>signInGoogle()); $('#authRedirectRetryButton')?.addEventListener('click',()=>{clearAuthError();signInGoogle();}); $('#accountSignInButton').addEventListener('click',()=>showDialog('#authDialog')); $('#connectionsSignInButton').addEventListener('click',()=>showDialog('#authDialog')); $('#accountSignOutButton').addEventListener('click',()=>signOutUser());
  $('#accountProfileForm').addEventListener('submit',e=>savePublicProfile(e)); $('#accountDisplayName').addEventListener('input',markAccountDirty); $('#accountBio').addEventListener('input',markAccountDirty); $('#accountViewPublicProfile').addEventListener('click',()=>state.profileId&&openProfileDetail(state.profileId)); $('#copyPublicIdButton').addEventListener('click',async()=>{if(!state.profileId)return;try{await navigator.clipboard.writeText(state.profileId);toast('Public profile ID copied.');}catch{const r=document.createRange();r.selectNodeContents($('#accountFullPublicId'));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);toast('Public profile ID selected. Copy it with your browser.');}}); $('#accountPublicAvatar').addEventListener('click',openAvatarEditor); $('#avatarJsonEditor').addEventListener('input',avatarEditorRead); $('#avatarResetButton').addEventListener('click',()=>{$('#avatarJsonEditor').value=JSON.stringify(defaultAvatarSpec({...ownProfile(),displayName:$('#accountDisplayName').value||ownProfile().displayName}),null,2);avatarEditorRead();}); $('#avatarSaveButton').addEventListener('click',()=>saveAvatarJson());
  $('#openLogicGuide').addEventListener('click',()=>openLogicGuide()); $('#explainButton').addEventListener('click',()=>openLogicGuide()); $$('[data-guide]').forEach(b=>b.addEventListener('click',()=>openLogicGuide(b.dataset.guide)));
  $('#newSpaceButton').addEventListener('click',openSpaceDialog); $('#communityCreateButton').addEventListener('click',openSpaceDialog); $('#newChannelButton').addEventListener('click',()=>openChannelDialog(state.activeSpaceId!=='all'?state.activeSpaceId:'')); $$('.quick-create').forEach(b=>b.addEventListener('click',()=>openCreate(b.dataset.kind))); $('#newLfgButton').addEventListener('click',()=>{if(requireUser())showDialog('#lfgDialog');});
  $('#createForm').addEventListener('submit',e=>createObject(e).catch(err=>{console.error(err);setCreateError(firestoreErrorText(err,'create this item'));})); $('#statusGrantForm').addEventListener('submit',e=>grantStatus(e).catch(console.error)); $('#statusScopeKind').addEventListener('change',renderStatusTargetOptions); $('#spaceForm').addEventListener('submit',e=>createSpace(e).catch(console.error)); $('#channelForm').addEventListener('submit',e=>createChannel(e).catch(console.error)); $('#connectForm').addEventListener('submit',e=>submitConnection(e).catch(console.error)); $('#detailCommentForm').addEventListener('submit',e=>submitComment(e).catch(console.error)); $('#detailCommentSignIn').addEventListener('click',()=>showDialog('#authDialog')); $('#lfgForm').addEventListener('submit',e=>createLfg(e).catch(console.error));
  $('#globalSearch').addEventListener('input',()=>{renderSearchPanel();renderFeed();renderCatalogs();renderLfg();}); document.addEventListener('click',e=>{if(!e.target.closest('.top-search'))$('#searchResultsPanel').hidden=true;}); document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('#globalSearch').focus();}}); $('#focusMapButton').addEventListener('click',()=>{state.mapLayoutSeed++;renderUniverse();}); window.addEventListener('resize',()=>state.activeView==='universe'&&renderUniverse()); $('#detailDialog').addEventListener('close',()=>{stopDetailCommentSubscription();state.detail=null;}); window.addEventListener('hashchange',()=>setView(location.hash.replace('#','')||'home',false));
}
function initialRender(){state.sessionImpact=loadSessionImpact();try{const saved=sessionStorage.getItem('lcsMomentumMode');if(MOMENTUM_MODES[saved])state.momentumMode=saved;}catch{}state.networkContext=readNetworkContext();if(state.networkContext?.mode&&MOMENTUM_MODES[state.networkContext.mode])state.momentumMode=state.networkContext.mode;renderAuth();renderAccount();renderSpaces();renderFeed();renderCatalogs();renderCommunities();renderTrends();renderLfg();renderConnections();renderStatusSurfaces();renderModeration();renderMomentumDeck();renderSessionMomentum();renderNetworkContext();setView(location.hash.replace('#','')||'home',false);}

window.addEventListener('pageshow',()=>{if(isMobileAuthBrowser())recoverPersistedMobileAuth();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&isMobileAuthBrowser())recoverPersistedMobileAuth();});

bindUI(); initialRender(); initFirebase(); setInterval(()=>{if(state.statuses.some(x=>x.expiresAt)){renderStatusSurfaces();renderAuth();renderDetailThread();setupModerationSubscriptions();}},30000);
