import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture({paused=false,captions=false,language=null,attempt=true,holdFailure=false}={}) {
  let available=captions,enabled=true,releaseTranscript;
  const messages=[],events=new Map(),media={paused,currentTime:100,playbackRate:1,readyState:4,getBoundingClientRect:()=>({width:640,height:360,top:0,left:0,right:640,bottom:360}),closest:()=>null};let listener, browserWindow;
  const location=new URL(`https://www.youtube.com/watch?v=aaaaaaaaaaa`);
  const add=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn)};
  const ctx={URLSearchParams,location,Date,innerWidth:1000,innerHeight:800,
    setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer},clearTimeout,
    document:{hidden:false,querySelectorAll:selector=>selector==='video'?[media]:[],querySelector:selector=>selector==='video'?media:null,addEventListener:add,removeEventListener(){}},
    chrome:{storage:{local:{get:async()=>({settings:{enabled,dwellSeconds:3600}})}},runtime:{
      onMessage:{addListener:fn=>listener=fn},sendMessage:async msg=>{messages.push(msg);return msg.type==='should-index'?{index:enabled,reason:enabled?undefined:'Indexing is paused'}:{ok:true}},
    }},addEventListener:add,
    postMessage(msg){if(msg.type==='getTranscript'){
      const segments=available?[{start:0,text:'caption'}]:[];
      const respond=()=>events.get('message').forEach(fn=>fn({source:browserWindow,origin:location.origin,data:{source:'recall-main',type:'transcript',reqId:msg.reqId,segments}}));
      if(holdFailure&&!available)releaseTranscript=respond;else respond();
    }},
  };
  ctx.window=ctx;vm.createContext(ctx);browserWindow=vm.runInContext('window',ctx);
  vm.runInContext(readFileSync(new URL('../content/yt-bridge.js',import.meta.url),'utf8'),ctx);
  events.get('message').forEach(fn=>fn({source:browserWindow,origin:location.origin,data:{source:'recall-main',type:'video',video:{videoId:'aaaaaaaaaaa',title:'Test',audioLanguage:language}}}));
  const initial=attempt?new Promise(resolve=>listener({type:'index-now'},{},resolve)):Promise.resolve();
  if(!holdFailure)await initial;await tick();
  const notify=data=>events.get('message').forEach(fn=>fn({source:browserWindow,origin:location.origin,data:{source:'recall-main',...data}}));
  return {messages,media,async finishFailure(){releaseTranscript();await initial;await tick();await tick();},pauseSaving(){enabled=false;},reset(){notify({type:'video-reset'});},async ready(videoId='aaaaaaaaaaa'){available=true;notify({type:'captions-ready',videoId});await tick();await tick();},async play(){media.paused=false;events.get('playing').forEach(fn=>fn());await tick()}};
}
test('caption failure automatically starts speech for a normal playing video',async()=>{
  const f=await fixture();assert.equal(f.messages.filter(m=>m.type==='speech-auto-start').length,1);assert.equal(f.messages.find(msg=>msg.type==='index-failed').title,'Test');
});
test('successful captions avoid loading the speech model',async()=>{
  const f=await fixture({captions:true});assert.equal(f.messages.some(m=>m.type==='speech-auto-start'),false);
  assert.equal(f.messages.some(m=>m.type==='index-video'),true);
});
test('a caption failure while paused defers speech until playback, without another recording action',async()=>{
  const f=await fixture({paused:true});assert.equal(f.messages.some(m=>m.type==='speech-auto-start'),false);
  await f.play();await f.play();assert.equal(f.messages.filter(m=>m.type==='speech-auto-start').length,1);
});

test('known non-English videos never start the English-only fallback',async()=>{
 const f=await fixture({language:'es'});await f.play();assert.equal(f.messages.some(row=>row.type==='speech-auto-start'),false);
 const english=await fixture({language:'en-GB'});assert.equal(english.messages.some(row=>row.type==='speech-auto-start'),true);
});

test('undetermined language uses the automatic English fallback without a popup action',async()=>{
 const f=await fixture({language:'und'});assert.equal(f.messages.filter(msg=>msg.type==='speech-auto-start').length,1);
});

test('late captions upgrade a failed capture once without requiring another search',async()=>{
 const f=await fixture({paused:true});assert.equal(f.messages.some(row=>row.type==='index-video'),false);
 await f.ready();await f.ready();
 assert.equal(f.messages.filter(row=>row.type==='index-video').length,1);
 await f.play();assert.equal(f.messages.some(row=>row.type==='speech-auto-start'),false,'late captions cancel deferred speech fallback');
});
test('late captions cannot save after capture is paused or the video changes',async()=>{
 for(const action of ['pauseSaving','reset']){const f=await fixture({paused:true});f[action]();await f.ready();assert.equal(f.messages.some(row=>row.type==='index-video'),false,action);}
 const other=await fixture({paused:true});await other.ready('bbbbbbbbbbb');assert.equal(other.messages.some(row=>row.type==='index-video'),false);
});
test('late caption notifications do not repeat a successful caption save',async()=>{
 const f=await fixture({captions:true});await f.ready();assert.equal(f.messages.filter(row=>row.type==='index-video').length,1);
});
test('caption availability does not bypass the watch delay or accept an invalid video identity',async()=>{
 const f=await fixture({attempt:false});await f.ready();await f.ready(null);await f.ready({});assert.equal(f.messages.some(row=>row.type==='index-video'),false);
});
test('caption availability during a failing request retries only after it settles',async()=>{
 const f=await fixture({paused:true,holdFailure:true});await f.ready();assert.equal(f.messages.some(row=>row.type==='index-video'),false);
 await f.finishFailure();assert.equal(f.messages.filter(row=>row.type==='index-video').length,1);
});
test('navigation while a late-caption retry waits cancels the retry',async()=>{
 const f=await fixture({paused:true,holdFailure:true});await f.ready();f.reset();await f.finishFailure();assert.equal(f.messages.some(row=>row.type==='index-video'),false);
});
