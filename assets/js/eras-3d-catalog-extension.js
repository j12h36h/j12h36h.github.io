(function installEras3dCatalogExtension(){
  if (window.__eras3dCatalogExtensionInstalled) return;
  window.__eras3dCatalogExtensionInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  let extensionPromise = null;

  const extension = () => extensionPromise || (extensionPromise = nativeFetch('/public-assets/catalog-3d.json',{cache:'no-store'})
    .then(r => r.ok ? r.json() : {assets:[]})
    .catch(() => ({assets:[]})));

  const mergeCatalogs = (base, extra) => {
    const seen = new Set();
    const assets = [];
    for (const asset of [...(base?.assets || []), ...(extra?.assets || [])]) {
      const id = String(asset?.id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id); assets.push(asset);
    }
    return {...(base || {}), assets, extensions:[...(base?.extensions || []),'eras-3d'].filter((v,i,a)=>a.indexOf(v)===i)};
  };

  window.fetch = async function eras3dFetch(input, init){
    const url = typeof input === 'string' ? input : String(input?.url || '');
    const response = await nativeFetch(input, init);
    if (!/(^|\/)public-assets\/catalog\.json(?:\?|$)/.test(url)) return response;
    try {
      const base = await response.clone().json();
      const extra = await extension();
      const merged = mergeCatalogs(base, extra);
      return new Response(JSON.stringify(merged), {
        status: response.status,
        statusText: response.statusText,
        headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
      });
    } catch (_) {
      return response;
    }
  };

  async function update3dCounts(){
    const extra = await extension();
    const counts = {Object:0,Structure:0,Material:0,Scene:0,World:0,Ruleset:0};
    const category = asset => {
      const t=String(asset?.type||'').toLowerCase(), c=String(asset?.category||'').toLowerCase();
      if(['object','3d-object','model'].includes(t)||['3d-objects','objects','models'].includes(c))return 'Object';
      if(['structure','3d-structure'].includes(t)||['3d-structures','structures'].includes(c))return 'Structure';
      if(['material','surface'].includes(t)||['3d-materials','materials','surfaces'].includes(c))return 'Material';
      if(['scene','map-chunk','scene-chunk'].includes(t)||['3d-scenes','scenes','scene-chunks'].includes(c))return 'Scene';
      if(['ruleset','rules'].includes(t)||['rulesets','rules'].includes(c))return 'Ruleset';
      if(['world','map','open-world'].includes(t)||['world','worlds','maps'].includes(c))return 'World';
      return '';
    };
    for(const a of extra?.assets||[]){const k=category(a);if(k)counts[k]=(counts[k]||0)+1;}
    const ids={Object:'objectAssetCount',Structure:'structureAssetCount',Material:'materialAssetCount',Scene:'sceneAssetCount',Ruleset:'rulesetAssetCount'};
    for(const [k,id] of Object.entries(ids)){const el=document.getElementById(id);if(el)el.textContent=String(counts[k]||0).padStart(2,'0');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update3dCounts,{once:true}); else update3dCounts();
})();
