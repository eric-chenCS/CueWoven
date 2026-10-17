import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function fixture({blocked=false,reply=()=>({ok:true})}={}){
 let now=100000,serial=0,storageListener,shade=0;const timers=new Map(),messages=[],sizes=[];
 const context={video:{videoId:'aaaaaaaaaaa'},time:42,paused:false,visible:true,ad:false,seeking:false,forced:false,revision:1},media={readyState:4,videoWidth:1920,videoHeight:1080};
 const canvas=()=>{const node={getContext:()=>({fillRect(){},drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(96*54*4).fill(shade)})}),toDataURL:()=>{if(blocked)throw Error('Tainted canvas');sizes.push([node.width,node.height]);return 'data:image/jpeg;base64,test'+shade}};return node;};
 const sandbox={Date:{now:()=>now},setTimeout:fn=>{timers.set(++serial,fn);return serial},clearTimeout:id=>timers.delete(id),window:{addEventListener(){}},document:{addEventListener(){},querySelector:()=>media,createElement:canvas},chrome:{storage:{onChanged:{addListener:fn=>storageListener=fn}},runtime:{sendMessage:async msg=>{messages.push(msg);return reply(msg)}}}};
 vm.createContext(sandbox);for(const file of ['../lib/scene-policy.js','../content/scene-capture.js'])vm.runInContext(readFileSync(new URL(file,import.meta.url),'utf8'),sandbox);
 sandbox.__recallScenes.start(()=>context,{enabled:true,scenesEnabled:true,dwellSeconds:0});
 return {messages,context,timers,media,sizes,shade(value){shade=value;},api:sandbox.__recallScenes,advance(seconds){now+=seconds*1000;context.time+=seconds},async tick(){const entry=timers.entries().next().value;if(entry){timers.delete(entry[0]);await entry[1]();}},disable(){storageListener({settings:{newValue:{scenesEnabled:false}}},'local');}};
}
test('portrait and square snapshots preserve useful image area at the same pixel budget',async()=>{
 for(const [width,height,expected] of [[1080,1920,[180,320]],[1080,1080,[240,240]],[1920,1080,[320,180]]]){const f=fixture();f.media.videoWidth=width;f.media.videoHeight=height;await f.tick();assert.deepEqual(f.sizes[0],expected);assert.equal(expected[0]*expected[1],57600);f.api.stop();}
});
test('quiet video stretches routine snapshots to 60 seconds and skips visited buckets',async()=>{
 const f=fixture();await f.tick();await f.tick();assert.equal(f.messages.length,1);f.advance(20);await f.tick();assert.equal(f.messages.length,1);f.advance(40);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[0].start,42);f.advance(60);f.context.time=42;await f.tick();assert.equal(f.messages.length,2);f.api.stop();
});
test('paused, hidden, ad and seeking states never save a frame',async()=>{
 for(const [key,value] of [['paused',true],['visible',false],['ad',true],['seeking',true]]){const f=fixture();f.context[key]=value;await f.tick();assert.equal(f.messages.length,0);f.api.stop();}
});
test('minor visual noise stays quiet, but a cut after a quiet stretch captures immediately',async()=>{
 const f=fixture();await f.tick();for(let i=1;i<=80;i++){f.advance(.5);f.shade(i%2?8:0);await f.tick();}assert.equal(f.messages.length,1);f.advance(.5);f.shade(200);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[1].start,82.5);f.api.stop();
});
test('history capture tabs and disabled capture never save frames',async()=>{
 const f=fixture();f.context.forced=true;await f.tick();assert.equal(f.messages.length,0);const off=fixture();off.disable();await off.tick();assert.equal(off.messages.length,0);assert.equal(off.timers.size,0);
});
test('leaving a video clears scene capture timers',async()=>{const f=fixture();f.api.stop();await f.tick();assert.equal(f.messages.length,0);assert.equal(f.timers.size,0);});
test('a model failure backs off instead of retrying at every probe',async()=>{
 const f=fixture({reply:()=>({error:'Model download unavailable'})});await f.tick();for(let i=0;i<39;i++){f.advance(.5);await f.tick();}assert.equal(f.messages.filter(msg=>msg.type==='scene-frame').length,1);f.advance(.5);await f.tick();assert.equal(f.messages.filter(msg=>msg.type==='scene-frame').length,2);f.api.stop();
});
test('a protected player reports the limitation once and stops scene capture',async()=>{const f=fixture({blocked:true});await f.tick();assert.equal(f.messages[0].type,'scene-capture-error');assert.equal(f.timers.size,0);});
test('a visual event between baseline frames produces an extra timestamped scene',async()=>{
 const f=fixture();await f.tick();f.advance(7);f.shade(180);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[1].adaptive,true);assert.equal(f.messages[1].start,49);f.advance(13);await f.tick();assert.equal(f.messages.length,3);assert.equal(f.messages[2].adaptive,false);f.api.stop();
});
test('probes continue during inference and retain the first short event in one waiting slot',async()=>{
 let finish;const f=fixture({reply:msg=>msg.adaptive===false?new Promise(resolve=>finish=resolve):({ok:true})});const initial=f.tick();f.advance(.5);f.shade(180);await f.tick();f.advance(.5);f.shade(0);await f.tick();assert.equal(f.messages.length,1);finish({ok:true});await initial;f.advance(1);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[1].image,'data:image/jpeg;base64,test180');assert.equal(f.messages[1].start,42.5);f.api.stop();
});
test('busy retries retain a brief event, while stale waiting frames expire',async()=>{
 let busy=true;const f=fixture({reply:msg=>msg.adaptive&&busy?({busy:true}):({ok:true})});await f.tick();f.advance(3);f.shade(180);await f.tick();f.advance(.5);f.shade(0);await f.tick();busy=false;f.advance(1.5);await f.tick();assert.equal(f.messages.at(-1).image,'data:image/jpeg;base64,test180');f.api.stop();
 let finish;const stale=fixture({reply:()=>new Promise(resolve=>finish=resolve)});const job=stale.tick();stale.advance(.5);stale.shade(180);await stale.tick();stale.advance(11);await stale.tick();finish({ok:true});await job;stale.advance(1);await stale.tick();assert.equal(stale.messages.length,1);stale.api.stop();
});
test('continuous motion is bounded to six extra captures per rolling minute',async()=>{
 const f=fixture();await f.tick();for(let i=1;i<40;i++){f.advance(.5);f.shade(i%2?200:0);await f.tick();}assert.equal(f.messages.filter(msg=>msg.adaptive).length,6);f.api.stop();
});
test('disabling capture discards a queued event and ignores an old response',async()=>{
 let finish;const f=fixture({reply:()=>new Promise(resolve=>finish=resolve)});const job=f.tick();f.advance(.5);f.shade(180);await f.tick();f.disable();finish({ok:true});await job;f.advance(3);await f.tick();assert.equal(f.messages.length,1);assert.equal(f.timers.size,0);
});
test('a seek revision drops an old queued event before it can attach to new playback',async()=>{
 let finish,first=true;const f=fixture({reply:()=>{if(first){first=false;return new Promise(resolve=>finish=resolve);}return {ok:true};}});const job=f.tick();f.advance(.5);f.shade(180);await f.tick();f.context.revision++;f.context.time=400;await f.tick();finish({ok:true});await job;f.advance(2);await f.tick();assert.equal(f.messages.length,2);assert.equal(f.messages[1].start,400);assert.equal(f.messages[1].revision,2);f.api.stop();
});
