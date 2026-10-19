(async()=>{
 const status=document.getElementById('status');
 try {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const result=await chrome.tabs.sendMessage(tab.id,{type:'fbqb-status'});
  status.textContent=result.ready?(result.platform==='Threads'?'Threads 原生封鎖流程已就緒。':'API 登入驗證已就緒。'):result.error;
 } catch {status.textContent='請開啟或重新整理 Facebook 或 Threads 分頁。';}
})();
document.getElementById('check').addEventListener('click',async event=>{
 const button=event.currentTarget,output=document.getElementById('profile-status');
 button.disabled=true;output.textContent='辨識中…';
 try {
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const result=await chrome.tabs.sendMessage(tab.id,{type:'fbqb-check-profile'});
  output.textContent=result.ok?'目前個人檔案可正確辨識，未送出封鎖請求。':result.error;
 } catch {output.textContent='請先開啟目標的 Facebook 或 Threads 個人檔案並重新整理。';}
 finally {button.disabled=false;}
});
