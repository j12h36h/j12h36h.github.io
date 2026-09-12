(() => {
  if (window.ERASHelp) return;
  let root=null, history=[], busy=false;

  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function renderMessages(){
    const list=root.querySelector('[data-help-messages]');
    list.innerHTML = history.length ? history.map(m=>`<div class="eras-help-msg ${m.role==='user'?'is-user':'is-ai'}">${esc(m.content)}</div>`).join('')
      : '<div class="eras-help-msg is-ai">Describe what you need help with. I can answer through the E.R.A.S. Help assistant, or you can send the request to the support queue.</div>';
    list.scrollTop=list.scrollHeight;
  }

  function setStatus(text){const el=root?.querySelector('[data-help-status]');if(el)el.textContent=text||'';}

  async function callable(name,data){
    const eras=await import('/game/assets/js/eras-data.js?v=20260912-help1');
    if(!eras.auth.currentUser) throw new Error('Sign in to your E.R.A.S. account first.');
    await eras.ensureIdentity(eras.auth.currentUser);
    const fns=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js');
    const appMod=await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js');
    const app=appMod.getApp('site-account');
    const fn=fns.httpsCallable(fns.getFunctions(app),name);
    return (await fn(data)).data;
  }

  async function ask(){
    if(busy)return;
    const input=root.querySelector('[data-help-input]');
    const text=input.value.trim();
    if(!text)return;
    history.push({role:'user',content:text});input.value='';renderMessages();
    busy=true;setStatus('ASKING E.R.A.S. HELP…');
    try{
      const data=await callable('erasHelpChat',{
        messages:history.slice(-10),
        page:location.pathname,
        title:document.title
      });
      history.push({role:'assistant',content:String(data?.reply||'No response was returned.')});
      renderMessages();setStatus(`AI HELP // ${String(data?.model||'GPT').toUpperCase()}`);
    }catch(error){
      const message=String(error?.message||error||'Help assistant unavailable.');
      history.push({role:'assistant',content:`AI help is not available yet: ${message}`});
      renderMessages();setStatus('AI HELP UNAVAILABLE // YOU CAN STILL SEND A SUPPORT REQUEST');
    }finally{busy=false;}
  }

  async function sendRequest(){
    if(busy)return;
    const input=root.querySelector('[data-help-input]');
    const text=input.value.trim() || [...history].reverse().find(x=>x.role==='user')?.content || '';
    if(!text){setStatus('WRITE A HELP REQUEST FIRST');return;}
    busy=true;setStatus('SENDING HELP REQUEST…');
    try{
      const data=await callable('erasHelpRequest',{message:text,page:location.pathname,title:document.title,history:history.slice(-6)});
      setStatus(`HELP REQUEST SENT // ${data?.requestId||'QUEUED'}`);
      window.ERASUtilityToast?.('Help request sent.');
    }catch(error){
      setStatus(`HELP REQUEST FAILED // ${String(error?.message||error)}`);
    }finally{busy=false;}
  }

  function build(){
    root=document.createElement('div');root.className='eras-utility-backdrop';
    root.innerHTML=`<section class="eras-utility-window" role="dialog" aria-modal="true" aria-label="E.R.A.S. Help">
      <header class="eras-utility-head"><div><b>HELP</b><small>E.R.A.S. HELP ASSISTANT + SUPPORT REQUESTS</small></div><button class="eras-utility-close" type="button" data-close>×</button></header>
      <div class="eras-utility-body eras-help-layout">
        <div class="eras-help-messages" data-help-messages></div>
        <div>
          <div class="eras-help-compose">
            <label class="eras-utility-field"><span>WHAT DO YOU NEED HELP WITH?</span><textarea data-help-input maxlength="4000" placeholder="Describe the problem or question…"></textarea></label>
            <button class="eras-utility-button is-primary" type="button" data-ask>ASK AI</button>
            <button class="eras-utility-button" type="button" data-send>SEND REQUEST</button>
          </div>
          <p class="eras-help-status" data-help-status>AI HELP REQUIRES THE SECURE FIREBASE FUNCTION + OPENAI API SECRET.</p>
        </div>
      </div>
    </section>`;
    document.body.appendChild(root);
    root.querySelector('[data-close]').addEventListener('click',()=>root.classList.remove('is-open'));
    root.addEventListener('click',e=>{if(e.target===root)root.classList.remove('is-open');});
    root.querySelector('[data-ask]').addEventListener('click',ask);
    root.querySelector('[data-send]').addEventListener('click',sendRequest);
    root.querySelector('[data-help-input]').addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();ask();}
    });
    renderMessages();
  }

  function open(){if(!root)build();root.classList.add('is-open');root.querySelector('[data-help-input]')?.focus();}
  window.ERASHelp={open};
})();
