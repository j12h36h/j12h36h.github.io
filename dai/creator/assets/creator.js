
(() => {
"use strict";

const catalog = window.DAI_CREATOR_CATALOG;
const actionMap = new Map(catalog.actions.map(x => [x.id, x]));
const conditionMap = new Map(catalog.conditions.map(x => [x.id, x]));
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Math.random().toString(36).slice(2,10);

let state = freshState();
let selectedPreview = {kind:"project"};

function freshState() {
  return {
    formatVersion: 1,
    pack: {
      name: "My DAI Pack",
      namespace: "my_dai_pack",
      description: "A custom Decisions and Impulses datapack.",
      minFormat: [107,1],
      maxFormat: 107
    },
    objectives: [],
    menus: [],
    groups: [],
    recognition: [],
    extraFiles: {}
  };
}

function slug(v, fallback="item") {
  const s = String(v ?? "").trim().toLowerCase()
    .replace(/\\/g,"/")
    .replace(/[^a-z0-9._/-]+/g,"_")
    .replace(/^[/_.-]+|[/_.-]+$/g,"");
  return s || fallback;
}
function validNamespace(v){ return /^[a-z0-9_.-]+$/.test(String(v || "")); }
function validLocalPath(v){ return /^[a-z0-9_.\/-]+$/.test(String(v || "")) && !String(v).includes(".."); }
function fullId(local){ return `${state.pack.namespace}:${slug(local)}`; }
function deep(v){ return JSON.parse(JSON.stringify(v)); }

function blankAction(type="delay") {
  return {_id:uid(),type,action:"",menu:"",open:"",yaw:0,pitch:0,direction:"",ticks:0,slot:0,state:false,value:0,conditions:[],sequence:[]};
}
function blankCondition(type="player_health") {
  const spec = conditionMap.get(type);
  const vt = spec?.valueType || "value";
  return {_id:uid(),type,operator:vt==="boolean"?"is_true":"equals",boolean_value:false,number_value:0,string_value:"",negate:false,parameter:"",parameter_number:0,conditions:[]};
}
function blankObjective(){ return {_id:uid(),id:`objective_${state.objectives.length+1}`,actions:[blankAction()]}; }
function blankMenu(){
  return {_id:uid(),type:"normal",id:`menu_${state.menus.length+1}`,priority:100,buttons:[]};
}
function blankButton(menu){
  return {_id:uid(),slot:menu.buttons.length,id:`button_${menu.buttons.length+1}`,text:`Button ${menu.buttons.length+1}`,action:"",conditions:[]};
}
function blankGroup(){ return {_id:uid(),id:`group_${state.groups.length+1}`,replace:false,entries:["minecraft:stone"]}; }
function blankRecognition(){
  return {
    _id:uid(), id:`recognition_${state.recognition.length+1}`, type:"structure",
    scan:{mode:"connected",origin:"targeted_block",max_blocks:512,max_radius:12,horizontal_radius:12,upward_range:12,downward_range:4},
    groups:[{_id:uid(),name:"primary",registry:`${state.pack.namespace}:group_1`,minimum:1,maximum:""}],
    requirements:[{_id:uid(),type:"connected",groups:["primary"],group:"",relative_to:"",minimum_height:1,minimum_ratio:0.5,minimum:"",maximum:""}],
    resultId:`${state.pack.namespace}:recognition_${state.recognition.length+1}`
  };
}

function loadPackInputs(){
  $("#packName").value = state.pack.name ?? "";
  $("#namespace").value = state.pack.namespace ?? "";
  $("#description").value = state.pack.description ?? "";
  $("#minFormat").value = JSON.stringify(state.pack.minFormat ?? [107,1]);
  $("#maxFormat").value = state.pack.maxFormat ?? 107;
}
function readPackInputs(){
  state.pack.name = $("#packName").value.trim() || "My DAI Pack";
  state.pack.namespace = $("#namespace").value.trim() || "my_dai_pack";
  state.pack.description = $("#description").value.trim();
  try { state.pack.minFormat = JSON.parse($("#minFormat").value); }
  catch { state.pack.minFormat = $("#minFormat").value.trim(); }
  state.pack.maxFormat = Number($("#maxFormat").value || 107);
}
["packName","namespace","description","minFormat","maxFormat"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    readPackInputs();
    renderExportTree();
    refreshPreview();
  });
});

function switchView(view){
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view===view));
  $$(".editor-section").forEach(s => s.classList.toggle("active", s.id===`view-${view}`));
  selectedPreview = {kind:view};
  refreshPreview();
}
$$(".nav-btn").forEach(b => b.addEventListener("click",()=>switchView(b.dataset.view)));

function optionGroups(items, selected, valueKey="id"){
  const groups = {};
  items.forEach(x => (groups[x.category] ||= []).push(x));
  return Object.entries(groups).map(([cat,list]) =>
    `<optgroup label="${esc(cat)}">` +
    list.map(x => `<option value="${esc(x[valueKey])}"${x[valueKey]===selected?" selected":""}>${esc(x[valueKey])}</option>`).join("") +
    `</optgroup>`
  ).join("");
}

function actionOptions(selected){ return optionGroups(catalog.actions, selected); }
function conditionOptions(selected){ return optionGroups(catalog.conditions, selected); }

function field(label, input, help=""){
  return `<div class="field"><label>${esc(label)}</label>${input}${help?`<span class="help">${esc(help)}</span>`:""}</div>`;
}
function textInput(value, attr=""){ return `<input ${attr} value="${esc(value)}">`; }
function numberInput(value, attr=""){ return `<input type="number" ${attr} value="${esc(value)}">`; }

function cleanAction(a){
  const out = {type:a.type};
  const spec = actionMap.get(a.type);
  const params = spec?.params || [];
  const use = new Set(params);
  if (a.type==="sequence" || a.type==="random_action") use.add("sequence");

  for (const p of use){
    if (p==="conditions") continue;
    if (p==="sequence") {
      if (a.sequence?.length) out.sequence = a.sequence.map(cleanAction);
      continue;
    }
    if (p==="action" && a.action!=="") out.action = a.action;
    else if (p==="menu" && a.menu!=="") out.menu = a.menu;
    else if (p==="open" && a.open!=="") out.open = a.open;
    else if (p==="yaw") out.yaw = Number(a.yaw||0);
    else if (p==="pitch") out.pitch = Number(a.pitch||0);
    else if (p==="direction" && a.direction!=="") out.direction = a.direction;
    else if (p==="ticks") out.ticks = Number(a.ticks||0);
    else if (p==="slot") out.slot = Number(a.slot||0);
    else if (p==="state") out.state = Boolean(a.state);
    else if (p==="value") out.value = Number(a.value||0);
  }

  // Preserve imported fields the visual editor does not own.
  if (a._extra && typeof a._extra==="object") Object.assign(out, deep(a._extra));
  if (a.conditions?.length) out.conditions = a.conditions.map(cleanCondition);
  return out;
}
function cleanCondition(c){
  const out = {type:c.type};
  if (["all","any","none","not"].includes(c.type)) {
    out.conditions = (c.conditions || []).map(cleanCondition);
  } else {
    if (c.operator) out.operator = c.operator;
    const spec = conditionMap.get(c.type);
    const vt = spec?.valueType || "value";
    const providerInputs = new Set(spec?.inputs || []);
    if (providerInputs.has("parameter") && c.parameter!=="") out.parameter = c.parameter;
    if (providerInputs.has("parameter_number") && Number(c.parameter_number)!==0) out.parameter_number = Number(c.parameter_number);
    if (providerInputs.has("boolean_value")) out.boolean_value = Boolean(c.boolean_value);
    // Comparison expectation:
    if (vt==="number") out.number_value = Number(c.number_value||0);
    if (vt==="string") out.string_value = c.string_value ?? "";
    if (vt==="boolean" && ["equals","not_equals"].includes(c.operator)) out.boolean_value = Boolean(c.boolean_value);
    if (c._extra && typeof c._extra==="object") Object.assign(out, deep(c._extra));
  }
  if (c.negate) out.negate = true;
  return out;
}

function objectiveJson(o){
  return {type:"sequence", sequence:o.actions.map(cleanAction)};
}
function menuJson(m){
  return {
    priority:Number(m.priority||0),
    buttons:m.buttons.map(b => {
      const out={slot:Number(b.slot||0),id:b.id,text:b.text,action:b.action};
      if (b.conditions?.length) out.conditions=b.conditions.map(cleanCondition);
      return out;
    })
  };
}
function groupJson(g){ return {replace:Boolean(g.replace),entries:[...g.entries]}; }
function recognitionJson(r){
  const groups={};
  r.groups.forEach(g=>{
    const x={registry:g.registry,minimum:Number(g.minimum||0)};
    if (g.maximum!=="" && g.maximum!=null) x.maximum=Number(g.maximum);
    groups[g.name]=x;
  });
  const reqs=r.requirements.map(q=>{
    const x={type:q.type};
    if (q.groups?.length) x.groups=[...q.groups];
    if (q.group) x.group=q.group;
    if (q.relative_to) x.relative_to=q.relative_to;
    if (q.minimum_height!=="" && q.minimum_height!=null && q.type==="vertical_column") x.minimum_height=Number(q.minimum_height);
    if (q.minimum_ratio!=="" && q.minimum_ratio!=null && q.type==="near_upper_region") x.minimum_ratio=Number(q.minimum_ratio);
    if (q.minimum!=="" && q.minimum!=null) x.minimum=Number(q.minimum);
    if (q.maximum!=="" && q.maximum!=null) x.maximum=Number(q.maximum);
    return x;
  });
  return {
    type:r.type||"structure",
    scan:{
      mode:r.scan.mode||"connected",
      origin:r.scan.origin||"targeted_block",
      max_blocks:Number(r.scan.max_blocks||512),
      max_radius:Number(r.scan.max_radius||12),
      horizontal_radius:Number(r.scan.horizontal_radius||12),
      upward_range:Number(r.scan.upward_range||12),
      downward_range:Number(r.scan.downward_range||4)
    },
    groups,
    requirements:reqs,
    result:{id:r.resultId || `${state.pack.namespace}:${r.id}`}
  };
}

function renderActionCard(a, onChange, onDelete, depth=0){
  const spec=actionMap.get(a.type);
  const params=new Set(spec?.params||[]);
  if (["sequence","random_action"].includes(a.type)) params.add("sequence");
  let dyn="";
  const inputFor = p => {
    if (p==="action") return field("action", textInput(a.action,'data-af="action"'), "Resource ID, item/tag, waypoint, key, command or other string payload.");
    if (p==="menu") return field("menu", textInput(a.menu,'data-af="menu"'));
    if (p==="open") return field("open", textInput(a.open,'data-af="open"'));
    if (p==="yaw") return field("yaw", numberInput(a.yaw,'step="0.1" data-af="yaw"'));
    if (p==="pitch") return field("pitch", numberInput(a.pitch,'step="0.1" data-af="pitch"'));
    if (p==="direction") return field("direction", textInput(a.direction,'data-af="direction"'), "Examples: forward, up, surrounding_26, or 0,1,0.");
    if (p==="ticks") return field("ticks", numberInput(a.ticks,'min="0" data-af="ticks"'));
    if (p==="slot") return field("slot", numberInput(a.slot,'min="0" data-af="slot"'));
    if (p==="state") return field("state", `<select data-af="state"><option value="true"${a.state?" selected":""}>true</option><option value="false"${!a.state?" selected":""}>false</option></select>`);
    if (p==="value") return field("value", numberInput(a.value,'step="0.01" data-af="value"'));
    return "";
  };
  [...params].filter(p=>!["conditions","sequence"].includes(p)).forEach(p=>dyn+=inputFor(p));

  const el=document.createElement("div");
  el.className="item-card action-card";
  el.innerHTML=`
    <div class="item-head">
      <strong>${esc(a.type)}${spec?` · ${esc(spec.purpose)}`:" · imported/unknown action"}</strong>
      <div class="item-actions">
        <button class="btn small danger" data-del>Remove</button>
      </div>
    </div>
    <div class="item-body">
      ${field("Action Type",`<select data-action-type>${actionOptions(a.type)}${!spec?`<option selected value="${esc(a.type)}">${esc(a.type)} (imported)</option>`:""}</select>`)}
      <div class="dynamic-fields">${dyn || '<div class="mini-note">This handler has no direct scalar parameters.</div>'}</div>
      <div class="subbox conditions-box">
        <div class="subbox-head"><strong>Conditions</strong><button class="btn small" data-add-condition>+ Condition</button></div>
        <div data-condition-list></div>
      </div>
      ${params.has("sequence") ? `<div class="subbox child-box"><div class="subbox-head"><strong>Nested Actions</strong><button class="btn small" data-add-child>+ Action</button></div><div data-child-list></div></div>`:""}
      ${a._extra && Object.keys(a._extra).length ? `<div class="mini-note">Imported extra fields are preserved on export.</div>`:""}
    </div>`;
  el.querySelector("[data-del]").onclick=onDelete;
  el.querySelector("[data-action-type]").onchange=e=>{
    const old=a.type;
    a.type=e.target.value;
    if (!a.sequence) a.sequence=[];
    if (old!==a.type) a._extra = a._extra || {};
    onChange(true);
  };
  el.querySelectorAll("[data-af]").forEach(inp=>{
    inp.oninput=()=>{
      const k=inp.dataset.af;
      if (["ticks","slot","yaw","pitch","value"].includes(k)) a[k]=Number(inp.value||0);
      else if (k==="state") a[k]=inp.value==="true";
      else a[k]=inp.value;
      onChange();
    };
  });
  el.querySelector("[data-add-condition]").onclick=()=>{ a.conditions.push(blankCondition()); onChange(true); };
  renderConditionList(el.querySelector("[data-condition-list]"),a.conditions,()=>onChange(true));

  const addChild=el.querySelector("[data-add-child]");
  if (addChild) {
    addChild.onclick=()=>{a.sequence.push(blankAction());onChange(true);};
    renderActionList(el.querySelector("[data-child-list]"),a.sequence,()=>onChange(true),depth+1);
  }
  el.onclick=()=>{selectedPreview={kind:"action",value:a};refreshPreview();};
  return el;
}

function renderActionList(container,list,onChange,depth=0){
  container.innerHTML="";
  if (!list.length){ container.innerHTML='<div class="empty">No actions yet.</div>'; return; }
  list.forEach((a,i)=>{
    const card=renderActionCard(a,onChange,()=>{list.splice(i,1);onChange(true);},depth);
    container.appendChild(card);
  });
}

function renderConditionCard(c,list,index,onChange){
  const spec=conditionMap.get(c.type);
  const logical=["all","any","none","not"].includes(c.type);
  const ops=catalog.operators[spec?.valueType||"value"] || catalog.operators.value;
  let dyn="";
  if (!logical) {
    dyn += field("Operator",`<select data-cf="operator">${ops.map(op=>`<option value="${op}"${op===c.operator?" selected":""}>${op}</option>`).join("")}</select>`);
    if ((spec?.inputs||[]).includes("parameter")) dyn += field("parameter",textInput(c.parameter,'data-cf="parameter"'));
    if ((spec?.inputs||[]).includes("parameter_number")) dyn += field("parameter_number",numberInput(c.parameter_number,'step="0.01" data-cf="parameter_number"'));
    if (spec?.valueType==="number") dyn += field("number_value",numberInput(c.number_value,'step="0.01" data-cf="number_value"'),"Expected comparison value.");
    if (spec?.valueType==="string") dyn += field("string_value",textInput(c.string_value,'data-cf="string_value"'),"Expected comparison value.");
    if (spec?.valueType==="boolean" && ["equals","not_equals"].includes(c.operator)) dyn += field("boolean_value",`<select data-cf="boolean_value"><option value="true"${c.boolean_value?" selected":""}>true</option><option value="false"${!c.boolean_value?" selected":""}>false</option></select>`);
  }

  const el=document.createElement("div");
  el.className="item-card condition-card";
  el.innerHTML=`
  <div class="item-head">
    <strong>${esc(c.type)}${spec?` · ${esc(spec.purpose)}`:" · imported/unknown condition"}</strong>
    <div class="item-actions"><button class="btn small danger" data-del>Remove</button></div>
  </div>
  <div class="item-body">
    ${field("Condition Type",`<select data-condition-type>${conditionOptions(c.type)}${!spec?`<option selected value="${esc(c.type)}">${esc(c.type)} (imported)</option>`:""}</select>`)}
    <div class="dynamic-fields">${dyn}</div>
    ${field("Negate",`<select data-cf="negate"><option value="false"${!c.negate?" selected":""}>false</option><option value="true"${c.negate?" selected":""}>true</option></select>`)}
    ${logical?`<div class="subbox"><div class="subbox-head"><strong>Child Conditions</strong><button class="btn small" data-add-child-condition>+ Condition</button></div><div data-child-conditions></div></div>`:""}
    ${c._extra && Object.keys(c._extra).length?'<div class="mini-note">Imported extra fields are preserved on export.</div>':""}
  </div>`;
  el.querySelector("[data-del]").onclick=()=>{list.splice(index,1);onChange();};
  el.querySelector("[data-condition-type]").onchange=e=>{
    c.type=e.target.value;
    const ns=conditionMap.get(c.type);
    c.operator=(ns?.valueType==="boolean")?"is_true":"equals";
    onChange();
  };
  el.querySelectorAll("[data-cf]").forEach(inp=>{
    inp.oninput=()=>{
      const k=inp.dataset.cf;
      if (k==="negate"||k==="boolean_value") c[k]=inp.value==="true";
      else if (k==="number_value"||k==="parameter_number") c[k]=Number(inp.value||0);
      else c[k]=inp.value;
      onChange(false);
    };
  });
  if (logical) {
    el.querySelector("[data-add-child-condition]").onclick=()=>{c.conditions.push(blankCondition());onChange();};
    renderConditionList(el.querySelector("[data-child-conditions]"),c.conditions,onChange);
  }
  el.onclick=()=>{selectedPreview={kind:"condition",value:c};refreshPreview();};
  return el;
}

function renderConditionList(container,list,onChange){
  container.innerHTML="";
  if(!list.length){container.innerHTML='<div class="empty">No conditions.</div>';return;}
  list.forEach((c,i)=>container.appendChild(renderConditionCard(c,list,i,onChange)));
}

function renderObjectives(){
  const root=$("#objectiveList"); root.innerHTML="";
  if(!state.objectives.length){root.innerHTML='<div class="empty">No objectives yet. Add one to begin composing behavior.</div>';return;}
  state.objectives.forEach((o,oi)=>{
    const el=document.createElement("div");el.className="item-card";
    el.innerHTML=`
      <div class="item-head"><strong>${esc(fullId(o.id))}</strong><div class="item-actions"><button class="btn small danger" data-del>Delete</button></div></div>
      <div class="item-body">
        ${field("Objective ID",textInput(o.id,'data-oid'))}
        <div class="subbox"><div class="subbox-head"><strong>Ordered Actions</strong><button class="btn small" data-add>+ Action</button></div><div data-actions></div></div>
      </div>`;
    el.querySelector("[data-del]").onclick=()=>{state.objectives.splice(oi,1);renderObjectives();refreshAll();};
    el.querySelector("[data-oid]").oninput=e=>{o.id=e.target.value;refreshAll();};
    el.querySelector("[data-add]").onclick=()=>{o.actions.push(blankAction());renderObjectives();refreshAll();};
    renderActionList(el.querySelector("[data-actions]"),o.actions,(rerender=false)=>{if(rerender)renderObjectives();refreshAll();});
    el.onclick=()=>{selectedPreview={kind:"objective",value:o};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addObjective").onclick=()=>{state.objectives.push(blankObjective());renderObjectives();refreshAll();};

function renderMenus(){
  const root=$("#menuList");root.innerHTML="";
  if(!state.menus.length){root.innerHTML='<div class="empty">No menus yet.</div>';return;}
  state.menus.forEach((m,mi)=>{
    const el=document.createElement("div");el.className="item-card menu-card";
    el.innerHTML=`
    <div class="item-head"><strong>${esc(m.type)} · ${esc(m.id)}</strong><div class="item-actions"><button class="btn small danger" data-del>Delete</button></div></div>
    <div class="item-body">
      <div class="form-grid">
        ${field("Menu Type",`<select data-mf="type"><option value="normal"${m.type==="normal"?" selected":""}>normal</option><option value="automation"${m.type==="automation"?" selected":""}>automation</option><option value="available"${m.type==="available"?" selected":""}>available</option></select>`)}
        ${field("Menu ID",textInput(m.id,'data-mf="id"'))}
        ${field("Priority",numberInput(m.priority,'min="0" data-mf="priority"'))}
      </div>
      <div class="subbox"><div class="subbox-head"><strong>Buttons</strong><button class="btn small" data-add-button>+ Button</button></div><div data-buttons></div></div>
    </div>`;
    el.querySelector("[data-del]").onclick=()=>{state.menus.splice(mi,1);renderMenus();refreshAll();};
    el.querySelectorAll("[data-mf]").forEach(inp=>inp.oninput=()=>{
      const k=inp.dataset.mf;m[k]=k==="priority"?Number(inp.value||0):inp.value;renderMenus();refreshAll();
    });
    const btnRoot=el.querySelector("[data-buttons]");
    if(!m.buttons.length) btnRoot.innerHTML='<div class="empty">No buttons.</div>';
    m.buttons.forEach((b,bi)=>{
      const card=document.createElement("div");card.className="item-card";
      card.innerHTML=`
      <div class="item-head"><strong>Slot ${esc(b.slot)} · ${esc(b.text)}</strong><div class="item-actions"><button class="btn small danger" data-del>Remove</button></div></div>
      <div class="item-body">
        <div class="form-grid">
          ${field("Slot",numberInput(b.slot,'min="0" data-bf="slot"'))}
          ${field("Button ID",textInput(b.id,'data-bf="id"'))}
          ${field("Text",textInput(b.text,'data-bf="text"'))}
          ${field("Action",textInput(b.action,'data-bf="action"'),"Use a namespaced action/objective ID.")}
        </div>
        <div class="subbox"><div class="subbox-head"><strong>Button Conditions</strong><button class="btn small" data-add-cond>+ Condition</button></div><div data-conds></div></div>
      </div>`;
      card.querySelector("[data-del]").onclick=()=>{m.buttons.splice(bi,1);renderMenus();refreshAll();};
      card.querySelectorAll("[data-bf]").forEach(inp=>inp.oninput=()=>{const k=inp.dataset.bf;b[k]=k==="slot"?Number(inp.value||0):inp.value;refreshAll();});
      card.querySelector("[data-add-cond]").onclick=()=>{b.conditions.push(blankCondition());renderMenus();refreshAll();};
      renderConditionList(card.querySelector("[data-conds]"),b.conditions,()=>{renderMenus();refreshAll();});
      card.onclick=()=>{selectedPreview={kind:"menuButton",value:b};refreshPreview();};
      btnRoot.appendChild(card);
    });
    el.querySelector("[data-add-button]").onclick=()=>{m.buttons.push(blankButton(m));renderMenus();refreshAll();};
    el.onclick=()=>{selectedPreview={kind:"menu",value:m};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addMenu").onclick=()=>{state.menus.push(blankMenu());renderMenus();refreshAll();};

function renderGroups(){
  const root=$("#groupList");root.innerHTML="";
  if(!state.groups.length){root.innerHTML='<div class="empty">No recognition groups yet.</div>';return;}
  state.groups.forEach((g,gi)=>{
    const el=document.createElement("div");el.className="item-card recognition-card";
    el.innerHTML=`
    <div class="item-head"><strong>${esc(fullId(g.id))}</strong><div class="item-actions"><button class="btn small danger" data-del>Delete</button></div></div>
    <div class="item-body">
      <div class="form-grid">
        ${field("Group ID",textInput(g.id,'data-gf="id"'))}
        ${field("Replace Existing Contributions",`<select data-gf="replace"><option value="false"${!g.replace?" selected":""}>false</option><option value="true"${g.replace?" selected":""}>true</option></select>`)}
        <div class="field full"><label>Entries — one block ID per line</label><textarea data-gf="entries">${esc(g.entries.join("\n"))}</textarea></div>
      </div>
    </div>`;
    el.querySelector("[data-del]").onclick=()=>{state.groups.splice(gi,1);renderGroups();refreshAll();};
    el.querySelectorAll("[data-gf]").forEach(inp=>inp.oninput=()=>{
      const k=inp.dataset.gf;
      if(k==="replace")g.replace=inp.value==="true";
      else if(k==="entries")g.entries=inp.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      else g[k]=inp.value;
      refreshAll();
    });
    el.onclick=()=>{selectedPreview={kind:"group",value:g};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addGroup").onclick=()=>{state.groups.push(blankGroup());renderGroups();refreshAll();};

function requirementFields(q, groupNames){
  let x=field("Requirement Type",`<select data-rq="type">${catalog.recognitionRequirements.map(t=>`<option value="${t}"${q.type===t?" selected":""}>${t}</option>`).join("")}</select>`);
  if(["connected"].includes(q.type)) x+=field("Groups",textInput((q.groups||[]).join(", "),'data-rq="groups"'),"Comma-separated local group names.");
  if(["vertical_column","touches_ground","contains_group","dimensions"].includes(q.type)) x+=field("Group",textInput(q.group||"",'data-rq="group"'));
  if(q.type==="vertical_column") x+=field("Minimum Height",numberInput(q.minimum_height||1,'min="1" data-rq="minimum_height"'));
  if(q.type==="near_upper_region") {
    x+=field("Group",textInput(q.group||"",'data-rq="group"'));
    x+=field("Relative To",textInput(q.relative_to||"",'data-rq="relative_to"'));
    x+=field("Minimum Ratio",numberInput(q.minimum_ratio??0.5,'step="0.01" min="0" max="1" data-rq="minimum_ratio"'));
  }
  if(["contains_group","dimensions","group_ratio"].includes(q.type)) {
    x+=field("Minimum",numberInput(q.minimum??"",'data-rq="minimum"'));
    x+=field("Maximum",numberInput(q.maximum??"",'data-rq="maximum"'));
  }
  return x;
}

function renderRecognition(){
  const root=$("#recognitionList");root.innerHTML="";
  if(!state.recognition.length){root.innerHTML='<div class="empty">No recognition definitions yet.</div>';return;}
  state.recognition.forEach((r,ri)=>{
    const el=document.createElement("div");el.className="item-card recognition-card";
    el.innerHTML=`
    <div class="item-head"><strong>${esc(fullId(r.id))}</strong><div class="item-actions"><button class="btn small danger" data-del>Delete</button></div></div>
    <div class="item-body">
      <div class="form-grid">
        ${field("Recognition ID",textInput(r.id,'data-rf="id"'))}
        ${field("Type",textInput(r.type,'data-rf="type"'))}
        ${field("Result ID",textInput(r.resultId,'data-rf="resultId"'))}
        ${field("Scan Mode",textInput(r.scan.mode,'data-sf="mode"'))}
        ${field("Scan Origin",textInput(r.scan.origin,'data-sf="origin"'))}
        ${field("Max Blocks",numberInput(r.scan.max_blocks,'min="1" data-sf="max_blocks"'))}
        ${field("Max Radius",numberInput(r.scan.max_radius,'min="1" data-sf="max_radius"'))}
        ${field("Horizontal Radius",numberInput(r.scan.horizontal_radius,'min="1" data-sf="horizontal_radius"'))}
        ${field("Upward Range",numberInput(r.scan.upward_range,'min="0" data-sf="upward_range"'))}
        ${field("Downward Range",numberInput(r.scan.downward_range,'min="0" data-sf="downward_range"'))}
      </div>
      <div class="subbox"><div class="subbox-head"><strong>Local Groups</strong><button class="btn small" data-add-group>+ Group</button></div><div data-local-groups></div></div>
      <div class="subbox"><div class="subbox-head"><strong>Requirements</strong><button class="btn small" data-add-req>+ Requirement</button></div><div data-reqs></div></div>
    </div>`;
    el.querySelector("[data-del]").onclick=()=>{state.recognition.splice(ri,1);renderRecognition();refreshAll();};
    el.querySelectorAll("[data-rf]").forEach(inp=>inp.oninput=()=>{r[inp.dataset.rf]=inp.value;refreshAll();});
    el.querySelectorAll("[data-sf]").forEach(inp=>inp.oninput=()=>{const k=inp.dataset.sf;r.scan[k]=["max_blocks","max_radius","horizontal_radius","upward_range","downward_range"].includes(k)?Number(inp.value||0):inp.value;refreshAll();});

    const gr=el.querySelector("[data-local-groups]");
    if(!r.groups.length)gr.innerHTML='<div class="empty">No groups.</div>';
    r.groups.forEach((g,gi)=>{
      const c=document.createElement("div");c.className="item-card";
      c.innerHTML=`<div class="item-head"><strong>${esc(g.name)}</strong><button class="btn small danger" data-del>Remove</button></div>
      <div class="item-body"><div class="form-grid">
      ${field("Local Name",textInput(g.name,'data-lg="name"'))}
      ${field("Registry ID",textInput(g.registry,'data-lg="registry"'))}
      ${field("Minimum",numberInput(g.minimum,'min="0" data-lg="minimum"'))}
      ${field("Maximum",numberInput(g.maximum,'min="0" data-lg="maximum"'),"Blank = no explicit maximum.")}
      </div></div>`;
      c.querySelector("[data-del]").onclick=()=>{r.groups.splice(gi,1);renderRecognition();refreshAll();};
      c.querySelectorAll("[data-lg]").forEach(inp=>inp.oninput=()=>{const k=inp.dataset.lg;g[k]=["minimum","maximum"].includes(k)?(inp.value===""?"":Number(inp.value)):inp.value;refreshAll();});
      gr.appendChild(c);
    });
    el.querySelector("[data-add-group]").onclick=()=>{r.groups.push({_id:uid(),name:`group_${r.groups.length+1}`,registry:`${state.pack.namespace}:group_1`,minimum:1,maximum:""});renderRecognition();refreshAll();};

    const rr=el.querySelector("[data-reqs]");
    if(!r.requirements.length)rr.innerHTML='<div class="empty">No requirements.</div>';
    r.requirements.forEach((q,qi)=>{
      const c=document.createElement("div");c.className="item-card";
      c.innerHTML=`<div class="item-head"><strong>${esc(q.type)}</strong><button class="btn small danger" data-del>Remove</button></div>
      <div class="item-body"><div class="dynamic-fields">${requirementFields(q,r.groups.map(g=>g.name))}</div></div>`;
      c.querySelector("[data-del]").onclick=()=>{r.requirements.splice(qi,1);renderRecognition();refreshAll();};
      c.querySelectorAll("[data-rq]").forEach(inp=>inp.oninput=()=>{
        const k=inp.dataset.rq;
        if(k==="groups")q.groups=inp.value.split(",").map(x=>x.trim()).filter(Boolean);
        else if(["minimum_height","minimum_ratio","minimum","maximum"].includes(k))q[k]=inp.value===""?"":Number(inp.value);
        else q[k]=inp.value;
        if(k==="type")renderRecognition();
        refreshAll();
      });
      rr.appendChild(c);
    });
    el.querySelector("[data-add-req]").onclick=()=>{r.requirements.push({_id:uid(),type:"connected",groups:r.groups.map(g=>g.name),group:"",relative_to:"",minimum_height:1,minimum_ratio:.5,minimum:"",maximum:""});renderRecognition();refreshAll();};
    el.onclick=()=>{selectedPreview={kind:"recognition",value:r};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addRecognition").onclick=()=>{state.recognition.push(blankRecognition());renderRecognition();refreshAll();};

function generatedFiles(){
  readPackInputs();
  const files={};
  files["pack.mcmeta"]=JSON.stringify({pack:{description:state.pack.description,min_format:state.pack.minFormat,max_format:state.pack.maxFormat}},null,2)+"\n";
  const n=state.pack.namespace;
  state.objectives.forEach(o=>files[`data/${n}/objectives/definitions/${slug(o.id)}.json`]=JSON.stringify(objectiveJson(o),null,2)+"\n");
  state.menus.forEach(m=>{
    let path;
    if(m.type==="automation") path=`data/${n}/menus/actions/automation/${slug(m.id)}.json`;
    else if(m.type==="available") path=`data/${n}/menus/actions/available/${slug(m.id)}.json`;
    else path=`data/${n}/menus/actions/${slug(m.id)}.json`;
    files[path]=JSON.stringify(menuJson(m),null,2)+"\n";
  });
  state.groups.forEach(g=>files[`data/${n}/objectives/groups/${slug(g.id)}.json`]=JSON.stringify(groupJson(g),null,2)+"\n");
  state.recognition.forEach(r=>files[`data/${n}/objectives/recognition/${slug(r.id)}.json`]=JSON.stringify(recognitionJson(r),null,2)+"\n");

  // Passthrough only when a managed file did not replace it.
  Object.entries(state.extraFiles||{}).forEach(([path,text])=>{
    if(!(path in files)) files[path]=text;
  });
  return files;
}

function fileTreeText(){
  const files=Object.keys(generatedFiles()).sort();
  return files.map(x=>"• "+x).join("\n");
}
function renderExportTree(){
  const t=fileTreeText();
  $("#fileTree").textContent=t;
  $("#treePreview").textContent=t;
}

function previewValue(){
  const p=selectedPreview;
  if(p.kind==="objective" && p.value)return objectiveJson(p.value);
  if(p.kind==="action" && p.value)return cleanAction(p.value);
  if(p.kind==="condition" && p.value)return cleanCondition(p.value);
  if(p.kind==="menu" && p.value)return menuJson(p.value);
  if(p.kind==="menuButton" && p.value){
    const b=p.value;const x={slot:b.slot,id:b.id,text:b.text,action:b.action};if(b.conditions?.length)x.conditions=b.conditions.map(cleanCondition);return x;
  }
  if(p.kind==="group" && p.value)return groupJson(p.value);
  if(p.kind==="recognition" && p.value)return recognitionJson(p.value);
  if(p.kind==="pack")return {pack:{description:state.pack.description,min_format:state.pack.minFormat,max_format:state.pack.maxFormat}};
  if(p.kind==="objectives")return state.objectives.map(o=>({id:fullId(o.id),definition:objectiveJson(o)}));
  if(p.kind==="menus")return state.menus.map(m=>({type:m.type,id:m.id,definition:menuJson(m)}));
  if(p.kind==="groups")return state.groups.map(g=>({id:fullId(g.id),definition:groupJson(g)}));
  if(p.kind==="recognition")return state.recognition.map(r=>({id:fullId(r.id),definition:recognitionJson(r)}));
  return {pack:state.pack,objectives:state.objectives.length,menus:state.menus.length,recognitionGroups:state.groups.length,recognitionDefinitions:state.recognition.length,passthroughFiles:Object.keys(state.extraFiles||{}).length};
}
function refreshPreview(){
  $("#jsonPreview").textContent=JSON.stringify(previewValue(),null,2);
  $("#previewLabel").textContent=selectedPreview.kind;
}
$$(".tab").forEach(tab=>tab.onclick=()=>{
  $$(".tab").forEach(x=>x.classList.toggle("active",x===tab));
  const tree=tab.dataset.preview==="tree";
  $("#jsonPreview").hidden=tree;
  $("#treePreview").hidden=!tree;
});

function refreshAll(){
  renderExportTree();
  refreshPreview();
}

function renderAll(){
  loadPackInputs();
  renderObjectives();
  renderMenus();
  renderGroups();
  renderRecognition();
  refreshAll();
  const count=Object.keys(state.extraFiles||{}).length;
  const summary=$("#importSummary");
  if(count){
    summary.hidden=false;
    summary.textContent=`Imported project contains ${count} passthrough file(s) not owned by the visual editor. They will be preserved on export unless replaced by a managed file path.`;
  } else summary.hidden=true;
}

function validateCondition(c,path,issues){
  const spec=conditionMap.get(c.type);
  if(!spec)issues.push({level:"warn",message:`${path}: unknown condition type '${c.type}' will be preserved.`});
  const logical=["all","any","none","not"].includes(c.type);
  if(logical){
    if(c.type==="not" && (c.conditions||[]).length!==1)issues.push({level:"err",message:`${path}: 'not' requires exactly one child condition.`});
    (c.conditions||[]).forEach((x,i)=>validateCondition(x,`${path}.conditions[${i}]`,issues));
    return;
  }
  if(spec){
    const ops=catalog.operators[spec.valueType]||catalog.operators.value;
    if(c.operator && !ops.includes(c.operator))issues.push({level:"err",message:`${path}: operator '${c.operator}' is not valid for ${spec.valueType} condition '${c.type}'.`});
  }
  if(c.type==="nearby_recognition" && !String(c.parameter||"").trim())issues.push({level:"err",message:`${path}: nearby_recognition requires parameter recognition ID.`});
  if(c.type==="nearby_entity_count" && !String(c.parameter||"").trim())issues.push({level:"err",message:`${path}: nearby_entity_count requires parameter entity/filter.`});
}
function validateAction(a,path,issues,objectiveIds){
  if(!a.type)issues.push({level:"err",message:`${path}: action type is missing.`});
  if(!actionMap.has(a.type))issues.push({level:"warn",message:`${path}: unknown/imported action type '${a.type}' is preserved but cannot be fully validated by this DAI 1.6 catalog.`});

  const needsAction=["enqueue_action","run_if_success","run_if_failure","objective_execute","recognize_block","run_command","set_gamemode","key_click","key_press","key_release","remember_waypoint","remember_target_waypoint","select_waypoint","forget_waypoint","forget_failed_waypoint","craft_recipe"];
  if(needsAction.includes(a.type) && !String(a.action||"").trim())issues.push({level:"err",message:`${path}: '${a.type}' requires an action/string payload.`});
  if(a.type==="move" && !String(a.direction||"").trim())issues.push({level:"err",message:`${path}: move requires direction.`});
  if(a.type==="delay" && Number(a.ticks)<=0)issues.push({level:"err",message:`${path}: delay must use ticks > 0.`});
  if(a.type==="update_menu" && (!a.menu || !a.open))issues.push({level:"err",message:`${path}: update_menu requires both menu and open.`});

  if(["enqueue_action","run_if_success","run_if_failure"].includes(a.type) && String(a.action||"").startsWith(state.pack.namespace+":")){
    const local=String(a.action).slice(state.pack.namespace.length+1);
    if(!objectiveIds.has(local))issues.push({level:"err",message:`${path}: local objective reference '${a.action}' does not exist.`});
  }
  (a.conditions||[]).forEach((c,i)=>validateCondition(c,`${path}.conditions[${i}]`,issues));
  (a.sequence||[]).forEach((x,i)=>validateAction(x,`${path}.sequence[${i}]`,issues,objectiveIds));
}
function validateProject(){
  readPackInputs();
  const issues=[];
  if(!validNamespace(state.pack.namespace))issues.push({level:"err",message:"Pack namespace is invalid. Use lowercase a-z, 0-9, _, -, or . only."});
  if(!state.pack.description)issues.push({level:"warn",message:"Pack description is empty."});
  if(!Number.isFinite(Number(state.pack.maxFormat)) || Number(state.pack.maxFormat)<1)issues.push({level:"err",message:"Maximum pack format must be a positive number."});
  if(!(Array.isArray(state.pack.minFormat) || Number.isFinite(Number(state.pack.minFormat))))issues.push({level:"err",message:"Minimum pack format must be JSON number/array syntax."});

  function duplicates(items,label,key=x=>x.id){
    const seen=new Map();
    items.forEach(x=>{const k=key(x);seen.set(k,(seen.get(k)||0)+1);});
    for(const [k,n] of seen)if(n>1)issues.push({level:"err",message:`Duplicate ${label} '${k}'.`});
  }
  duplicates(state.objectives,"objective ID");
  duplicates(state.groups,"recognition group ID");
  duplicates(state.recognition,"recognition definition ID");
  duplicates(state.menus,"menu path",m=>`${m.type}:${m.id}`);

  const objectiveIds=new Set(state.objectives.map(x=>slug(x.id)));
  state.objectives.forEach((o,oi)=>{
    if(!validLocalPath(o.id))issues.push({level:"err",message:`Objective ${oi+1} has invalid ID/path '${o.id}'.`});
    o.actions.forEach((a,i)=>validateAction(a,`objective '${o.id}' action[${i}]`,issues,objectiveIds));
  });

  state.menus.forEach((m,mi)=>{
    if(!["normal","automation","available"].includes(m.type))issues.push({level:"err",message:`Menu '${m.id}' has invalid type '${m.type}'.`});
    if(!validLocalPath(m.id))issues.push({level:"err",message:`Menu ${mi+1} has invalid ID/path '${m.id}'.`});
    if(Number(m.priority)<0)issues.push({level:"err",message:`Menu '${m.id}' priority cannot be negative.`});
    duplicates(m.buttons,`button ID in menu '${m.id}'`,b=>b.id);
    duplicates(m.buttons,`slot in menu '${m.id}'`,b=>String(b.slot));
    m.buttons.forEach((b,bi)=>{
      if(Number(b.slot)<0)issues.push({level:"err",message:`Menu '${m.id}' button ${bi+1} has a negative slot.`});
      if(!b.id)issues.push({level:"err",message:`Menu '${m.id}' button ${bi+1} is missing id.`});
      if(!b.text)issues.push({level:"err",message:`Menu '${m.id}' button '${b.id}' is missing text.`});
      if(!b.action)issues.push({level:"err",message:`Menu '${m.id}' button '${b.id}' is missing action.`});
      if(String(b.action||"").startsWith(state.pack.namespace+":")){
        const local=String(b.action).slice(state.pack.namespace.length+1);
        if(!objectiveIds.has(local))issues.push({level:"err",message:`Menu '${m.id}' button '${b.id}' references missing local objective '${b.action}'.`});
      }
      (b.conditions||[]).forEach((c,i)=>validateCondition(c,`menu '${m.id}' button '${b.id}' condition[${i}]`,issues));
    });
  });

  const localGroupIds=new Set(state.groups.map(g=>`${state.pack.namespace}:${slug(g.id)}`));
  state.groups.forEach(g=>{
    if(!validLocalPath(g.id))issues.push({level:"err",message:`Recognition group has invalid ID/path '${g.id}'.`});
    if(!g.entries.length)issues.push({level:"warn",message:`Recognition group '${g.id}' has no entries.`});
    g.entries.forEach(x=>{if(!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(x))issues.push({level:"warn",message:`Recognition group '${g.id}' entry '${x}' does not look like a resource ID.`});});
  });

  state.recognition.forEach(r=>{
    if(!validLocalPath(r.id))issues.push({level:"err",message:`Recognition definition has invalid ID/path '${r.id}'.`});
    const names=new Set();
    r.groups.forEach(g=>{
      if(!g.name)issues.push({level:"err",message:`Recognition '${r.id}' contains a group with no local name.`});
      if(names.has(g.name))issues.push({level:"err",message:`Recognition '${r.id}' has duplicate local group '${g.name}'.`});
      names.add(g.name);
      if(!g.registry)issues.push({level:"err",message:`Recognition '${r.id}' group '${g.name}' is missing registry ID.`});
      if(String(g.registry).startsWith(state.pack.namespace+":") && !localGroupIds.has(g.registry))issues.push({level:"err",message:`Recognition '${r.id}' group '${g.name}' references missing local recognition group '${g.registry}'.`});
      if(g.maximum!=="" && Number(g.maximum)<Number(g.minimum))issues.push({level:"err",message:`Recognition '${r.id}' group '${g.name}' maximum is below minimum.`});
    });
    r.requirements.forEach((q,qi)=>{
      if(!catalog.recognitionRequirements.includes(q.type))issues.push({level:"warn",message:`Recognition '${r.id}' requirement ${qi+1} uses unknown type '${q.type}'.`});
      const refs=[...(q.groups||[]),q.group,q.relative_to].filter(Boolean);
      refs.forEach(name=>{if(!names.has(name))issues.push({level:"err",message:`Recognition '${r.id}' requirement ${qi+1} references missing local group '${name}'.`});});
      if(q.type==="not"){}
    });
    if(!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(r.resultId||""))issues.push({level:"err",message:`Recognition '${r.id}' result ID '${r.resultId}' is invalid.`});
  });

  if(!issues.length)issues.push({level:"ok",message:"No errors or warnings found. Project is ready to export."});
  return issues;
}
function showValidation(issues){
  const root=$("#validationResults");root.innerHTML="";
  issues.forEach(x=>{
    const d=document.createElement("div");d.className=`status ${x.level}`;d.textContent=(x.level==="err"?"ERROR: ":x.level==="warn"?"WARNING: ":"OK: ")+x.message;root.appendChild(d);
  });
}
$("#runValidation").onclick=()=>showValidation(validateProject());

function hasErrors(issues){ return issues.some(x=>x.level==="err"); }

function downloadBlob(blob,name){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}

// ---------------- ZIP writer (store method, no dependency) ----------------
const CRC_TABLE = (() => {
  const t=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}
  return t;
})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function u16(v){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,v,true);return b;}
function u32(v){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,v>>>0,true);return b;}
function concat(parts){let n=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(n),o=0;for(const p of parts){out.set(p,o);o+=p.length;}return out;}
function zipStore(files){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0,count=0;
  Object.entries(files).forEach(([name,text])=>{
    const nb=enc.encode(name),data=enc.encode(text),crc=crc32(data),flags=0x0800;
    const local=concat([u32(0x04034b50),u16(20),u16(flags),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0),nb,data]);
    const central=concat([u32(0x02014b50),u16(20),u16(20),u16(flags),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(nb.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nb]);
    locals.push(local);centrals.push(central);offset+=local.length;count++;
  });
  const central=concat(centrals),body=concat(locals);
  const end=concat([u32(0x06054b50),u16(0),u16(0),u16(count),u16(count),u32(central.length),u32(body.length),u16(0)]);
  return new Blob([body,central,end],{type:"application/zip"});
}

// ---------------- ZIP reader (store + deflate, no dependency) ----------------
function findEOCD(bytes){
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){
    if(dv.getUint32(i,true)===0x06054b50)return i;
  }
  return -1;
}
async function inflateRaw(bytes){
  if(typeof DecompressionStream==="undefined")throw new Error("This browser cannot decompress ZIP deflate entries. Use a current Chrome, Edge, Firefox, or Safari.");
  const ds=new DecompressionStream("deflate-raw");
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function readZip(file){
  const bytes=new Uint8Array(await file.arrayBuffer()),dv=new DataView(bytes.buffer);
  const eocd=findEOCD(bytes);if(eocd<0)throw new Error("ZIP end-of-central-directory was not found.");
  const count=dv.getUint16(eocd+10,true),centralOffset=dv.getUint32(eocd+16,true);
  let p=centralOffset;const out={};const dec=new TextDecoder();
  for(let i=0;i<count;i++){
    if(dv.getUint32(p,true)!==0x02014b50)throw new Error("Invalid ZIP central directory.");
    const flags=dv.getUint16(p+8,true),method=dv.getUint16(p+10,true),compSize=dv.getUint32(p+20,true);
    const nameLen=dv.getUint16(p+28,true),extraLen=dv.getUint16(p+30,true),commentLen=dv.getUint16(p+32,true),localOffset=dv.getUint32(p+42,true);
    const name=dec.decode(bytes.slice(p+46,p+46+nameLen));
    p+=46+nameLen+extraLen+commentLen;
    if(name.endsWith("/"))continue;
    if(flags&1)throw new Error(`Encrypted ZIP entry '${name}' is not supported.`);
    if(dv.getUint32(localOffset,true)!==0x04034b50)throw new Error(`Invalid local header for '${name}'.`);
    const ln=dv.getUint16(localOffset+26,true),le=dv.getUint16(localOffset+28,true),dataStart=localOffset+30+ln+le;
    const comp=bytes.slice(dataStart,dataStart+compSize);
    let raw;
    if(method===0)raw=comp;
    else if(method===8)raw=await inflateRaw(comp);
    else throw new Error(`ZIP entry '${name}' uses unsupported compression method ${method}.`);
    out[name.replace(/^\.?\//,"")]=dec.decode(raw);
  }
  return out;
}

function normalizedImportedAction(raw){
  if(!raw || typeof raw!=="object")return blankAction();
  const a=blankAction(raw.type||"delay");
  const known=new Set(["type","action","menu","open","yaw","pitch","direction","ticks","slot","state","value","conditions","sequence"]);
  for(const k of ["action","menu","open","yaw","pitch","direction","ticks","slot","state","value"])if(k in raw)a[k]=raw[k];
  a.conditions=(raw.conditions||[]).map(normalizedImportedCondition);
  a.sequence=(raw.sequence||[]).map(normalizedImportedAction);
  const extra={};Object.keys(raw).forEach(k=>{if(!known.has(k))extra[k]=raw[k];});if(Object.keys(extra).length)a._extra=extra;
  return a;
}
function normalizedImportedCondition(raw){
  const c=blankCondition(raw?.type||"all");
  const known=new Set(["type","operator","boolean_value","number_value","string_value","negate","parameter","parameter_number","conditions"]);
  for(const k of ["operator","boolean_value","number_value","string_value","negate","parameter","parameter_number"])if(k in (raw||{}))c[k]=raw[k];
  c.conditions=(raw?.conditions||[]).map(normalizedImportedCondition);
  const extra={};Object.keys(raw||{}).forEach(k=>{if(!known.has(k))extra[k]=raw[k];});if(Object.keys(extra).length)c._extra=extra;
  return c;
}
function parseJson(text,path,errors){
  try{return JSON.parse(text);}catch(e){errors.push(`${path}: ${e.message}`);return null;}
}

function importFiles(files,sourceLabel="datapack"){
  const errors=[],next=freshState(),managed=new Set();
  const mc=files["pack.mcmeta"]?parseJson(files["pack.mcmeta"],"pack.mcmeta",errors):null;
  if(mc?.pack){
    next.pack.description=mc.pack.description??next.pack.description;
    next.pack.minFormat=mc.pack.min_format??next.pack.minFormat;
    next.pack.maxFormat=mc.pack.max_format??next.pack.maxFormat;
    managed.add("pack.mcmeta");
  }

  // Choose namespace with the most known DAI paths.
  const counts={};
  Object.keys(files).forEach(path=>{
    const m=path.match(/^data\/([^/]+)\/(objectives\/(definitions|groups|recognition)\/|menus\/actions\/)/);
    if(m)counts[m[1]]=(counts[m[1]]||0)+1;
  });
  const chosen=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(chosen)next.pack.namespace=chosen;

  const n=next.pack.namespace.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const objectiveRe=new RegExp(`^data/${n}/objectives/definitions/(.+)\\.json$`);
  const groupRe=new RegExp(`^data/${n}/objectives/groups/(.+)\\.json$`);
  const recogRe=new RegExp(`^data/${n}/objectives/recognition/(.+)\\.json$`);
  const menuRe=new RegExp(`^data/${n}/menus/actions/(.+)\\.json$`);

  Object.entries(files).forEach(([path,text])=>{
    let m;
    if((m=path.match(objectiveRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      const actions=raw.type==="sequence"&&Array.isArray(raw.sequence)?raw.sequence.map(normalizedImportedAction):[normalizedImportedAction(raw)];
      next.objectives.push({_id:uid(),id:m[1],actions});managed.add(path);return;
    }
    if((m=path.match(groupRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      next.groups.push({_id:uid(),id:m[1],replace:Boolean(raw.replace),entries:Array.isArray(raw.entries)?raw.entries:[]});managed.add(path);return;
    }
    if((m=path.match(recogRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      const groups=Object.entries(raw.groups||{}).map(([name,g])=>({_id:uid(),name,registry:g.registry||"",minimum:g.minimum??0,maximum:g.maximum??""}));
      const reqs=(raw.requirements||[]).map(q=>({_id:uid(),type:q.type||"connected",groups:q.groups||[],group:q.group||"",relative_to:q.relative_to||"",minimum_height:q.minimum_height??1,minimum_ratio:q.minimum_ratio??.5,minimum:q.minimum??"",maximum:q.maximum??""}));
      next.recognition.push({
        _id:uid(),id:m[1],type:raw.type||"structure",
        scan:{mode:raw.scan?.mode||"connected",origin:raw.scan?.origin||"targeted_block",max_blocks:raw.scan?.max_blocks??512,max_radius:raw.scan?.max_radius??12,horizontal_radius:raw.scan?.horizontal_radius??12,upward_range:raw.scan?.upward_range??12,downward_range:raw.scan?.downward_range??4},
        groups,requirements:reqs,resultId:raw.result?.id||`${next.pack.namespace}:${m[1]}`
      });managed.add(path);return;
    }
    if((m=path.match(menuRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      let rel=m[1],type="normal",id=rel;
      if(rel.startsWith("automation/")){type="automation";id=rel.slice("automation/".length);}
      else if(rel.startsWith("available/")){type="available";id=rel.slice("available/".length);}
      else if(rel==="available"){type="available";id="available";}
      next.menus.push({
        _id:uid(),type,id,priority:Number(raw.priority||0),
        buttons:(raw.buttons||[]).map(b=>({_id:uid(),slot:Number(b.slot||0),id:b.id||"",text:b.text||"",action:b.action||"",conditions:(b.conditions||[]).map(normalizedImportedCondition)}))
      });managed.add(path);return;
    }
  });

  Object.entries(files).forEach(([path,text])=>{if(!managed.has(path))next.extraFiles[path]=text;});
  next.pack.name=sourceLabel.replace(/\.(zip|json)$/i,"") || "Imported DAI Pack";
  state=next;renderAll();
  selectedPreview={kind:"project"};refreshPreview();

  const summary=$("#importSummary");summary.hidden=false;
  summary.textContent=`Imported '${sourceLabel}'. Editable: ${state.objectives.length} objective(s), ${state.menus.length} menu(s), ${state.groups.length} recognition group(s), ${state.recognition.length} recognition definition(s). Preserving ${Object.keys(state.extraFiles).length} passthrough file(s).${errors.length?` ${errors.length} JSON file(s) could not be parsed and remain passthrough.`:""}`;
  if(errors.length)alert("Import completed with JSON parse warnings:\n\n"+errors.slice(0,10).join("\n"));
}

$("#importZip").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const files=await readZip(f);importFiles(files,f.name);}
  catch(err){alert("Could not import datapack ZIP:\n"+err.message);}
  e.target.value="";
};
$("#importFolder").onchange=async e=>{
  const files={};
  for(const f of e.target.files){
    let path=f.webkitRelativePath||f.name;
    // Remove root directory.
    const parts=path.split("/");if(parts.length>1)path=parts.slice(1).join("/");
    files[path]=await f.text();
  }
  importFiles(files,e.target.files[0]?.webkitRelativePath?.split("/")[0]||"Imported Folder");
  e.target.value="";
};

$("#newProject").onclick=()=>{
  if(!confirm("Start a new project? Unsaved changes in the current creator project will be cleared."))return;
  state=freshState();selectedPreview={kind:"project"};renderAll();showValidation([]);
};

function projectForSave(){ readPackInputs(); return deep(state); }
function saveEditableProject(){
  const issues=validateProject();showValidation(issues);
  if(hasErrors(issues) && !confirm("This editable project has validation errors. Save it as an unfinished draft anyway?"))return;
  downloadBlob(new Blob([JSON.stringify(projectForSave(),null,2)],{type:"application/json"}),`${slug(state.pack.name,"dai_project")}.dai-project.json`);
}
$("#saveProject").onclick=saveEditableProject;
$("#exportProject").onclick=saveEditableProject;

$("#loadProject").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const x=JSON.parse(await f.text());
    if(!x.pack || !Array.isArray(x.objectives) || !Array.isArray(x.menus))throw new Error("This does not look like a DAI Creator project file.");
    state=x;state.extraFiles ||= {};selectedPreview={kind:"project"};renderAll();
  }catch(err){alert("Could not load creator project:\n"+err.message);}
  e.target.value="";
};

function exportDatapack(){
  const issues=validateProject();showValidation(issues);
  if(hasErrors(issues)){
    switchView("validate");
    alert("Datapack export was blocked because validation found hard errors. Fix the errors shown in Validation, then export again.");
    return;
  }
  const files=generatedFiles();
  const blob=zipStore(files);
  downloadBlob(blob,`${slug(state.pack.name,"dai_datapack")}.zip`);
}
$("#exportZip").onclick=exportDatapack;
$("#quickExport").onclick=exportDatapack;

function wirePackInputs(){ loadPackInputs(); }
function init(){
  wirePackInputs();renderAll();renderExportTree();refreshPreview();showValidation([]);
}
init();

})();
