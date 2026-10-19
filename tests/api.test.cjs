const {test}=require('node:test');const assert=require('node:assert/strict');
const A=require('../extension/api.js'),C=require('../extension/core.js');
const doc={querySelectorAll:()=>[{textContent:JSON.stringify({require:[['CurrentUserInitialData',[],{USER_ID:'123',ACCOUNT_ID:'123'}],['DTSGInitialData',[],{token:'test-token'}],['LSD',[],{token:'test-lsd'}]]})}]};
const response=value=>({ok:true,text:async()=>JSON.stringify(value)});
const success={data:{user_block:{viewer:{}}}};
const client=fetcher=>A.createClient({doc,fetcher,parseHTML:()=>({querySelectorAll:()=>[{getAttribute:()=> 'fb://profile/456'}]}),canonical:C.profileURL});
test('authentication modules are parsed without executing page code',()=>{
 assert.deepEqual(A.credentials(doc),{actor:'123',dtsg:'test-token',lsd:'test-lsd'});
 assert.throws(()=>A.credentials({querySelectorAll:()=>[]}),/登入/);
});
test('only explicit unambiguous profile metadata resolves vanity IDs',()=>{
 assert.equal(A.targetID('https://www.facebook.com/profile.php?id=456'),'456');
 assert.equal(A.targetID('https://www.facebook.com/alice',{querySelectorAll:()=>[{getAttribute:()=> 'fb://profile/456'},{getAttribute:()=> 'fb://profile/789'}]}),null);
 assert.equal(A.targetID('https://www.facebook.com/alice',{querySelectorAll:()=>[]}),null);
});
test('success requires user_block, not merely HTTP 200',()=>{
 assert.deepEqual(A.parseResponse(JSON.stringify(success)),{ok:true});
 for(const value of [{data:{}},{errors:[{message:'denied'}],...success},{data:{user_block:null}}])assert.throws(()=>A.parseResponse(JSON.stringify(value)));
 assert.throws(()=>A.parseResponse('<html>login</html>'));
});
test('direct request uses target ID, session credentials, and same-origin endpoint',async()=>{
 const calls=[];const a=client(async(url,options)=>{calls.push({url,options});return response(success)});
 await a.block('https://www.facebook.com/profile.php?id=456');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://www.facebook.com/api/graphql/');
 const opts=calls[0].options;assert.equal(opts.credentials,'same-origin');assert.equal(opts.redirect,'error');
 assert.equal(JSON.parse(opts.body.get('variables')).input.user_id,'456');
 assert.equal(opts.body.get('fb_api_req_friendly_name'),'ProfileCometActionBlockUserMutation');
});
test('concurrent duplicate and completed requests are not sent again',async()=>{
 let count=0,release;const a=client(()=>{count++;return new Promise(r=>release=()=>r(response(success)))});
 const first=a.block('https://www.facebook.com/456'),second=a.block('https://www.facebook.com/456');await Promise.resolve();release();
 await Promise.all([first,second]);await a.block('https://www.facebook.com/456');assert.equal(count,1);
});
test('vanity URL uses one read then one mutation',async()=>{
 const methods=[];const a=client(async(url,opts)=>{methods.push(opts.method||'GET');if(!opts.method)assert.equal(opts.headers.Accept,'text/html');return opts.method?response(success):{ok:true,text:async()=>'<html></html>'}});
 await a.block('https://www.facebook.com/alice');assert.deepEqual(methods,['GET','POST']);
});
test('reject self and foreign URLs without network requests',async()=>{
 let calls=0;const a=client(async()=>{calls++;return response(success)});
 await assert.rejects(a.block('https://www.facebook.com/123'),/目前登入/);
 await assert.rejects(a.block('https://evil.test/456'),/網址/);assert.equal(calls,0);
});
test('timeouts and server errors do not auto retry or become success',async()=>{
 let calls=0;const a=client(async()=>{calls++;throw new DOMException('timeout','TimeoutError')});
 await assert.rejects(a.block('https://www.facebook.com/456'),/結果尚未確認/);assert.equal(calls,1);
 await assert.rejects(client(async()=>response({errors:[{}]})).block('https://www.facebook.com/456'),/拒絕/);
});
const profileDoc=(records,metas=[])=>({querySelectorAll:selector=>selector.startsWith('script')?[{textContent:JSON.stringify({require:[['RelayPrefetchedStreamCache','next',[],[{data:records}]]]})}]:metas.map(id=>({getAttribute:()=>`fb://profile/${id}`}))});
test('username profile resolves its typed User record, ignoring viewer and shared author',()=>{
 const records=[{__typename:'User',id:'123',url:'https://www.facebook.com/viewer'}, {__typename:'Page',id:'789',url:'https://www.facebook.com/example.person'}, {__typename:'User',id:'456000123456789',url:'https://www.facebook.com/example.person'}];
 assert.equal(A.targetID('https://www.facebook.com/example.person?comment_id=anything',profileDoc(records)),'456000123456789');
 assert.equal(A.targetID('https://www.facebook.com/example.person',profileDoc([{id:'456',url:'https://www.facebook.com/example.person'}])),null);
 for(const url of ['https://evil.test/example.person','https://www.facebook.com/example.person/posts/123','https://www.facebook.com/other']) assert.equal(A.targetID('https://www.facebook.com/example.person',profileDoc([{__typename:'User',id:'456',url}])),null);
});
test('conflicting profile evidence fails closed',()=>{
 const records=[{__typename:'User',id:'456',url:'https://www.facebook.com/alice'}, {__typename:'User',id:'789',profile_url:'https://www.facebook.com/alice'}];
 assert.equal(A.targetID('https://www.facebook.com/alice',profileDoc(records)),null);
 assert.equal(A.targetID('https://www.facebook.com/alice',profileDoc(records.slice(0,1),['789'])),null);
});
test('resolve only reads and does not block; missing IDs never send a mutation',async()=>{
 const methods=[];const a=A.createClient({doc,canonical:C.profileURL,parseHTML:()=>profileDoc([{__typename:'User',id:'456',url:'https://www.facebook.com/alice'}]),fetcher:async(url,opts)=>{methods.push(opts.method||'GET');return {ok:true,text:async()=>''}}});
 assert.equal(await a.resolve('https://www.facebook.com/alice'),'456');assert.deepEqual(methods,['GET']);
 const b=A.createClient({doc,canonical:C.profileURL,parseHTML:()=>profileDoc([]),fetcher:async(url,opts)=>{methods.push(opts.method||'GET');return {ok:true,text:async()=>''}}});
 await assert.rejects(b.block('https://www.facebook.com/alice'),/ID/);assert.deepEqual(methods,['GET','GET']);
});
