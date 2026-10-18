import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture({dwellSeconds=20, metadataError=false}={}) {
  const events=new Map(), messages=[], timers=new Map(), requests=[], visuals=[];
  let nextTimer=0, browserWindow;
  const rect={width:300,height:500,top:0,left:0,right:300,bottom:500};
  const neighbour={paused:false,ended:false,readyState:4,currentTime:99,getBoundingClientRect:()=>({...rect,left:-500,right:-200}),closest:()=>null};
  const active={...neighbour,currentTime:7,getBoundingClientRect:()=>rect};
  const location=new URL('https://www.youtube.com/shorts/aaaaaaaaaaa');
  const context=vm.createContext({URLSearchParams,location,Date,innerWidth:1000,innerHeight:800,
    setTimeout:(fn,ms)=>{timers.set(++nextTimer,{fn,ms});return nextTimer},clearTimeout:id=>timers.delete(id),
    document:{hidden:false,querySelectorAll:()=>[neighbour,active],addEventListener(){},removeEventListener(){}},
    __recallScenes:{start:(_clock,options)=>visuals.push(options)},
    chrome:{storage:{local:{get:async()=>({settings:{enabled:true,dwellSeconds}})}},runtime:{onMessage:{addListener(){}},sendMessage:async msg=>{
      messages.push(msg);return msg.type==='should-index'?{index:true}:msg.type==='index-metadata'&&metadataError?{error:'Storage failed'}:{ok:true};
    }}},addEventListener:(name,fn)=>events.set(name,fn),postMessage:msg=>{if(msg.type==='getTranscript')requests.push(msg)},
  });
  vm.runInContext('window=globalThis',context);browserWindow=vm.runInContext('window',context);
  vm.runInContext(readFileSync(new URL('../content/yt-bridge.js',import.meta.url),'utf8'),context);
  const emit=data=>events.get('message')({source:browserWindow,origin:location.origin,data:{source:'recall-main',...data}});
  return {messages,timers,requests,context,active,visuals,
    async video(video={}){emit({type:'video',video:{videoId:'aaaaaaaaaaa',title:'A short',shortForm:true,...video}});await flush()},
    async dwell(){const entry=[...timers].find(([,timer])=>timer.ms<=20000);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();await flush()},
    async captions(segments=[]){emit({type:'transcript',reqId:requests.at(-1).reqId,segments});await flush()},
  };
}
for(const [video,expected] of [[{shortForm:true},5000],[{shortForm:false,lengthSeconds:12},5000],[{shortForm:false,lengthSeconds:180},20000]]) {
  test(`save delay is ${expected}ms for ${JSON.stringify(video)}`,async()=>{
    const f=fixture();await f.video(video);assert.equal([...f.timers.values()][0].ms,expected);assert.equal(f.visuals[0].dwellSeconds,expected/1000);
  });
}
test('a shorter watch-time setting is retained for Shorts',async()=>{const f=fixture({dwellSeconds:2});await f.video();assert.equal([...f.timers.values()][0].ms,2000)});
test('metadata is sent before captions finish and no-captions fallback reports title saved',async()=>{
  const f=fixture();await f.video();await f.dwell();
  assert.equal(f.messages.find(msg=>msg.type==='index-metadata').video.title,'A short');
  await f.captions();assert.equal(f.messages.find(msg=>msg.type==='index-failed').metadataSaved,true);
});
test('failed metadata storage is not reported as a saved title',async()=>{
  const f=fixture({metadataError:true});await f.video();await f.dwell();await f.captions();assert.equal(f.messages.find(msg=>msg.type==='index-failed').metadataSaved,false);
});
test('swiping starts the next capture while the previous transcript is still pending',async()=>{
  const f=fixture();await f.video();await f.dwell();await f.video({videoId:'bbbbbbbbbbb'});await f.dwell();
  assert.deepEqual(f.requests.map(msg=>msg.videoId),['aaaaaaaaaaa','bbbbbbbbbbb']);
});
test('YouTube scene, screen and speech hooks select the visible video over the first neighbour',async()=>{
  const f=fixture();await f.video();assert.equal(f.context.__recallMediaElement(),f.active);
  f.active.checkVisibility=()=>false;assert.equal(f.context.__recallMediaElement(),null);
});
