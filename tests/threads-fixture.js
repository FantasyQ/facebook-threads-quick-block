window.chrome={runtime:{onMessage:{addListener(){}}}};
const scenario=new URLSearchParams(location.search).get('scenario');let count=0;
for(const name of ['alice','bob']) {
 const article=document.createElement('article');article.innerHTML=`<header><span><a href="https://www.threads.com/@${name}">${name}</a></span><a href="https://www.threads.com/@${name}/post/test"><time>1分鐘</time></a><button aria-haspopup="menu" aria-label="更多">更多</button></header><p>模擬留言提及 <a href="https://www.threads.com/@other">@other</a></p>`;
 document.getElementById('posts').append(article);
 article.querySelector('button').onclick=()=>{
  const menu=document.createElement('div');menu.setAttribute('role','menu');menu.innerHTML='<button role="menuitem">封鎖</button>';article.append(menu);
  menu.firstChild.onclick=()=>{menu.remove();const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.innerHTML=`<h2>封鎖${scenario==='mismatch'?'wrong_target':name}？</h2><button>封鎖</button><button>取消</button>`;document.body.append(dialog);
   dialog.lastChild.onclick=()=>dialog.remove();dialog.querySelector('button').onclick=()=>{count++;document.getElementById('result').textContent=`模擬送出 ${count} 次`;dialog.remove();const status=document.createElement('p');status.setAttribute('role','status');status.textContent=`已封鎖「${name}」。`;document.body.append(status);};
  };
 };
}
