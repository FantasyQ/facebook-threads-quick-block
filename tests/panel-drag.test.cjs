const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const source = fs.readFileSync(require.resolve('../extension/content.js'),'utf8');
  const code = source.slice(source.indexOf('  function installQueueDrag('),source.indexOf('  function renderQueue('));
  let resize;
  const host = {style:{},getBoundingClientRect:()=>({
    left:parseFloat(host.style.left)||18,top:parseFloat(host.style.top)||300,width:200,height:100
  })};
  const handlers = {};
  const handle = {style:{},title:'',closest:()=>handle,
    addEventListener:(name,fn)=>{handlers[name]=fn;},
    setPointerCapture:()=>{},hasPointerCapture:()=>true,releasePointerCapture:()=>{}};
  const window = {innerWidth:800,innerHeight:600,addEventListener:(_,fn)=>{resize=fn;}};
  const context = vm.createContext({window,ResizeObserver:class {observe(){}},Math});
  vm.runInContext(code,context);
  context.installQueueDrag(host,[handle]);
  const send = (type,overrides={}) => {
    const event = {isPrimary:true,button:0,pointerId:1,clientX:50,clientY:320,target:handle,detail:1,
      preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...overrides};
    handlers[type](event);return event;
  };
  return {host,handle,window,send,resize:()=>resize()};
}

test('drag moves and clamps panel, suppresses only the drag click, and permits the next tap',()=>{
  const {host,send}=setup();
  send('pointerdown');
  send('pointermove',{clientX:52,clientY:321});
  assert.equal(host.style.left,undefined);
  send('pointermove',{clientX:1000,clientY:-100});
  assert.equal(host.style.left,'600px');
  assert.equal(host.style.top,'0px');
  send('pointerup');
  assert.equal(send('click').stopped,true);
  send('pointerdown');send('pointerup');
  assert.equal(send('click').stopped,undefined);
});

test('controls do not drag, pointer cancellation ends movement, and resize keeps panel visible',()=>{
  const {host,send,window,resize}=setup();
  send('pointerdown',{target:{closest:()=>({})}});
  send('pointermove',{clientX:700});
  assert.equal(host.style.left,undefined);
  send('pointerdown');send('pointermove',{clientX:700,clientY:580});
  send('pointercancel');
  const left=host.style.left;
  send('pointermove',{clientX:10});
  assert.equal(host.style.left,left);
  window.innerWidth=300;window.innerHeight=200;resize();
  assert.equal(host.style.left,'100px');
  assert.equal(host.style.top,'100px');
  assert.equal(send('click',{detail:0}).stopped,undefined);
});
