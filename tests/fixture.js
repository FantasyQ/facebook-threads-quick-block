const surface=document.getElementById('surface'), results=document.getElementById('results');
const scenario=new URLSearchParams(location.search).get('scenario');let mutations=0;
const script=document.createElement('script');script.type='application/json';script.textContent=JSON.stringify({require:[['CurrentUserInitialData',[],{USER_ID:'123',ACCOUNT_ID:'123'}],['DTSGInitialData',[],{token:'fake-local-test-token'}]]});document.head.append(script);
window.chrome={runtime:{onMessage:{addListener:()=>{}}}};
window.fetch=async(url,opts)=>{
 if(opts.method!=='POST') return {ok:true,text:async()=>'<meta property="al:android:url" content="fb://profile/456">'};
 mutations++;document.getElementById('click-result').textContent=`模擬封鎖請求次數：${mutations}`;
 await new Promise(r=>setTimeout(r,300));
 if(scenario==='error')return {ok:true,text:async()=>JSON.stringify({errors:[{message:'Denied'}]})};
 return {ok:true,text:async()=>JSON.stringify({data:{user_block:{viewer:{}}}})};
};
const make=(name,id,label)=>{
 const article=document.createElement('article');article.setAttribute('role','article');article.setAttribute('aria-label',label);
 const a=document.createElement('a');a.href=`https://www.facebook.com/profile.php?id=${id}`;a.textContent=name;
 article.append(a,document.createTextNode('　這是虛構留言。'));return article;
};
const alice=make('測試 Alice','456','測試 Alice的留言1分鐘前');
const bob=make('測試 Bob','789','測試 Bob回覆測試 Alice的留言1分鐘前');alice.append(bob);surface.append(alice);
const mention=document.createElement('a');mention.href='https://www.facebook.com/profile.php?id=456';mention.textContent='測試 Alice';bob.append(mention);
setTimeout(()=>{
 let parent=bob;
 for(let depth=3;depth<=8;depth++) {
  const name='測試層級'+depth;
  const child=make(name,String(900+depth),name+'回覆測試對象的回覆1分鐘前');
  const mention=document.createElement('a');mention.href='https://www.facebook.com/profile.php?id=888';mention.textContent='測試對象';child.append(mention);
  parent.append(child);parent=child;
 }
 surface.append(make('測試 Alice','456','測試 Alice的留言2分鐘前'));
},350);
setTimeout(()=>{
 const articles=[...surface.querySelectorAll('[role="article"]')];
 const correct=articles.length===9 && articles.every(article=>{
  const buttons=[...article.querySelectorAll('.fbqb-button')].filter(b=>b.closest('[role="article"]')===article);
  const link=article.querySelector('a');
  return buttons.length===1 && buttons[0].previousElementSibling===link && buttons[0].dataset.profile===link.href && buttons[0].dataset.name===link.textContent;
 });
 results.textContent=correct?'PASS：第 1–8 層、動態展開、重複作者均正確；未誤加至內文提及':'FAIL';
},1500);
