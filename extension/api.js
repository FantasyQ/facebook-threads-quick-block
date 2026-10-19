/* Same-origin Facebook adapter. Never persist or log authentication values. */
(() => {
  const OPERATION = 'ProfileCometActionBlockUserMutation';
  const DOC_ID = '27871511059188774'; // Observed 2026-10-19; private interface, fail closed on change.
  const digits = value => typeof value === 'string' && /^\d+$/.test(value);
  function findModule(doc, name) {
    let result;
    function visit(value) {
      if (!value || typeof value !== 'object' || result) return;
      if (Array.isArray(value) && value[0] === name && value[2] && typeof value[2] === 'object') { result = value[2]; return; }
      for (const child of Object.values(value)) visit(child);
    }
    for (const script of doc.querySelectorAll('script[type="application/json"]')) {
      try { visit(JSON.parse(script.textContent)); } catch { /* Ignore non-JSON scripts. */ }
      if (result) break;
    }
    return result;
  }
  function credentials(doc) {
    const viewer = findModule(doc, 'CurrentUserInitialData');
    const dtsg = findModule(doc, 'DTSGInitialData');
    const lsd = findModule(doc, 'LSD');
    const actor = String(viewer?.USER_ID || '');
    if (!digits(actor) || actor === '0' || !dtsg?.token) throw Error('無法取得目前登入驗證資料，請重新整理 Facebook 後再試。');
    // Do not silently act as a Page or another managed identity.
    if (viewer.ACCOUNT_ID && String(viewer.ACCOUNT_ID) !== actor) throw Error('請切換回個人帳號後再試。');
    return {actor, dtsg:dtsg.token, lsd:lsd?.token};
  }
  function targetID(url, doc) {
    const u = new URL(url);
    if (u.pathname === '/profile.php' && digits(u.searchParams.get('id'))) return u.searchParams.get('id');
    if (/^\/\d+\/?$/.test(u.pathname)) return u.pathname.replaceAll('/','');
    if (!doc) return null;
    const ids = new Set();
    for (const meta of doc.querySelectorAll('meta[property="al:android:url"],meta[property="al:ios:url"]')) {
      const match = /^fb:\/\/profile\/(\d+)\/?$/.exec(meta.getAttribute('content') || '');
      if (match) ids.add(match[1]);
    }
    // Match a typed User record to the exact requested profile URL. Other
    // IDs (viewer, shared posts, comments and recommendations) are irrelevant.
    const profileKey = raw => {
      try {
        const value = new URL(raw);
        if (value.origin !== 'https://www.facebook.com') return null;
        return value.pathname.replace(/\/$/, '').toLowerCase();
      } catch { return null; }
    };
    const key = profileKey(url);
    function visit(value) {
      if (!value || typeof value !== 'object') return;
      if (value.__typename === 'User' && digits(value.id) &&
          [value.url, value.profile_url].some(raw => typeof raw === 'string' && profileKey(raw) === key)) ids.add(value.id);
      for (const child of Object.values(value)) visit(child);
    }
    for (const script of doc.querySelectorAll('script[type="application/json"]')) {
      try { visit(JSON.parse(script.textContent)); } catch { /* Not executable code. */ }
    }
    return ids.size === 1 ? [...ids][0] : null;
  }
  function parseResponse(text) {
    const clean = text.replace(/^for\s*\(;;\);\s*/, '').trim();
    let data;
    try { data = JSON.parse(clean); } catch { throw Error('Facebook 回應格式已變更，無法確認封鎖結果；請先查看封鎖名單。'); }
    if (data.errors?.length || data.error) throw Error('Facebook 拒絕此封鎖請求；請查看原生封鎖功能或稍後再試。');
    if (!data.data?.user_block?.viewer || typeof data.data.user_block.viewer !== 'object') throw Error('未收到 Facebook 的封鎖成功回應；請先查看封鎖名單。');
    return {ok:true};
  }
  function bodyFor(auth,id) {
    return new URLSearchParams({
      av:auth.actor, __user:auth.actor, __a:'1', fb_dtsg:auth.dtsg,
      ...(auth.lsd ? {lsd:auth.lsd} : {}),
      fb_api_caller_class:'RelayModern', fb_api_req_friendly_name:OPERATION,
      server_timestamps:'true', doc_id:DOC_ID,
      variables:JSON.stringify({collectionID:null,hasCollectionAndSectionID:false,input:{blocksource:'PROFILE',should_apply_to_later_created_profiles:false,user_id:id,actor_id:auth.actor,client_mutation_id:'1'},scale:2,sectionID:null,isPrivacyCheckupContext:false,__relay_internal__pv__FBProfile_enable_perf_improv_gkrelayprovider:true})
    });
  }
  function createClient({doc,fetcher,parseHTML,canonical}) {
    const active = new Map(), completed = new Set();
    async function resolve(raw) {
      const url = canonical(raw);
      if (!url) throw Error('無法辨識目標帳號網址。');
      let id = targetID(url);
      if (!id) {
        const response = await fetcher(url,{headers:{Accept:'text/html'},credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw Error('無法讀取目標個人檔案。');
        const html = await response.text();
        const parsed = parseHTML(html);
        id = targetID(url,parsed);
        if (!id) throw Error('無法可靠取得此帳號的 ID，請使用 Facebook 原生封鎖功能。');
      }
      return id;
    }
    async function block(raw) {
      const auth = credentials(doc);
      const id = await resolve(raw);
      if (id === auth.actor) throw Error('不能封鎖目前登入的帳號。');
      const key = `${auth.actor}:${id}`;
      if (completed.has(key)) return {ok:true};
      if (active.has(key)) return active.get(key);
      const request = (async () => {
        try {
          const response = await fetcher('https://www.facebook.com/api/graphql/',{
            method:'POST',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(20000),
            headers:{'Content-Type':'application/x-www-form-urlencoded','X-FB-Friendly-Name':OPERATION},body:bodyFor(auth,id)
          });
          if (!response.ok) throw Error('Facebook 未接受請求，請先確認封鎖名單後再試。');
          const result = parseResponse(await response.text());
          completed.add(key); return result;
        } catch (error) {
          if (error.name === 'TimeoutError' || error.name === 'AbortError' || error instanceof TypeError) throw Error('連線中斷或逾時，結果尚未確認。請先查看 Facebook 封鎖名單，避免重複操作。');
          throw error;
        } finally { active.delete(key); }
      })();
      active.set(key,request); return request;
    }
    return {block,resolve};
  }
  const api = {findModule,credentials,targetID,parseResponse,bodyFor,createClient};
  if (typeof module !== 'undefined') module.exports = api; else globalThis.FBQuickBlockAPI = api;
})();
