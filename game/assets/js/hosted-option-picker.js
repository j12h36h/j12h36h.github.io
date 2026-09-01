const esc = value => String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let active = null;
function ensureModal(){
  let root=document.getElementById('erasOptionModal');
  if(root)return root;
  root=document.createElement('div');root.id='erasOptionModal';root.className='eras-option-modal';root.hidden=true;
  root.innerHTML='<section class="eras-option-dialog" role="dialog" aria-modal="true" aria-labelledby="erasOptionTitle"><header class="eras-option-head"><div><small>PREDEFINED E.R.A.S. OPTIONS</small><h2 id="erasOptionTitle">SELECT OPTION</h2></div><button class="eras-option-close" type="button" aria-label="Close">×</button></header><div class="eras-option-grid" id="erasOptionGrid"></div><footer class="eras-option-foot" id="erasOptionFoot"><button type="button" data-option-cancel>CANCEL</button><button type="button" data-option-confirm hidden>CONFIRM SELECTION</button></footer></section>';
  document.body.appendChild(root);
  root.querySelector('.eras-option-close').onclick=closeOptionPicker;
  root.querySelector('[data-option-cancel]').onclick=closeOptionPicker;
  root.addEventListener('click',e=>{if(e.target===root)closeOptionPicker();const card=e.target.closest('[data-option-id]');if(card)choose(card.dataset.optionId);});
  root.querySelector('[data-option-confirm]').onclick=confirmMulti;
  document.addEventListener('keydown',e=>{if(!root.hidden&&e.key==='Escape')closeOptionPicker();});
  return root;
}
function normalize(options=[]){return options.map(o=>typeof o==='string'?{id:o,name:o,description:''}:o).filter(o=>o&&o.id);}
function render(){
  const root=ensureModal(), grid=root.querySelector('#erasOptionGrid'), confirm=root.querySelector('[data-option-confirm]');
  root.querySelector('#erasOptionTitle').textContent=String(active?.title||'SELECT OPTION').toUpperCase();
  confirm.hidden=!active?.multi;
  grid.innerHTML=normalize(active?.options).map(o=>`<button type="button" class="eras-option-card ${active.selected.has(String(o.id))?'is-selected':''}" data-option-id="${esc(o.id)}"><span class="eras-option-card-icon">${o.image?`<img src="${esc(o.image)}" alt="">`:esc(o.icon||'◇')}</span><span class="eras-option-card-copy"><b>${esc(o.name||o.id)}</b><p>${esc(o.description||'')}</p>${Array.isArray(o.tags)&&o.tags.length?`<span class="eras-option-tags">${o.tags.slice(0,6).map(t=>`<span>${esc(t)}</span>`).join('')}</span>`:''}</span><span class="eras-option-check">✓</span></button>`).join('');
}
function choose(id){
  if(!active)return;
  id=String(id);
  if(active.multi){if(active.selected.has(id))active.selected.delete(id);else if(active.selected.size<(active.max||8))active.selected.add(id);render();return;}
  active.selected=new Set([id]);const option=normalize(active.options).find(o=>String(o.id)===id);active.onSelect?.(id,option);closeOptionPicker();
}
function confirmMulti(){if(!active)return;const ids=[...active.selected];const options=normalize(active.options).filter(o=>ids.includes(String(o.id)));active.onSelect?.(ids,options);closeOptionPicker();}
export function openOptionPicker({title='Select option',options=[],selected='',multi=false,max=8,onSelect}={}){
  closeOptionPicker();
  const initial=multi?(Array.isArray(selected)?selected:[]):[selected].filter(Boolean);
  active={title,options:normalize(options),selected:new Set(initial.map(String)),multi,max,onSelect};
  const root=ensureModal();render();root.hidden=false;document.documentElement.style.overflow='hidden';setTimeout(()=>root.querySelector('.eras-option-card')?.focus(),0);
}
export function closeOptionPicker(){const root=document.getElementById('erasOptionModal');if(root)root.hidden=true;active=null;document.documentElement.style.overflow='';}
export function optionTriggerMarkup(option,label='SELECT'){
  const o=option||{};return `<span class="eras-option-trigger-icon">${esc(o.icon||'◇')}</span><span class="eras-option-trigger-copy"><b>${esc(o.name||label)}</b><small>${esc(o.description||label)}</small></span><span class="eras-option-trigger-arrow">›</span>`;
}
