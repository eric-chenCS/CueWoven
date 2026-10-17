import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture({blocked=false}={}) {
  let now=100000,serial=0,storageListener;const timers=new Map(),messages=[];
  const context={video:{videoId:'aaaaaaaaaaa'},time:42,paused:false,visible:true,ad:false,seeking:false,forced:false};
  const media={readyState:4,videoWidth:1920,videoHeight:1080};
  const canvas={getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>{if(blocked)throw Error('Tainted canvas');return 'data:image/jpeg;base64,test'}};
  const sandbox={Date:{now:()=>now},setTimeout:fn=>{timers.set(++serial,fn);return serial},clearTimeout:id=>timers.delete(id),
    window:{addEventListener(){}},document:{addEventListener(){},querySelector:()=>media,createElement:()=>canvas},
    chrome:{storage:{onChanged:{addListener:fn=>storageListener=fn}},runtime:{sendMessage:async msg=>{messages.push(msg);return {ok:true}}}},
  };
  vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../content/scene-capture.js',import.meta.url),'utf8'),sandbox);
  sandbox.__recallScenes.start(()=>context,{enabled:true,scenesEnabled:true,dwellSeconds:0});
  return {messages,context,timers,api:sandbox.__recallScenes,advance(seconds){now+=seconds*1000;context.time+=seconds},async tick(){const [id,fn]=timers.entries().next().value||[];if(fn){timers.delete(id);await fn()}},disable(){storageListener({settings:{newValue:{scenesEnabled:false}}},'local')}};
}
test('scene capture samples only once per time bucket and at most once per 20 wall seconds',async()=>{
  const f=fixture();await f.tick();await f.tick();assert.equal(f.messages.length,1);
  f.advance(20);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[0].start,42);
  f.context.time=42;f.advance(20);f.context.time=42;await f.tick();assert.equal(f.messages.length,2);f.api.stop();
});
test('paused, hidden, ad and seeking states never save a frame',async()=>{
  for(const [key,value] of [['paused',true],['visible',false],['ad',true],['seeking',true]]){
    const f=fixture();f.context[key]=value;await f.tick();assert.equal(f.messages.length,0);f.api.stop();
  }
});
test('history capture tabs and disabled capture never save frames',async()=>{
  const f=fixture();f.context.forced=true;await f.tick();assert.equal(f.messages.length,0);
  const off=fixture();off.disable();await off.tick();assert.equal(off.messages.length,0);assert.equal(off.timers.size,0);
});
test('leaving a video clears scene capture timers',async()=>{
  const f=fixture();f.api.stop();await f.tick();assert.equal(f.messages.length,0);assert.equal(f.timers.size,0);
});
test('a protected player reports the limitation once and stops scene capture',async()=>{
  const f=fixture({blocked:true});await f.tick();assert.equal(f.messages[0].type,'scene-capture-error');assert.equal(f.timers.size,0);
});
