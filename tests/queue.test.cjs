const {test}=require('node:test'),assert=require('node:assert/strict');
const {createQueue}=require('../extension/queue.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const item=n=>({key:String(n),name:`Person ${n}`});
test('30 rapid clicks run sequentially with an interval and deduplicate pending/completed entries',async()=>{
 let inFlight=0,max=0;const order=[],gaps=[];
 const q=createQueue({run:async p=>{inFlight++;max=Math.max(max,inFlight);await tick();order.push(p.key);inFlight--;},sleep:async ms=>{gaps.push(ms);await tick();}});
 for(let n=0;n<30;n++){assert.equal(q.add(item(n)),true);assert.equal(q.add(item(n)),false);}
 for(let n=0;n<100&&q.snapshot().completed<30;n++)await tick();
 assert.equal(max,1);assert.deepEqual(order,Array.from({length:30},(_,n)=>String(n)));assert.equal(q.snapshot().completed,30);assert.equal(q.add(item(0)),false);assert.ok(gaps.every(ms=>ms===2000));assert.ok(gaps.length>=29);
});
test('failure pauses remaining work and resume does not retry the failed mutation',async()=>{
 const order=[];const q=createQueue({run:async p=>{order.push(p.key);if(p.key==='1')throw Error('uncertain');},sleep:async()=>{}});
 q.add(item(1));q.add(item(2));await tick();
 assert.deepEqual(order,['1']);assert.equal(q.snapshot().paused,true);assert.equal(q.snapshot().waiting,1);assert.equal(q.snapshot().reason,'uncertain');
 q.resume();await tick();assert.deepEqual(order,['1','2']);assert.equal(q.snapshot().completed,1);
});
test('pause and cancel leave active request alone and allow cancelled items to be added later',async()=>{
 let release;const changes=[],order=[];const q=createQueue({run:p=>{order.push(p.key);return new Promise(r=>release=r)},sleep:async()=>{},onChange:(s,p,state)=>{if(p)changes.push([p.key,state])}});
 q.add(item(1));q.add(item(2));q.pause();q.cancelWaiting();release();await tick();
 assert.deepEqual(order,['1']);assert.equal(q.snapshot().waiting,0);assert.ok(changes.some(([key,state])=>key==='2'&&state==='cancelled'));
 assert.equal(q.add(item(2)),true);await tick();assert.deepEqual(order,['1']);q.resume();assert.deepEqual(order,['1','2']);release();await tick();
});
test('new work during the interval waits until the gap ends',async()=>{
 let releaseGap;const calls=[];const q=createQueue({run:async p=>calls.push(p.key),sleep:()=>new Promise(r=>releaseGap=r)});
 q.add(item(1));await tick();q.add(item(2));assert.deepEqual(calls,['1']);releaseGap();await tick();assert.deepEqual(calls,['1','2']);releaseGap();
});
