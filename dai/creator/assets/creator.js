
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

function freshState(kind="datapack") {
  return {
    formatVersion: 10,
    kind,
    pack: {
      name: "My DAI Pack",
      namespace: "my_dai_pack",
      description: "A custom DAI Engine datapack.",
      minFormat: [107,1],
      maxFormat: 107,
      resourceFormat: 48,
      role: "auto",
      packId: "",
      packVersion: "",
      companionAutoEnable: false,
      companionId: ""
    },
    objectives: [],
    menus: [],
    titleScreens: [],
    experiences: [],
    worldgens: [],
    content: [],
    reactions: [],
    runtimeDefinitions: [],
    groups: [],
    recognition: [],
    resourceFiles: {},
    packIcon: null,
    resourceMcmeta: null,
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
function normalizeZipPath(v){
  return String(v??"").replace(/\\/g,"/").replace(/^\.?\/+/,"").replace(/\/{2,}/g,"/").trim();
}
function validZipPath(v){
  const p=normalizeZipPath(v);
  return Boolean(p) && !p.split("/").includes("..") && !p.includes("\0");
}
function byteLengthOf(data){
  if(data instanceof Uint8Array)return data.byteLength;
  if(data instanceof ArrayBuffer)return data.byteLength;
  return new TextEncoder().encode(String(data??"")).byteLength;
}
function humanBytes(n){
  if(n<1024)return `${n} B`;
  if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;
  return `${(n/(1024*1024)).toFixed(1)} MB`;
}
function decodeText(data){
  if(data instanceof Uint8Array)return new TextDecoder().decode(data);
  if(data instanceof ArrayBuffer)return new TextDecoder().decode(new Uint8Array(data));
  return String(data??"");
}

function blankSprite() {
  return {
    id:"overlay_1", texture:"my_pack:gui/example", anchor:"center",
    x:0, y:0, width:64, height:64, alpha:1.0, color:"#FFFFFF",
    z:0, ticks:20, interactable:false, click_action:"", consume_click:false
  };
}
function blankSpriteSheet() {
  return {
    ...blankSprite(),
    id:"animated_overlay_1",
    texture:"my_pack:gui/example_sheet",
    animation:{frame_width:64,frame_height:64,frame_count:8,columns:4,frame_ticks:2,loop:true}
  };
}
function blankAction(type="delay") {
  return {
    _id:uid(),type,action:"",menu:"",open:"",yaw:0,pitch:0,direction:"",target:"",
    ticks:0,slot:0,state:false,value:0,conditions:[],sequence:[],
    sprite:blankSprite(),sprite_sheet:blankSpriteSheet()
  };
}
function blankCondition(type="player_health") {
  const spec = conditionMap.get(type);
  const vt = spec?.valueType || "value";
  return {_id:uid(),type,operator:vt==="boolean"?"is_true":"equals",boolean_value:false,number_value:0,string_value:"",negate:false,target:"",parameter:"",parameter_number:0,conditions:[]};
}
function blankObjective(){ return {_id:uid(),id:`objective_${state.objectives.length+1}`,actions:[blankAction()]}; }
function blankMenu(){
  return {_id:uid(),type:"normal",id:`menu_${state.menus.length+1}`,priority:100,buttons:[]};
}
function blankButton(menu){
  return {
    _id:uid(),slot:menu.buttons.length,id:`button_${menu.buttons.length+1}`,
    text:`Button ${menu.buttons.length+1}`,action:"",conditions:[],
    style:{enabled:false,background:"",hover:"",selected:"",text:"",border:""}
  };
}

function blankTitleScreen(){
  return {_id:uid(),id:`title_${state.titleScreens.length+1}`,enabled:true,priority:100,title:"DECISIONS & IMPULSES",subtitle:"Custom DAI title screen",backgroundTop:"#FF061018",backgroundBottom:"#FF142A38",titleColor:"#FFF2F7FA",subtitleColor:"#FF9CB7C7",buttons:[]};
}
function blankTitleButton(screen){
  return {_id:uid(),id:`button_${screen.buttons.length+1}`,label:`BUTTON ${screen.buttons.length+1}`,action:"open_url",url:"https://j12h36h.github.io/dai/",anchor:"center",x:0,y:screen.buttons.length*30-30,width:230,height:24,iconType:"item",iconId:"minecraft:carrot",iconScale:1,iconOffsetX:9,background:"#B8182A32",hover:"#E02F5A43",border:"#FF5E9770",text:"#FFFFFFFF",animation:"spin",animationSpeed:.85,animationAmount:1};
}
const CONTENT_FOLDERS={item:"dai_items",block:"dai_blocks",weapon:"dai_weapons",armor:"dai_armor",effect:"dai_effects",potion:"dai_potions",projectile:"dai_projectiles",particle:"dai_particles",enchantment:"dai_enchantments",entity:"dai_entities"};
function blankContent(){
  return {_id:uid(),type:"item",id:`content_${state.content.length+1}`,carrier:"minecraft:flint",displayName:"Custom DAI Item",description:"A datapack-defined DAI content identity.",model:"minecraft:flint",registryBacked:true,nativeRegistry:"item",slot:"",capabilities:"",tags:"",attributes:"{}",nativeAttributes:"{}",nativeComponents:"{}",events:"{}",stats:'{"stack_size": 64}',block:"{}",projectile:"{}",particle:"{}",effect:"{}",potion:"{}",entity:"{}"};
}
function blankNativeEntity(){
  const i=state.content.filter(x=>x.type==="entity").length+1;
  return {_id:uid(),type:"entity",id:`native_entity_${i}`,carrier:"",displayName:`Native Entity ${i}`,description:"A carrierless JSON-defined DAI entity.",model:"",registryBacked:true,nativeRegistry:"entity",slot:"",capabilities:"",tags:"",attributes:"{}",nativeAttributes:JSON.stringify({"minecraft:max_health":20.0,"minecraft:movement_speed":0.25,"minecraft:attack_damage":3.0,"minecraft:follow_range":24.0},null,2),nativeComponents:"{}",events:"{}",stats:"{}",block:"{}",projectile:"{}",particle:"{}",effect:"{}",potion:"{}",entity:JSON.stringify({category:"monster",width:0.8,height:1.8,tracking_range:10,update_interval:3,behavior_sequence:`${state.pack.namespace}:native_entity_ai`,behavior_interval:2,vanilla_ai:false,spawning:{natural:false}},null,2)};
}
function blankLivingPortal(){
  const i=state.content.filter(x=>x.type==="entity").length+1;
  return {_id:uid(),type:"entity",id:`living_portal_${i}`,carrier:"",displayName:`Living Portal ${i}`,description:"A registry-backed living DAI entity with reloadable movement and portal behavior.",model:"",registryBacked:true,nativeRegistry:"entity",slot:"",capabilities:"",tags:"portal",attributes:"{}",nativeAttributes:JSON.stringify({"minecraft:max_health":20.0,"minecraft:movement_speed":0.20,"minecraft:follow_range":32.0},null,2),nativeComponents:"{}",events:"{}",stats:"{}",block:"{}",projectile:"{}",particle:"{}",effect:"{}",potion:"{}",entity:JSON.stringify({category:"creature",width:2.5,height:3.5,tracking_range:12,update_interval:2,vanilla_ai:false,spawning:{natural:false},movement:{type:"floating_wander",speed:0.04,radius:12,vertical_range:3,interval_ticks:40,no_gravity:true,no_collision:true,look_at_player:true},portal:{enabled:true,destination:"minecraft:overworld",target_mode:"same_coordinates",trigger_radius:1.5,cooldown_ticks:40,preserve_velocity:true,preserve_rotation:true,enter_command:"",exit_command:""}},null,2)};
}


function blankNativeBlock(){
  const i=state.content.filter(x=>x.type==="block").length+1;
  return {_id:uid(),type:"block",id:`native_block_${i}`,carrier:"",displayName:`Native Block ${i}`,description:"A registry-backed DAI block with native physical properties and lifecycle events.",model:"minecraft:stone",registryBacked:true,nativeRegistry:"block",slot:"",capabilities:"",tags:"",attributes:"{}",nativeAttributes:"{}",nativeComponents:"{}",events:JSON.stringify({use:`action:${state.pack.namespace}:block_use`,step:`action:${state.pack.namespace}:block_step`},null,2),stats:"{}",block:JSON.stringify({hardness:1.5,explosion_resistance:6.0,sound:"metal",luminance:12,friction:0.6,speed_factor:1.0,jump_factor:1.0,no_occlusion:false,no_collision:false,emissive_rendering:true,states:["powered"],redstone_state:"powered",redstone_signal:0,scheduled_tick_delay:0},null,2),projectile:"{}",particle:"{}",effect:"{}",potion:"{}",entity:"{}"};
}
function blankProjectile(){
  const i=state.content.filter(x=>x.type==="projectile").length+1;
  return {_id:uid(),type:"projectile",id:`projectile_${i}`,carrier:"minecraft:snowball",displayName:`DAI Projectile ${i}`,description:"A DAI projectile with live speed, gravity, collision and lifecycle physics.",model:"",registryBacked:false,nativeRegistry:"item",slot:"",capabilities:"",tags:"",attributes:"{}",nativeAttributes:"{}",nativeComponents:"{}",events:JSON.stringify({spawn:`action:${state.pack.namespace}:projectile_spawn`,hit_entity:`action:${state.pack.namespace}:projectile_hit`,hit_block:`action:${state.pack.namespace}:projectile_block`,expire:`action:${state.pack.namespace}:projectile_expire`},null,2),stats:JSON.stringify({projectile_speed:1.8,gravity:0.03},null,2),block:"{}",projectile:JSON.stringify({drag:0.0,lifetime:100,hit_radius:0.35,damage:4.0,knockback:0.2,pierce:0,ricochets:0,homing_radius:0.0,homing_strength:0.0,return_to_owner:false,return_after_ticks:20,hit_owner:false,hit_allies:true,collide_blocks:true,collide_entities:true},null,2),particle:"{}",effect:"{}",potion:"{}",entity:"{}"};
}
function blankParticle(){
  const i=state.content.filter(x=>x.type==="particle").length+1;
  return {_id:uid(),type:"particle",id:`particle_${i}`,carrier:"",displayName:`Native Particle ${i}`,description:"A registry-backed DAI particle type with authored emitter and render physics.",model:"",registryBacked:true,nativeRegistry:"particle",slot:"",capabilities:"",tags:"",attributes:"{}",nativeAttributes:"{}",nativeComponents:"{}",events:JSON.stringify({emit:`action:${state.pack.namespace}:particle_emit`},null,2),stats:"{}",block:"{}",projectile:"{}",particle:JSON.stringify({shape:"point",count:8,spread_x:0.15,spread_y:0.15,spread_z:0.15,speed:0.05,radius:1.0,force:false,texture:`${state.pack.namespace}:particle/example`,lifetime:20,gravity:0.0,friction:0.98,scale:1.0,color:65535,alpha:1.0,full_bright:true,collision:false},null,2),effect:"{}",potion:"{}",entity:"{}"};
}
function blankNativeEffect(){
  const i=state.content.filter(x=>x.type==="effect").length+1;
  return {_id:uid(),type:"effect",id:`effect_${i}`,carrier:"",displayName:`Native Effect ${i}`,description:"A registry-backed MobEffect with DAI apply/start/tick/remove/end hooks.",model:"",registryBacked:true,nativeRegistry:"effect",slot:"",capabilities:"",tags:"",attributes:"{}",nativeAttributes:"{}",nativeComponents:"{}",events:JSON.stringify({apply:`action:${state.pack.namespace}:effect_apply`,tick:`action:${state.pack.namespace}:effect_tick`,remove:`action:${state.pack.namespace}:effect_remove`},null,2),stats:JSON.stringify({tick_interval:20},null,2),block:"{}",projectile:"{}",particle:"{}",effect:JSON.stringify({category:"beneficial",color:65535,tick_interval:20},null,2),potion:"{}",entity:"{}"};
}

function blankReaction(){
  return {
    _id:uid(),id:`reaction_${state.reactions.length+1}`,type:"default",
    event:"player_attack_entity",phase:"post",priority:100,conditions:[],sequence:[]
  };
}
const RUNTIME_DEFINITION_TYPES={
  recipe:{label:"DAI Processing Recipe",folder:"dai_recipes",sample:{type:"crafting_shaped",pattern:["A"],key:{A:{item:"minecraft:stone"}},result:{item:"minecraft:stone",count:1}}},
  reaction_event:{label:"Reaction Event",folder:"reaction_events",sample:{phases:["pre","during","post"],cancellable:true,overrideable:true}},
  screen_profile:{label:"Screen Profile",folder:"screen_profiles",sample:{variants:[]}},
  attribute:{label:"DAI Attribute",folder:"dai_attributes",sample:{default:100,minimum:0,maximum:100}},
  animation:{label:"DAI Animation",folder:"dai_animations",sample:{duration_ticks:20,loop:false,channel:"upper_body",priority:10,interruptible:true,markers:{},marker_actions:{},tracks:{}}},
  sound:{label:"DAI 3.0 Sound",folder:"dai_sounds",customization:true,carrierResourceId:true,sample:{display_name:"UI Chime",carrier:"minecraft:block.note_block.pling",properties:{source:"master"},numbers:{volume:1.0,pitch:1.0},events:{}}},
  music:{label:"DAI 3.0 Music",folder:"dai_music",customization:true,carrierResourceId:true,sample:{display_name:"Experience Music",carrier:"minecraft:music.game",numbers:{volume:1.0,pitch:1.0},events:{}}},
  hud:{label:"DAI 3.0 HUD",folder:"dai_hud",customization:true,sample:{display_name:"Status HUD",texture:"my_dai_pack:gui/status",numbers:{x:0,y:0,width:128,height:32,z:20,ticks:0,alpha:1.0},properties:{anchor:"top_left",color:"#FFFFFF",click_action:""},flags:{interactable:false,consume_click:false,hide_vanilla:false},events:{}}},
  render_profile:{label:"DAI 3.0 Render Profile",folder:"dai_render_profiles",customization:true,sample:{display_name:"Cinematic Profile",properties:{},numbers:{},flags:{},events:{apply:"action:my_dai_pack:apply_render_profile",clear:"action:my_dai_pack:clear_render_profile"}}},
  structure:{label:"DAI 3.0 Structure / Natural Structure",folder:"dai_structures",customization:true,carrierResourceId:true,sample:{display_name:"Placed Structure",carrier:"minecraft:village/plains/houses/plains_small_house_1",target:"~ ~ ~",flags:{natural:false},properties:{placement:"surface",dimensions:"minecraft:overworld",rotation:"random",mirror:"none"},numbers:{spacing_chunks:24,separation_chunks:8,frequency:1.0,min_y:-64,max_y:320},events:{}}},
  feature:{label:"DAI 3.0 World Feature / Natural Feature",folder:"dai_features",customization:true,carrierResourceId:true,sample:{display_name:"Placed Feature",carrier:"minecraft:ore_coal",target:"~ ~ ~",flags:{natural:false},properties:{placement:"surface",dimensions:"minecraft:overworld"},numbers:{spacing_chunks:6,separation_chunks:2,frequency:1.0},events:{}}},
  loot:{label:"DAI 3.0 Loot",folder:"dai_loot",customization:true,carrierResourceId:true,sample:{display_name:"Reward Loot",carrier:"minecraft:chests/simple_dungeon",events:{}}},
  currency:{label:"DAI 3.0 Currency",folder:"dai_currencies",customization:true,sample:{display_name:"Credits",properties:{objective:"credits"},numbers:{amount:1.0},events:{}}},
  shop:{label:"DAI 3.0 Shop",folder:"dai_shops",customization:true,sample:{display_name:"Field Shop",entries:["my_dai_pack:starter_item"],events:{open:"action:my_dai_pack:shop_open",purchase:"action:my_dai_pack:shop_purchase"}}},
  dialogue:{label:"DAI 3.0 Dialogue",folder:"dai_dialogues",customization:true,sample:{display_name:"NPC Introduction",entries:["Welcome, agent."],events:{start:"action:my_dai_pack:dialogue_start",choose:"action:my_dai_pack:dialogue_choose",end:"action:my_dai_pack:dialogue_end"}}},
  quest:{label:"DAI 3.0 Quest",folder:"dai_quests",customization:true,sample:{display_name:"First Assignment",entries:["Reach the objective."],events:{start:"action:my_dai_pack:quest_start",advance:"action:my_dai_pack:quest_advance",complete:"action:my_dai_pack:quest_complete",fail:"action:my_dai_pack:quest_fail"}}},
  faction:{label:"DAI 3.0 Faction",folder:"dai_factions",customization:true,sample:{display_name:"Border",properties:{tag:"faction_border"},events:{}}},
  biome:{label:"DAI 3.0 Native Biome",folder:"dai_biomes",sample:{has_precipitation:true,temperature:0.8,downfall:0.4,water_color:"#3f76e4",effects:{fog_color:12638463,sky_color:7907327},spawners:{},spawn_costs:{}}},
  dimension_type:{label:"DAI 3.0 Dimension Type",folder:"dai_dimension_types",sample:{natural:true,ultrawarm:false,has_skylight:true,has_ceiling:false,coordinate_scale:1.0,ambient_light:0.0,min_y:-64,height:384,logical_height:384,infiniburn:"#minecraft:infiniburn_overworld",effects:"minecraft:overworld"}},
  timeline:{label:"DAI 3.0 Timeline / World Clock",folder:"dai_timelines",sample:{world_clock:"minecraft:overworld",day_length:24000}},
  dimension:{label:"DAI 3.0 Native Dimension",folder:"dai_dimensions",sample:{generation:{type:"void",dimension_type:"minecraft:overworld",biome:"minecraft:the_void",features:false,lakes:false,structures:false}}},
  native_registry:{label:"DAI 3.0 Open Mojang Registry Bridge",folder:"dai_registry",sample:{registry:"damage_type",raw:{message_id:"my_damage",exhaustion:0.1,scaling:"never"}}},
  native_data:{label:"DAI 3.0 Open Server-Data Bridge",folder:"dai_data",sample:{output:"predicate",raw:{condition:"minecraft:entity_properties",entity:"this",predicate:{}}}},
  ruleset:{label:"DAI 3.0 Ruleset",folder:"dai_rules",customization:true,sample:{display_name:"Adventure Rules",entries:["doDaylightCycle=false","keepInventory=true"],events:{}}},
  vehicle:{label:"DAI 3.0 Vehicle",folder:"dai_vehicles",customization:true,carrierResourceId:true,sample:{display_name:"Light Vehicle",carrier:"minecraft:minecart",numbers:{acceleration:0.045,reverse_acceleration:0.035,max_speed:0.8,reverse_speed:0.32,drag:0.06,braking:0.14,turn_rate:6.0,strafe_factor:0.0,jump_velocity:0.42,boost_multiplier:1.35},flags:{camera_steering:true,allow_reverse:true,allow_jump:false,gravity:true,lock_driver_pitch:false},events:{tick:"",boost:""}}},
  portal:{label:"DAI 3.0 Standalone Portal Volume",folder:"dai_portals",customization:true,sample:{display_name:"Portal Volume",target:"0 64 0",properties:{shape:"box",dimension:"minecraft:overworld",destination:"minecraft:the_nether",destination_target:"0 80 0",affects:"players",required_tag:"",forbidden_tag:""},numbers:{width:3,height:5,depth:1,cooldown_ticks:40,yaw:0,pitch:0},flags:{enabled:true,preserve_velocity:true,preserve_rotation:true},events:{enter:"",exit:""}}},
  interactive:{label:"DAI 3.0 Interactive Volume",folder:"dai_interactives",customization:true,sample:{display_name:"Control Zone",target:"0 64 0",properties:{shape:"box",dimension:"minecraft:overworld",required_tag:"",forbidden_tag:""},numbers:{width:3,height:3,depth:3,tick_interval:1},flags:{enabled:true},events:{enter:"",tick:"",exit:"",use:`action:${state.pack.namespace}:console_use`,attack:""}}},
  fluid:{label:"DAI 3.0 Fluid Behavior",folder:"dai_fluids",customization:true,carrierResourceId:true,sample:{display_name:"Energy Fluid",carrier:"minecraft:water",numbers:{drag:0.2,vertical_drag:0.2,buoyancy:0.02,damage:0,damage_interval:20,tick_interval:1},flags:{extinguish:false,no_gravity:false},events:{enter:"",tick:"",exit:""}}},
  environment:{label:"DAI 3.0 Environment",folder:"dai_environments",customization:true,sample:{display_name:"Training Arena",events:{enter:"action:my_dai_pack:arena_enter",exit:"action:my_dai_pack:arena_exit"}}}
};
function blankRuntimeDefinition(type="recipe"){
  const spec=RUNTIME_DEFINITION_TYPES[type]||RUNTIME_DEFINITION_TYPES.recipe;
  const count=state.runtimeDefinitions.filter(x=>x.type===type).length+1;
  return {_id:uid(),type,id:`${type}_${count}`,json:JSON.stringify(spec.sample,null,2)};
}
function runtimeDefinitionPath(d){
  const spec=RUNTIME_DEFINITION_TYPES[d.type]||RUNTIME_DEFINITION_TYPES.recipe;
  return `data/${state.pack.namespace}/${spec.folder}/${slug(d.id)}.json`;
}
function reactionEventSpecs(){
  const events=[...(catalog.reactionEvents||[])];
  state.runtimeDefinitions.filter(d=>d.type==="reaction_event").forEach(d=>{
    try{
      const raw=JSON.parse(String(d.json||"{}"));
      events.push({
        id:fullId(d.id),
        phases:Array.isArray(raw.phases)&&raw.phases.length?raw.phases:["pre","during","post"],
        cancellable:Boolean(raw.cancellable),
        overrideable:Boolean(raw.overrideable),
        entityContext:Boolean(raw.entity_context),
        purpose:raw.purpose||"Datapack-defined reaction event."
      });
    }catch{}
  });
  return events;
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

function blankExperience(){
  const i=state.experiences.length+1;
  return {_id:uid(),id:`experience_${i}`,enabled:true,priority:1000,saveId:`My DAI Experience ${i}`,saveName:`My DAI Experience ${i}`,createIfMissing:true,loadIfExisting:true,autoCreate:true,worldgen:`${state.pack.namespace}:worldgen_1`,onFirstJoin:`${state.pack.namespace}:first_join`,onJoin:`${state.pack.namespace}:resume`,uiAutoEnable:true,uiGraveCursor:true,uiOpenMenu:false,uiOpenAction:"",uiCloseAction:"",uiAnchorOverlay:"",uiGraveMenu:"",uiGraveMenuOpen:"",brandingJson:"{}",controlAutomation:true,controlMovement:true,controlCombat:true,controlWorldEditing:true,controlMaxActions:0,controlMaxQueue:0};
}
function blankWorldgen(){
  const i=state.worldgens.length+1;
  return {_id:uid(),id:`worldgen_${i}`,enabled:true,worldPreset:"",worldType:"normal",biome:"minecraft:plains",noiseSettings:"minecraft:overworld",layers:'[{"block":"minecraft:bedrock","height":1},{"block":"minecraft:dirt","height":2},{"block":"minecraft:grass_block","height":1}]',waterDepth:60,floorBlock:"minecraft:bedrock",floorHeight:1,surfaceBlock:"minecraft:sand",surfaceHeight:1,waterBlock:"minecraft:water",features:true,lakes:true,structures:true,includeNether:true,includeEnd:true,seed:"",spawnX:0,spawnY:64,spawnZ:0,spawnYaw:0,spawnPitch:0,generationCommands:"",initialStructures:"[]",bootstrapActions:""};
}
function experienceJson(e){const ui={auto_enable:Boolean(e.uiAutoEnable),grave_cursor_toggle:Boolean(e.uiGraveCursor),open_dai_menu_on_grave:Boolean(e.uiOpenMenu)};if(String(e.uiOpenAction||"").trim())ui.grave_open_action=String(e.uiOpenAction).trim();if(String(e.uiCloseAction||"").trim())ui.grave_close_action=String(e.uiCloseAction).trim();if(String(e.uiAnchorOverlay||"").trim())ui.grave_anchor_overlay=String(e.uiAnchorOverlay).trim();if(String(e.uiGraveMenu||"").trim())ui.grave_menu=String(e.uiGraveMenu).trim();if(String(e.uiGraveMenuOpen||"").trim())ui.grave_menu_open=String(e.uiGraveMenuOpen).trim();const controls={automation:e.controlAutomation!==false,automation_movement:e.controlMovement!==false,automation_combat:e.controlCombat!==false,automation_world_editing:e.controlWorldEditing!==false};const aps=Number(e.controlMaxActions||0),queue=Number(e.controlMaxQueue||0);if(aps>0)controls.max_actions_per_second=aps;if(queue>0)controls.max_action_queue_size=queue;const out={enabled:Boolean(e.enabled),priority:Number(e.priority||0),save_id:String(e.saveId||""),save_name:String(e.saveName||""),create_if_missing:Boolean(e.createIfMissing),load_if_existing:Boolean(e.loadIfExisting),auto_create:Boolean(e.autoCreate),worldgen:String(e.worldgen||""),on_first_join:String(e.onFirstJoin||""),on_join:String(e.onJoin||""),ui,controls};const branding=parseObjectField(e.brandingJson||"{}");if(Object.keys(branding).length)out.branding=branding;return out;}
function worldgenJson(w){
  const wt={type:String(w.worldType||"normal")};
  if(String(w.biome||"").trim())wt.biome=String(w.biome).trim();
  if(String(w.noiseSettings||"").trim())wt.noise_settings=String(w.noiseSettings).trim();
  if(["flat","superflat"].includes(wt.type)){try{const layers=JSON.parse(String(w.layers||"[]"));if(Array.isArray(layers))wt.layers=layers;}catch{wt.layers=[];}}
  if(["water","water_world"].includes(wt.type)){wt.water_depth=Number(w.waterDepth||0);wt.floor_block=String(w.floorBlock||"minecraft:bedrock");wt.floor_height=Number(w.floorHeight||0);wt.surface_block=String(w.surfaceBlock||"minecraft:sand");wt.surface_height=Number(w.surfaceHeight||0);wt.water_block=String(w.waterBlock||"minecraft:water");}
  wt.features=w.features!==false;wt.lakes=w.lakes!==false;wt.structures=w.structures!==false;wt.include_nether=w.includeNether!==false;wt.include_end=w.includeEnd!==false;
  const out={enabled:Boolean(w.enabled),world_type:wt,spawn:{x:Number(w.spawnX||0),y:Number(w.spawnY||64),z:Number(w.spawnZ||0),yaw:Number(w.spawnYaw||0),pitch:Number(w.spawnPitch||0)},generation_commands:String(w.generationCommands||"").split(/\n/).map(x=>x.trim()).filter(Boolean),initial_structures:[],bootstrap_actions:String(w.bootstrapActions||"").split(/[\n,]/).map(x=>x.trim()).filter(Boolean)};
  if(String(w.worldPreset||"").trim())out.world_preset=String(w.worldPreset).trim();
  if(String(w.seed).trim()!=="") out.seed=Number(w.seed);
  try{const arr=JSON.parse(String(w.initialStructures||"[]"));if(Array.isArray(arr))out.initial_structures=arr;}catch{}
  return out;
}

function loadPackInputs(){
  $("#packName").value = state.pack.name ?? "";
  $("#namespace").value = state.pack.namespace ?? "";
  $("#description").value = state.pack.description ?? "";
  $("#minFormat").value = JSON.stringify(state.pack.minFormat ?? [107,1]);
  $("#maxFormat").value = state.pack.maxFormat ?? 107;
  $("#resourceFormat").value = state.pack.resourceFormat ?? 48;
  if($("#packRole")) $("#packRole").value = state.pack.role ?? "auto";
  if($("#packId")) $("#packId").value = state.pack.packId ?? "";
  if($("#packVersion")) $("#packVersion").value = state.pack.packVersion ?? "";
  if($("#companionAutoEnable")) $("#companionAutoEnable").value = state.pack.companionAutoEnable ? "true" : "false";
  if($("#companionId")) $("#companionId").value = state.pack.companionId ?? "";
}
function readPackInputs(){
  state.pack.name = $("#packName").value.trim() || (state.kind==="resourcepack" ? "My Resource Pack" : "My DAI Pack");
  state.pack.namespace = $("#namespace").value.trim() || "my_dai_pack";
  state.pack.description = $("#description").value.trim();
  try { state.pack.minFormat = JSON.parse($("#minFormat").value); }
  catch { state.pack.minFormat = $("#minFormat").value.trim(); }
  state.pack.maxFormat = Number($("#maxFormat").value || 107);
  state.pack.resourceFormat = Number($("#resourceFormat").value || 48);
  if($("#packRole")) state.pack.role = $("#packRole").value || "auto";
  if($("#packId")) state.pack.packId = $("#packId").value.trim();
  if($("#packVersion")) state.pack.packVersion = $("#packVersion").value.trim();
  if($("#companionAutoEnable")) state.pack.companionAutoEnable = $("#companionAutoEnable").value === "true";
  if($("#companionId")) state.pack.companionId = $("#companionId").value.trim();
}
["packName","namespace","description","minFormat","maxFormat","resourceFormat","packRole","packId","packVersion","companionAutoEnable","companionId"].forEach(id => {
  document.getElementById(id).addEventListener("input", () => {
    readPackInputs();
    if(id==="namespace" && state.kind==="resourcepack") renderResourceFiles();
    refreshAll();
  });
});

function switchView(view){
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view===view));
  $$(".editor-section").forEach(s => s.classList.toggle("active", s.id===`view-${view}`));
  selectedPreview = {kind:view};
  refreshPreview();
}
$$(".nav-btn[data-view]").forEach(b => b.addEventListener("click",()=>switchView(b.dataset.view)));
$$('[data-jump]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.jump)));
if($("#creatorNavSearch"))$("#creatorNavSearch").addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase();
  $$(".sidebar .nav-btn").forEach(b=>{
    const modeHidden=b.classList.contains("resource-only")?state.kind!=="resourcepack":b.classList.contains("datapack-only")?state.kind==="resourcepack":false;
    const hay=(b.textContent+" "+(b.dataset.search||"")).toLowerCase();
    b.hidden=modeHidden || Boolean(q && !hay.includes(q));
  });
});
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
    e.preventDefault();
    const input=$("#creatorNavSearch");
    if(input){input.focus();input.select();}
  } else if(e.key==="Escape" && document.activeElement===$("#creatorNavSearch")){
    $("#creatorNavSearch").value="";
    $("#creatorNavSearch").dispatchEvent(new Event("input"));
    $("#creatorNavSearch").blur();
  }
});
function updateModeUi(){
  const resource = state.kind === "resourcepack";
  $$(".datapack-only").forEach(el=>el.hidden=resource);
  $$(".resource-only").forEach(el=>el.hidden=!resource);
  $$(".datapack-format").forEach(el=>el.hidden=resource);
  $$(".resource-format").forEach(el=>el.hidden=!resource);

  $("#creatorModeTitle").textContent = resource ? "Resource Pack Creator" : "Datapack Creator";
  $("#creatorModeSub").textContent = resource ? "Build or edit a Minecraft resource pack" : "Build or edit a DAI datapack";
  $("#workspaceHeading").textContent = resource ? "DAI Resource Pack Creator" : "DAI Datapack Creator";
  $("#workspaceDescription").textContent = resource
    ? "Create or import a Minecraft resource pack, add textures and other assets, opt into DAI 3.0 companion auto-enable, coordinate directional combat presentation where applicable, then export a normal editable ZIP."
    : "Create a complete DAI Engine 3.0 game or addon: experiences, native entities, worldgen, objectives, server-authoritative actions, menus, reactions and custom content. Universal Files can create anything the guided editor does not expose; the Musashi directional-combat client hook is documented separately.";
  $("#packSetupSubtitle").textContent = resource ? "Identity and Minecraft resource-pack metadata" : "Identity and Minecraft datapack metadata";
  $("#exportSubtitle").textContent = resource ? "Compile a standard Minecraft resource-pack ZIP after validation" : "Compile a standard Minecraft datapack ZIP after validation";
  $("#exportZip").textContent = resource ? "Validate & Export Resource Pack ZIP" : "Validate & Export Datapack ZIP";
  $("#quickExport").textContent = resource ? "Validate & Export Resource Pack ZIP" : "Validate & Export ZIP";

  const active=$$(".nav-btn.active").find(x=>!x.hidden);
  if(!active) switchView("pack");
}


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

function cleanSprite(s, animated=false){
  const source=s || (animated?blankSpriteSheet():blankSprite());
  const out={
    id:String(source.id||""),
    texture:String(source.texture||""),
    anchor:String(source.anchor||"center"),
    x:Number(source.x||0),
    y:Number(source.y||0),
    width:Number(source.width||64),
    height:Number(source.height||64),
    alpha:Number(source.alpha??1),
    color:String(source.color||"#FFFFFF"),
    z:Number(source.z||0),
    ticks:Number(source.ticks||0),
    interactable:Boolean(source.interactable),
    consume_click:Boolean(source.consume_click)
  };
  if(String(source.click_action||"").trim()) out.click_action=String(source.click_action).trim();
  if(animated){
    const a=source.animation||{};
    out.animation={
      frame_width:Number(a.frame_width||64),
      frame_height:Number(a.frame_height||64),
      frame_count:Number(a.frame_count||1),
      columns:Number(a.columns||1),
      frame_ticks:Number(a.frame_ticks||1),
      loop:Boolean(a.loop)
    };
  }
  return out;
}

function cleanAction(a){
  const out = {type:a.type};
  const spec = actionMap.get(a.type);
  const params = spec?.params || [];
  const use = new Set(params);
  if (a.type==="sequence" || a.type==="random_action") use.add("sequence");

  if(a.type==="overlay_sprite") out.sprite=cleanSprite(a.sprite,false);
  if(a.type==="overlay_sprite_sheet") out.sprite_sheet=cleanSprite(a.sprite_sheet,true);

  for (const p of use){
    if (["conditions","sprite","sprite_sheet"].includes(p)) continue;
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
    else if (p==="target" && a.target!=="") out.target = a.target;
  }

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
    if (providerInputs.has("target") && c.target!=="") out.target = c.target;
    if (providerInputs.has("parameter") && c.parameter!=="") out.parameter = c.parameter;
    if (providerInputs.has("parameter_number") && Number(c.parameter_number)!==0) out.parameter_number = Number(c.parameter_number);
    if (providerInputs.has("string_value") && c.string_value!=="") out.string_value = c.string_value;
    if (providerInputs.has("boolean_value")) out.boolean_value = Boolean(c.boolean_value);
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
      if(b.style?.enabled){
        const style={};
        ["background","hover","selected","text","border"].forEach(k=>{
          if(String(b.style[k]||"").trim()) style[k]=String(b.style[k]).trim();
        });
        out.style=style;
      }
      return out;
    })
  };
}

function titleScreenJson(t){
  return {
    enabled:Boolean(t.enabled),priority:Number(t.priority||0),title:String(t.title||""),subtitle:String(t.subtitle||""),
    background:{top:String(t.backgroundTop||"#FF061018"),bottom:String(t.backgroundBottom||"#FF142A38")},
    title_color:String(t.titleColor||"#FFFFFFFF"),subtitle_color:String(t.subtitleColor||"#FFAAAAAA"),
    buttons:(t.buttons||[]).map(b=>{
      const out={id:String(b.id||""),label:String(b.label||""),action:String(b.action||""),anchor:String(b.anchor||"center"),x:Number(b.x||0),y:Number(b.y||0),width:Number(b.width||230),height:Number(b.height||24),icon:{type:String(b.iconType||"item"),id:String(b.iconId||"minecraft:carrot"),scale:Number(b.iconScale||1),offset_x:Number(b.iconOffsetX||0)},style:{background:String(b.background||"#B8182A32"),hover:String(b.hover||"#E02F5A43"),border:String(b.border||"#FF5E9770"),text:String(b.text||"#FFFFFFFF")},hover_animation:{type:String(b.animation||"none"),speed:Number(b.animationSpeed||1),amount:Number(b.animationAmount||1)}};
      if(String(b.url||"").trim()) out.url=String(b.url).trim();
      return out;
    })
  };
}
function parseObjectField(text,fallback={}){try{const v=JSON.parse(String(text||"{}"));return v&&typeof v==="object"&&!Array.isArray(v)?v:fallback;}catch{return fallback;}}
function csvList(text){return String(text||"").split(/[\n,]/).map(x=>x.trim()).filter(Boolean);}
function contentJson(c){
  const out={display_name:String(c.displayName||""),description:String(c.description||""),registry_backed:Boolean(c.registryBacked)};if(String(c.carrier||"").trim())out.carrier=String(c.carrier).trim();if(String(c.model||"").trim())out.model=String(c.model).trim();
  if(c.registryBacked) out.native_registry=String(c.nativeRegistry||((c.type==="block")?"block":"item"));
  if(String(c.slot||"").trim())out.slot=String(c.slot).trim();
  const caps=csvList(c.capabilities),tags=csvList(c.tags);if(caps.length)out.capabilities=caps;if(tags.length)out.tags=tags;
  const attrs=parseObjectField(c.attributes),nativeAttrs=parseObjectField(c.nativeAttributes),nativeComponents=parseObjectField(c.nativeComponents),events=parseObjectField(c.events),stats=parseObjectField(c.stats);
  if(Object.keys(attrs).length)out.attributes=attrs;if(Object.keys(nativeAttrs).length)out.native_attributes=nativeAttrs;if(Object.keys(nativeComponents).length)out.components=nativeComponents;if(Object.keys(events).length)out.events=events;if(Object.keys(stats).length)out.stats=stats;
  for(const key of ["block","projectile","particle","effect","potion","entity"]){const value=parseObjectField(c[key]);if(Object.keys(value).length)out[key]=value;}
  return out;
}

function reactionJson(r){
  return {
    type:r.type,
    event:r.event,
    phase:r.phase,
    priority:Number(r.priority||0),
    conditions:(r.conditions||[]).map(cleanCondition),
    sequence:(r.sequence||[]).map(cleanAction)
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

function overlayEditorHtml(a){
  const animated=a.type==="overlay_sprite_sheet";
  const s=animated?a.sprite_sheet:a.sprite;
  const anchors=(catalog.overlayAnchors||["center"]).map(x=>`<option value="${x}"${s.anchor===x?" selected":""}>${x}</option>`).join("");
  return `<div class="subbox overlay-box">
    <div class="subbox-head"><strong>${animated?"Animated Sprite Sheet":"Static Sprite"} Configuration</strong></div>
    <div class="mini-note">Texture IDs resolve through enabled Minecraft resource packs. Subfolders are supported.</div>
    <div class="dynamic-fields">
      ${field("Overlay ID",textInput(s.id,'data-of="id"'))}
      ${field("Texture",textInput(s.texture,'data-of="texture"'),"Example: my_pack:gui/combat/pow")}
      ${field("Anchor",`<select data-of="anchor">${anchors}</select>`)}
      ${field("X Offset",numberInput(s.x,'step="1" data-of="x"'))}
      ${field("Y Offset",numberInput(s.y,'step="1" data-of="y"'))}
      ${field("Screen Width",numberInput(s.width,'min="1" step="1" data-of="width"'))}
      ${field("Screen Height",numberInput(s.height,'min="1" step="1" data-of="height"'))}
      ${field("Alpha",numberInput(s.alpha,'min="0.1" max="1" step="0.05" data-of="alpha"'),"0.1–1.0; defaults to 1.0.")}
      ${field("Tint Color",textInput(s.color,'data-of="color"'),"#RRGGBB or #AARRGGBB")}
      ${field("Z Order",numberInput(s.z,'step="1" data-of="z"'),"Higher z renders and hit-tests above lower z.")}
      ${field("Lifetime Ticks",numberInput(s.ticks,'min="0" step="1" data-of="ticks"'),"0 = persistent until removed/cleared.")}
      ${field("Interactable",`<select data-of="interactable"><option value="false"${!s.interactable?" selected":""}>false</option><option value="true"${s.interactable?" selected":""}>true</option></select>`)}
      ${field("Click Action",textInput(s.click_action||"",'data-of="click_action"'),"Namespaced DAI action/objective fired when clicked.")}
      ${field("Consume Click",`<select data-of="consume_click"><option value="false"${!s.consume_click?" selected":""}>false</option><option value="true"${s.consume_click?" selected":""}>true</option></select>`,"false lets the click continue to lower overlays / underlying UI.")}
    </div>
    ${animated?`<div class="subbox">
      <div class="subbox-head"><strong>Animation Grid</strong></div>
      <div class="dynamic-fields">
        ${field("Frame Width",numberInput(s.animation.frame_width,'min="1" data-an="frame_width"'))}
        ${field("Frame Height",numberInput(s.animation.frame_height,'min="1" data-an="frame_height"'))}
        ${field("Frame Count",numberInput(s.animation.frame_count,'min="1" data-an="frame_count"'))}
        ${field("Columns",numberInput(s.animation.columns,'min="1" data-an="columns"'))}
        ${field("Ticks Per Frame",numberInput(s.animation.frame_ticks,'min="1" data-an="frame_ticks"'))}
        ${field("Loop",`<select data-an="loop"><option value="true"${s.animation.loop?" selected":""}>true</option><option value="false"${!s.animation.loop?" selected":""}>false</option></select>`)}
      </div>
    </div>`:""}
  </div>`;
}
function bindOverlayEditor(el,a,onChange){
  if(!["overlay_sprite","overlay_sprite_sheet"].includes(a.type)) return;
  const animated=a.type==="overlay_sprite_sheet";
  const s=animated?a.sprite_sheet:a.sprite;
  el.querySelectorAll("[data-of]").forEach(inp=>inp.oninput=()=>{
    const k=inp.dataset.of;
    if(["x","y","width","height","alpha","z","ticks"].includes(k)) s[k]=Number(inp.value||0);
    else if(["interactable","consume_click"].includes(k)) s[k]=inp.value==="true";
    else s[k]=inp.value;
    onChange();
  });
  if(animated){
    el.querySelectorAll("[data-an]").forEach(inp=>inp.oninput=()=>{
      const k=inp.dataset.an;
      if(k==="loop") s.animation[k]=inp.value==="true";
      else s.animation[k]=Number(inp.value||0);
      onChange();
    });
  }
}
function renderActionCard(a, onChange, onDelete, depth=0){
  const spec=actionMap.get(a.type);
  const params=new Set(spec?.params||[]);
  if (["sequence","random_action"].includes(a.type)) params.add("sequence");
  if(!a.sprite) a.sprite=blankSprite();
  if(!a.sprite_sheet) a.sprite_sheet=blankSpriteSheet();
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
    if (p==="target") return field("target", textInput(a.target||"",'data-af="target"'), "Target position or other handler-specific target string. Server block actions accept x y z and ~ relative coordinates.");
    return field(p, textInput(a[p]??"",`data-af="${p}"`), "Handler-specific string parameter.");
  };
  [...params].filter(p=>!["conditions","sequence","sprite","sprite_sheet"].includes(p)).forEach(p=>dyn+=inputFor(p));

  const overlay=["overlay_sprite","overlay_sprite_sheet"].includes(a.type)?overlayEditorHtml(a):"";
  const el=document.createElement("div");
  el.className="item-card action-card";
  el.innerHTML=`
    <div class="item-head">
      <strong>${esc(a.type)}${spec?` · ${esc(spec.purpose)}`:" · imported/unknown action"}</strong>
      <div class="item-actions"><button class="btn small danger" data-del>Remove</button></div>
    </div>
    <div class="item-body">
      ${field("Action Type",`<select data-action-type>${actionOptions(a.type)}${!spec?`<option selected value="${esc(a.type)}">${esc(a.type)} (imported)</option>`:""}</select>`)}
      <div class="dynamic-fields">${dyn || (overlay?"":'<div class="mini-note">This handler has no direct scalar parameters.</div>')}</div>
      ${overlay}
      <div class="subbox conditions-box">
        <div class="subbox-head"><strong>Conditions</strong><button class="btn small" data-add-condition>+ Condition</button></div>
        <div data-condition-list></div>
      </div>
      ${params.has("sequence") ? `<div class="subbox child-box"><div class="subbox-head"><strong>Nested Actions</strong><button class="btn small" data-add-child>+ Action</button></div><div data-child-list></div></div>`:""}
      ${a._extra && Object.keys(a._extra).length ? `<div class="mini-note">Imported extra fields are preserved on export.</div>`:""}
    </div>`;
  el.querySelector("[data-del]").onclick=onDelete;
  el.querySelector("[data-action-type]").onchange=e=>{
    a.type=e.target.value;
    if (!a.sequence) a.sequence=[];
    if(!a.sprite) a.sprite=blankSprite();
    if(!a.sprite_sheet) a.sprite_sheet=blankSpriteSheet();
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
  bindOverlayEditor(el,a,onChange);
  el.querySelector("[data-add-condition]").onclick=()=>{ a.conditions.push(blankCondition()); onChange(true); };
  renderConditionList(el.querySelector("[data-condition-list]"),a.conditions,(structural=false)=>onChange(structural));

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
    if ((spec?.inputs||[]).includes("target")) dyn += field("target",textInput(c.target,'data-cf="target"'),"Provider input, such as a DAI customization kind/folder.");
    if ((spec?.inputs||[]).includes("parameter")) dyn += field("parameter",textInput(c.parameter,'data-cf="parameter"'));
    if ((spec?.inputs||[]).includes("parameter_number")) dyn += field("parameter_number",numberInput(c.parameter_number,'step="0.01" data-cf="parameter_number"'));
    if ((spec?.inputs||[]).includes("string_value") && spec?.valueType!=="string") dyn += field("string_value (input)",textInput(c.string_value,'data-cf="string_value"'),"Provider input rather than the comparison result.");
    if (spec?.valueType==="number") dyn += field("number_value",numberInput(c.number_value,'step="0.01" data-cf="number_value"'),"Expected comparison value.");
    if (spec?.valueType==="string") dyn += field("string_value",textInput(c.string_value,'data-cf="string_value"'),"Expected comparison value.");
    if (spec?.valueType==="boolean" && ["equals","not_equals"].includes(c.operator)) dyn += field("boolean_value",`<select data-cf="boolean_value"><option value="true"${c.boolean_value?" selected":""}>true</option><option value="false"${!c.boolean_value?" selected":""}>false</option></select>`);
  }

  const el=document.createElement("div");
  el.className="item-card condition-card";
  el.innerHTML=`
  <div class="item-head">
    <div class="item-title-line"><span class="condition-type-chip">${esc(spec?.valueType||"unknown")}</span><strong>${esc(c.type)}${spec?` · ${esc(spec.purpose)}`:" · imported/unknown condition"}</strong></div>
    <div class="item-actions"><button class="btn small danger" data-del>Remove</button></div>
  </div>
  <div class="item-body">
    ${field("Condition Type",`<select data-condition-type>${conditionOptions(c.type)}${!spec?`<option selected value="${esc(c.type)}">${esc(c.type)} (imported)</option>`:""}</select>`)}
    <div class="dynamic-fields">${dyn}</div>
    ${field("Negate",`<select data-cf="negate"><option value="false"${!c.negate?" selected":""}>false</option><option value="true"${c.negate?" selected":""}>true</option></select>`)}
    ${logical?`<div class="subbox"><div class="subbox-head"><strong>Child Conditions</strong><button class="btn small" data-add-child-condition>+ Condition</button></div><div data-child-conditions></div></div>`:""}
    ${c._extra && Object.keys(c._extra).length?'<div class="mini-note">Imported extra fields are preserved on export.</div>':""}
  </div>`;
  el.querySelector("[data-del]").onclick=()=>{list.splice(index,1);onChange(true);};
  el.querySelector("[data-condition-type]").onchange=e=>{
    c.type=e.target.value;
    const ns=conditionMap.get(c.type);
    c.operator=(ns?.valueType==="boolean")?"is_true":"equals";
    onChange(true);
  };
  el.querySelectorAll("[data-cf]").forEach(inp=>{
    const handler=()=>{
      const k=inp.dataset.cf;
      if (k==="negate"||k==="boolean_value") c[k]=inp.value==="true";
      else if (k==="number_value"||k==="parameter_number") c[k]=Number(inp.value||0);
      else c[k]=inp.value;
      const structural=k==="operator";
      onChange(structural);
    };
    if(inp.tagName==="SELECT") inp.onchange=handler;
    else inp.oninput=handler;
  });
  if (logical) {
    el.querySelector("[data-add-child-condition]").onclick=()=>{c.conditions.push(blankCondition());onChange(true);};
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
    el.querySelectorAll("[data-mf]").forEach(inp=>{
      const handler=()=>{
        const k=inp.dataset.mf;m[k]=k==="priority"?Number(inp.value||0):inp.value;
        if(k==="type") renderMenus();
        refreshAll();
      };
      if(inp.tagName==="SELECT") inp.onchange=handler;
      else inp.oninput=handler;
    });
    const btnRoot=el.querySelector("[data-buttons]");
    if(!m.buttons.length) btnRoot.innerHTML='<div class="empty">No buttons.</div>';
    m.buttons.forEach((b,bi)=>{
      b.style ||= {enabled:false,background:"",hover:"",selected:"",text:"",border:""};
      const card=document.createElement("div");card.className="item-card";
      card.innerHTML=`
      <div class="item-head"><strong>Slot ${esc(b.slot)} · ${esc(b.text)}</strong><div class="item-actions"><button class="btn small danger" data-del>Remove</button></div></div>
      <div class="item-body">
        <div class="form-grid">
          ${field("Slot",numberInput(b.slot,'min="0" data-bf="slot"'))}
          ${field("Button ID",textInput(b.id,'data-bf="id"'))}
          ${field("Text",textInput(b.text,'data-bf="text"'))}
          ${field("Action",textInput(b.action,'data-bf="action"'),"Use a namespaced DAI action/objective ID.")}
        </div>
        <div class="subbox style-box">
          <div class="subbox-head"><strong>Custom Button Style</strong></div>
          ${field("Use Custom Colors",`<select data-style-enabled><option value="false"${!b.style.enabled?" selected":""}>false — vanilla</option><option value="true"${b.style.enabled?" selected":""}>true</option></select>`)}
          ${b.style.enabled?`<div class="dynamic-fields">
            ${field("Background",textInput(b.style.background,'data-style="background"'),"#RRGGBB or #AARRGGBB")}
            ${field("Hover",textInput(b.style.hover,'data-style="hover"'))}
            ${field("Selected",textInput(b.style.selected,'data-style="selected"'))}
            ${field("Text",textInput(b.style.text,'data-style="text"'))}
            ${field("Border",textInput(b.style.border,'data-style="border"'))}
          </div>`:""}
        </div>
        <div class="subbox"><div class="subbox-head"><strong>Button Conditions</strong><button class="btn small" data-add-cond>+ Condition</button></div><div data-conds></div></div>
      </div>`;
      card.querySelector("[data-del]").onclick=()=>{m.buttons.splice(bi,1);renderMenus();refreshAll();};
      card.querySelectorAll("[data-bf]").forEach(inp=>inp.oninput=()=>{const k=inp.dataset.bf;b[k]=k==="slot"?Number(inp.value||0):inp.value;refreshAll();});
      card.querySelector("[data-style-enabled]").onchange=e=>{b.style.enabled=e.target.value==="true";renderMenus();refreshAll();};
      card.querySelectorAll("[data-style]").forEach(inp=>inp.oninput=()=>{b.style[inp.dataset.style]=inp.value;refreshAll();});
      card.querySelector("[data-add-cond]").onclick=()=>{b.conditions.push(blankCondition());renderMenus();refreshAll();};
      renderConditionList(card.querySelector("[data-conds]"),b.conditions,(structural=false)=>{if(structural)renderMenus();refreshAll();});
      card.onclick=()=>{selectedPreview={kind:"menuButton",value:b};refreshPreview();};
      btnRoot.appendChild(card);
    });
    el.querySelector("[data-add-button]").onclick=()=>{m.buttons.push(blankButton(m));renderMenus();refreshAll();};
    el.onclick=()=>{selectedPreview={kind:"menu",value:m};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addMenu").onclick=()=>{state.menus.push(blankMenu());renderMenus();refreshAll();};


function renderTitleScreens(){
  const root=$("#titleScreenList");if(!root)return;root.innerHTML="";
  if(!state.titleScreens.length){root.innerHTML='<div class="empty">No title screens yet. Add one to replace Minecraft\'s default main menu through DAI JSON.</div>';return;}
  const actions=["open_singleplayer","open_multiplayer","open_official_packs","open_mods","open_options","open_url","quit"];
  const animations=["none","spin","bob","pulse","orbit"];

  state.titleScreens.forEach((t,ti)=>{
    const el=document.createElement("div");el.className="item-card title-screen-card";
    el.innerHTML=`<div class="item-head"><strong>${esc(t.id)}</strong><div class="item-actions"><button class="btn small danger" data-del>Remove</button></div></div><div class="item-body"><div class="dynamic-fields">
      ${field("Definition ID",textInput(t.id,'data-tf="id"'))}${field("Enabled",`<select data-tf="enabled"><option value="true"${t.enabled?" selected":""}>true</option><option value="false"${!t.enabled?" selected":""}>false</option></select>`)}${field("Priority",numberInput(t.priority,'data-tf="priority"'))}${field("Title",textInput(t.title,'data-tf="title"'))}${field("Subtitle",textInput(t.subtitle,'data-tf="subtitle"'))}${field("Background Top",textInput(t.backgroundTop,'data-tf="backgroundTop"'))}${field("Background Bottom",textInput(t.backgroundBottom,'data-tf="backgroundBottom"'))}${field("Title Color",textInput(t.titleColor,'data-tf="titleColor"'))}${field("Subtitle Color",textInput(t.subtitleColor,'data-tf="subtitleColor"'))}
    </div><div class="subbox"><div class="subbox-head"><strong>Buttons</strong><button class="btn small primary" data-add-button>+ Button</button></div><div data-title-buttons></div></div></div>`;
    el.querySelector('[data-del]').onclick=()=>{state.titleScreens.splice(ti,1);renderTitleScreens();refreshAll();};
    el.querySelectorAll('[data-tf]').forEach(inp=>inp.oninput=()=>{const k=inp.dataset.tf;if(k==="enabled")t[k]=inp.value==="true";else if(k==="priority")t[k]=Number(inp.value||0);else t[k]=inp.value;refreshAll();});
    const br=el.querySelector('[data-title-buttons]');
    if(!t.buttons.length)br.innerHTML='<div class="empty">No buttons.</div>';
    t.buttons.forEach((b,bi)=>{const c=document.createElement("div");c.className="subbox title-button-card";c.innerHTML=`<div class="subbox-head"><strong>${esc(b.label||b.id)}</strong><button class="btn small danger" data-bdel>Remove</button></div><div class="dynamic-fields">
      ${field("Button ID",textInput(b.id,'data-bf="id"'))}${field("Label",textInput(b.label,'data-bf="label"'))}${field("Action",`<select data-bf="action">${actions.map(x=>`<option value="${x}"${b.action===x?" selected":""}>${x}</option>`).join("")}</select>`)}${field("URL",textInput(b.url||'','data-bf="url"'),"Used by open_url.")}${field("Anchor",`<select data-bf="anchor"><option value="center"${b.anchor==="center"?" selected":""}>center</option></select>`)}${field("X",numberInput(b.x,'data-bf="x"'))}${field("Y",numberInput(b.y,'data-bf="y"'))}${field("Width",numberInput(b.width,'data-bf="width"'))}${field("Height",numberInput(b.height,'data-bf="height"'))}
      ${field("Icon Type",`<select data-bf="iconType"><option value="item"${b.iconType==="item"?" selected":""}>item</option></select>`)}${field("Minecraft Item ID",textInput(b.iconId,'data-bf="iconId"'),"Example: minecraft:carrot or a registered DAI item.")}${field("Icon Scale",numberInput(b.iconScale,'step="0.1" data-bf="iconScale"'))}${field("Icon X Offset",numberInput(b.iconOffsetX,'data-bf="iconOffsetX"'))}
      ${field("Background",textInput(b.background,'data-bf="background"'))}${field("Hover",textInput(b.hover,'data-bf="hover"'))}${field("Border",textInput(b.border,'data-bf="border"'))}${field("Text",textInput(b.text,'data-bf="text"'))}${field("Hover Animation",`<select data-bf="animation">${animations.map(x=>`<option value="${x}"${b.animation===x?" selected":""}>${x}</option>`).join("")}</select>`)}${field("Animation Speed",numberInput(b.animationSpeed,'step="0.05" data-bf="animationSpeed"'))}${field("Animation Amount",numberInput(b.animationAmount,'step="0.1" data-bf="animationAmount"'))}
      </div>`;
      c.querySelector('[data-bdel]').onclick=()=>{t.buttons.splice(bi,1);renderTitleScreens();refreshAll();};
      c.querySelectorAll('[data-bf]').forEach(inp=>inp.oninput=()=>{const k=inp.dataset.bf;if(["x","y","width","height","iconScale","iconOffsetX","animationSpeed","animationAmount"].includes(k))b[k]=Number(inp.value||0);else b[k]=inp.value;refreshAll();});
      c.onclick=()=>{selectedPreview={kind:"titleButton",value:b};refreshPreview();};br.appendChild(c);
    });
    el.querySelector('[data-add-button]').onclick=()=>{t.buttons.push(blankTitleButton(t));renderTitleScreens();refreshAll();};el.onclick=()=>{selectedPreview={kind:"titleScreen",value:t};refreshPreview();};root.appendChild(el);
  });
}
if($("#addTitleScreen"))$("#addTitleScreen").onclick=()=>{const t=blankTitleScreen();t.buttons.push(blankTitleButton(t));state.titleScreens.push(t);renderTitleScreens();refreshAll();};

function renderContent(){
  const root=$("#contentList");if(!root)return;root.innerHTML="";
  if(!state.content.length){root.innerHTML='<div class="empty">No custom DAI content definitions yet.</div>';return;}
  const types=Object.keys(CONTENT_FOLDERS);
  const registryOptions=["item","block","entity","effect","potion","particle"];
  state.content.forEach((c,ci)=>{const el=document.createElement("div");el.className="item-card content-card";
    const specialized=[];
    if(c.type==="block")specialized.push(field("Block Settings JSON",`<textarea data-cf="block">${esc(c.block||"{}")}</textarea>`,"Static physical shell + states/shapes/redstone: hardness, luminance, friction, states, outline_shape, collision_shape, redstone_state, use_toggle_state, etc."));
    if(c.type==="projectile")specialized.push(field("Projectile Physics JSON",`<textarea data-cf="projectile">${esc(c.projectile||"{}")}</textarea>`,"drag, lifetime, hit_radius, damage, knockback, pierce, ricochets, homing, return and collision behavior. Speed/gravity remain in Stats JSON."));
    if(c.type==="particle")specialized.push(field("Particle Settings JSON",`<textarea data-cf="particle">${esc(c.particle||"{}")}</textarea>`,"Emitter + render physics: shape/count/spread/speed/radius, texture/lifetime/gravity/friction/scale/color/alpha/full_bright/collision."));
    if(c.type==="effect")specialized.push(field("Native Effect JSON",`<textarea data-cf="effect">${esc(c.effect||"{}")}</textarea>`,"Registry-backed MobEffect shell: category, color, tick_interval."));
    if(c.type==="potion")specialized.push(field("Native Potion JSON",`<textarea data-cf="potion">${esc(c.potion||"{}")}</textarea>`,"Native potion effect entries use strings: 'namespace:effect duration amplifier'."));
    if(c.type==="entity")specialized.push(field("Entity JSON",`<textarea data-cf="entity">${esc(c.entity||"{}")}</textarea>`,"Native shell, spawn/movement/gameplay/portal/riding. Gameplay events include hurt, damage_dealt, death, kill, attacked, interact, jump/fall, target and passenger/mount lifecycle."));
    el.innerHTML=`<div class="item-head"><strong>${esc(c.type)} · ${esc(c.id)}</strong><button class="btn small danger" data-del>Remove</button></div><div class="item-body"><div class="dynamic-fields">
    ${field("Content Type",`<select data-cf="type">${types.map(x=>`<option value="${x}"${c.type===x?" selected":""}>${x}</option>`).join("")}</select>`)}${field("Definition ID",textInput(c.id,'data-cf="id"'))}${field("Display Name",textInput(c.displayName,'data-cf="displayName"'))}${field("Description",textInput(c.description,'data-cf="description"'))}${field(c.type==="entity"?"Legacy Carrier (optional)":"Carrier (optional for native types)",textInput(c.carrier,'data-cf="carrier"'),c.type==="entity"?"Leave blank for a native DAI entity; legacy packs may use a vanilla/modded carrier.":"Carrier-backed definitions can point at a vanilla/modded ID; registry-backed native types may leave this blank where supported.")}${field("Vanilla Model Alias",textInput(c.model,'data-cf="model"'),"Optional model/item alias where relevant.")}${field("Registry Backed",`<select data-cf="registryBacked"><option value="true"${c.registryBacked?" selected":""}>true</option><option value="false"${!c.registryBacked?" selected":""}>false</option></select>`)}${field("Native Registry",`<select data-cf="nativeRegistry">${registryOptions.map(x=>`<option value="${x}"${c.nativeRegistry===x?" selected":""}>${x}</option>`).join("")}</select>`,"Static registry targets: item, block, entity, effect, potion or particle.")}${field("Armor Slot",textInput(c.slot||'','data-cf="slot"'),"Optional; e.g. chest")}${field("Capabilities",`<textarea data-cf="capabilities">${esc(c.capabilities)}</textarea>`,"Comma or newline separated resource IDs.")}${field("Tags",`<textarea data-cf="tags">${esc(c.tags)}</textarea>`,"Comma or newline separated labels.")}${field("Attributes JSON",`<textarea data-cf="attributes">${esc(c.attributes)}</textarea>`)}${field("Native Attributes JSON",`<textarea data-cf="nativeAttributes">${esc(c.nativeAttributes)}</textarea>`)}${field("Native Data Components JSON",`<textarea data-cf="nativeComponents">${esc(c.nativeComponents||"{}")}</textarea>`,"Open Mojang DataComponentType map. Component edits are static-shell changes when they affect a native item.")}${field("Events JSON",`<textarea data-cf="events">${esc(c.events)}</textarea>`,"Hot-reloadable lifecycle dispatch map. Item, block, projectile, particle and effect runtimes consume their documented event names.")}${field("Stats JSON",`<textarea data-cf="stats">${esc(c.stats)}</textarea>`,"Common stats. Projectile speed/gravity are live physics in Pass II.")}${specialized.join("")}
    </div></div>`;
    el.querySelector('[data-del]').onclick=()=>{state.content.splice(ci,1);renderContent();refreshAll();};
    el.querySelectorAll('[data-cf]').forEach(inp=>{const handler=()=>{const k=inp.dataset.cf;if(k==="registryBacked")c[k]=inp.value==="true";else c[k]=inp.value;if(k==="type"){const map={block:"block",entity:"entity",effect:"effect",potion:"potion",particle:"particle"};c.nativeRegistry=map[c.type]||"item";renderContent();}refreshAll();};if(inp.tagName==="SELECT")inp.onchange=handler;else inp.oninput=handler;});
    el.onclick=()=>{selectedPreview={kind:"content",value:c};refreshPreview();};root.appendChild(el);
  });
}
if($("#addContent"))$("#addContent").onclick=()=>{state.content.push(blankContent());renderContent();refreshAll();};
if($("#addNativeEntity"))$("#addNativeEntity").onclick=()=>{state.content.push(blankNativeEntity());renderContent();refreshAll();};
if($("#addLivingPortal"))$("#addLivingPortal").onclick=()=>{state.content.push(blankLivingPortal());renderContent();refreshAll();};
if($("#addNativeBlock"))$("#addNativeBlock").onclick=()=>{state.content.push(blankNativeBlock());renderContent();refreshAll();};
if($("#addProjectile"))$("#addProjectile").onclick=()=>{state.content.push(blankProjectile());renderContent();refreshAll();};
if($("#addParticle"))$("#addParticle").onclick=()=>{state.content.push(blankParticle());renderContent();refreshAll();};
if($("#addNativeEffect"))$("#addNativeEffect").onclick=()=>{state.content.push(blankNativeEffect());renderContent();refreshAll();};

function renderReactions(){
  const root=$("#reactionList");root.innerHTML="";
  if(!state.reactions.length){root.innerHTML='<div class="empty">No reactions yet. Reactions subscribe JSON behavior to registered runtime events.</div>';return;}
  state.reactions.forEach((r,ri)=>{
    const availableEvents=reactionEventSpecs();
    const known=availableEvents.find(e=>e.id===r.event);
    const eventOptions=availableEvents.map(e=>`<option value="${esc(e.id)}"${r.event===e.id?" selected":""}>${esc(e.id)}${String(e.id).includes(":")?" (datapack)":""}</option>`).join("");
    const extraEvent=!known&&r.event?`<option selected value="${esc(r.event)}">${esc(r.event)} (imported)</option>`:"";
    const el=document.createElement("div");el.className="item-card reaction-card";
    el.innerHTML=`
      <div class="item-head"><strong>${esc(r.id)} · ${esc(r.type)} · ${esc(r.event)} / ${esc(r.phase)}</strong><div class="item-actions"><button class="btn small danger" data-del>Delete</button></div></div>
      <div class="item-body">
        <div class="form-grid">
          ${field("Reaction ID / Path",textInput(r.id,'data-rf2="id"'))}
          ${field("Type",`<select data-rf2="type"><option value="default"${r.type==="default"?" selected":""}>default</option><option value="override"${r.type==="override"?" selected":""}>override</option><option value="cancel"${r.type==="cancel"?" selected":""}>cancel</option></select>`)}
          ${field("Event",`<select data-rf2="event">${eventOptions}${extraEvent}</select>`)}
          ${field("Phase",`<select data-rf2="phase"><option value="pre"${r.phase==="pre"?" selected":""}>pre</option><option value="during"${r.phase==="during"?" selected":""}>during</option><option value="post"${r.phase==="post"?" selected":""}>post</option></select>`)}
          ${field("Priority",numberInput(r.priority,'min="0" step="1" data-rf2="priority"'),"Higher priority evaluates first within the same event + phase.")}
        </div>
        <div class="mini-note">${known?esc(known.purpose):"Imported event not present in this creator catalog."}</div>
        <div class="subbox"><div class="subbox-head"><strong>Reaction Conditions</strong><button class="btn small" data-add-rcond>+ Condition</button></div><div data-rconds></div></div>
        <div class="subbox"><div class="subbox-head"><strong>Reaction Sequence</strong><button class="btn small" data-add-ra>+ Action</button></div><div data-raction-list></div></div>
      </div>`;
    el.querySelector("[data-del]").onclick=()=>{state.reactions.splice(ri,1);renderReactions();refreshAll();};
    el.querySelectorAll("[data-rf2]").forEach(inp=>{
      const handler=()=>{
        const k=inp.dataset.rf2;r[k]=k==="priority"?Number(inp.value||0):inp.value;
        if(["event","type"].includes(k)) renderReactions();
        refreshAll();
      };
      if(inp.tagName==="SELECT") inp.onchange=handler;
      else inp.oninput=handler;
    });
    el.querySelector("[data-add-rcond]").onclick=()=>{r.conditions.push(blankCondition("reaction_active"));renderReactions();refreshAll();};
    renderConditionList(el.querySelector("[data-rconds]"),r.conditions,(structural=false)=>{if(structural)renderReactions();refreshAll();});
    el.querySelector("[data-add-ra]").onclick=()=>{r.sequence.push(blankAction());renderReactions();refreshAll();};
    renderActionList(el.querySelector("[data-raction-list]"),r.sequence,(rerender=false)=>{if(rerender)renderReactions();refreshAll();});
    el.onclick=()=>{selectedPreview={kind:"reaction",value:r};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addReaction").onclick=()=>{state.reactions.push(blankReaction());renderReactions();refreshAll();};

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
      c.querySelectorAll("[data-rq]").forEach(inp=>{
        const handler=()=>{
          const k=inp.dataset.rq;
          if(k==="groups")q.groups=inp.value.split(",").map(x=>x.trim()).filter(Boolean);
          else if(["minimum_height","minimum_ratio","minimum","maximum"].includes(k))q[k]=inp.value===""?"":Number(inp.value);
          else q[k]=inp.value;
          if(k==="type")renderRecognition();
          refreshAll();
        };
        if(inp.tagName==="SELECT")inp.onchange=handler;else inp.oninput=handler;
      });
      rr.appendChild(c);
    });
    el.querySelector("[data-add-req]").onclick=()=>{r.requirements.push({_id:uid(),type:"connected",groups:r.groups.map(g=>g.name),group:"",relative_to:"",minimum_height:1,minimum_ratio:.5,minimum:"",maximum:""});renderRecognition();refreshAll();};
    el.onclick=()=>{selectedPreview={kind:"recognition",value:r};refreshPreview();};
    root.appendChild(el);
  });
}
$("#addRecognition").onclick=()=>{state.recognition.push(blankRecognition());renderRecognition();refreshAll();};


function renderExperiences(){
  const er=$("#experienceList"),wr=$("#worldgenList");if(!er||!wr)return;er.innerHTML="";wr.innerHTML="";
  if(!state.experiences.length)er.innerHTML='<div class="empty">No experience definitions yet.</div>';
  state.experiences.forEach((e,i)=>{const el=document.createElement("div");el.className="item-card experience-card";el.innerHTML=`<div class="item-head"><strong>${esc(fullId(e.id))}</strong><button class="btn small danger" data-del>Remove</button></div><div class="item-body"><div class="dynamic-fields">
    <div class="field-group-title">Identity & Save</div>${field("Definition ID",textInput(e.id,'data-ef="id"'))}${field("Enabled",`<select data-ef="enabled"><option value="true"${e.enabled?" selected":""}>true</option><option value="false"${!e.enabled?" selected":""}>false</option></select>`)}${field("Priority",numberInput(e.priority,'data-ef="priority"'))}${field("Save ID",textInput(e.saveId,'data-ef="saveId"'))}${field("Save Name",textInput(e.saveName,'data-ef="saveName"'))}${field("Worldgen ID",textInput(e.worldgen,'data-ef="worldgen"'))}<div class="field-group-title">Lifecycle</div>${field("On First Join",textInput(e.onFirstJoin,'data-ef="onFirstJoin"'))}${field("On Join / Resume",textInput(e.onJoin,'data-ef="onJoin"'))}${field("Create If Missing",boolSelect(e.createIfMissing,'data-ef="createIfMissing"'))}${field("Load If Existing",boolSelect(e.loadIfExisting,'data-ef="loadIfExisting"'))}${field("Auto Create",boolSelect(e.autoCreate,'data-ef="autoCreate"'))}<div class="field-group-title">Experience-Owned UI</div>${field("UI Auto Enable",boolSelect(e.uiAutoEnable,'data-ef="uiAutoEnable"'))}${field("Grave Cursor Toggle",boolSelect(e.uiGraveCursor,'data-ef="uiGraveCursor"'))}${field("Open Generic DAI Menu On Grave",boolSelect(e.uiOpenMenu,'data-ef="uiOpenMenu"'))}${field("Grave Open Action",textInput(e.uiOpenAction||"",'data-ef="uiOpenAction"'),"Example: tamacrafti:open")}${field("Grave Close Action",textInput(e.uiCloseAction||"",'data-ef="uiCloseAction"'),"Example: tamacrafti:close")}${field("Grave Anchor Overlay",textInput(e.uiAnchorOverlay||"",'data-ef="uiAnchorOverlay"'),"Overlay ID used to determine whether the experience UI is open.")}${field("Direct Grave Menu",textInput(e.uiGraveMenu||"",'data-ef="uiGraveMenu"'),"Optional DAI menu ID to open directly.")}${field("Direct Grave Menu Open State",textInput(e.uiGraveMenuOpen||"",'data-ef="uiGraveMenuOpen"'),"Optional open-state value paired with grave_menu.")}<div class="field-group-title">MAIN Experience Branding</div>${field("Branding JSON",`<textarea data-ef="brandingJson">${esc(e.brandingJson||"{}")}</textarea>`,"Open branding object: window_title, loading_*, companion_id, early_loading and world_loading. Assets live in the companion resource pack.")}<div class="field-group-title">Player-Control Ceiling</div>${field("Allow Automation",boolSelect(e.controlAutomation!==false,'data-ef="controlAutomation"'),"The player can still disable automation globally.")}${field("Allow Movement Automation",boolSelect(e.controlMovement!==false,'data-ef="controlMovement"'))}${field("Allow Combat Automation",boolSelect(e.controlCombat!==false,'data-ef="controlCombat"'))}${field("Allow World-Editing Automation",boolSelect(e.controlWorldEditing!==false,'data-ef="controlWorldEditing"'))}${field("Max Actions / Second",numberInput(e.controlMaxActions||0,'min="0" max="20" data-ef="controlMaxActions"'),"0 = no additional experience cap.")}${field("Max Queue Size",numberInput(e.controlMaxQueue||0,'min="0" max="2048" data-ef="controlMaxQueue"'),"0 = no additional experience cap.")}
  </div></div>`;el.querySelector('[data-del]').onclick=()=>{state.experiences.splice(i,1);renderExperiences();refreshAll();};el.querySelectorAll('[data-ef]').forEach(inp=>inp.oninput=()=>{const k=inp.dataset.ef;if(["enabled","createIfMissing","loadIfExisting","autoCreate","uiAutoEnable","uiGraveCursor","uiOpenMenu","controlAutomation","controlMovement","controlCombat","controlWorldEditing"].includes(k))e[k]=inp.value==="true";else if(["priority","controlMaxActions","controlMaxQueue"].includes(k))e[k]=Number(inp.value||0);else e[k]=inp.value;refreshAll();});el.onclick=()=>{selectedPreview={kind:"experience",value:e};refreshPreview();};er.appendChild(el);});
  if(!state.worldgens.length)wr.innerHTML='<div class="empty">No worldgen profiles yet.</div>';
  state.worldgens.forEach((w,i)=>{const el=document.createElement("div");el.className="item-card worldgen-card";el.innerHTML=`<div class="item-head"><strong>${esc(fullId(w.id))}</strong><button class="btn small danger" data-del>Remove</button></div><div class="item-body"><div class="dynamic-fields">
    <div class="field-group-title">World Type</div>${field("Definition ID",textInput(w.id,'data-wf="id"'))}${field("Enabled",boolSelect(w.enabled,'data-wf="enabled"'))}${field("World Type",`<select data-wf="worldType">${["normal","amplified","large_biomes","single_biome","debug","void","flat","superflat","water","fixed_biome_noise","noise"].map(x=>`<option value="${x}"${(w.worldType||"normal")===x?" selected":""}>${x}</option>`).join("")}</select>`,`DAI 3.0 friendly generator. High-level world types compile into real startup registry data and can reference native DAI biomes/dimension data.`)}${field("World Preset Override",textInput(w.worldPreset||"",'data-wf="worldPreset"'),"Optional raw minecraft/custom preset ID. When set, it overrides the friendly world type for experience creation.")}${field("Biome",textInput(w.biome||"minecraft:plains",'data-wf="biome"'))}${field("Noise Settings",textInput(w.noiseSettings||"minecraft:overworld",'data-wf="noiseSettings"'))}${field("Features",boolSelect(w.features!==false,'data-wf="features"'))}${field("Lakes",boolSelect(w.lakes!==false,'data-wf="lakes"'))}${field("Structures",boolSelect(w.structures!==false,'data-wf="structures"'))}${field("Include Nether",boolSelect(w.includeNether!==false,'data-wf="includeNether"'))}${field("Include End",boolSelect(w.includeEnd!==false,'data-wf="includeEnd"'))}${field("Flat Layers JSON",`<textarea data-wf="layers">${esc(w.layers||"[]")}</textarea>`,`Used by flat/superflat. Array of {block,height}.`)}${field("Water Depth",numberInput(w.waterDepth??60,'min="0" max="384" data-wf="waterDepth"'))}${field("Water Block",textInput(w.waterBlock||"minecraft:water",'data-wf="waterBlock"'))}${field("Floor Block",textInput(w.floorBlock||"minecraft:bedrock",'data-wf="floorBlock"'))}${field("Floor Height",numberInput(w.floorHeight??1,'min="0" max="384" data-wf="floorHeight"'))}${field("Surface Block",textInput(w.surfaceBlock||"minecraft:sand",'data-wf="surfaceBlock"'))}${field("Surface Height",numberInput(w.surfaceHeight??1,'min="0" max="384" data-wf="surfaceHeight"'))}<div class="field-group-title">Spawn & Bootstrap</div>${field("Seed (optional)",textInput(w.seed,'data-wf="seed"'))}${field("Spawn X",numberInput(w.spawnX,'data-wf="spawnX"'))}${field("Spawn Y",numberInput(w.spawnY,'data-wf="spawnY"'))}${field("Spawn Z",numberInput(w.spawnZ,'data-wf="spawnZ"'))}${field("Spawn Yaw",numberInput(w.spawnYaw,'step="0.1" data-wf="spawnYaw"'))}${field("Spawn Pitch",numberInput(w.spawnPitch,'step="0.1" data-wf="spawnPitch"'))}${field("Generation Commands",`<textarea data-wf="generationCommands">${esc(w.generationCommands)}</textarea>`,`One server command per line.`)}${field("Bootstrap Actions",`<textarea data-wf="bootstrapActions">${esc(w.bootstrapActions)}</textarea>`,`Namespaced DAI action IDs, one per line.`)}${field("Initial Structures JSON",`<textarea data-wf="initialStructures">${esc(w.initialStructures)}</textarea>`,`Array of {structure,x,y,z,rotation,mirror}.`)}
  </div></div>`;el.querySelector('[data-del]').onclick=()=>{state.worldgens.splice(i,1);renderExperiences();refreshAll();};el.querySelectorAll('[data-wf]').forEach(inp=>inp.oninput=()=>{const k=inp.dataset.wf;if(["enabled","features","lakes","structures","includeNether","includeEnd"].includes(k))w[k]=inp.value==="true";else if(["spawnX","spawnY","spawnZ","spawnYaw","spawnPitch","waterDepth","floorHeight","surfaceHeight"].includes(k))w[k]=Number(inp.value||0);else w[k]=inp.value;refreshAll();});el.onclick=()=>{selectedPreview={kind:"worldgen",value:w};refreshPreview();};wr.appendChild(el);});
}
function boolSelect(v,attrs=""){return `<select ${attrs}><option value="true"${v?" selected":""}>true</option><option value="false"${!v?" selected":""}>false</option></select>`;}
if($("#addExperience"))$("#addExperience").onclick=()=>{state.experiences.push(blankExperience());renderExperiences();refreshAll();};
if($("#addWorldgen"))$("#addWorldgen").onclick=()=>{state.worldgens.push(blankWorldgen());renderExperiences();refreshAll();};
if($("#addExperienceStarter"))$("#addExperienceStarter").onclick=()=>{const w=blankWorldgen();w.id=`worldgen_${state.worldgens.length+1}`;state.worldgens.push(w);const e=blankExperience();e.id=`experience_${state.experiences.length+1}`;e.worldgen=fullId(w.id);e.uiOpenAction=`${state.pack.namespace}:open`;e.uiCloseAction=`${state.pack.namespace}:close`;e.uiAnchorOverlay="main_frame";state.experiences.push(e);renderExperiences();renderDashboard();refreshAll();};

function renderRuntimeDefinitions(){
  const root=$("#runtimeDefinitionList");if(!root)return;root.innerHTML="";
  if(!state.runtimeDefinitions.length){root.innerHTML='<div class="empty">No managed runtime definitions yet. Add DAI runtime data, native world data, or an open Mojang registry/server-data bridge definition.</div>';return;}
  state.runtimeDefinitions.forEach((d,di)=>{
    const spec=RUNTIME_DEFINITION_TYPES[d.type]||RUNTIME_DEFINITION_TYPES.recipe;
    const el=document.createElement("div");el.className="item-card runtime-definition-card";
    el.innerHTML=`<div class="item-head"><strong>${esc(spec.label)} · ${esc(d.id)}</strong><button class="btn small danger" data-del>Remove</button></div><div class="item-body"><div class="form-grid">${field("Definition Type",`<select data-rtd="type">${Object.entries(RUNTIME_DEFINITION_TYPES).map(([k,v])=>`<option value="${esc(k)}"${k===d.type?" selected":""}>${esc(v.label)}</option>`).join("")}</select>`)}${field("Definition ID / Path",textInput(d.id,'data-rtd="id"'),`Exports under ${spec.folder}/. Slashes are allowed for nested paths.`)}<div class="field full"><label>JSON Definition</label><textarea class="runtime-json" data-rtd="json" spellcheck="false">${esc(d.json)}</textarea><span class="help">Unknown/new fields are preserved exactly as JSON. Validation checks syntax without narrowing the client schema.</span></div></div></div>`;
    el.querySelector('[data-del]').onclick=()=>{state.runtimeDefinitions.splice(di,1);renderRuntimeDefinitions();refreshAll();};
    el.querySelectorAll('[data-rtd]').forEach(inp=>{
      const handler=()=>{const k=inp.dataset.rtd;if(k==="type"){d.type=inp.value;renderRuntimeDefinitions();}else d[k]=inp.value;refreshAll();};
      if(inp.tagName==="SELECT")inp.onchange=handler;else inp.oninput=handler;
    });
    el.onclick=()=>{selectedPreview={kind:"runtimeDefinition",value:d};refreshPreview();};
    root.appendChild(el);
  });
}
$$('[data-add-runtime]').forEach(b=>b.onclick=()=>{state.runtimeDefinitions.push(blankRuntimeDefinition(b.dataset.addRuntime));renderRuntimeDefinitions();refreshAll();});
const runtimeTypePicker=$("#runtimeTypePicker");
if(runtimeTypePicker){runtimeTypePicker.innerHTML=Object.entries(RUNTIME_DEFINITION_TYPES).map(([k,v])=>`<option value="${esc(k)}">${esc(v.label)} · ${esc(v.folder)}</option>`).join("");}
if($("#addRuntimeSelected"))$("#addRuntimeSelected").onclick=()=>{const type=runtimeTypePicker?.value||"recipe";state.runtimeDefinitions.push(blankRuntimeDefinition(type));renderRuntimeDefinitions();refreshAll();};

const UNIVERSAL_TEMPLATES={
  experience:()=>[`data/${state.pack.namespace}/dai_experiences/experience.json`,JSON.stringify(experienceJson(blankExperience()),null,2)+"\n"],
  experience_ui:()=>{const e=blankExperience();e.uiOpenAction=`${state.pack.namespace}:open`;e.uiCloseAction=`${state.pack.namespace}:close`;e.uiAnchorOverlay="main_frame";return [`data/${state.pack.namespace}/dai_experiences/ui_owned_experience.json`,JSON.stringify(experienceJson(e),null,2)+"\n"];},
  worldgen:()=>[`data/${state.pack.namespace}/dai_worldgen/worldgen.json`,JSON.stringify(worldgenJson(blankWorldgen()),null,2)+"\n"],
  attribute:()=>[`data/${state.pack.namespace}/dai_attributes/stamina.json`,JSON.stringify({default:100,minimum:0,maximum:100},null,2)+"\n"],
  animation:()=>[`data/${state.pack.namespace}/dai_animations/animation.json`,JSON.stringify({duration_ticks:20,loop:false,channel:"upper_body",priority:10,interruptible:true,markers:{},marker_actions:{},tracks:{}},null,2)+"\n"],
  recipe:()=>[`data/${state.pack.namespace}/dai_recipes/example.json`,JSON.stringify({type:"crafting_shaped",pattern:["A"],key:{A:{item:"minecraft:stone"}},result:{item:"minecraft:stone",count:1}},null,2)+"\n"],
  reaction_event:()=>[`data/${state.pack.namespace}/reaction_events/custom_event.json`,JSON.stringify({phases:["pre","during","post"],cancellable:true,overrideable:true},null,2)+"\n"],
  screen_profile:()=>[`data/${state.pack.namespace}/screen_profiles/minecraft/example.json`,JSON.stringify({variants:[]},null,2)+"\n"],
  native_ai:()=>[`data/${state.pack.namespace}/logics/definitions/native_entity_ai.json`,JSON.stringify({sequence:[{type:"target_player",conditions:[{type:"entity_has_target",operator:"is_false"}]},{type:"look_at_target",conditions:[{type:"entity_has_target",operator:"is_true"}]},{type:"move_to_target",value:1.0,conditions:[{type:"entity_target_distance",operator:"greater_than",number_value:3.0}]},{type:"melee_attack",value:3.0,conditions:[{type:"entity_target_distance",operator:"less_than_or_equal",number_value:3.0},{type:"entity_can_see_target",operator:"is_true"}]},{type:"wander",value:0.8,ticks:5,conditions:[{type:"entity_has_target",operator:"is_false"}]}]},null,2)+"\n"],
  function:()=>[`data/${state.pack.namespace}/function/example.mcfunction`,"# DAI / Minecraft function\n"],
  json:()=>[`data/${state.pack.namespace}/custom/example.json`,"{}\n"]
};
function fileIsProbablyText(path,data){if(/\.(json|mcfunction|txt|md|mcmeta|properties|lang|fsh|vsh|glsl|csv)$/i.test(path))return true;const bytes=data instanceof Uint8Array?data:null;if(!bytes)return typeof data==="string";if(bytes.length>1024*1024)return false;for(let i=0;i<Math.min(bytes.length,4096);i++)if(bytes[i]===0)return false;return true;}
function uniqueUniversalPath(path){let p=normalizeZipPath(path),i=2;const dot=p.lastIndexOf('.'),base=dot>p.lastIndexOf('/')?p.slice(0,dot):p,ext=dot>p.lastIndexOf('/')?p.slice(dot):'';while(Object.prototype.hasOwnProperty.call(state.extraFiles,p)||Object.prototype.hasOwnProperty.call(generatedFiles(),p))p=`${base}_${i++}${ext}`;return p;}
function addUniversal(path,data){state.extraFiles[uniqueUniversalPath(path)]=data;renderUniversalFiles();refreshAll();}
function renderUniversalFiles(){const root=$("#universalFileList");if(!root)return;root.innerHTML="";const entries=Object.entries(state.extraFiles||{}).sort(([a],[b])=>a.localeCompare(b));if(!entries.length){root.innerHTML='<div class="empty">No universal/passthrough files yet. Templates and uploads appear here.</div>';return;}entries.forEach(([path,data])=>{const texty=fileIsProbablyText(path,data),el=document.createElement("div");el.className="item-card universal-file-card";el.innerHTML=`<div class="item-head"><strong>${esc(path)}</strong><div class="item-actions"><button class="btn small danger" data-del>Remove</button></div></div><div class="item-body"><div class="field"><label>ZIP Path</label><input class="resource-file-path" data-path value="${esc(path)}"/></div><div class="file-meta">${humanBytes(byteLengthOf(data))} · ${texty?"editable text":"binary file"}</div>${texty?`<div class="field" style="margin-top:8px"><label>Contents</label><textarea data-content style="min-height:240px">${esc(decodeText(data))}</textarea></div>`:'<div class="binary-note">Binary data is preserved exactly. Rename, remove, or replace it by uploading another file.</div>'}</div>`;el.querySelector('[data-del]').onclick=()=>{delete state.extraFiles[path];renderUniversalFiles();refreshAll();};const pi=el.querySelector('[data-path]');pi.onchange=()=>{const next=normalizeZipPath(pi.value);if(!validZipPath(next)){alert('Invalid ZIP path.');pi.value=path;return;}if(next!==path&&Object.prototype.hasOwnProperty.call(state.extraFiles,next)){alert('A universal file already uses that path.');pi.value=path;return;}if(next!==path){state.extraFiles[next]=data;delete state.extraFiles[path];renderUniversalFiles();refreshAll();}};const ta=el.querySelector('[data-content]');if(ta)ta.oninput=()=>{state.extraFiles[path]=ta.value;refreshAll();};el.onclick=()=>{selectedPreview={kind:"universalFile",value:path};refreshPreview();};root.appendChild(el);});}
if($("#addTextFile"))$("#addTextFile").onclick=()=>addUniversal(`data/${state.pack.namespace}/custom/new_file.json`,"{}\n");
$$('.template-file').forEach(b=>b.onclick=()=>{const fn=UNIVERSAL_TEMPLATES[b.dataset.template];if(fn){const [p,d]=fn();addUniversal(p,d);}});
async function importUniversalInput(input,folder=false){for(const f of input.files||[]){let path=f.webkitRelativePath||f.name;if(folder&&path.includes('/'))path=path.split('/').slice(1).join('/');addUniversal(path,new Uint8Array(await f.arrayBuffer()));}input.value="";}
if($("#addUniversalFiles"))$("#addUniversalFiles").onchange=e=>importUniversalInput(e.target,false);
if($("#addUniversalFolder"))$("#addUniversalFolder").onchange=e=>importUniversalInput(e.target,true);
function renderDashboard(){const root=$("#dashboardStats");if(!root)return;const files=Object.keys(generatedFiles()).length;const vals=state.kind==="resourcepack"?[[Object.keys(state.resourceFiles||{}).length,"resource assets"],[Object.keys(state.extraFiles||{}).length,"universal files"],[files,"exported files"],[state.pack.namespace,"namespace"]]:[[state.objectives.length,"objectives"],[state.experiences.length,"experiences"],[state.runtimeDefinitions.length,"runtime defs"],[files,"exported files"]];root.innerHTML=vals.map(([v,l])=>`<div class="dash-stat"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join('');}
function generatedFiles(){
  readPackInputs();
  const files={};

  if(state.kind==="resourcepack"){
    const meta=state.resourceMcmeta && typeof state.resourceMcmeta==="object" ? deep(state.resourceMcmeta) : {};
    meta.pack={...(meta.pack||{}),description:state.pack.description,pack_format:Number(state.pack.resourceFormat||48)};
    delete meta.pack.min_format;
    delete meta.pack.max_format;
    const daiMeta=meta.dai && typeof meta.dai==="object" && !Array.isArray(meta.dai) ? {...meta.dai} : {};
    delete daiMeta.auto_enable; delete daiMeta.autoEnable; delete daiMeta.companion_id; delete daiMeta.companionId;
    if(state.pack.companionAutoEnable) daiMeta.auto_enable=true;
    if(String(state.pack.companionId||"").trim()) daiMeta.companion_id=String(state.pack.companionId).trim();
    if(Object.keys(daiMeta).length) meta.dai=daiMeta; else delete meta.dai;
    files["pack.mcmeta"]=JSON.stringify(meta,null,2)+"\n";
    if(state.packIcon) files["pack.png"]=state.packIcon;
    Object.entries(state.resourceFiles||{}).forEach(([path,data])=>{
      const clean=normalizeZipPath(path);
      if(clean && !(clean in files)) files[clean]=data;
    });
    Object.entries(state.extraFiles||{}).forEach(([path,data])=>{
      const clean=normalizeZipPath(path);
      if(clean && !(clean in files)) files[clean]=data;
    });
    return files;
  }

  const packMeta={pack:{description:state.pack.description,min_format:state.pack.minFormat,max_format:state.pack.maxFormat}};const daiMeta={};if(["main","addon"].includes(state.pack.role))daiMeta.role=state.pack.role;if(String(state.pack.packId||"").trim())daiMeta.pack_id=String(state.pack.packId).trim();if(String(state.pack.packVersion||"").trim())daiMeta.version=String(state.pack.packVersion).trim();if(Object.keys(daiMeta).length)packMeta.dai=daiMeta;files["pack.mcmeta"]=JSON.stringify(packMeta,null,2)+"\n";
  const n=state.pack.namespace;
  state.experiences.forEach(e=>files[`data/${n}/dai_experiences/${slug(e.id)}.json`]=JSON.stringify(experienceJson(e),null,2)+"\n");
  state.worldgens.forEach(w=>files[`data/${n}/dai_worldgen/${slug(w.id)}.json`]=JSON.stringify(worldgenJson(w),null,2)+"\n");
  state.objectives.forEach(o=>files[`data/${n}/objectives/definitions/${slug(o.id)}.json`]=JSON.stringify(objectiveJson(o),null,2)+"\n");
  state.titleScreens.forEach(t=>files[`data/${n}/dai_title_screens/${slug(t.id)}.json`]=JSON.stringify(titleScreenJson(t),null,2)+"\n");
  state.content.forEach(c=>{const folder=CONTENT_FOLDERS[c.type]||"dai_items";files[`data/${n}/${folder}/${slug(c.id)}.json`]=JSON.stringify(contentJson(c),null,2)+"\n";});
  state.menus.forEach(m=>{
    let path;
    if(m.type==="automation") path=`data/${n}/menus/actions/automation/${slug(m.id)}.json`;
    else if(m.type==="available") path=`data/${n}/menus/actions/available/${slug(m.id)}.json`;
    else path=`data/${n}/menus/actions/${slug(m.id)}.json`;
    files[path]=JSON.stringify(menuJson(m),null,2)+"\n";
  });
  state.reactions.forEach(r=>files[`data/${n}/reactions/${slug(r.id)}.json`]=JSON.stringify(reactionJson(r),null,2)+"\n");
  state.runtimeDefinitions.forEach(d=>{let body=String(d.json||"{}").trim();try{body=JSON.stringify(JSON.parse(body),null,2);}catch{}files[runtimeDefinitionPath(d)]=body+"\n";});
  state.groups.forEach(g=>files[`data/${n}/objectives/groups/${slug(g.id)}.json`]=JSON.stringify(groupJson(g),null,2)+"\n");
  state.recognition.forEach(r=>files[`data/${n}/objectives/recognition/${slug(r.id)}.json`]=JSON.stringify(recognitionJson(r),null,2)+"\n");

  Object.entries(state.extraFiles||{}).forEach(([path,data])=>{
    const clean=normalizeZipPath(path);
    if(clean && !(clean in files)) files[clean]=data;
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
    const b=p.value;const x={slot:b.slot,id:b.id,text:b.text,action:b.action};
    if(b.conditions?.length)x.conditions=b.conditions.map(cleanCondition);
    if(b.style?.enabled)x.style=menuJson({priority:0,buttons:[b]}).buttons[0].style;
    return x;
  }
  if(p.kind==="experience" && p.value)return experienceJson(p.value);
  if(p.kind==="worldgen" && p.value)return worldgenJson(p.value);
  if(p.kind==="universalFile" && p.value){const data=state.extraFiles[p.value];if(data==null)return {};try{return JSON.parse(decodeText(data));}catch{return {path:p.value,size:byteLengthOf(data),text:decodeText(data).slice(0,12000)};}}
  if(p.kind==="titleScreen" && p.value)return titleScreenJson(p.value);
  if(p.kind==="titleButton" && p.value)return p.value;
  if(p.kind==="content" && p.value)return contentJson(p.value);
  if(p.kind==="reaction" && p.value)return reactionJson(p.value);
  if(p.kind==="runtimeDefinition" && p.value){try{return JSON.parse(p.value.json);}catch{return {type:p.value.type,id:p.value.id,invalid_json:p.value.json};}}
  if(p.kind==="group" && p.value)return groupJson(p.value);
  if(p.kind==="recognition" && p.value)return recognitionJson(p.value);
  if(p.kind==="pack")return {pack:{description:state.pack.description,min_format:state.pack.minFormat,max_format:state.pack.maxFormat}};
  if(p.kind==="objectives")return state.objectives.map(o=>({id:fullId(o.id),definition:objectiveJson(o)}));
  if(p.kind==="menus")return state.menus.map(m=>({type:m.type,id:m.id,definition:menuJson(m)}));
  if(p.kind==="experiences")return state.experiences.map(e=>({id:fullId(e.id),definition:experienceJson(e)}));
  if(p.kind==="titles")return state.titleScreens.map(t=>({id:fullId(t.id),definition:titleScreenJson(t)}));
  if(p.kind==="content")return state.content.map(c=>({type:c.type,id:fullId(c.id),definition:contentJson(c)}));
  if(p.kind==="reactions")return state.reactions.map(r=>({id:fullId(r.id),definition:reactionJson(r)}));
  if(p.kind==="runtime")return state.runtimeDefinitions.map(d=>({type:d.type,id:d.id,path:runtimeDefinitionPath(d)}));
  if(p.kind==="groups")return state.groups.map(g=>({id:fullId(g.id),definition:groupJson(g)}));
  if(p.kind==="recognition")return state.recognition.map(r=>({id:fullId(r.id),definition:recognitionJson(r)}));
  if(state.kind==="resourcepack")return {
    kind:"resourcepack",pack:state.pack,
    resourceFiles:Object.keys(state.resourceFiles||{}).length,
    packIcon:Boolean(state.packIcon),passthroughFiles:Object.keys(state.extraFiles||{}).length
  };
  return {
    kind:"datapack",pack:state.pack,experiences:state.experiences.length,worldgens:state.worldgens.length,objectives:state.objectives.length,menus:state.menus.length,titleScreens:state.titleScreens.length,contentDefinitions:state.content.length,
    reactions:state.reactions.length,runtimeDefinitions:state.runtimeDefinitions.length,recognitionGroups:state.groups.length,
    recognitionDefinitions:state.recognition.length,
    passthroughFiles:Object.keys(state.extraFiles||{}).length
  };
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

let refreshFrame=0;
function refreshAllNow(){
  if(refreshFrame){cancelAnimationFrame(refreshFrame);refreshFrame=0;}
  renderExportTree();
  refreshPreview();
}
function refreshAll(){
  if(refreshFrame)return;
  refreshFrame=requestAnimationFrame(()=>{
    refreshFrame=0;
    renderExportTree();
    refreshPreview();
  });
}


function referenceEntries(){
  const actions=(catalog.actions||[]).map(x=>({
    kind:"action",id:x.id,category:x.category||"Uncategorized",purpose:x.purpose||"",
    meta:(x.params||[]).length?`params: ${(x.params||[]).join(", ")}`:"no parameters",
    searchable:[x.id,x.category,x.purpose,...(x.params||[])].join(" ").toLowerCase()
  }));
  const conditions=(catalog.conditions||[]).map(x=>({
    kind:"condition",scope:"general",id:x.id,category:x.category||"Uncategorized",purpose:x.purpose||"",
    valueType:x.valueType||"value",
    meta:(x.inputs||[]).length?`inputs: ${(x.inputs||[]).join(", ")}`:"no provider inputs",
    searchable:[x.id,x.category,x.purpose,x.valueType,...(x.inputs||[]),"general registry"].join(" ").toLowerCase()
  }));
  actions.forEach(x=>x.scope="general");
  const entityActions=(catalog.entityBehaviorActions||[]).map(x=>({
    kind:"action",scope:"entity behavior",id:x.id,category:x.category||"Native Entity AI",purpose:x.purpose||"",
    meta:"native entity behavior vocabulary",
    searchable:[x.id,x.category,x.purpose,"entity behavior ai"].join(" ").toLowerCase()
  }));
  const entityConditions=(catalog.entityBehaviorConditions||[]).map(x=>({
    kind:"condition",scope:"entity behavior",id:x.id,category:x.category||"Native Entity AI",purpose:x.purpose||"",
    valueType:x.valueType||"value",meta:"native entity behavior predicate",
    searchable:[x.id,x.category,x.purpose,x.valueType,"entity behavior predicate ai"].join(" ").toLowerCase()
  }));
  return [...actions,...conditions,...entityActions,...entityConditions];
}
const REFERENCE_ENTRIES=referenceEntries();

function setupReferenceCategories(){
  const select=$("#referenceCategory");
  if(!select || select.dataset.ready)return;
  const categories=[...new Set(REFERENCE_ENTRIES.map(x=>x.category))].sort((a,b)=>a.localeCompare(b));
  select.innerHTML='<option value="">All categories</option>'+categories.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
  select.dataset.ready="true";
}

function renderReferenceLibrary(){
  const root=$("#referenceList");
  if(!root)return;
  setupReferenceCategories();
  const q=($("#referenceSearch")?.value||"").trim().toLowerCase();
  const kind=$("#referenceKind")?.value||"all";
  const category=$("#referenceCategory")?.value||"";
  const matches=REFERENCE_ENTRIES.filter(x=>
    (kind==="all"||x.kind===kind) &&
    (!category||x.category===category) &&
    (!q||x.searchable.includes(q))
  );
  const count=$("#referenceCount");
  if(count)count.textContent=`${matches.length} match${matches.length===1?"":"es"}`;
  if(!matches.length){
    root.innerHTML='<div class="empty">No capabilities match that search. Try a broader gameplay word or clear the category filter.</div>';
    return;
  }
  root.innerHTML=matches.map(x=>{
    const operatorHint=x.kind==="condition" && x.valueType
      ? `<span class="reference-type">${esc(x.valueType)}</span>`:"";
    return `<article class="reference-card">
      <div class="reference-card-head"><span class="reference-kind ${x.kind}">${x.kind}</span><span class="reference-scope ${x.scope==="entity behavior"?"entity":"general"}">${esc(x.scope||"general")}</span>${operatorHint}<code>${esc(x.id)}</code></div>
      <strong>${esc(x.category)}</strong>
      <p>${esc(x.purpose||"No description available.")}</p>
      <small>${esc(x.meta)}</small>
    </article>`;
  }).join("");
}

["referenceSearch","referenceKind","referenceCategory"].forEach(id=>{
  const el=$("#"+id);
  if(el){
    const evt=el.tagName==="INPUT"?"input":"change";
    el.addEventListener(evt,renderReferenceLibrary);
  }
});

function renderAll(){
  state.kind ||= "datapack";
  state.titleScreens ||= [];
  state.experiences ||= [];
  state.experiences.forEach(e=>{e.uiOpenAction??="";e.uiCloseAction??="";e.uiAnchorOverlay??="";e.uiGraveMenu??="";e.uiGraveMenuOpen??="";e.brandingJson??="{}";e.controlAutomation??=true;e.controlMovement??=true;e.controlCombat??=true;e.controlWorldEditing??=true;e.controlMaxActions??=0;e.controlMaxQueue??=0;});
  state.worldgens ||= [];
  state.content ||= [];
  state.content.forEach(c=>{c.nativeComponents??="{}";c.block??="{}";c.projectile??="{}";c.particle??="{}";c.effect??="{}";c.potion??="{}";c.entity??="{}";});
  state.reactions ||= [];
  state.runtimeDefinitions ||= [];
  state.groups ||= [];
  state.recognition ||= [];
  state.resourceFiles ||= {};
  state.packIcon ||= null;
  state.resourceMcmeta ||= null;
  state.extraFiles ||= {};
  state.pack.resourceFormat ??= 48;
  state.pack.role ??= "auto";
  state.pack.packId ??= "";
  state.pack.packVersion ??= "";
  loadPackInputs();
  updateModeUi();
  renderObjectives();
  renderMenus();
  renderExperiences();
  renderTitleScreens();
  renderContent();
  renderReactions();
  renderRuntimeDefinitions();
  renderGroups();
  renderRecognition();
  renderResourceFiles();
  renderUniversalFiles();
  renderDashboard();
  renderReferenceLibrary();
  refreshAll();
  const count=Object.keys(state.extraFiles||{}).length;
  const summary=$("#importSummary");
  if(count){
    summary.hidden=false;
    summary.textContent=`Imported project contains ${count} passthrough file(s) not owned by the visual editor. They will be preserved on export unless replaced by a managed file path.`;
  } else summary.hidden=true;
}

function renderResourceFiles(){
  const root=$("#resourceFileList");
  if(!root)return;
  root.innerHTML="";
  const entries=Object.entries(state.resourceFiles||{}).sort(([a],[b])=>a.localeCompare(b));
  if(!entries.length){
    root.innerHTML='<div class="empty">No resource files yet. Add PNG textures or any other files used by the resource pack.</div>';
  } else {
    entries.forEach(([path,data])=>{
      const card=document.createElement("div");
      card.className="item-card resource-file-card";
      card.innerHTML=`<div class="item-head"><strong>${esc(path)}</strong><button class="btn small danger" type="button" data-remove-resource>Remove</button></div>
      <div class="item-body">
        <div class="field full"><label>ZIP Path</label><input class="resource-file-path" data-resource-path value="${esc(path)}"><span class="help">For textures use assets/${esc(state.pack.namespace)}/textures/... .png</span></div>
        <div class="resource-meta">${humanBytes(byteLengthOf(data))}</div>
      </div>`;
      card.querySelector("[data-remove-resource]").onclick=()=>{
        delete state.resourceFiles[path];
        renderResourceFiles();refreshAll();
      };
      card.querySelector("[data-resource-path]").onchange=e=>{
        const next=normalizeZipPath(e.target.value);
        if(!validZipPath(next)){
          alert("That resource ZIP path is invalid. Paths cannot be empty or contain '..'.");
          e.target.value=path;return;
        }
        if(next!==path && Object.prototype.hasOwnProperty.call(state.resourceFiles,next)){
          alert(`A resource file already exists at '${next}'.`);e.target.value=path;return;
        }
        if(next!==path){state.resourceFiles[next]=data;delete state.resourceFiles[path];renderResourceFiles();refreshAll();}
      };
      root.appendChild(card);
    });
  }
  const icon=$("#packIconStatus");
  if(icon)icon.textContent=state.packIcon?`pack.png selected · ${humanBytes(byteLengthOf(state.packIcon))}`:"No pack.png selected.";
  const remove=$("#removePackIcon");if(remove)remove.disabled=!state.packIcon;
}

async function addResourceFileObjects(fileList,fromFolder=false){
  if(state.kind!=="resourcepack")return;
  readPackInputs();
  for(const f of fileList){
    let rel=fromFolder?(f.webkitRelativePath||f.name):f.name;
    if(fromFolder){
      const parts=rel.split("/");
      if(parts.length>1 && ["assets","pack.mcmeta","pack.png"].includes(parts[1]))rel=parts.slice(1).join("/");
    }
    rel=normalizeZipPath(rel);
    let path;
    if(rel==="pack.mcmeta")continue;
    if(rel==="pack.png"){
      state.packIcon=new Uint8Array(await f.arrayBuffer());continue;
    }
    if(rel.startsWith("assets/"))path=rel;
    else if(fromFolder && /^(textures|models|font|sounds|atlases|lang|shaders|particles|equipment|items)\//.test(rel))path=`assets/${state.pack.namespace}/${rel}`;
    else path=`assets/${state.pack.namespace}/textures/${rel}`;
    path=normalizeZipPath(path);
    state.resourceFiles[path]=new Uint8Array(await f.arrayBuffer());
  }
  renderResourceFiles();refreshAll();
}

$("#addResourceFiles").onchange=async e=>{await addResourceFileObjects(e.target.files,false);e.target.value="";};
$("#addResourceFolder").onchange=async e=>{await addResourceFileObjects(e.target.files,true);e.target.value="";};
$("#setPackIcon").onchange=async e=>{const f=e.target.files[0];if(f){state.packIcon=new Uint8Array(await f.arrayBuffer());renderResourceFiles();refreshAll();}e.target.value="";};
$("#removePackIcon").onclick=()=>{state.packIcon=null;renderResourceFiles();refreshAll();};

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
function validColor(v){return /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(String(v||""));}
function validResourceId(v){return /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(String(v||""));}

function validateOverlay(s,path,issues,objectiveIds,animated=false){
  if(!s || typeof s!=="object"){issues.push({level:"err",message:`${path}: overlay object is missing.`});return;}
  if(!String(s.id||"").trim())issues.push({level:"err",message:`${path}: overlay id is required.`});
  if(!validResourceId(s.texture))issues.push({level:"err",message:`${path}: texture '${s.texture||""}' is not a valid resource ID.`});
  if(!(catalog.overlayAnchors||[]).includes(s.anchor))issues.push({level:"err",message:`${path}: unknown anchor '${s.anchor}'.`});
  if(Number(s.width)<=0 || Number(s.height)<=0)issues.push({level:"err",message:`${path}: width and height must be > 0.`});
  if(Number(s.alpha)<0.1 || Number(s.alpha)>1)issues.push({level:"err",message:`${path}: alpha must be between 0.1 and 1.0.`});
  if(!validColor(s.color))issues.push({level:"err",message:`${path}: color must be #RRGGBB or #AARRGGBB.`});
  if(Number(s.ticks)<0)issues.push({level:"err",message:`${path}: ticks cannot be negative.`});
  if(!Number.isFinite(Number(s.z)))issues.push({level:"err",message:`${path}: z must be numeric.`});
  if(s.interactable && !String(s.click_action||"").trim())issues.push({level:"err",message:`${path}: interactable=true requires click_action.`});
  if(String(s.click_action||"").startsWith(state.pack.namespace+":")){
    const local=String(s.click_action).slice(state.pack.namespace.length+1);
    if(!objectiveIds.has(local))issues.push({level:"err",message:`${path}: click_action '${s.click_action}' references a missing local objective.`});
  }
  if(animated){
    const a=s.animation||{};
    for(const k of ["frame_width","frame_height","frame_count","columns","frame_ticks"]){
      if(Number(a[k])<=0)issues.push({level:"err",message:`${path}.animation.${k} must be > 0.`});
    }
  }
}

function validateAction(a,path,issues,objectiveIds){
  if(!a.type)issues.push({level:"err",message:`${path}: action type is missing.`});
  if(!actionMap.has(a.type))issues.push({level:"warn",message:`${path}: unknown/imported action type '${a.type}' is preserved but cannot be fully validated by this DAI 3.0 creator catalog.`});

  const needsAction=["enqueue_action","run_if_success","run_if_failure","objective_execute","recognize_block","run_command","run_server_command","server_run_function","server_set_block","server_give_item","server_take_item","set_gamemode","key_click","key_press","key_release","remember_waypoint","remember_target_waypoint","select_waypoint","forget_waypoint","forget_failed_waypoint","craft_recipe","overlay_remove"];
  if(needsAction.includes(a.type) && !String(a.action||"").trim())issues.push({level:"err",message:`${path}: '${a.type}' requires an action/string payload.`});
  if(a.type==="move" && !String(a.direction||"").trim())issues.push({level:"err",message:`${path}: move requires direction.`});
  if(a.type==="delay" && Number(a.ticks)<=0)issues.push({level:"err",message:`${path}: delay must use ticks > 0.`});
  if(a.type==="update_menu" && (!a.menu || !a.open))issues.push({level:"err",message:`${path}: update_menu requires both menu and open.`});
  if(["server_set_block","server_break_block"].includes(a.type) && !String(a.target||"").trim())issues.push({level:"err",message:`${path}: '${a.type}' requires target coordinates.`});
  if(["server_give_item","server_take_item"].includes(a.type) && Number(a.value)<=0)issues.push({level:"err",message:`${path}: '${a.type}' requires value > 0 for item count.`});
  if(a.type==="overlay_sprite")validateOverlay(a.sprite,`${path}.sprite`,issues,objectiveIds,false);
  if(a.type==="overlay_sprite_sheet")validateOverlay(a.sprite_sheet,`${path}.sprite_sheet`,issues,objectiveIds,true);

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

  if(state.kind==="resourcepack"){
    if(!Number.isFinite(Number(state.pack.resourceFormat)) || Number(state.pack.resourceFormat)<1)issues.push({level:"err",message:"Resource pack format must be a positive number."});
    const entries=Object.entries(state.resourceFiles||{});
    if(!entries.length)issues.push({level:"warn",message:"Resource pack contains no files under assets/."});
    entries.forEach(([path])=>{
      const clean=normalizeZipPath(path);
      if(!validZipPath(clean))issues.push({level:"err",message:`Resource file has invalid ZIP path '${path}'.`});
      else if(!clean.startsWith("assets/"))issues.push({level:"warn",message:`Resource file '${clean}' is outside assets/. It will still be preserved.`});
      const m=clean.match(/^assets\/([^/]+)\//);
      if(m && !validNamespace(m[1]))issues.push({level:"err",message:`Resource file '${clean}' uses invalid namespace '${m[1]}'.`});
      if(/[A-Z]/.test(clean))issues.push({level:"warn",message:`Resource path '${clean}' contains uppercase letters; Minecraft resource locations are normally lowercase.`});
    });
    Object.entries(state.extraFiles||{}).forEach(([path,data])=>{if(!validZipPath(path))issues.push({level:"err",message:`Universal file has invalid ZIP path '${path}'.`});if(path.toLowerCase().endsWith('.json')&&fileIsProbablyText(path,data)){try{JSON.parse(decodeText(data));}catch(e){issues.push({level:"err",message:`Universal JSON '${path}' is invalid: ${e.message}`});}}});
    if(!issues.length)issues.push({level:"ok",message:"No errors or warnings found. Resource pack is ready to export."});
    return issues;
  }

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
  duplicates(state.reactions,"reaction ID");
  duplicates(state.runtimeDefinitions,"runtime definition path",d=>`${d.type}:${d.id}`);
  duplicates(state.titleScreens,"title screen ID");
  duplicates(state.content,"content registry ID",c=>`${c.type}:${c.id}`);
  duplicates(state.menus,"menu path",m=>`${m.type}:${m.id}`);

  state.runtimeDefinitions.forEach((d,di)=>{
    const spec=RUNTIME_DEFINITION_TYPES[d.type];
    if(!spec)issues.push({level:"err",message:`Runtime definition ${di+1} has unknown type '${d.type}'.`});
    if(!validLocalPath(d.id))issues.push({level:"err",message:`Runtime definition ${di+1} has invalid ID/path '${d.id}'.`});
    try{const parsed=JSON.parse(String(d.json||"{}"));if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))issues.push({level:"warn",message:`Runtime definition '${d.id}' is valid JSON but is not an object.`});else if(spec?.customization){
      if(spec.carrierResourceId && String(parsed.carrier||"").trim() && !validResourceId(parsed.carrier))issues.push({level:"err",message:`Customization '${d.id}' carrier '${parsed.carrier}' is not a valid resource ID.`});
      for(const key of ["properties","events"]){if(key in parsed && (!parsed[key]||typeof parsed[key]!=="object"||Array.isArray(parsed[key])||Object.values(parsed[key]).some(v=>typeof v!=="string")))issues.push({level:"err",message:`Customization '${d.id}' ${key} must be an object of string values.`});}
      if("numbers" in parsed && (!parsed.numbers||typeof parsed.numbers!=="object"||Array.isArray(parsed.numbers)||Object.values(parsed.numbers).some(v=>typeof v!=="number"||!Number.isFinite(v))))issues.push({level:"err",message:`Customization '${d.id}' numbers must be an object of finite numbers.`});
      if("flags" in parsed && (!parsed.flags||typeof parsed.flags!=="object"||Array.isArray(parsed.flags)||Object.values(parsed.flags).some(v=>typeof v!=="boolean")))issues.push({level:"err",message:`Customization '${d.id}' flags must be an object of booleans.`});
      for(const key of ["tags","entries"]){if(key in parsed && (!Array.isArray(parsed[key])||parsed[key].some(v=>typeof v!=="string")))issues.push({level:"err",message:`Customization '${d.id}' ${key} must be an array of strings.`});}
      if(String(parsed.sequence||"").trim() && !validResourceId(String(parsed.sequence).replace(/^action:/,"")))issues.push({level:"warn",message:`Customization '${d.id}' sequence '${parsed.sequence}' does not look like a namespaced DAI action ID.`});
    }}
    catch(e){issues.push({level:"err",message:`Runtime definition '${d.id}' contains invalid JSON: ${e.message}`});}
  });

  state.titleScreens.forEach((t,ti)=>{
    if(!validLocalPath(t.id))issues.push({level:"err",message:`Title screen ${ti+1} has invalid ID/path '${t.id}'.`});
    for(const [name,value] of [["background.top",t.backgroundTop],["background.bottom",t.backgroundBottom],["title_color",t.titleColor],["subtitle_color",t.subtitleColor]])if(!validColor(value))issues.push({level:"err",message:`Title screen '${t.id}' ${name} must be #RRGGBB or #AARRGGBB.`});
    duplicates(t.buttons,`button ID in title screen '${t.id}'`,b=>b.id);
    t.buttons.forEach((b,bi)=>{if(!b.id)issues.push({level:"err",message:`Title screen '${t.id}' button ${bi+1} is missing id.`});if(!b.label)issues.push({level:"warn",message:`Title screen '${t.id}' button '${b.id}' has no label.`});if(!["open_singleplayer","open_multiplayer","open_official_packs","open_mods","open_options","open_url","quit"].includes(b.action))issues.push({level:"err",message:`Title screen '${t.id}' button '${b.id}' has unknown action '${b.action}'.`});if(b.action==="open_url"&&!String(b.url||"").trim())issues.push({level:"err",message:`Title screen '${t.id}' button '${b.id}' open_url requires url.`});if(b.iconType==="item"&&!validResourceId(b.iconId))issues.push({level:"err",message:`Title screen '${t.id}' button '${b.id}' has invalid item icon '${b.iconId}'.`});if(!["none","spin","bob","pulse","orbit"].includes(b.animation))issues.push({level:"err",message:`Title screen '${t.id}' button '${b.id}' has unknown hover animation '${b.animation}'.`});for(const [name,value] of [["background",b.background],["hover",b.hover],["border",b.border],["text",b.text]])if(!validColor(value))issues.push({level:"err",message:`Title screen '${t.id}' button '${b.id}' style.${name} is invalid.`});});
  });
  state.content.forEach((c,ci)=>{
    if(!CONTENT_FOLDERS[c.type])issues.push({level:"err",message:`Content ${ci+1} has unknown type '${c.type}'.`});
    if(!validLocalPath(c.id))issues.push({level:"err",message:`Content ${ci+1} has invalid ID/path '${c.id}'.`});
    if(!validResourceId(c.carrier))issues.push({level:"err",message:`Content '${c.id}' has invalid carrier '${c.carrier}'.`});
    if(!validResourceId(c.model))issues.push({level:"err",message:`Content '${c.id}' has invalid model alias '${c.model}'.`});
    if(c.registryBacked && !["item","block","entity"].includes(c.nativeRegistry))issues.push({level:"err",message:`Content '${c.id}' native_registry must be item, block, or entity.`});
    if(c.type==="block"&&c.registryBacked&&c.nativeRegistry!=="block")issues.push({level:"warn",message:`Registry-backed block '${c.id}' normally uses native_registry=block.`});
    for(const [label,value] of [["attributes",c.attributes],["native_attributes",c.nativeAttributes],["components",c.nativeComponents],["events",c.events],["stats",c.stats],["entity",c.entity]]){try{const x=JSON.parse(String(value||"{}"));if(!x||typeof x!=="object"||Array.isArray(x))throw new Error();}catch{issues.push({level:"err",message:`Content '${c.id}' ${label} must be a JSON object.`});}}
  });

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
      if(b.style?.enabled){
        const present=["background","hover","selected","text","border"].filter(k=>String(b.style[k]||"").trim());
        if(!present.length)issues.push({level:"warn",message:`Menu '${m.id}' button '${b.id}' enables custom style but supplies no colors.`});
        present.forEach(k=>{if(!validColor(b.style[k]))issues.push({level:"err",message:`Menu '${m.id}' button '${b.id}' style.${k} must be #RRGGBB or #AARRGGBB.`});});
      }
      (b.conditions||[]).forEach((c,i)=>validateCondition(c,`menu '${m.id}' button '${b.id}' condition[${i}]`,issues));
    });
  });

  state.reactions.forEach((r,ri)=>{
    if(!validLocalPath(r.id))issues.push({level:"err",message:`Reaction ${ri+1} has invalid ID/path '${r.id}'.`});
    if(!["default","override","cancel"].includes(r.type))issues.push({level:"err",message:`Reaction '${r.id}' has unknown type '${r.type}'.`});
    const ev=reactionEventSpecs().find(e=>e.id===r.event);
    if(!ev)issues.push({level:"err",message:`Reaction '${r.id}' references unknown event '${r.event}'.`});
    if(!["pre","during","post"].includes(r.phase))issues.push({level:"err",message:`Reaction '${r.id}' has invalid phase '${r.phase}'.`});
    if(ev && !ev.phases.includes(r.phase))issues.push({level:"err",message:`Reaction '${r.id}' event '${r.event}' does not support phase '${r.phase}'.`});
    if(Number(r.priority)<0)issues.push({level:"err",message:`Reaction '${r.id}' priority cannot be negative.`});
    if(r.phase==="post" && r.type!=="default")issues.push({level:"err",message:`Reaction '${r.id}': post reactions must use type=default because the event has already completed.`});
    if(ev && r.type==="cancel" && !ev.cancellable)issues.push({level:"err",message:`Reaction '${r.id}': event '${r.event}' is not cancellable.`});
    if(ev && r.type==="override" && !ev.overrideable)issues.push({level:"err",message:`Reaction '${r.id}': event '${r.event}' is not overrideable.`});
    (r.conditions||[]).forEach((c,i)=>validateCondition(c,`reaction '${r.id}' condition[${i}]`,issues));
    (r.sequence||[]).forEach((a,i)=>validateAction(a,`reaction '${r.id}' sequence[${i}]`,issues,objectiveIds));
    if(!(r.sequence||[]).length)issues.push({level:"warn",message:`Reaction '${r.id}' has an empty sequence.`});
  });

  const localGroupIds=new Set(state.groups.map(g=>`${state.pack.namespace}:${slug(g.id)}`));
  state.groups.forEach(g=>{
    if(!validLocalPath(g.id))issues.push({level:"err",message:`Recognition group has invalid ID/path '${g.id}'.`});
    if(!g.entries.length)issues.push({level:"warn",message:`Recognition group '${g.id}' has no entries.`});
    g.entries.forEach(x=>{if(!validResourceId(x))issues.push({level:"warn",message:`Recognition group '${g.id}' entry '${x}' does not look like a resource ID.`});});
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
    });
    if(!validResourceId(r.resultId||""))issues.push({level:"err",message:`Recognition '${r.id}' result ID '${r.resultId}' is invalid.`});
  });

  state.experiences.forEach(e=>{if(!validLocalPath(e.id))issues.push({level:"err",message:`Experience has invalid ID/path '${e.id}'.`});try{const b=JSON.parse(String(e.brandingJson||"{}"));if(!b||typeof b!=="object"||Array.isArray(b))throw new Error("branding must be an object");}catch(err){issues.push({level:"err",message:`Experience '${e.id}' branding JSON is invalid: ${err.message}`});}if(e.worldgen&&String(e.worldgen).startsWith(state.pack.namespace+":")&&!state.worldgens.some(w=>fullId(w.id)===e.worldgen))issues.push({level:"warn",message:`Experience '${e.id}' references local worldgen '${e.worldgen}' that is not in the visual Worldgen editor (it may exist as a Universal File).`});for(const [label,value] of [["grave open action",e.uiOpenAction],["grave close action",e.uiCloseAction]])if(String(value||"").trim()&&!validResourceId(String(value).trim()))issues.push({level:"warn",message:`Experience '${e.id}' has ${label} '${value}' that is not a namespaced resource ID.`});});
  state.worldgens.forEach(w=>{if(!validLocalPath(w.id))issues.push({level:"err",message:`Worldgen has invalid ID/path '${w.id}'.`});try{const x=JSON.parse(String(w.initialStructures||"[]"));if(!Array.isArray(x))throw new Error('must be an array');}catch(e){issues.push({level:"err",message:`Worldgen '${w.id}' initial structures JSON is invalid: ${e.message}`});}});
  Object.entries(state.extraFiles||{}).forEach(([path,data])=>{if(!validZipPath(path))issues.push({level:"err",message:`Universal file has invalid ZIP path '${path}'.`});if(path.toLowerCase().endsWith('.json')&&fileIsProbablyText(path,data)){try{JSON.parse(decodeText(data));}catch(e){issues.push({level:"err",message:`Universal JSON '${path}' is invalid: ${e.message}`});}}});
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
  Object.entries(files).forEach(([name,value])=>{
    const nb=enc.encode(name);
    const data=value instanceof Uint8Array ? value : value instanceof ArrayBuffer ? new Uint8Array(value) : enc.encode(String(value??""));
    const crc=crc32(data),flags=0x0800;
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
    out[name.replace(/^\.?\//,"")]=raw;
  }
  return out;
}

function normalizedImportedAction(raw){
  if(!raw || typeof raw!=="object")return blankAction();
  const a=blankAction(raw.type||"delay");
  const known=new Set(["type","action","menu","open","yaw","pitch","direction","ticks","slot","state","value","target","conditions","sequence","sprite","sprite_sheet"]);
  for(const k of ["action","menu","open","yaw","pitch","direction","ticks","slot","state","value","target"])if(k in raw)a[k]=raw[k];
  a.conditions=(raw.conditions||[]).map(normalizedImportedCondition);
  a.sequence=(raw.sequence||[]).map(normalizedImportedAction);
  if(raw.sprite && typeof raw.sprite==="object")a.sprite={...blankSprite(),...deep(raw.sprite)};
  if(raw.sprite_sheet && typeof raw.sprite_sheet==="object"){
    a.sprite_sheet={...blankSpriteSheet(),...deep(raw.sprite_sheet)};
    a.sprite_sheet.animation={...blankSpriteSheet().animation,...deep(raw.sprite_sheet.animation||{})};
  }
  const extra={};Object.keys(raw).forEach(k=>{if(!known.has(k))extra[k]=raw[k];});if(Object.keys(extra).length)a._extra=extra;
  return a;
}
function normalizedImportedCondition(raw){
  const c=blankCondition(raw?.type||"all");
  const known=new Set(["type","operator","boolean_value","number_value","string_value","negate","target","parameter","parameter_number","conditions"]);
  for(const k of ["operator","boolean_value","number_value","string_value","negate","target","parameter","parameter_number"])if(k in (raw||{}))c[k]=raw[k];
  c.conditions=(raw?.conditions||[]).map(normalizedImportedCondition);
  const extra={};Object.keys(raw||{}).forEach(k=>{if(!known.has(k))extra[k]=raw[k];});if(Object.keys(extra).length)c._extra=extra;
  return c;
}
function normalizedImportedButton(b){
  return {
    _id:uid(),slot:Number(b.slot||0),id:b.id||"",text:b.text||"",action:b.action||"",
    conditions:(b.conditions||[]).map(normalizedImportedCondition),
    style:{
      enabled:Boolean(b.style),
      background:b.style?.background||"",hover:b.style?.hover||"",
      selected:b.style?.selected||"",text:b.style?.text||"",border:b.style?.border||""
    }
  };
}

function parseJson(text,path,errors){
  try{return JSON.parse(decodeText(text));}catch(e){errors.push(`${path}: ${e.message}`);return null;}
}

function importFiles(files,sourceLabel="datapack"){
  const errors=[],next=freshState(),managed=new Set();
  const mc=files["pack.mcmeta"]?parseJson(files["pack.mcmeta"],"pack.mcmeta",errors):null;
  if(mc?.pack){
    next.pack.description=mc.pack.description??next.pack.description;
    next.pack.minFormat=mc.pack.min_format??next.pack.minFormat;
    next.pack.maxFormat=mc.pack.max_format??next.pack.maxFormat;
    next.pack.role=["main","addon"].includes(mc.dai?.role)?mc.dai.role:"auto";
    next.pack.packId=String(mc.dai?.pack_id??mc.dai?.packId??mc.dai?.identity??mc.dai?.id??mc.dai?.project_id??mc.dai?.projectId??"");
    next.pack.packVersion=String(mc.dai?.version??mc.dai?.pack_version??mc.dai?.packVersion??"");
    managed.add("pack.mcmeta");
  }

  const counts={};
  Object.keys(files).forEach(path=>{
    const m=path.match(/^data\/([^/]+)\/(dai_experiences\/|dai_worldgen\/|objectives\/(definitions|groups|recognition)\/|menus\/actions\/|reactions\/|reaction_events\/|screen_profiles\/|dai_[a-z0-9_]+\/)/);
    if(m)counts[m[1]]=(counts[m[1]]||0)+1;
  });
  const chosen=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(chosen)next.pack.namespace=chosen;

  const n=next.pack.namespace.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const experienceRe=new RegExp(`^data/${n}/dai_experiences/(.+)\\.json$`);
  const worldgenRe=new RegExp(`^data/${n}/dai_worldgen/(.+)\\.json$`);
  const objectiveRe=new RegExp(`^data/${n}/objectives/definitions/(.+)\\.json$`);
  const groupRe=new RegExp(`^data/${n}/objectives/groups/(.+)\\.json$`);
  const recogRe=new RegExp(`^data/${n}/objectives/recognition/(.+)\\.json$`);
  const menuRe=new RegExp(`^data/${n}/menus/actions/(.+)\\.json$`);
  const reactionRe=new RegExp(`^data/${n}/reactions/(.+)\\.json$`);
  const runtimeRe=new RegExp(`^data/${n}/(dai_recipes|reaction_events|screen_profiles|dai_attributes|dai_animations|dai_sounds|dai_music|dai_hud|dai_render_profiles|dai_structures|dai_features|dai_loot|dai_currencies|dai_shops|dai_dialogues|dai_quests|dai_factions|dai_biomes|dai_dimension_types|dai_timelines|dai_dimensions|dai_registry|dai_data|dai_rules|dai_vehicles|dai_portals|dai_interactives|dai_fluids|dai_environments)/(.+)\\.json$`);
  const titleRe=new RegExp(`^data/${n}/dai_title_screens/(.+)\\.json$`);
  const contentRe=new RegExp(`^data/${n}/(dai_items|dai_blocks|dai_weapons|dai_armor|dai_effects|dai_potions|dai_projectiles|dai_particles|dai_enchantments|dai_entities)/(.+)\\.json$`);

  Object.entries(files).forEach(([path,text])=>{
    let m;
    if((m=path.match(experienceRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      const ui=raw.ui||{},controls=raw.controls||{};next.experiences.push({_id:uid(),id:m[1],enabled:raw.enabled!==false,priority:Number(raw.priority||0),saveId:raw.save_id||"",saveName:raw.save_name||"",createIfMissing:raw.create_if_missing!==false,loadIfExisting:raw.load_if_existing!==false,autoCreate:raw.auto_create!==false,worldgen:raw.worldgen||"",onFirstJoin:raw.on_first_join||"",onJoin:raw.on_join||"",uiAutoEnable:ui.auto_enable!==false,uiGraveCursor:ui.grave_cursor_toggle!==false,uiOpenMenu:Boolean(ui.open_dai_menu_on_grave),uiOpenAction:ui.grave_open_action||"",uiCloseAction:ui.grave_close_action||"",uiAnchorOverlay:ui.grave_anchor_overlay||"",uiGraveMenu:ui.grave_menu||"",uiGraveMenuOpen:ui.grave_menu_open||"",brandingJson:JSON.stringify(raw.branding||{},null,2),controlAutomation:controls.automation!==false,controlMovement:controls.automation_movement!==false,controlCombat:controls.automation_combat!==false,controlWorldEditing:controls.automation_world_editing!==false,controlMaxActions:Number(controls.max_actions_per_second||0),controlMaxQueue:Number(controls.max_action_queue_size||0)});managed.add(path);return;
    }
    if((m=path.match(worldgenRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;const sp=raw.spawn||{};
      const wt=typeof raw.world_type==="string"?{type:raw.world_type}:((raw.world_type&&typeof raw.world_type==="object")?raw.world_type:{});next.worldgens.push({_id:uid(),id:m[1],enabled:raw.enabled!==false,worldPreset:raw.world_preset||"",worldType:wt.type||(!raw.world_preset?"normal":"normal"),biome:wt.biome||"minecraft:plains",noiseSettings:wt.noise_settings||"minecraft:overworld",layers:JSON.stringify(wt.layers||[{block:"minecraft:bedrock",height:1},{block:"minecraft:dirt",height:2},{block:"minecraft:grass_block",height:1}],null,2),waterDepth:Number(wt.water_depth??60),floorBlock:wt.floor_block||"minecraft:bedrock",floorHeight:Number(wt.floor_height??1),surfaceBlock:wt.surface_block||"minecraft:sand",surfaceHeight:Number(wt.surface_height??1),waterBlock:wt.water_block||"minecraft:water",features:wt.features!==false,lakes:wt.lakes!==false,structures:wt.structures!==false,includeNether:wt.include_nether!==false,includeEnd:wt.include_end!==false,seed:raw.seed??"",spawnX:Number(sp.x||0),spawnY:Number(sp.y??64),spawnZ:Number(sp.z||0),spawnYaw:Number(sp.yaw||0),spawnPitch:Number(sp.pitch||0),generationCommands:(raw.generation_commands||[]).join("\n"),initialStructures:JSON.stringify(raw.initial_structures||[],null,2),bootstrapActions:(raw.bootstrap_actions||[]).join("\n")});managed.add(path);return;
    }
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

    if((m=path.match(titleRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      const t={_id:uid(),id:m[1],enabled:raw.enabled!==false,priority:Number(raw.priority||0),title:raw.title||"",subtitle:raw.subtitle||"",backgroundTop:raw.background?.top||"#FF061018",backgroundBottom:raw.background?.bottom||"#FF142A38",titleColor:raw.title_color||"#FFFFFFFF",subtitleColor:raw.subtitle_color||"#FFAAAAAA",buttons:(raw.buttons||[]).map(b=>({_id:uid(),id:b.id||"",label:b.label||"",action:b.action||"",url:b.url||"",anchor:b.anchor||"center",x:Number(b.x||0),y:Number(b.y||0),width:Number(b.width||230),height:Number(b.height||24),iconType:b.icon?.type||"item",iconId:b.icon?.id||"minecraft:carrot",iconScale:Number(b.icon?.scale??1),iconOffsetX:Number(b.icon?.offset_x||0),background:b.style?.background||"#B8182A32",hover:b.style?.hover||"#E02F5A43",border:b.style?.border||"#FF5E9770",text:b.style?.text||"#FFFFFFFF",animation:b.hover_animation?.type||"none",animationSpeed:Number(b.hover_animation?.speed??1),animationAmount:Number(b.hover_animation?.amount??1)}))};
      next.titleScreens.push(t);managed.add(path);return;
    }
    if((m=path.match(contentRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      const type=Object.entries(CONTENT_FOLDERS).find(([,folder])=>folder===m[1])?.[0]||"item";
      next.content.push({_id:uid(),type,id:m[2],carrier:raw.carrier||"",displayName:raw.display_name||"",description:raw.description||"",model:raw.model||"",registryBacked:Boolean(raw.registry_backed),nativeRegistry:raw.native_registry||((type==="block")?"block":(type==="entity"?"entity":"item")),slot:raw.slot||"",capabilities:(raw.capabilities||[]).join("\n"),tags:(raw.tags||[]).join("\n"),attributes:JSON.stringify(raw.attributes||{},null,2),nativeAttributes:JSON.stringify(raw.native_attributes||{},null,2),nativeComponents:JSON.stringify(raw.components||raw.native_components||{},null,2),events:JSON.stringify(raw.events||{},null,2),stats:JSON.stringify(raw.stats||{},null,2),block:JSON.stringify(raw.block||{},null,2),projectile:JSON.stringify(raw.projectile||{},null,2),particle:JSON.stringify(raw.particle||{},null,2),effect:JSON.stringify(raw.effect||{},null,2),potion:JSON.stringify(raw.potion||{},null,2),entity:JSON.stringify(raw.entity||{},null,2)});managed.add(path);return;
    }
    if((m=path.match(runtimeRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      const type=Object.entries(RUNTIME_DEFINITION_TYPES).find(([,spec])=>spec.folder===m[1])?.[0];
      if(type){next.runtimeDefinitions.push({_id:uid(),type,id:m[2],json:JSON.stringify(raw,null,2)});managed.add(path);return;}
    }
    if((m=path.match(reactionRe))){
      const raw=parseJson(text,path,errors);if(!raw)return;
      next.reactions.push({
        _id:uid(),id:m[1],type:raw.type||"default",event:raw.event||"",
        phase:raw.phase||"post",priority:Number(raw.priority||0),
        conditions:(raw.conditions||[]).map(normalizedImportedCondition),
        sequence:(raw.sequence||[]).map(normalizedImportedAction)
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
        buttons:(raw.buttons||[]).map(normalizedImportedButton)
      });managed.add(path);return;
    }
  });

  Object.entries(files).forEach(([path,text])=>{if(!managed.has(path))next.extraFiles[path]=text;});
  next.pack.name=sourceLabel.replace(/\.(zip|json)$/i,"") || "Imported DAI Pack";
  state=next;renderAll();
  selectedPreview={kind:"project"};refreshPreview();

  const summary=$("#importSummary");summary.hidden=false;
  summary.textContent=`Imported '${sourceLabel}'. Editable: ${state.experiences.length} experience(s), ${state.worldgens.length} worldgen profile(s), ${state.objectives.length} objective(s), ${state.menus.length} menu(s), ${state.titleScreens.length} title screen(s), ${state.content.length} content definition(s), ${state.reactions.length} reaction(s), ${state.runtimeDefinitions.length} runtime definition(s), ${state.groups.length} recognition group(s), ${state.recognition.length} recognition definition(s). Preserving ${Object.keys(state.extraFiles).length} passthrough file(s).${errors.length?` ${errors.length} JSON file(s) could not be parsed and remain passthrough.`:""}`;
  if(errors.length)alert("Import completed with JSON parse warnings:\n\n"+errors.slice(0,10).join("\n"));
}

function importResourcePackFiles(files,sourceLabel="resource_pack"){
  const errors=[],next=freshState("resourcepack");
  const mc=files["pack.mcmeta"]?parseJson(files["pack.mcmeta"],"pack.mcmeta",errors):null;
  if(mc && typeof mc==="object"){
    next.resourceMcmeta=mc;
    if(mc.pack){
      next.pack.description=mc.pack.description??"";
      next.pack.resourceFormat=Number(mc.pack.pack_format??48);
    }
    if(mc.dai && typeof mc.dai==="object"){
      next.pack.companionAutoEnable = mc.dai.auto_enable===true || mc.dai.autoEnable===true;
      next.pack.companionId = String(mc.dai.companion_id??mc.dai.companionId??"");
    }
  }

  const counts={};
  Object.keys(files).forEach(path=>{
    const m=normalizeZipPath(path).match(/^assets\/([^/]+)\//);
    if(m)counts[m[1]]=(counts[m[1]]||0)+1;
  });
  const chosen=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if(chosen)next.pack.namespace=chosen;

  Object.entries(files).forEach(([rawPath,data])=>{
    const path=normalizeZipPath(rawPath);
    if(path==="pack.mcmeta")return;
    if(path==="pack.png"){next.packIcon=data;return;}
    if(path.startsWith("assets/"))next.resourceFiles[path]=data;
    else next.extraFiles[path]=data;
  });

  next.pack.name=sourceLabel.replace(/\.zip$/i,"")||"Imported Resource Pack";
  state=next;selectedPreview={kind:"project"};renderAll();switchView("pack");showValidation([]);
  const summary=$("#importSummary");summary.hidden=false;
  summary.textContent=`Imported resource pack '${sourceLabel}'. Editable resource files: ${Object.keys(state.resourceFiles).length}. Preserving ${Object.keys(state.extraFiles).length} additional file(s).${errors.length?` ${errors.length} metadata warning(s) were found.`:""}`;
  if(errors.length)alert("Resource pack imported with metadata warnings:\n\n"+errors.slice(0,10).join("\n"));
}

$("#importZip").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const files=await readZip(f);importFiles(files,f.name);switchView("pack");showValidation([]);}
  catch(err){alert("Could not import datapack ZIP:\n"+err.message);}
  e.target.value="";
};
$("#importResourceZip").onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  try{const files=await readZip(f);importResourcePackFiles(files,f.name);}
  catch(err){alert("Could not import resource pack ZIP:\n"+err.message);}
  e.target.value="";
};
$("#importFolder").onchange=async e=>{
  const files={};
  for(const f of e.target.files){
    let path=f.webkitRelativePath||f.name;
    const parts=path.split("/");if(parts.length>1)path=parts.slice(1).join("/");
    files[path]=new Uint8Array(await f.arrayBuffer());
  }
  importFiles(files,e.target.files[0]?.webkitRelativePath?.split("/")[0]||"Imported Folder");
  switchView("pack");showValidation([]);e.target.value="";
};

$("#newProject").onclick=()=>{
  if(!confirm("Start a new datapack? Unsaved changes in the current pack will be cleared."))return;
  state=freshState("datapack");selectedPreview={kind:"project"};renderAll();switchView("pack");showValidation([]);
};
$("#newResourcePack").onclick=()=>{
  if(!confirm("Start a new resource pack? Unsaved changes in the current pack will be cleared."))return;
  state=freshState("resourcepack");
  state.pack.name="My Resource Pack";
  state.pack.description="A custom Minecraft resource pack for DAI Engine.";
  state.pack.companionAutoEnable=true;
  selectedPreview={kind:"project"};renderAll();switchView("pack");showValidation([]);
};

function exportPack(){
  const issues=validateProject();showValidation(issues);
  const errors=issues.filter(x=>x.level==="err");
  if(errors.length){
    const type=state.kind==="resourcepack"?"resource pack":"datapack";
    const sample=errors.slice(0,4).map(x=>`• ${x.message}`).join("\n");
    const more=errors.length>4?`\n• …and ${errors.length-4} more error(s).`:"";
    const ok=confirm(`Validation found ${errors.length} hard error(s). This ${type} is unconfirmed and may fail to load or behave incorrectly.\n\n${sample}${more}\n\nExport the ZIP anyway?`);
    if(!ok){switchView("validate");return;}
  }
  const files=generatedFiles();
  const blob=zipStore(files);
  const fallback=state.kind==="resourcepack"?"resource_pack":"dai_datapack";
  downloadBlob(blob,`${slug(state.pack.name,fallback)}.zip`);
}
$("#exportZip").onclick=exportPack;
$("#quickExport").onclick=exportPack;


// ---- DAI 3.0 Browser Gameplay Tester ------------------------------------
const tester={running:true,built:false,keys:new Set(),last:0,player:{x:450,y:260,health:20,food:20,slot:0,dimension:""},entities:[],dimensions:[],log:[],overlay:"",uiMode:"none"};
function testerParse(text,fallback={}){try{return JSON.parse(String(text||"{}"));}catch{return fallback;}}
function testerLog(message,kind="info"){
  tester.log.unshift({time:new Date().toLocaleTimeString(),message:String(message),kind});tester.log=tester.log.slice(0,80);
  const root=$("#testerLog");if(root)root.innerHTML=tester.log.map(x=>`<div class="tester-log-row ${esc(x.kind)}"><time>${esc(x.time)}</time><span>${esc(x.message)}</span></div>`).join("")||'<div class="empty">No runtime events yet.</div>';
}
function testerDimensions(){
  const dims=[{id:"minecraft:overworld",name:"Overworld",type:"normal"},{id:"minecraft:the_nether",name:"Nether",type:"noise"},{id:"minecraft:the_end",name:"The End",type:"noise"}];
  state.worldgens.forEach(w=>dims.push({id:fullId(w.id),name:`Worldgen: ${w.id}`,type:w.worldType||"normal",source:w}));
  state.runtimeDefinitions.filter(d=>d.type==="dimension").forEach(d=>{const raw=testerParse(d.json,{}),g=raw.generation||raw.world_type||{};dims.push({id:fullId(d.id),name:raw.display_name||d.id,type:typeof g==="string"?g:(g.type||"normal"),source:raw});});
  return dims.filter((d,i,a)=>a.findIndex(x=>x.id===d.id)===i);
}
function testerContentItems(){return state.content.filter(c=>c.type!=="entity").slice(0,9);}
function testerBuildScene(){
  tester.dimensions=testerDimensions();tester.entities=[];tester.player.x=450;tester.player.y=260;tester.player.health=20;tester.player.food=20;tester.player.slot=0;
  if(!tester.player.dimension||!tester.dimensions.some(d=>d.id===tester.player.dimension))tester.player.dimension=tester.dimensions[0]?.id||"minecraft:overworld";
  const entities=state.content.filter(c=>c.type==="entity");
  entities.forEach((c,i)=>{const raw=testerParse(c.entity,{}),angle=(Math.PI*2*i)/Math.max(1,entities.length),r=125+35*(i%3);tester.entities.push({id:fullId(c.id),name:c.displayName||c.id,x:450+Math.cos(angle)*r,y:260+Math.sin(angle)*r,homeX:450+Math.cos(angle)*r,homeY:260+Math.sin(angle)*r,raw,movement:raw.movement||{},portal:raw.portal||{},phase:angle,nextMove:0});});
  tester.built=true;tester.running=true;tester.last=performance.now();testerLog(`Built test scene: ${state.content.length} content definition(s), ${tester.entities.length} entity(s), ${tester.dimensions.length} dimension/world option(s).`,"ok");
  testerRenderControls();testerFindings();testerRenderUi();testerUpdateLabels();
  const c=$("#testerCanvas");if(c){c.focus();testerDraw(c.getContext("2d"));}
}
function testerRenderControls(){
  const dim=$("#testerDimension"),obj=$("#testerObjective"),menu=$("#testerMenu"),title=$("#testerTitle");
  if(dim){dim.innerHTML=tester.dimensions.map(d=>`<option value="${esc(d.id)}"${d.id===tester.player.dimension?" selected":""}>${esc(d.name)} · ${esc(d.type)}</option>`).join("");}
  if(obj)obj.innerHTML='<option value="">Select objective…</option>'+state.objectives.map(o=>`<option value="${esc(o.id)}">${esc(fullId(o.id))}</option>`).join("");
  if(menu)menu.innerHTML='<option value="">Select menu…</option>'+state.menus.map(m=>`<option value="${esc(m.id)}">${esc(m.id)} · ${esc(m.type)}</option>`).join("");
  if(title)title.innerHTML='<option value="">Select title screen…</option>'+state.titleScreens.map(t=>`<option value="${esc(t.id)}">${esc(t.id)}</option>`).join("");
  const hot=$("#testerHotbar"),items=testerContentItems();if(hot)hot.innerHTML=Array.from({length:9},(_,i)=>{const item=items[i];return `<button type="button" class="tester-slot${tester.player.slot===i?" selected":""}" data-tester-slot="${i}"><b>${i+1}</b><span>${esc(item?.displayName||item?.id||"empty")}</span></button>`;}).join("");
  $$('[data-tester-slot]').forEach(b=>b.onclick=()=>{tester.player.slot=Number(b.dataset.testerSlot);testerRenderControls();testerLog(`Selected hotbar slot ${tester.player.slot+1}.`);});
}
function testerWorld(){return tester.dimensions.find(d=>d.id===tester.player.dimension)||{id:tester.player.dimension,name:tester.player.dimension,type:"normal"};}
function testerUpdateLabels(){const d=testerWorld();if($("#testerDimensionLabel"))$("#testerDimensionLabel").textContent=d.name||d.id;if($("#testerWorldTypeLabel"))$("#testerWorldTypeLabel").textContent=`${d.id} · ${d.type||"normal"}`;if($("#testerHealth"))$("#testerHealth").textContent=Math.round(tester.player.health);if($("#testerFood"))$("#testerFood").textContent=Math.round(tester.player.food);}
function testerFindings(){
  const findings=[];const issues=validateProject();issues.forEach(i=>findings.push({kind:i.level==="err"?"err":"warn",text:i.message}));
  state.content.filter(c=>c.type==="entity").forEach(c=>{const raw=testerParse(c.entity,null);if(!raw)findings.push({kind:"err",text:`Entity ${c.id}: entity JSON cannot be parsed.`});else if(raw.portal?.enabled&&!raw.portal.destination)findings.push({kind:"err",text:`Portal ${c.id}: enabled but has no destination.`});});
  state.runtimeDefinitions.filter(d=>d.type==="dimension").forEach(d=>{try{JSON.parse(d.json);}catch{findings.push({kind:"err",text:`Dimension ${d.id}: invalid JSON.`});}});
  if(!findings.length)findings.push({kind:"ok",text:"No Creator-level problems found. Browser scene is ready; complete final verification in Minecraft before publishing."});
  const root=$("#testerFindings");if(root)root.innerHTML=findings.slice(0,18).map(f=>`<div class="tester-finding ${f.kind}">${esc(f.text)}</div>`).join("");if($("#testerFindingCount"))$("#testerFindingCount").textContent=`${findings.length} finding${findings.length===1?"":"s"}`;
}
function testerFireReaction(event){
  const hits=state.reactions.filter(r=>r.event===event);if(!hits.length){testerLog(`Event ${event}: no reaction definitions matched.`);return;}
  hits.sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0)).forEach(r=>{testerLog(`Reaction ${r.id} (${r.type}) ← ${event}.`,"event");testerExecuteActions(r.sequence||[],`reaction:${r.id}`);});
}
function testerFindObjective(ref){const raw=String(ref||"");const local=raw.includes(":")?raw.split(":").slice(1).join(":"):raw;return state.objectives.find(o=>o.id===local||fullId(o.id)===raw);}
function testerExecuteReference(ref){const o=testerFindObjective(ref);if(o){testerLog(`Objective ${fullId(o.id)} started.`,"event");testerExecuteActions(o.actions||[],`objective:${o.id}`);}else if(ref)testerLog(`Dispatch ${ref} (no managed objective with this ID; treated as external DAI action).`,"warn");}
function testerExecuteActions(actions,source="sequence",depth=0){if(depth>8){testerLog(`Stopped ${source}: simulation recursion limit reached.`,"warn");return;}for(const a of actions||[])testerExecuteAction(a,source,depth);}
function testerExecuteAction(a,source,depth){
  const t=String(a?.type||"");if(!t)return;
  switch(t){
    case "delay": testerLog(`${source}: delay ${Number(a.ticks||0)} tick(s) (compressed in browser).`);break;
    case "sequence": testerExecuteActions(a.sequence||[],source,depth+1);break;
    case "random_action":{const seq=a.sequence||[];if(seq.length)testerExecuteAction(seq[Math.floor(Math.random()*seq.length)],source,depth+1);break;}
    case "objective_execute": testerExecuteReference(a.action||a.target||a.value);break;
    case "set_look": testerLog(`${source}: facing set to yaw ${a.yaw??0}, pitch ${a.pitch??0}.`);break;
    case "add_look": testerLog(`${source}: facing adjusted.`);break;
    case "move": tester.player.y-=18;testerLog(`${source}: player movement action simulated.`);break;
    case "jump": tester.player.y-=12;testerLog(`${source}: jump simulated.`);break;
    case "hotbar_select": tester.player.slot=Math.max(0,Math.min(8,Number(a.slot||0)));testerRenderControls();break;
    case "item_use": testerUseItem();break;
    case "overlay_sprite": case "overlay_sprite_sheet": tester.overlay=a.sprite?.id||a.sprite_sheet?.id||t;testerLog(`${source}: overlay ${tester.overlay} shown.`,"ok");break;
    case "overlay_remove": case "overlay_clear": tester.overlay="";testerLog(`${source}: overlay cleared.`);break;
    case "dimension_transfer":{const target=String(a.target||a.action||a.value||"");if(target)testerTransfer(target,"dimension_transfer action");else testerLog(`${source}: dimension transfer dispatched (destination not represented in managed action fields).`,"warn");break;}
    case "server_give_item": case "loot_grant": testerLog(`${source}: ${t} simulated in inventory trace.`,"ok");break;
    case "server_take_item": testerLog(`${source}: item removal simulated in inventory trace.`);break;
    case "sound_play": case "music_play": case "hud_show": case "render_profile_apply": case "shop_open": case "dialogue_start": case "quest_start": case "quest_advance": case "quest_complete": case "currency_add": case "currency_take": case "currency_set": case "rules_apply": case "environment_enter": case "environment_exit": testerLog(`${source}: ${t} dispatched.`,"ok");break;
    case "run_command": case "run_server_command": case "server_run_function": case "server_set_block": case "server_break_block": testerLog(`${source}: ${t} requires Minecraft/server authority; recorded but not executed here.`,"warn");break;
    default: testerLog(`${source}: ${t} dispatched in browser approximation.`);break;
  }
}
function testerUseItem(){const item=testerContentItems()[tester.player.slot];testerLog(item?`Used ${item.displayName||item.id} from slot ${tester.player.slot+1}.`:`Used empty slot ${tester.player.slot+1}.`,item?"event":"warn");testerFireReaction("player_use_item");}
function testerNearest(){let best=null,dist=Infinity;for(const e of tester.entities){const d=Math.hypot(e.x-tester.player.x,e.y-tester.player.y);if(d<dist){best=e;dist=d;}}return best?{entity:best,dist}:null;}
function testerTransfer(destination,reason="portal"){
  let id=String(destination||"");if(!id.includes(":"))id=fullId(id);if(!tester.dimensions.some(d=>d.id===id))tester.dimensions.push({id,name:id,type:"custom"});tester.player.dimension=id;tester.player.x=450;tester.player.y=260;testerLog(`Transferred to ${id} via ${reason}.`,"portal");testerRenderControls();testerUpdateLabels();
}
function testerTick(dt,now){
  if(!tester.built||!tester.running)return;const speed=190*dt;if(tester.keys.has("w"))tester.player.y-=speed;if(tester.keys.has("s"))tester.player.y+=speed;if(tester.keys.has("a"))tester.player.x-=speed;if(tester.keys.has("d"))tester.player.x+=speed;tester.player.x=Math.max(12,Math.min(888,tester.player.x));tester.player.y=Math.max(12,Math.min(508,tester.player.y));
  for(const e of tester.entities){const m=e.movement||{},type=String(m.type||"behavior");const sp=(Number(m.speed)||0.04)*1450*dt;e.phase+=dt*(0.5+Number(m.speed||0.04)*3);if(type==="drift"){e.x+=(Number(m.drift_x)||0)*220*dt;e.y+=(Number(m.drift_z)||Number(m.drift_y)||0)*220*dt;}else if(type==="follow"||type==="follow_player"){const dx=tester.player.x-e.x,dy=tester.player.y-e.y,l=Math.hypot(dx,dy)||1;e.x+=dx/l*sp;e.y+=dy/l*sp;}else if(["flee","flee_player","avoid_player"].includes(type)){const dx=e.x-tester.player.x,dy=e.y-tester.player.y,l=Math.hypot(dx,dy)||1;e.x+=dx/l*sp;e.y+=dy/l*sp;}else if(type==="orbit"||type==="orbit_player"){const r=Math.max(35,(Number(m.radius)||8)*11);e.x=tester.player.x+Math.cos(e.phase)*r;e.y=tester.player.y+Math.sin(e.phase)*r;}else if(type==="wander"||type==="floating_wander"){const r=Math.max(24,(Number(m.radius)||8)*8);e.x=e.homeX+Math.cos(e.phase*.73)*r;e.y=e.homeY+Math.sin(e.phase*.91)*r*.55;}else if(["relocate","blink","teleport_wander"].includes(type)){const interval=Math.max(200,(Number(m.interval_ticks)||20)*50);if(now>e.nextMove){e.nextMove=now+interval;const r=Math.max(35,(Number(m.radius)||8)*9),a=Math.random()*Math.PI*2;e.x=e.homeX+Math.cos(a)*r;e.y=e.homeY+Math.sin(a)*r;testerLog(`${e.name} relocated.`,"event");}}
    e.x=Math.max(16,Math.min(884,e.x));e.y=Math.max(16,Math.min(504,e.y));const p=e.portal||{};if(p.enabled&&p.destination){const radius=Math.max(18,(Number(p.trigger_radius)||1)*22);if(Math.hypot(e.x-tester.player.x,e.y-tester.player.y)<=radius&&!e.portalLatch){e.portalLatch=true;testerTransfer(p.destination,`${e.name} portal`);}else if(Math.hypot(e.x-tester.player.x,e.y-tester.player.y)>radius*1.4)e.portalLatch=false;}}
}
function testerDraw(ctx){
  if(!ctx)return;const w=ctx.canvas.width,h=ctx.canvas.height,d=testerWorld(),type=String(d.type||"normal");ctx.clearRect(0,0,w,h);let bg="#17241d";if(type.includes("void"))bg="#050608";else if(type.includes("water"))bg="#0a2635";else if(type.includes("debug"))bg="#281b32";else if(type.includes("flat")||type.includes("superflat"))bg="#18311d";else if(d.id.includes("nether"))bg="#351616";else if(d.id.includes("end"))bg="#171427";ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle="rgba(255,255,255,.045)";ctx.lineWidth=1;for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}if(type.includes("water")){ctx.strokeStyle="rgba(184,148,255,.18)";for(let y=12;y<h;y+=22){ctx.beginPath();ctx.moveTo(0,y);ctx.bezierCurveTo(w*.25,y+8,w*.75,y-8,w,y);ctx.stroke();}}
  for(const e of tester.entities){const p=e.portal||{};if(p.enabled){ctx.strokeStyle="#79d8ff";ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,18+Math.sin(e.phase*3)*2,0,Math.PI*2);ctx.stroke();ctx.strokeStyle="rgba(121,216,255,.22)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(e.x,e.y,Math.max(18,(Number(p.trigger_radius)||1)*22),0,Math.PI*2);ctx.stroke();}else{ctx.fillStyle="#e6b86b";ctx.beginPath();ctx.arc(e.x,e.y,11,0,Math.PI*2);ctx.fill();}ctx.fillStyle="#d9e5ea";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(e.name,e.x,e.y-25);}
  ctx.save();ctx.translate(tester.player.x,tester.player.y);ctx.fillStyle="#a7efc0";ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(10,10);ctx.lineTo(0,6);ctx.lineTo(-10,10);ctx.closePath();ctx.fill();ctx.restore();if(tester.overlay){ctx.fillStyle="rgba(121,200,196,.13)";ctx.fillRect(w/2-120,18,240,34);ctx.strokeStyle="#79c8c4";ctx.strokeRect(w/2-120,18,240,34);ctx.fillStyle="#d9eeee";ctx.font="13px monospace";ctx.fillText(`OVERLAY: ${tester.overlay}`,w/2,40);}
}
function testerRenderUi(){const root=$("#testerUiPreview");if(!root)return;const menuId=$("#testerMenu")?.value,titleId=$("#testerTitle")?.value;if(menuId){const m=state.menus.find(x=>x.id===menuId);tester.uiMode=`menu:${menuId}`;$("#testerUiMode").textContent=tester.uiMode;root.innerHTML=(m?.buttons||[]).length?(m.buttons||[]).sort((a,b)=>a.slot-b.slot).map(b=>`<button class="tester-ui-button" type="button" data-tester-action="${esc(b.action||"")}">${esc(b.text||b.id)}</button>`).join(""):'<div class="empty">This menu has no buttons.</div>';}else if(titleId){const t=state.titleScreens.find(x=>x.id===titleId);tester.uiMode=`title:${titleId}`;$("#testerUiMode").textContent=tester.uiMode;root.innerHTML=`<div class="tester-title-sim"><strong>${esc(t?.title||"")}</strong><span>${esc(t?.subtitle||"")}</span>${(t?.buttons||[]).map(b=>`<button class="tester-ui-button" type="button" data-tester-action="${esc(b.action||"")}">${esc(b.label||b.id)}</button>`).join("")}</div>`;}else{tester.uiMode="none";$("#testerUiMode").textContent="none";root.innerHTML='<div class="empty">Choose a menu or title screen to preview its buttons.</div>';}
  $$('[data-tester-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.testerAction;testerLog(`UI button dispatched ${a||"<no action>"}.`,"event");testerExecuteReference(a);});
}
function testerFrame(now){const dt=Math.min(.05,Math.max(0,(now-(tester.last||now))/1000));tester.last=now;testerTick(dt,now);const c=$("#testerCanvas");if(c)testerDraw(c.getContext("2d"));testerUpdateLabels();requestAnimationFrame(testerFrame);}
function setupGameplayTester(){
  const c=$("#testerCanvas");if(!c)return;c.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["w","a","s","d"].includes(k)){tester.keys.add(k);e.preventDefault();}if(/^\d$/.test(e.key)&&e.key!=="0"){tester.player.slot=Number(e.key)-1;testerRenderControls();e.preventDefault();}if(e.code==="Space"){testerUseItem();e.preventDefault();}if(k==="e"){const n=testerNearest();testerLog(n?`Interacted with ${n.entity.name} (${(n.dist/22).toFixed(1)} simulated blocks).`:"No entity available.","event");testerFireReaction("player_interact_entity");e.preventDefault();}if(k==="f"){const n=testerNearest();testerLog(n?`Attacked ${n.entity.name}.`:"No entity available.","event");testerFireReaction("player_attack_entity");e.preventDefault();}});c.addEventListener("keyup",e=>tester.keys.delete(e.key.toLowerCase()));c.addEventListener("blur",()=>tester.keys.clear());
  $("#testerBuild").onclick=testerBuildScene;$("#testerReset").onclick=()=>{tester.player.x=450;tester.player.y=260;tester.player.health=20;testerLog("Player reset.");};$("#testerPause").onclick=()=>{tester.running=!tester.running;$("#testerPause").textContent=tester.running?"Pause":"Resume";testerLog(tester.running?"Simulation resumed.":"Simulation paused.");};$("#testerAttack").onclick=()=>{const n=testerNearest();testerLog(n?`Attacked ${n.entity.name}.`:"No entity available.","event");testerFireReaction("player_attack_entity");};$("#testerInteract").onclick=()=>{const n=testerNearest();testerLog(n?`Interacted with ${n.entity.name}.`:"No entity available.","event");testerFireReaction("player_interact_entity");};$("#testerUseBlock").onclick=()=>{testerLog("Used simulated test block.","event");testerFireReaction("player_use_block");};$("#testerDamage").onclick=()=>{tester.player.health=Math.max(0,tester.player.health-4);testerLog(`Player took 4 damage → ${tester.player.health}/20 HP.`,tester.player.health?"warn":"err");};$("#testerClearLog").onclick=()=>{tester.log=[];testerLog("Runtime trace cleared.");};$("#testerRunObjective").onclick=()=>{const id=$("#testerObjective").value;if(id)testerExecuteReference(id);};$("#testerDimension").onchange=e=>testerTransfer(e.target.value,"manual tester switch");$("#testerMenu").onchange=()=>{$("#testerTitle").value="";testerRenderUi();};$("#testerTitle").onchange=()=>{$("#testerMenu").value="";testerRenderUi();};requestAnimationFrame(testerFrame);
}


// ---- Public Pack Base Importer -------------------------------------------
let publicBaseRegistry=null;
function forgeCdnUrl(fileId,fileName){
  const raw=String(Math.trunc(Number(fileId)||0));if(!raw||raw==="0")return "";
  const prefix=raw.length>3?raw.slice(0,-3):"0", suffix=raw.slice(-3).padStart(3,"0");
  return `https://edge.forgecdn.net/files/${prefix}/${suffix}/${encodeURIComponent(String(fileName||"pack.zip")).replace(/%2F/gi,"/")}`;
}
function publicBaseStatus(message,level="ok"){
  const root=$("#publicBaseStatus");if(!root)return;root.innerHTML=`<div class="status ${level}">${esc(message)}</div>`;
}
async function publicBaseRegistryLoad(){
  if(publicBaseRegistry)return publicBaseRegistry;
  const response=await fetch("../api/packs.json",{cache:"no-store"});if(!response.ok)throw new Error(`Registry HTTP ${response.status}`);
  publicBaseRegistry=await response.json();return publicBaseRegistry;
}
function selectedPublicPack(){const id=$("#publicBasePack")?.value||"";return (publicBaseRegistry?.packs||[]).find(x=>x.id===id)||null;}
function renderPublicBaseComponents(){
  const pack=selectedPublicPack(),sel=$("#publicBaseComponent"),summary=$("#publicBaseSummary"),link=$("#publicBaseDownload");if(!sel)return;
  const components=pack?.components||[];sel.innerHTML=components.map((c,i)=>`<option value="${i}">${esc(c.type||"datapack")} · ${esc(c.file_name||c.id||`component ${i+1}`)}</option>`).join("");
  const chosen=components[Number(sel.value||0)]||components[0];
  if(summary)summary.textContent=pack?`${pack.name}\n${pack.summary||""}\nVersion: ${pack.version||"?"} · ${components.length} component(s)`:'No public pack selected.';
  const url=chosen?forgeCdnUrl(chosen.curseforge_file_id,chosen.file_name):"";if(link){link.hidden=!url;if(url)link.href=url;}
}
async function openPublicBaseModal(){
  const modal=$("#publicBaseModal");if(!modal)return;modal.hidden=false;document.body.style.overflow="hidden";publicBaseStatus("Loading public registry…","warn");
  try{const registry=await publicBaseRegistryLoad(),sel=$("#publicBasePack");sel.innerHTML=(registry.packs||[]).map((p,i)=>`<option value="${esc(p.id)}"${i===0?" selected":""}>${esc(p.name)} · ${esc(p.version||"")}</option>`).join("");renderPublicBaseComponents();publicBaseStatus(`${(registry.packs||[]).length} public registry pack(s) available as Creator bases.`,"ok");}
  catch(err){publicBaseStatus(`Could not load the official registry: ${err.message}. You can still use a direct public ZIP URL.`,"warn");}
}
function closePublicBaseModal(){const modal=$("#publicBaseModal");if(modal)modal.hidden=true;document.body.style.overflow="";}
function addPublicBaseSourceNote(meta){
  if(!$("#publicBaseSourceNote")?.checked)return;
  const lines=["DAI Creator public-base source note","",`Source: ${meta.name||"Public pack"}`,`Source page: ${meta.infoUrl||""}`,`Source ZIP: ${meta.url||""}`,`Source file: ${meta.fileName||""}`,`Imported: ${new Date().toISOString()}`,"","This project was imported as an editable starting base. Review the original project's license and attribution/redistribution terms before publishing your derivative work.","The DAI Creator does not grant rights to third-party assets or code.",""];
  state.extraFiles["DAI_CREATOR_BASE_SOURCE.txt"]=lines.join("\n");renderUniversalFiles();refreshAll();
}
async function importPublicBaseUrl(url,meta={}){
  if(!url)throw new Error("No ZIP URL was provided.");
  if(!confirm("Load this public pack as the current Creator base? Unsaved changes in the current project will be replaced."))return false;
  const modal=$("#publicBaseModal");modal?.classList.add("loading");publicBaseStatus("Downloading and importing public ZIP…","warn");
  try{
    const response=await fetch(url,{mode:"cors",cache:"no-store"});if(!response.ok)throw new Error(`ZIP HTTP ${response.status}`);
    const blob=await response.blob();const files=await readZip(blob);const type=meta.type||"datapack";const label=meta.name||meta.fileName||url.split("/").pop()||"Public Base";
    if(type==="resource_pack")importResourcePackFiles(files,label);else importFiles(files,label);
    addPublicBaseSourceNote({...meta,url});
    const summary=$("#importSummary");if(summary){summary.hidden=false;summary.textContent=`Public base loaded from ${meta.name||url}. Rename IDs/namespace and review the source license before publishing. `+summary.textContent;}
    publicBaseStatus("Public pack loaded as the editable project base.","ok");closePublicBaseModal();switchView("pack");return true;
  } catch(err){
    publicBaseStatus(`Direct browser import failed: ${err.message}. If the host blocks CORS, open/download the ZIP and use Import Datapack ZIP / Import Resource ZIP instead.`,"err");return false;
  } finally {modal?.classList.remove("loading");}
}
function setupPublicBaseImporter(){
  $("#usePublicBase")?.addEventListener("click",openPublicBaseModal);$("[data-public-base-card]")?.addEventListener("click",openPublicBaseModal);$("[data-public-base-card-resource]")?.addEventListener("click",openPublicBaseModal);
  $$('[data-public-base-close]').forEach(x=>x.addEventListener("click",closePublicBaseModal));
  $("#publicBasePack")?.addEventListener("change",renderPublicBaseComponents);$("#publicBaseComponent")?.addEventListener("change",renderPublicBaseComponents);
  $("#loadPublicBase")?.addEventListener("click",async()=>{const pack=selectedPublicPack(),components=pack?.components||[],component=components[Number($("#publicBaseComponent")?.value||0)];if(!pack||!component){publicBaseStatus("Choose a public pack/component first.","warn");return;}const url=forgeCdnUrl(component.curseforge_file_id,component.file_name);if(!url){publicBaseStatus("This registry component has no public downloadable file ID yet.","warn");return;}await importPublicBaseUrl(url,{name:pack.name,infoUrl:pack.info_url,fileName:component.file_name,type:component.type});});
  $("#loadPublicBaseUrl")?.addEventListener("click",async()=>{const url=$("#publicBaseUrl")?.value.trim();await importPublicBaseUrl(url,{name:"Public URL Base",infoUrl:url,fileName:(url||"").split("/").pop()||"public-pack.zip",type:$("#publicBaseUrlType")?.value|| (state.kind==="resourcepack"?"resource_pack":"datapack")});});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#publicBaseModal")?.hidden)closePublicBaseModal();});
}

function wirePackInputs(){ loadPackInputs(); }
function init(){
  wirePackInputs();renderAll();refreshAll();showValidation([]);setupGameplayTester();setupPublicBaseImporter();switchView("dashboard");
}
init();

})();
