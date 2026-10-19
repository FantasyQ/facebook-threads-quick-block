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
setTimeout(()=>{bob.append(make('測試 Carol','987','測試 Carol回覆測試 Bob的留言1分鐘前'));surface.append(make('測試 Alice','456','測試 Alice的留言2分鐘前'));},350);
setTimeout(()=>{results.textContent=document.querySelectorAll('.fbqb-button').length===4?'PASS：回覆、動態留言與同帳號多則留言辨識正常':'FAIL';},1200);
