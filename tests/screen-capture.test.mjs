import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
function fixture({blocked=false,reply=()=>({ok:true})}={}) {
  let now=100000,serial=0,storageListener,shade=null;const timers=new Map(),messages=[];
  const context={video:{videoId:'aaaaaaaaaaa'},time:42,paused:false,visible:true,ad:false,seeking:false};
  const media={readyState:4,videoWidth:1920,videoHeight:1080};
  const canvas={getContext:()=>({fillRect(){},drawImage(){},getImageData(){if(blocked)throw Error('Tainted canvas');return {data:Uint8ClampedArray.from([shade??now%251,1,2,255])};}}),toDataURL:(format,quality)=>{assert.equal(format,'image/jpeg');assert.equal(quality,.95);assert.equal(canvas.width,1280);assert.equal(canvas.height,720);if(blocked)throw Error('Tainted canvas');return 'data:image/jpeg;base64,test'+now}};
  const sandbox={crypto:webcrypto,TextEncoder,Date:{now:()=>now},setTimeout:fn=>{timers.set(++serial,fn);return serial},clearTimeout:id=>timers.delete(id),
    window:{addEventListener(){}},document:{addEventListener(){},querySelector:()=>media,createElement:()=>canvas},
    chrome:{storage:{onChanged:{addListener:fn=>storageListener=fn}},runtime:{sendMessage:async msg=>{messages.push(msg);return reply(msg)}}},
  };
  vm.createContext(sandbox);vm.runInContext(readFileSync(new URL('../content/screen-capture.js',import.meta.url),'utf8'),sandbox);
  sandbox.__recallScreen.start(()=>context,{enabled:true,screenTextEnabled:true,dwellSeconds:0});
  return {messages,context,timers,still(value){shade=value;},api:sandbox.__recallScreen,advance(seconds){now+=seconds*1000;context.time+=seconds},async tick(){const [id,fn]=timers.entries().next().value||[];if(fn){timers.delete(id);await fn()}},disable(){storageListener({settings:{newValue:{screenTextEnabled:false}}},'local')}};
}
test('screen capture samples only once per time bucket and at most once per 5 wall seconds',async()=>{
  const f=fixture();await f.tick();await f.tick();assert.equal(f.messages.length,1);
  f.advance(5);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[0].start,42);
  f.context.time=42;f.advance(5);f.context.time=42;await f.tick();assert.equal(f.messages.length,2);f.api.stop();
});
test('paused, hidden, ad and seeking states never save a frame',async()=>{
  for(const [key,value] of [['paused',true],['visible',false],['ad',true],['seeking',true]]){
    const f=fixture();f.context[key]=value;await f.tick();assert.equal(f.messages.length,0);f.api.stop();
  }
});
test('disabled capture never saves frames',async()=>{
  const off=fixture();off.disable();await off.tick();assert.equal(off.messages.length,0);assert.equal(off.timers.size,0);
});
test('leaving a video clears screen capture timers',async()=>{
  const f=fixture();f.api.stop();await f.tick();assert.equal(f.messages.length,0);assert.equal(f.timers.size,0);
});
test('a protected player reports the limitation once and stops screen capture',async()=>{
  const f=fixture({blocked:true});await f.tick();assert.equal(f.messages[0].type,'screen-capture-error');assert.equal(f.timers.size,0);
});

test('identical pixels skip JPEG/OCR once, but periodic reads prevent indefinite suppression',async()=>{
 const f=fixture();f.still(80);await f.tick();f.advance(5);await f.tick();assert.equal(f.messages.length,1);f.advance(5);await f.tick();assert.equal(f.messages.length,2);f.api.stop();
});
test('a one-byte pixel change still triggers OCR at five seconds',async()=>{
 const f=fixture();f.still(80);await f.tick();f.still(81);f.advance(5);await f.tick();assert.equal(f.messages.length,2);f.api.stop();
});
test('empty or busy frames do not reduce the five-second cadence for new pixels',async()=>{
 for(const reply of [()=>({ok:true,empty:true}),()=>({busy:true})]){const f=fixture({reply});for(let i=0;i<5;i++){await f.tick();f.advance(5);}assert.equal(f.messages.length,5);f.api.stop();}
});

test('unchanged images are re-read by wall time even during slow playback',async()=>{
 const f=fixture();f.still(80);await f.tick();f.advance(5);await f.tick();assert.equal(f.messages.length,1);f.advance(5);f.context.time=47;await f.tick();assert.equal(f.messages.length,2);f.api.stop();
});
