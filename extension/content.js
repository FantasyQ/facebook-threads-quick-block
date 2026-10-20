(() => {
  'use strict';
  const C = FBQuickBlock;
  const T = typeof FBQuickBlockThreads !== 'undefined' ? FBQuickBlockThreads : null;
  const adapter = T || FBQuickBlockAPI;
  const ARTICLE = '[role="article"][aria-label]';
  const client = adapter.createClient({doc:document,fetcher:fetch.bind(window),parseHTML:html=>new DOMParser().parseFromString(html,'text/html'),canonical:C.profileURL});
  const states = new Map();
  const queue = FBQuickBlockQueue.createQueue({
    run: async person => {
      if (adapter.credentials(document).actor !== person.actor) throw Error('登入身分已改變，請取消等待項目並重新整理。');
      await client.block(person.url,person);
    },
    onChange: (status,person,state) => {
      if(person) {
        if(state === 'cancelled') states.delete(person.url);
        else states.set(person.url,state);
        scan();
      }
      renderQueue(status);
    }
  });
  function renderQueue(status) {
    let host=document.getElementById('fbqb-queue');
    if(!host) {
      host=document.createElement('div');host.id='fbqb-queue';
      const shadow=host.attachShadow({mode:'open'});
      const style=document.createElement('style');style.textContent=":host{position:fixed;left:18px;bottom:20px;z-index:2147483646;max-width:min(320px,calc(100vw - 36px))}section{background:#202636;color:white;padding:14px 18px;border-radius:12px;box-shadow:0 4px 24px #0004;font:14px/1.6 system-ui}p{margin:4px 0}button{margin:8px 8px 0 0;padding:4px 10px;cursor:pointer}small{color:#cbd1dd}header{display:flex;align-items:center;justify-content:space-between;gap:12px}#collapse{margin:0}#expand{margin:0;padding:8px 12px;border:1px solid #aeb5c5;border-radius:20px;background:#202636;color:white;box-shadow:0 2px 12px #0003;font:14px/1.6 system-ui}button:focus-visible{outline:2px solid #8cbfff;outline-offset:3px}[hidden]{display:none!important}";
      const section=document.createElement('section');section.setAttribute('aria-label','封鎖佇列');
      section.id='panel';
      const header=document.createElement('header');
      const title=document.createElement('strong');title.textContent='封鎖佇列';
      const collapse=document.createElement('button');collapse.type='button';collapse.id='collapse';collapse.textContent='收合';collapse.setAttribute('aria-label','收合封鎖佇列');
      header.append(title,collapse);section.append(header);
      const expand=document.createElement('button');expand.type='button';expand.id='expand';expand.hidden=true;expand.setAttribute('aria-controls','panel');expand.setAttribute('aria-expanded','false');
      collapse.onclick=()=>{section.hidden=true;expand.hidden=false;expand.focus();};
      expand.onclick=()=>{section.hidden=false;expand.hidden=true;collapse.focus();};
      for(const id of ['counts','current','reason','toggle','cancel']) {
        const el=document.createElement(['toggle','cancel'].includes(id)?'button':'p');el.id=id;
        if(id==='counts')el.setAttribute('role','status');
        if(id==='cancel')el.textContent='取消等待項目';
        section.append(el);
      }
      const hint=document.createElement('p'),small=document.createElement('small');small.textContent='每次處理一人，間隔 2 秒。關閉或重新整理分頁會清除等待項目。';hint.append(small);section.append(hint);
      shadow.append(style,section,expand);
      shadow.getElementById('toggle').onclick=()=>queue.snapshot().paused?queue.resume():queue.pause();
      shadow.getElementById('cancel').onclick=()=>queue.cancelWaiting();
      document.body.append(host);
    }
    const root=host.shadowRoot;
    root.getElementById('counts').textContent=`等待 ${status.waiting} 人 · 完成 ${status.completed} 人 · 失敗 ${status.failed} 次`;
    root.getElementById('current').textContent=status.active?`處理中：${status.active}`:status.paused?'已暫停':status.waiting?'等待下一筆…':'處理完畢';
    root.getElementById('reason').textContent=status.reason;
    root.getElementById('toggle').textContent=status.paused?'繼續等待項目':'暫停';
    root.getElementById('cancel').disabled=!status.waiting;
    const summary=status.paused?'已暫停':status.active||status.waiting?`剩 ${status.waiting+(status.active?1:0)} 人`:'已完成';
    const expand=root.getElementById('expand');
    expand.textContent=`封鎖佇列 · ${summary}`;
    expand.setAttribute('aria-label',`展開封鎖佇列，${summary}${status.reason?`，${status.reason}`:''}`);
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if (message.type === 'fbqb-check-profile') {
      client.resolve(location.href).then(id=>respond({ok:true,id}),error=>respond({ok:false,error:error.message}));
      return true;
    }
    if (message.type !== 'fbqb-status') return;
    try { adapter.credentials(document); respond({ready:true,platform:T?'Threads':'Facebook'}); }
    catch (error) { respond({ready:false,error:error.message}); }
  });
  const visible = el => el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const label = el => C.normalize(el.getAttribute('aria-label') || el.textContent);
  const unique = list => list.length === 1 ? list[0] : null;
  function author(article) {
    if(T) return T.author(article);
    const nameLabel = article.getAttribute('aria-label');
    for (const link of article.querySelectorAll('a[href]')) {
      if (link.closest(ARTICLE) !== article) continue;
      const name = C.normalize(link.textContent);
      const url = C.profileURL(link.href);
      if (url && C.authorMatches(nameLabel, name)) return {name,url,link};
    }
    return null;
  }
  function notice(text) {
    let host = document.getElementById('fbqb-notice');
    if (!host) {
      host = document.createElement('div'); host.id = 'fbqb-notice';
      const shadow = host.attachShadow({mode:'open'});
      const style = document.createElement('style');
      style.textContent = ':host{position:fixed;right:20px;bottom:24px;z-index:2147483647;max-width:360px}section{background:#202636;color:#fff;padding:16px 18px;border-radius:12px;box-shadow:0 6px 30px #0004;font:14px/1.6 system-ui}p{margin:0}button{margin-top:10px;background:transparent;color:#fff;border:1px solid #aeb5c5;border-radius:5px;padding:3px 10px;cursor:pointer}';
      const box = document.createElement('section');
      const p = document.createElement('p'); p.setAttribute('role','status');
      const close = document.createElement('button'); close.textContent = '關閉提示'; close.onclick = () => host.remove();
      box.append(p,close); shadow.append(style,box); document.documentElement.append(host);
    }
    host.shadowRoot.querySelector('p').textContent = text;
  }
  function paint(button,url) {
    const state = states.get(url);
    const text = state === 'queued' ? '排隊中…' : state === 'pending' ? '封鎖中…' : state === 'done' ? '已封鎖' : state === 'error' ? '重試封鎖' : '封鎖此人';
    if (button.textContent !== text) button.textContent = text;
    button.disabled = ['queued','pending','done'].includes(state);
  }
  function scan() {
    for (const article of (T ? T.headers(document) : document.querySelectorAll(ARTICLE))) {
      const person = author(article);
      const old = Array.from(article.querySelectorAll('.fbqb-button')).find(b => T ? b.dataset.profile === person?.url : b.closest(ARTICLE) === article);
      if (!person) { old?.remove(); continue; }
      if (old && old.dataset.profile === person.url && old.dataset.name === person.name) { paint(old,person.url); continue; }
      old?.remove();
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'fbqb-button';
      button.dataset.profile = person.url; button.dataset.name = person.name;
      button.textContent = '封鎖此人'; button.setAttribute('aria-label',`封鎖 ${person.name}`);
      button.title = '加入佇列，依序封鎖';
      paint(button,person.url);
      button.addEventListener('click', async event => {
        event.preventDefault(); event.stopPropagation();
        if (!event.isTrusted || ['queued','pending','done'].includes(states.get(person.url))) return;
        const current = author(article);
        if (!current || current.url !== person.url || current.name !== person.name) { scan(); return; }
        try {
          const actor=adapter.credentials(document).actor;
          queue.add({...person,actor,key:person.url});
        } catch (error) { notice(error.message); }
      });
      person.link.after(button);
    }
  }
  let scheduled = false;
  const observer = new MutationObserver(records => {
    if (scheduled || records.every(r => r.target.closest?.('#fbqb-notice, #fbqb-queue'))) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; scan(); }, 250);
  });
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-label','href']});
  scan();
})();
