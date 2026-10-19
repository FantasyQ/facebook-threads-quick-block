/* One in-memory queue per Facebook tab. Never retry an uncertain mutation. */
(() => {
  function createQueue({run,onChange=()=>{},interval=2000,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
    const waiting=[],known=new Map();
    let active=null,paused=false,busy=false,completed=0,failed=0,reason='';
    const snapshot=()=>({waiting:waiting.length,active:active?.name||null,paused,completed,failed,reason});
    const emit=(item,state)=>onChange(snapshot(),item,state);
    async function pump() {
      if(busy||paused||!waiting.length)return;
      busy=true;
      try {
        while(!paused&&waiting.length) {
          active=waiting.shift();known.set(active.key,'pending');emit(active,'pending');
          try {await run(active);known.set(active.key,'done');completed++;emit(active,'done');}
          catch(error) {known.delete(active.key);failed++;paused=true;reason=error?.message||'處理失敗，佇列已暫停。';emit(active,'error');}
          active=null;emit();
          // Keep a gap even if new items arrive just after the queue empties.
          await sleep(interval);
        }
      } finally {busy=false;if(!paused&&waiting.length)void pump();}
    }
    return {
      add(item) {if(known.has(item.key))return false;known.set(item.key,'queued');waiting.push(item);emit(item,'queued');void pump();return true;},
      pause() {paused=true;reason='已手動暫停；進行中的項目會完成。';emit();},
      resume() {paused=false;reason='';emit();void pump();},
      cancelWaiting() {for(const item of waiting.splice(0)){known.delete(item.key);emit(item,'cancelled');}emit();},
      snapshot
    };
  }
  if(typeof module!=='undefined')module.exports={createQueue};else globalThis.FBQuickBlockQueue={createQueue};
})();
