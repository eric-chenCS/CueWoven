import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture({forced=false,paused=false,captions=false}={}) {
  const messages=[],events=new Map(),media={paused,currentTime:100,playbackRate:1};let listener, browserWindow;
  const location=new URL(`https://www.youtube.com/watch?v=aaaaaaaaaaa${forced?'&recall_index=1':''}`);
  const add=(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn)};
  const ctx={URLSearchParams,location,Date,
    setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer},clearTimeout,
    document:{hidden:false,querySelector:selector=>selector==='video'?media:null,addEventListener:add,removeEventListener(){}},
    chrome:{storage:{local:{get:async()=>({settings:{enabled:true,dwellSeconds:3600}})}},runtime:{
      onMessage:{addListener:fn=>listener=fn},sendMessage:async msg=>{messages.push(msg);return msg.type==='should-index'?{index:true}:{ok:true}},
    }},addEventListener:add,
    postMessage(msg){if(msg.type==='getTranscript')events.get('message').forEach(fn=>fn({source:browserWindow,origin:location.origin,data:{source:'recall-main',type:'transcript',reqId:msg.reqId,segments:captions?[{start:0,text:'caption'}]:[]}}))},
  };
  ctx.window=ctx;vm.createContext(ctx);browserWindow=vm.runInContext('window',ctx);
  vm.runInContext(readFileSync(new URL('../content/yt-bridge.js',import.meta.url),'utf8'),ctx);
  events.get('message').forEach(fn=>fn({source:browserWindow,origin:location.origin,data:{source:'recall-main',type:'video',video:{videoId:'aaaaaaaaaaa',title:'Test'}}}));
  await new Promise(resolve=>listener({type:'index-now'},{},resolve));await tick();
  return {messages,media,async play(){media.paused=false;events.get('playing').forEach(fn=>fn());await tick()}};
}
test('caption failure automatically starts speech for a normal playing video',async()=>{
  const f=await fixture();assert.equal(f.messages.filter(m=>m.type==='speech-auto-start').length,1);
});
test('successful captions avoid loading the speech model',async()=>{
  const f=await fixture({captions:true});assert.equal(f.messages.some(m=>m.type==='speech-auto-start'),false);
  assert.equal(f.messages.some(m=>m.type==='index-video'),true);
});
test('history capture tabs never fall back to speech',async()=>{
  const f=await fixture({forced:true});assert.equal(f.messages.some(m=>m.type==='speech-auto-start'),false);
});
test('a caption failure while paused defers speech until playback, without another recording action',async()=>{
  const f=await fixture({paused:true});assert.equal(f.messages.some(m=>m.type==='speech-auto-start'),false);
  await f.play();await f.play();assert.equal(f.messages.filter(m=>m.type==='speech-auto-start').length,1);
});
