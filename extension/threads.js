/* Threads adapter: validate author/header, then use the site's native block flow. */
(() => {
  const normalize=text=>String(text||'').replace(/\s+/g,' ').trim();
  function profileURL(raw,base='https://www.threads.com') {
    try {const u=new URL(raw,base);if(u.protocol!=='https:'||!['www.threads.com','www.threads.net','threads.com','threads.net'].includes(u.hostname)||u.port||u.username||u.password)return null;
      const match=/^\/@([a-zA-Z0-9._]+)\/?$/.exec(u.pathname);return match?`${u.origin}/@${match[1].toLowerCase()}`:null;
    } catch{return null;}
  }
  function confirmationMatches(title,name) {return [`封鎖${name}？`,`封鎖 ${name}？`,`Block ${name}?`,`Block @${name}?`].includes(normalize(title));}
  function successMatches(text,name) {
    text=normalize(text);
    return ['已封鎖','已封鎖。',`已封鎖${name}`,`已封鎖 ${name}`,`已封鎖「${name}」。`,`${name}已封鎖`,`${name} blocked`,`Blocked ${name}`].includes(text);
  }
  const visible=el=>el?.isConnected&&el.getClientRects().length>0&&!el.closest('[aria-hidden="true"]')&&getComputedStyle(el).visibility!=='hidden';
  function moreButtons(root) {return [...root.querySelectorAll('[role="button"][aria-haspopup="menu"],button[aria-haspopup="menu"]')].filter(el=>['更多','More'].includes(el.getAttribute('aria-label')||el.querySelector('svg title')?.textContent||el.querySelector('svg')?.getAttribute('title')));}
  function author(root) {
    const menus=moreButtons(root);if(menus.length!==1)return null;
    const candidates=[...root.querySelectorAll('a[href]')].map(link=>({link,url:profileURL(link.href),name:normalize(link.textContent)})).filter(p=>p.url&&p.name===new URL(p.url).pathname.slice(2));
    if(candidates.length!==1)return null;
    const person=candidates[0];
    const posts=[...root.querySelectorAll('a[href]')].filter(a=>{try{const u=new URL(a.href);return u.origin===new URL(person.url).origin&&u.pathname.startsWith(`/@${person.name}/post/`)&&a.querySelector('time');}catch{return false;}});
    return posts.length===1?{...person,menu:menus[0],root}:null;
  }
  function headers(doc) {
    const result=new Set();
    for(const menu of moreButtons(doc))for(let root=menu.parentElement,n=0;root&&n<9;root=root.parentElement,n++) {
      if(root.matches('nav,[role="navigation"]'))break;
      if(author(root)){result.add(root);break;}
    }
    return [...result];
  }
  function credentials(doc) {
    const links=[...doc.querySelectorAll('nav a[href],[role="navigation"] a[href]')].filter(a=>/^(個人檔案|Profile)( 個人檔案| Profile)?$/.test(normalize(a.getAttribute('aria-label')||a.textContent))||a.querySelector('svg[title="個人檔案"],svg[title="Profile"],svg[aria-label="個人檔案"],svg[aria-label="Profile"]'));
    const urls=[...new Set(links.map(a=>profileURL(a.href)).filter(Boolean))];
    if(urls.length!==1)throw Error('無法確認 Threads 登入帳號，請重新整理並確認已登入。');
    return {actor:urls[0]};
  }
  function createClient({doc}) {
    async function block(url,person) {
      const current=author(person.root);
      if(!current||current.url!==url||current.name!==person.name||!visible(current.menu))throw Error('此留言已離開畫面或作者已改變，請回到留言後重試。');
      if(credentials(doc).actor===url)throw Error('不能封鎖目前登入的帳號。');
      if([...doc.querySelectorAll('[role="dialog"],[role="menu"]')].some(visible))throw Error('請先關閉 Threads 的選單或對話框，再繼續佇列。');
      const startURL=location.href;let interrupted=false,submitted=false;
      const input=event=>{if(event.isTrusted&&!event.composedPath().some(el=>el?.id==='fbqb-queue'||el?.classList?.contains('fbqb-button')))interrupted=true;};
      doc.addEventListener('pointerdown',input,true);doc.addEventListener('keydown',input,true);
      const check=()=>{if(interrupted||location.href!==startURL)throw Error('操作已中斷；請確認封鎖狀態後再繼續。');};
      const wait=read=>new Promise((resolve,reject)=>{
        const deadline=Date.now()+12000;
        const poll=()=>{try{check();const value=read();if(value)return resolve(value);if(Date.now()>deadline)throw Error(submitted?'未能確認 Threads 封鎖結果，請先查看封鎖名單。':'Threads 介面未出現預期選項，佇列已暫停。');setTimeout(poll,100);}catch(error){reject(error);}};poll();
      });
      try {
        current.menu.click();
        const option=await wait(()=>{const list=[...doc.querySelectorAll('[role="menu"] [role="menuitem"]')].filter(el=>visible(el)&&['封鎖','Block'].includes(normalize(el.textContent)));return list.length===1?list[0]:null;});
        check();option.click();
        const dialog=await wait(()=>{const list=[...doc.querySelectorAll('[role="dialog"]')].filter(visible);return list.length===1?list[0]:null;});
        const title=dialog.querySelector('h1,h2,h3,[role="heading"]')?.textContent;
        if(!confirmationMatches(title,person.name))throw Error('Threads 確認視窗的帳號不符，已停止。');
        const confirms=[...dialog.querySelectorAll('button,[role="button"]')].filter(el=>visible(el)&&['封鎖','Block'].includes(normalize(el.textContent)));
        if(confirms.length!==1)throw Error('無法確認 Threads 的封鎖按鈕。');
        const statuses=()=>[...doc.querySelectorAll('[role="status"],[role="alert"]')].filter(visible).map(el=>normalize(el.textContent));
        const before=new Set(statuses());check();
        if(credentials(doc).actor!==person.actor)throw Error('登入身分已改變，已停止。');
        submitted=true;confirms[0].click();
        await wait(()=>statuses().some(text=>!before.has(text)&&successMatches(text,person.name)));
        return {ok:true};
      } finally {doc.removeEventListener('pointerdown',input,true);doc.removeEventListener('keydown',input,true);}
    }
    return {block,resolve:async raw=>{const url=profileURL(raw);if(!url)throw Error('請開啟 Threads 個人檔案。');return url;}};
  }
  const api={profileURL,confirmationMatches,successMatches,author,headers,credentials,createClient};
  if(typeof module!=='undefined')module.exports=api;else globalThis.FBQuickBlockThreads=api;
})();
